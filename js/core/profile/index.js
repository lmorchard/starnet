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
// card `inventory` + its helpers (addCardToInventory/findCard/removeCardsByInstanceId/
// removeDisclosedCards/buildRunHand) are kept DEFINED-BUT-UNUSED as vestigial code:
// the in-run darknet store, MINE, and various card readers still reference them
// until Phases 6–8 repoint every consumer. The Phase 9 sweep deletes them.

/** @typedef {import('../types.js').StarnetProfile} StarnetProfile */
/** @typedef {import('../types.js').ExploitCard} ExploitCard */
/** @typedef {import('../types.js').ExploitRound} ExploitRound */

export const PROFILE_VERSION = 2;

export { generateTargets } from "./targets.js";

/**
 * Create a fresh profile with a persistent carry-all `hoard`. Any seed `inventory`
 * cards are still added via addCardToInventory (vestigial) so they receive stable
 * instanceIds; the hoard is copied in as-is (rounds carry their own hex ids).
 * @param {{ bank?: number, hoard?: ExploitRound[], inventory?: ExploitCard[] }} [opts]
 * @returns {StarnetProfile}
 */
export function createProfile({ bank = 0, hoard = [], inventory = [] } = {}) {
  /** @type {StarnetProfile} */
  const p = { version: PROFILE_VERSION, bank, hoard: [...hoard], inventory: [], _instanceSeq: 0, _hubVisits: 0 };
  inventory.forEach((c) => addCardToInventory(p, c));
  return p;
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
 * VESTIGIAL (Phase 9 sweep removes this). Push a card into inventory, assigning a
 * profile-unique instanceId if it lacks one. Still referenced by the in-run darknet
 * store (store-logic.js) until Phase 6 repoints it.
 * @param {StarnetProfile} profile
 * @param {ExploitCard} card
 * @returns {ExploitCard}
 */
export function addCardToInventory(profile, card) {
  if (!card.instanceId) {
    card.instanceId = `inv-${profile._instanceSeq++}`;
  } else {
    // Preserve an explicit id, but keep _instanceSeq above any inv-N so a future
    // auto-assigned id can't collide with it.
    const m = /^inv-(\d+)$/.exec(card.instanceId);
    if (m) profile._instanceSeq = Math.max(profile._instanceSeq, Number(m[1]) + 1);
  }
  profile.inventory.push(card);
  return card;
}

/**
 * VESTIGIAL (Phase 9 sweep removes this).
 * @param {StarnetProfile} profile
 * @param {string} instanceId
 * @returns {ExploitCard|undefined}
 */
export function findCard(profile, instanceId) {
  return profile.inventory.find((c) => c.instanceId === instanceId);
}

/**
 * VESTIGIAL (Phase 9 sweep removes this). Remove inventory cards whose instanceId
 * is in the given list.
 * @param {StarnetProfile} profile
 * @param {string[]} instanceIds
 * @returns {ExploitCard[]} the removed cards
 */
export function removeCardsByInstanceId(profile, instanceIds) {
  const set = new Set(instanceIds);
  const removed = profile.inventory.filter((c) => set.has(c.instanceId));
  profile.inventory = profile.inventory.filter((c) => !set.has(c.instanceId));
  return removed;
}

/**
 * VESTIGIAL (Phase 9 sweep removes this). Discard all disclosed (burned-out,
 * unplayable) exploits from inventory. Superseded by removeDisclosedRounds.
 * @param {StarnetProfile} profile
 * @returns {ExploitCard[]} the removed cards
 */
export function removeDisclosedCards(profile) {
  const removed = profile.inventory.filter((c) => c.decayState === "disclosed");
  profile.inventory = profile.inventory.filter((c) => c.decayState !== "disclosed");
  return removed;
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
 * VESTIGIAL (Phase 9 sweep removes this). Clone loadout cards for use as a run hand.
 * Superseded by buildRunHoard; kept until the fast-start/card path is repointed.
 * @param {ExploitCard[]} loadoutCards
 * @returns {ExploitCard[]}
 */
export function buildRunHand(loadoutCards) {
  return loadoutCards.map((c) => ({ ...c, targetVulnTypes: [...c.targetVulnTypes] }));
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
