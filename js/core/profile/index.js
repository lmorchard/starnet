// @ts-check
// Persistent cross-run player profile — pure data model.
//
// This lives OUTSIDE GameState (which is strictly single-run and wiped by
// resetGame between runs). The profile holds what carries across runs: a cash
// bank and an exploit-card inventory. Functions here are pure in the sense that
// they operate on a profile object passed in — no module-level singleton, no
// event emission, no DOM. The localStorage binding lives in js/ui/profile-store.js.

/** @typedef {import('../types.js').StarnetProfile} StarnetProfile */
/** @typedef {import('../types.js').ExploitCard} ExploitCard */

export const PROFILE_VERSION = 1;

export { generateTargets } from "./targets.js";

/**
 * Create a fresh profile. Any seed `inventory` cards are added via
 * addCardToInventory so they receive stable instanceIds.
 * @param {{ bank?: number, inventory?: ExploitCard[] }} [opts]
 * @returns {StarnetProfile}
 */
export function createProfile({ bank = 0, inventory = [] } = {}) {
  /** @type {StarnetProfile} */
  const p = { version: PROFILE_VERSION, bank, inventory: [], _instanceSeq: 0, _hubVisits: 0 };
  inventory.forEach((c) => addCardToInventory(p, c));
  return p;
}

/**
 * Push a card into inventory, assigning a profile-unique instanceId if it lacks
 * one. The instanceId is what lets specific cards be written back or burned.
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
 * @param {StarnetProfile} profile
 * @param {string} instanceId
 * @returns {ExploitCard|undefined}
 */
export function findCard(profile, instanceId) {
  return profile.inventory.find((c) => c.instanceId === instanceId);
}

/**
 * Remove inventory cards whose instanceId is in the given list.
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
 * Discard all disclosed (burned-out, unplayable) exploits from inventory.
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
 * Clone loadout cards for use as a run hand. Cloning means in-run decay mutates
 * the run copy, not the inventory object; the instanceId is preserved so the
 * decayed state can be written back on commit.
 * @param {ExploitCard[]} loadoutCards
 * @returns {ExploitCard[]}
 */
export function buildRunHand(loadoutCards) {
  return loadoutCards.map((c) => ({ ...c, targetVulnTypes: [...c.targetVulnTypes] }));
}

/**
 * Commit a finished run back into the profile.
 * - success: deposit run cash (carried leftover + loot); for each final-hand card,
 *   write decay back to its inventory instance (matched by instanceId), or — if it
 *   has no instanceId (a card bought/mined mid-run) — add it to inventory.
 * - caught (Medium stakes): burn the carried loadout (remove by instanceId). Run
 *   cash is already forfeit upstream (endRun zeroes it), so nothing is deposited.
 * @param {StarnetProfile} profile
 * @param {{
 *   outcome: import('../types.js').RunOutcome,
 *   finalCash: number,
 *   finalHand: ExploitCard[],
 *   carriedInstanceIds: string[],
 * }} run
 * @returns {StarnetProfile}
 */
export function commitRun(profile, { outcome, finalCash, finalHand, carriedInstanceIds }) {
  if (outcome === "caught") {
    removeCardsByInstanceId(profile, carriedInstanceIds);
    return profile;
  }
  deposit(profile, finalCash);
  for (const card of finalHand) {
    const existing = card.instanceId ? findCard(profile, card.instanceId) : null;
    if (existing) {
      existing.usesRemaining = card.usesRemaining;
      existing.decayState = card.decayState;
    } else {
      addCardToInventory(profile, card);
    }
  }
  return profile;
}
