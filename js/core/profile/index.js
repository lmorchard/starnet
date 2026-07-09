// @ts-check
// Persistent cross-run player profile — pure data model.
//
// This lives OUTSIDE GameState (which is strictly single-run and wiped by
// resetGame between runs). The profile holds what carries across runs: a cash
// bank and a carry-all exploit-round `hoard`. Functions here are pure in the sense
// that they operate on a profile object passed in — no module-level singleton, no
// event emission, no DOM. The localStorage binding lives in js/ui/profile-store.js.
//
// E1 hoard cutover (Phase 5): the persistent store is now `hoard: ExploitRound[]`
// (the ENTIRE hoard is carried into every run — no loadout, no equip). The older
// card `inventory` + its helpers were removed in the Phase 9 sweep once every
// consumer had been repointed to the hoard.
// E2 Phase 1: added `gear: string[]` (owned gear ids) to the profile.

/** @typedef {import('../types.js').StarnetProfile} StarnetProfile */
/** @typedef {import('../types.js').ExploitRound} ExploitRound */

import { ALL_GEAR_IDS } from "../gear.js";

export const PROFILE_VERSION = 3;

export { generateTargets } from "./targets.js";

/**
 * Create a fresh profile with a persistent carry-all `hoard` and an empty `gear`
 * list. The hoard is copied in as-is (rounds carry their own unique hex ids).
 * @param {{ bank?: number, hoard?: ExploitRound[], gear?: string[] }} [opts]
 * @returns {StarnetProfile}
 */
export function createProfile({ bank = 0, hoard = [], gear = [] } = {}) {
  /** @type {StarnetProfile} */
  return { version: PROFILE_VERSION, bank, hoard: [...hoard], gear: [...gear], _hubVisits: 0 };
}

// ── Gear ownership helpers (E2 Phase 1) ──────────────────────────────────────

/**
 * Add a gear item to the profile's owned gear list.
 * No-ops (returns false) if the id is unknown or already owned.
 * @param {StarnetProfile} profile
 * @param {string} id
 * @returns {boolean} true if the gear was newly added
 */
export function addGear(profile, id) {
  if (!ALL_GEAR_IDS.includes(id)) return false;
  if (profile.gear.includes(id)) return false;
  profile.gear.push(id);
  return true;
}

/**
 * Check whether the player owns a given gear item.
 * @param {StarnetProfile} profile
 * @param {string} id
 * @returns {boolean}
 */
export function hasGear(profile, id) {
  return Array.isArray(profile.gear) && profile.gear.includes(id);
}

// ── Hoard (carry-all persistent ammunition) ──────────────────────────────────

/**
 * Push an ExploitRound onto the persistent hoard. No instanceId ceremony —
 * rounds carry their own unique hex ids.
 * @param {StarnetProfile} profile
 * @param {ExploitRound} round
 * @returns {ExploitRound}
 */
export function addRoundToHoard(profile, round) {
  profile.hoard.push(round);
  return round;
}

/**
 * Discard all disclosed (pattern-exposed, spent) rounds from the hoard.
 * @param {StarnetProfile} profile
 * @returns {ExploitRound[]} the removed rounds
 */
export function removeDisclosedRounds(profile) {
  const removed = profile.hoard.filter((r) => r.disclosed);
  profile.hoard = profile.hoard.filter((r) => !r.disclosed);
  return removed;
}

/**
 * Clone the whole hoard for a run. Cloning means in-run disclosure/burn mutates the
 * run copy, not the stored objects, until commit writes the final hoard back.
 * @param {ExploitRound[]} rounds
 * @returns {ExploitRound[]}
 */
export function buildRunHoard(rounds) {
  return rounds.map((r) => ({ ...r, types: [...r.types] }));
}

/**
 * Credit the bank.
 * @param {StarnetProfile} profile
 * @param {number} amount
 * @returns {StarnetProfile}
 */
export function deposit(profile, amount) {
  profile.bank += amount;
  return profile;
}

/**
 * Debit the bank if sufficient funds. Refuses negative amounts.
 * @param {StarnetProfile} profile
 * @param {number} amount
 * @returns {boolean} true if the debit succeeded
 */
export function withdraw(profile, amount) {
  if (amount < 0 || profile.bank < amount) return false;
  profile.bank -= amount;
  return true;
}

/**
 * Commit a finished run back into the profile (hoard model).
 * - success (clean): deposit run cash and persist the final carried hoard. Rounds
 *   disclosed/burned during the run are simply absent from `finalHoard`.
 * - caught: keep the hoard unchanged — E1 has no hoard loss (the ante is deferred).
 *   Run cash is already forfeit upstream (endRun zeroes it), so nothing is deposited.
 * @param {StarnetProfile} profile
 * @param {{
 *   outcome: import('../types.js').RunOutcome,
 *   finalCash: number,
 *   finalHoard: ExploitRound[],
 * }} run
 * @returns {StarnetProfile}
 */
export function commitRun(profile, { outcome, finalCash, finalHoard }) {
  if (outcome === "caught") return profile; // E1: no hoard loss; run cash already forfeit
  deposit(profile, finalCash);
  profile.hoard = finalHoard; // persist the carried hoard (burns already applied)
  return profile;
}
