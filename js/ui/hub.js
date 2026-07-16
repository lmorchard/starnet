// @ts-nocheck — DOM wiring.
// Overworld hub controller. Holds the in-progress launch selection (carried cash)
// in module scope so BOTH input channels — the <starnet-hub> GUI component and the
// console hub commands — drive the same state and produce the same log output (the
// GUI/console symmetry principle). The pure profile model is in js/core/profile;
// the run-start path is run-control.js.
//
// The ENTIRE persistent hoard is carried into every run (carry-all ammo, no
// per-run loadout of rounds). GEAR is different: the hub equips up to GEAR_SLOTS
// of the profile's owned gear into a loadout that rides into the run (player.loadout,
// which the auto-burn consumes). The hub darknet-store buys round packs into the
// hoard and gear into profile.gear (bank-funded).

import { loadProfile, saveProfile, prepareLaunch, prepareFastStartLaunch } from "./profile-store.js";
import { generateTargets, removeDisclosedRounds, hasGear } from "../core/profile/index.js";
import { buyFromStoreToProfile, buyGearToProfile } from "../core/store-logic.js";
import { getPackCatalog } from "../core/packs.js";
import { getGearCatalog, gearById } from "../core/gear.js";
import { GEAR_SLOTS } from "../core/balance.js";
import { startRun } from "./run-control.js";
import { buildNetwork as buildGenerated } from "../../data/networks/generated.js";
import { NAMED_NETWORKS } from "../../data/networks/index.js";
import { emitEvent, E } from "../core/events.js";

/** @type {{ withdrawAmount: number, loadoutGearIds: string[] }} */
let selection = { withdrawAmount: 0, loadoutGearIds: [] };
/** @type {import('../core/profile/targets.js').HubTarget[]} */
let targets = [];
/** True while the darknet store modal is open from the hub (for console context). */
let hubStoreOpen = false;

function hubEl() {
  return document.getElementById("overworld-hub");
}

function log(text, type = "meta") {
  emitEvent(E.LOG_ENTRY, { text, type });
}

/**
 * Summarize a hoard: total count + per-rarity counts.
 * @param {import('../core/types.js').ExploitRound[]} hoard
 * @returns {{ total: number, common: number, uncommon: number, rare: number, disclosed: number }}
 */
export function summarizeHoard(hoard = []) {
  const s = { total: hoard.length, common: 0, uncommon: 0, rare: 0, disclosed: 0 };
  for (const r of hoard) {
    if (r.rarity === "common" || r.rarity === "uncommon" || r.rarity === "rare") s[r.rarity]++;
    if (r.disclosed) s.disclosed++;
  }
  return s;
}

/** Push current profile + selection into the component for rendering. */
function refresh() {
  const el = hubEl();
  if (!el) return;
  const p = loadProfile();
  el.bank = p.bank;
  el.hoard = p.hoard;
  el.gear = p.gear;
  el.loadout = selection.loadoutGearIds;
  el.withdrawAmount = selection.withdrawAmount;
  el.targets = targets;
}

/** Attach component → controller event wiring once, at app init. */
export function initHub() {
  const el = hubEl();
  if (!el) return;
  el.addEventListener("withdraw-change", (e) => setWithdraw(e.detail.amount));
  el.addEventListener("launch", (e) => launchTarget(e.detail.targetId));
  el.addEventListener("discard-disclosed", () => discardDisclosed());
  el.addEventListener("visit-darknet", () => openHubDarknet());
  el.addEventListener("close", () => { el.open = false; });
  el.addEventListener("equip-gear", (e) => equipGear(e.detail.gearId));
  el.addEventListener("unequip-gear", (e) => unequipGear(e.detail.gearId));
}

/** Show the hub and sync it, without disturbing the in-progress selection or targets. */
function showHub() {
  const el = hubEl();
  if (!el) return;
  refresh();
  el.open = true;
}

/**
 * Canned "hub start" for fast-start scenarios (e.g. a `?network=` deep-link): seed a fresh
 * generated hoard and launch directly into the given prebuilt network, skipping the
 * overworld hub entirely. Fast-start is a throwaway test session — the hoard is ephemeral
 * (not drawn from the profile) and the run does NOT commit back (no cash, no hoard change),
 * so it always lands in a playable LAN regardless of profile state.
 * @param {{ graphDef: any, meta: any }} networkResult
 * @returns {boolean} always true (a run is always launched); the boolean preserves the
 *   caller's `quickStartRun(...) || openHub()` contract.
 */
