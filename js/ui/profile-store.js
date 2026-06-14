// @ts-check
// Browser binding for the persistent player profile: localStorage load/save and
// new-profile bootstrap. The pure model lives in js/core/profile.
//
// (Phase 2 adds launchRun + the RUN_ENDED commit subscriber to this module.)

import {
  createProfile,
  addCardToInventory,
  buildRunHand,
  commitRun,
  withdraw,
  findCard,
  PROFILE_VERSION,
} from "../core/profile/index.js";
import { generateStartingHand } from "../core/exploits.js";
import { on, E } from "../core/events.js";
import { getState } from "../core/state.js";

/** @typedef {import('../core/types.js').StarnetProfile} StarnetProfile */

const PROFILE_KEY = "starnet:profile";
const DEFAULT_BANK = 1000; // matches initGame's startCash fallback

/**
 * Load the profile from localStorage, or bootstrap a new one if absent/corrupt.
 * @returns {StarnetProfile}
 */
export function loadProfile() {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return normalizeProfile(parsed);
    } catch {
      // unparseable payload — fall through and re-bootstrap
    }
  }
  return bootstrapProfile();
}

/**
 * Repair a parsed profile to the current shape, filling missing/invalid fields so
 * an older or partially-written payload can't crash the hub downstream. Mutates
 * and returns the object.
 * @param {any} p
 * @returns {StarnetProfile}
 */
function normalizeProfile(p) {
  if (typeof p.bank !== "number") p.bank = 0;
  if (!Array.isArray(p.inventory)) p.inventory = [];
  if (typeof p._hubVisits !== "number") p._hubVisits = 0;
  if (typeof p.version !== "number") p.version = PROFILE_VERSION;
  // Derive _instanceSeq above any existing inv-N id so future auto-ids don't collide.
  let seq = typeof p._instanceSeq === "number" ? p._instanceSeq : 0;
  for (const c of p.inventory) {
    const m = c && typeof c.instanceId === "string" ? /^inv-(\d+)$/.exec(c.instanceId) : null;
    if (m) seq = Math.max(seq, Number(m[1]) + 1);
  }
  p._instanceSeq = seq;
  return p;
}

/**
 * Persist the profile to localStorage.
 * @param {StarnetProfile} profile
 */
export function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

/**
 * Create and persist a starter profile: a default bank plus a generated starter
 * inventory (each card banked so it gets an instanceId).
 * @returns {StarnetProfile}
 */
function bootstrapProfile() {
  const p = createProfile({ bank: DEFAULT_BANK });
  generateStartingHand().forEach((c) => addCardToInventory(p, c));
  saveProfile(p);
  return p;
}

// ── Run launch + commit ──────────────────────────────────────────────────────

/** @type {{ carriedInstanceIds: string[] } | null} Carried set for the in-flight run. */
let activeRun = null;

/**
 * Prepare an ephemeral fast-start launch: a freshly generated starter hand that is
 * neither drawn from nor committed back to the profile. Clears any active run so the
 * RUN_ENDED commit subscriber no-ops — fast-start sessions are throwaway tests and must
 * not deposit cash, keep cards, or burn a loadout. Always succeeds (no bank/inventory
 * dependency), so the player lands in a playable LAN regardless of profile state.
 * @param {number} maxCards - cap the dealt hand to the normal loadout size
 * @returns {{ startHandCards: import('../core/types.js').ExploitCard[], startCash: number }}
 */
export function prepareFastStartLaunch(maxCards) {
  activeRun = null; // a fast-start run does not commit back to the profile
  const hand = generateStartingHand().slice(0, maxCards);
  return { startHandCards: buildRunHand(hand), startCash: 0 };
}

/**
 * Prepare a run launch from the profile: withdraw the carried cash, clone the
 * chosen loadout, and record the carried set so the run can be committed when it
 * ends. Returns the meta additions (startHandCards + startCash) for the caller to
 * merge into the network meta and start via startRun(); returns null if the bank
 * can't cover the carried cash. The DOM/graph side stays in the UI layer (hub.js).
 * @param {{ loadoutInstanceIds: string[], withdrawAmount: number }} args
 * @returns {{ startHandCards: import('../core/types.js').ExploitCard[], startCash: number } | null}
 */
export function prepareLaunch({ loadoutInstanceIds, withdrawAmount }) {
  const profile = loadProfile();
  if (!withdraw(profile, withdrawAmount)) return null;
  const loadout = loadoutInstanceIds
    .map((id) => findCard(profile, id))
    .filter(/** @returns {c is import('../core/types.js').ExploitCard} */ (c) => Boolean(c));
  saveProfile(profile); // bank debited at launch
  activeRun = { carriedInstanceIds: loadout.map((c) => /** @type {string} */ (c.instanceId)) };
  return { startHandCards: buildRunHand(loadout), startCash: withdrawAmount };
}

let _commitWired = false;

/**
 * Wire the run-end → profile commit (call once at app init). On RUN_ENDED:
 * success deposits run cash and writes card decay back; capture burns the carried
 * loadout. Reads the final cash/hand from live game state.
 */
export function initProfileRunCommit() {
  if (_commitWired) return;
  _commitWired = true;
  on(E.RUN_ENDED, ({ outcome }) => {
    if (!activeRun) return;
    const s = getState();
    const profile = loadProfile();
    commitRun(profile, {
      outcome,
      finalCash: s.player.cash, // already 0 on "caught" — endRun zeroes it
      finalHand: s.player.hand,
      carriedInstanceIds: activeRun.carriedInstanceIds,
    });
    saveProfile(profile);
    activeRun = null;
  });
}
