// @ts-nocheck — DOM wiring.
// Overworld hub controller. Holds the in-progress launch selection (loadout +
// carried cash) in module scope so BOTH input channels — the <starnet-hub> GUI
// component and the console hub commands — drive the same state and produce the
// same log output (the GUI/console symmetry principle). The pure profile model is
// in js/core/profile; the run-start path is run-control.js.

import { loadProfile, saveProfile, prepareLaunch, prepareFastStartLaunch } from "./profile-store.js";
import { generateTargets, removeDisclosedCards } from "../core/profile/index.js";
import { buyFromStoreToProfile } from "../core/store-logic.js";
import { getStoreCatalog } from "../core/exploits.js";
import { startRun } from "./run-control.js";
import { buildNetwork as buildGenerated } from "../../data/networks/generated.js";
import { NAMED_NETWORKS } from "../../data/networks/index.js";
import { emitEvent, E } from "../core/events.js";

const MAX_LOADOUT = 5;

/** @type {{ loadoutIds: string[], withdrawAmount: number }} */
let selection = { loadoutIds: [], withdrawAmount: 0 };
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

/** Push current profile + selection into the component for rendering. */
function refresh() {
  const el = hubEl();
  if (!el) return;
  const p = loadProfile();
  el.bank = p.bank;
  el.inventory = p.inventory;
  el.loadout = [...selection.loadoutIds];
  el.withdrawAmount = selection.withdrawAmount;
  el.targets = targets;
}

/** Attach component → controller event wiring once, at app init. */
export function initHub() {
  const el = hubEl();
  if (!el) return;
  el.addEventListener("loadout-toggle", (e) => toggleCard(e.detail.instanceId));
  el.addEventListener("withdraw-change", (e) => setWithdraw(e.detail.amount));
  el.addEventListener("launch", (e) => launchTarget(e.detail.targetId));
  el.addEventListener("discard-disclosed", () => discardDisclosed());
  el.addEventListener("visit-darknet", () => openHubDarknet());
  el.addEventListener("close", () => { el.open = false; });
}

/** Show the hub and sync it, without disturbing the in-progress selection or targets. */
function showHub() {
  const el = hubEl();
  if (!el) return;
  refresh();
  el.open = true;
}

/**
 * Canned "hub start" for fast-start scenarios (e.g. a `?network=` deep-link): deal a fresh
 * generated starter hand and launch directly into the given prebuilt network, skipping the
 * overworld hub entirely. Fast-start is a throwaway test session — the hand is ephemeral
 * (not drawn from the profile) and the run does NOT commit back (no cash, no kept/burned
 * cards), so it always lands in a playable LAN regardless of profile state.
 * @param {{ graphDef: any, meta: any }} networkResult
 * @returns {boolean} always true (a run is always launched); the boolean preserves the
 *   caller's `quickStartRun(...) || openHub()` contract.
 */
export function quickStartRun(networkResult) {
  const launchMeta = prepareFastStartLaunch(MAX_LOADOUT);
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
  selection = { loadoutIds: [], withdrawAmount: 0 };
  showHub();
  log(`[HUB] Overworld hub — bank ¥${p.bank.toLocaleString()}, ${p.inventory.length} exploits in inventory.`);
}

// ── Operations (shared by GUI events and console commands) ───────────────────

export function equipCard(instanceId) {
  const p = loadProfile();
  const card = p.inventory.find((c) => c.instanceId === instanceId);
  if (!card) { log(`[HUB] No such exploit: ${instanceId}`, "error"); return; }
  if (selection.loadoutIds.includes(instanceId)) return;
  if (selection.loadoutIds.length >= MAX_LOADOUT) {
    log(`[HUB] Loadout full (${MAX_LOADOUT}). Unequip something first.`, "error");
    return;
  }
  selection.loadoutIds.push(instanceId);
  log(`[HUB] Equipped ${card.name} (${selection.loadoutIds.length}/${MAX_LOADOUT}).`);
  refresh();
}

export function unequipCard(instanceId) {
  const before = selection.loadoutIds.length;
  selection.loadoutIds = selection.loadoutIds.filter((id) => id !== instanceId);
  if (selection.loadoutIds.length !== before) {
    log(`[HUB] Unequipped (${selection.loadoutIds.length}/${MAX_LOADOUT}).`);
    refresh();
  }
}