export function quickStartRun(networkResult) {
  const launchMeta = prepareFastStartLaunch();
  log(`[HUB] Fast-start (overworld hub skipped) — ${networkResult.meta?.name ?? "network"}.`, "success");
  startRun({ graphDef: networkResult.graphDef, meta: { ...networkResult.meta, ...launchMeta } });
  return true;
}

/** Enter the hub fresh: roll a new target list, reset the selection, show it. */
export function openHub() {
  const p = loadProfile();
  p._hubVisits = (p._hubVisits ?? 0) + 1;
  saveProfile(p);
  targets = generateTargets(p);
  selection = { withdrawAmount: 0, loadoutGearIds: [] };
  showHub();
  log(`[HUB] Overworld hub — bank ¥${p.bank.toLocaleString()}, ${p.hoard.length} rounds in the hoard.`);
}

/**
 * Reset loadout selection to empty. TEST-ONLY helper — call in beforeEach so
 * each test starts with a clean loadout. In production, openHub() resets this.
 */
export function resetLoadoutSelection() {
  selection = { withdrawAmount: selection.withdrawAmount, loadoutGearIds: [] };
}

// ── Operations (shared by GUI events and console commands) ───────────────────

export function setWithdraw(amount) {
  const p = loadProfile();
  const clamped = Math.max(0, Math.min(Number(amount) || 0, p.bank));
  selection.withdrawAmount = clamped;
  log(`[HUB] Carrying ¥${clamped.toLocaleString()} into the run.`);
  refresh();
}

/**
 * Equip a gear item into the loadout selection (in-hub only, not persisted
 * until launch). Returns true on success, false on rejection.
 * Rejects: not owned, already equipped (dedupe), or cap exceeded.
 * @param {string} gearId
 * @returns {boolean}
 */
export function equipGear(gearId) {
  const g = gearById(gearId);
  if (!g) { log(`[HUB] Unknown gear: ${gearId}`, "error"); return false; }
  const p = loadProfile();
  if (!hasGear(p, gearId)) { log(`[HUB] Not owned: ${g.name}`, "error"); return false; }
  if (selection.loadoutGearIds.includes(gearId)) { log(`[HUB] ${g.name} already equipped.`); return false; }
  if (selection.loadoutGearIds.length >= GEAR_SLOTS) {
    log(`[HUB] Loadout full (${GEAR_SLOTS} slots). Unequip something first.`, "error");
    return false;
  }
  selection.loadoutGearIds = [...selection.loadoutGearIds, gearId];
  log(`[HUB] Equipped ${g.name} (${selection.loadoutGearIds.length}/${GEAR_SLOTS} slots).`);
  refresh();
  return true;
}

/**
 * Unequip a gear item from the loadout selection.
 * No-ops if the gear is not currently equipped.
 * @param {string} gearId
 */
export function unequipGear(gearId) {
  const g = gearById(gearId);
  const name = g ? g.name : gearId;
  if (!selection.loadoutGearIds.includes(gearId)) { return; }
  selection.loadoutGearIds = selection.loadoutGearIds.filter((id) => id !== gearId);
  log(`[HUB] Unequipped ${name} (${selection.loadoutGearIds.length}/${GEAR_SLOTS} slots).`);
  refresh();
}

/** Start a run against the given target carrying the whole hoard + carried cash + equipped loadout. */
export function launchTarget(targetId) {
  const target = targets.find((t) => t.id === targetId);
  if (!target) { log(`[HUB] No such target: ${targetId}`, "error"); return; }
  const launchMeta = prepareLaunch({
    withdrawAmount: selection.withdrawAmount,
    loadoutGearIds: selection.loadoutGearIds,
  });
  if (!launchMeta) { log("[HUB] Insufficient bank for that carry amount.", "error"); return; }
  // Authored jobs build a hand-crafted named network; procedural targets build from seed + spec (#261).
  let result;
  if (target.network) {
    const build = NAMED_NETWORKS[target.network];
    if (!build) { log(`[HUB] Unknown authored network: ${target.network}`, "error"); return; }
    result = build();
  } else {
    result = buildGenerated({ seed: target.seed, spec: target.spec });
  }
  const el = hubEl();
  if (el) el.open = false;
  log(`[HUB] Jacking into ${target.label}…`, "success");
  startRun({ graphDef: result.graphDef, meta: { ...result.meta, ...launchMeta } });
}

/** Read-only snapshot for console listing. */
export function getHub() {
  const p = loadProfile();
  return {
    bank: p.bank,
    hoard: p.hoard,
    gear: p.gear,
    loadout: selection.loadoutGearIds,
    targets,
    selection,
  };
}

/** Discard all disclosed (spent) rounds from the hoard. */
export function discardDisclosed() {
  const profile = loadProfile();
  const removed = removeDisclosedRounds(profile);
  if (!removed.length) { log("[HUB] No disclosed rounds to discard."); return; }
  saveProfile(profile);
  refresh();
  log(`[HUB] Discarded ${removed.length} disclosed round${removed.length === 1 ? "" : "s"}.`);
}

/** True when the player is at the hub (or its darknet store) rather than in a run. */
export function isHubContext() {
  return Boolean(hubEl()?.open) || hubStoreOpen;
}

/** Refresh the store modal's catalog and balance from current profile state. */
function refreshHubStore(storeEl) {
  const profile = loadProfile();
  storeEl.cash = profile.bank;
  storeEl.catalog = getPackCatalog();
  storeEl.gearCatalog = getGearCatalog(profile);
}

/**
 * Open the darknet broker from the hub. Reuses the in-run store modal, but spends
 * bank cash and delivers to the persistent inventory. Shows both packs and gear.
 */
export function openHubDarknet() {
  const storeEl = /** @type {any} */ (document.getElementById("darknet-store"));
  if (!storeEl || storeEl.open) return;
  hubStoreOpen = true;

  // Pop over the hub (left visible behind) and mark it as the overworld broker so
  // it reads distinctly from an in-run LAN session — see #darknet-store.from-hub.
  storeEl.classList.add("from-hub");
  storeEl.subtitle = "OVERWORLD — spending bank, stocking your profile (packs + gear)";
  refreshHubStore(storeEl);
  storeEl.open = true;
  log("[DARKNET] Broker online — spending bank; packs and gear delivered to your profile.");

  const onBuy = (evt) => {
    if (hubBuy(evt.detail.index)) {
      refreshHubStore(storeEl);
    }
  };
  const onBuyGear = (evt) => {
    if (hubBuyGear(evt.detail.gearId)) {
      refreshHubStore(storeEl);
    }
  };
  const onClose = () => {
    storeEl.open = false;
    storeEl.classList.remove("from-hub");
    storeEl.subtitle = "";
    storeEl.gearCatalog = [];
    storeEl.removeEventListener("buy", onBuy);
    storeEl.removeEventListener("buy-gear", onBuyGear);
    storeEl.removeEventListener("close", onClose);
    hubStoreOpen = false;
    refresh(); // the hub stayed open behind; just sync the updated bank/inventory
  };
  storeEl.addEventListener("buy", onBuy);
  storeEl.addEventListener("buy-gear", onBuyGear);
  storeEl.addEventListener("close", onClose);
}

/** Buy a research pack from the broker into the persistent hoard (spends bank). */
export function hubBuy(indexOrPackId) {
  const profile = loadProfile();
  const result = buyFromStoreToProfile(profile, indexOrPackId);
  if (!result) { log("[DARKNET] Purchase failed — insufficient bank or unknown pack.", "error"); return null; }
  saveProfile(profile);
  log(`[DARKNET] Bought ${result.pack.name} for ¥${result.price.toLocaleString()} → ${result.rounds.length} round(s) added to hoard.`, "success");
  refresh();
  return result;
}

/** Buy a gear item from the broker into the persistent profile (spends bank). Hub only. */
export function hubBuyGear(gearId) {
  const profile = loadProfile();
  const result = buyGearToProfile(profile, gearId);
  if (!result) {
    log("[DARKNET] Gear purchase failed — insufficient bank, already owned, or unknown item.", "error");
    return null;
  }
  saveProfile(profile);
  log(`[DARKNET] Acquired ${result.gear.name} for ¥${result.price.toLocaleString()} — added to gear.`, "success");
  refresh();
  return result;
}

/** Console: list the broker catalog and bank balance (hub context). */
export function listHubCatalog() {
  const p = loadProfile();
  log("DARKNET BROKER (hub) — spending bank, buying to hoard");
  log(`Bank: ¥${p.bank.toLocaleString()}`);
  getPackCatalog().forEach((item, i) => {
    const afford = p.bank >= item.price ? "" : "  [INSUFFICIENT BANK]";
    log(`  [${i + 1}] ${item.name}  [${item.size} rounds]  ¥${item.price}${afford}`);
  });
  log("GEAR");
  getGearCatalog(p).forEach((item) => {
    const owned = item.owned ? "  [OWNED]" : "";
    const afford = !item.owned && p.bank < item.price ? "  [INSUFFICIENT BANK]" : "";
    log(`  ${item.id}  ${item.name}  (${item.kind})  ¥${item.price}${owned}${afford}`);
  });
  log("Use: buy <index|packId|gearId>");
}