export function toggleCard(instanceId) {
  if (selection.loadoutIds.includes(instanceId)) unequipCard(instanceId);
  else equipCard(instanceId);
}

export function setWithdraw(amount) {
  const p = loadProfile();
  const clamped = Math.max(0, Math.min(Number(amount) || 0, p.bank));
  selection.withdrawAmount = clamped;
  log(`[HUB] Carrying ¥${clamped.toLocaleString()} into the run.`);
  refresh();
}

/** Start a run against the given target with the current loadout + carried cash. */
export function launchTarget(targetId) {
  const target = targets.find((t) => t.id === targetId);
  if (!target) { log(`[HUB] No such target: ${targetId}`, "error"); return; }
  const launchMeta = prepareLaunch({
    loadoutInstanceIds: selection.loadoutIds,
    withdrawAmount: selection.withdrawAmount,
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
  return { bank: p.bank, inventory: p.inventory, targets, selection };
}

/** Discard all disclosed (burned, unplayable) exploits from inventory. */
export function discardDisclosed() {
  const profile = loadProfile();
  const removed = removeDisclosedCards(profile);
  if (!removed.length) { log("[HUB] No disclosed exploits to discard."); return; }
  const removedIds = new Set(removed.map((c) => c.instanceId));
  selection.loadoutIds = selection.loadoutIds.filter((id) => !removedIds.has(id));
  saveProfile(profile);
  refresh();
  log(`[HUB] Discarded ${removed.length} disclosed exploit${removed.length === 1 ? "" : "s"}.`);
}

/** True when the player is at the hub (or its darknet store) rather than in a run. */
export function isHubContext() {
  return Boolean(hubEl()?.open) || hubStoreOpen;
}

/**
 * Open the darknet broker from the hub. Reuses the in-run store modal, but spends
 * bank cash and delivers to the persistent inventory. Hides the hub while shopping.
 */
export function openHubDarknet() {
  const storeEl = /** @type {any} */ (document.getElementById("darknet-store"));
  if (!storeEl || storeEl.open) return;
  hubStoreOpen = true;

  // Pop over the hub (left visible behind) and mark it as the overworld broker so
  // it reads distinctly from an in-run LAN session — see #darknet-store.from-hub.
  const profile = loadProfile();
  storeEl.classList.add("from-hub");
  storeEl.subtitle = "OVERWORLD — spending bank, delivering to inventory";
  storeEl.catalog = getStoreCatalog();
  storeEl.cash = profile.bank;
  storeEl.open = true;
  log("[DARKNET] Broker online — spending bank, delivering to inventory.");

  const onBuy = (evt) => {
    if (hubBuy(evt.detail.index)) {
      const p = loadProfile();
      storeEl.cash = p.bank;
      storeEl.catalog = getStoreCatalog();
    }
  };
  const onClose = () => {
    storeEl.open = false;
    storeEl.classList.remove("from-hub");
    storeEl.subtitle = "";
    storeEl.removeEventListener("buy", onBuy);
    storeEl.removeEventListener("close", onClose);
    hubStoreOpen = false;
    refresh(); // the hub stayed open behind; just sync the updated bank/inventory
  };
  storeEl.addEventListener("buy", onBuy);
  storeEl.addEventListener("close", onClose);
}

/** Buy an exploit from the broker into the persistent inventory (spends bank). */
export function hubBuy(indexOrVulnId) {
  const profile = loadProfile();
  const result = buyFromStoreToProfile(profile, indexOrVulnId);
  if (!result) { log("[DARKNET] Purchase failed — insufficient bank or unknown item.", "error"); return null; }
  saveProfile(profile);
  log(`[DARKNET] Bought ${result.card.name} for ¥${result.price.toLocaleString()} → inventory.`, "success");
  refresh();
  return result;
}

/** Console: list the broker catalog and bank balance (hub context). */
export function listHubCatalog() {
  const p = loadProfile();
  log("DARKNET BROKER (hub) — spending bank, buying to inventory");
  log(`Bank: ¥${p.bank.toLocaleString()}`);
  getStoreCatalog().forEach((item, i) => {
    const afford = p.bank >= item.price ? "" : "  [INSUFFICIENT BANK]";
    log(`  [${i + 1}] ${item.name}  [${item.rarity}]  ${item.vulnId}  ¥${item.price}${afford}`);
  });
  log("Use: buy <index>");
}
