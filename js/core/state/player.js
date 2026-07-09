// @ts-check
// Pure player state mutations. No event emission, no orchestration.

import { mutate } from "./index.js";

/** Adds amount to state.player.cash. */
export function addCash(amount) {
  mutate((s) => {
    s.player.cash += amount;
  });
}

/** Sets state.player.cash to an absolute value. */
export function setCash(amount) {
  mutate((s) => {
    s.player.cash = amount;
  });
}

/** Captures a credential token (from a SNIFFed flow). De-dupes; ignores empty. */
export function addCapturedCredential(key) {
  mutate((s) => {
    if (key && !s.player.capturedCredentials.includes(key)) s.player.capturedCredentials.push(key);
  });
}

/** Marks the current mission as complete. */
export function setMissionComplete() {
  mutate((s) => {
    if (s.mission) s.mission.complete = true;
  });
}

/** Damages player health by amount. Clamps at 0. */
export function damagePlayerHealth(amount) {
  mutate((s) => {
    s.player.health.current = Math.max(0, s.player.health.current - amount);
  });
}

/** Damages player deck integrity by amount. Clamps at 0. */
export function damagePlayerDeck(amount) {
  mutate((s) => {
    s.player.deckIntegrity.current = Math.max(0, s.player.deckIntegrity.current - amount);
  });
}

/** Sets player health to an absolute value. Clamps at [0, max]. */
export function setPlayerHealth(value) {
  mutate((s) => {
    s.player.health.current = Math.min(s.player.health.max, Math.max(0, value));
  });
}

/** Sets player deck integrity to an absolute value. Clamps at [0, max]. */
export function setPlayerDeckIntegrity(value) {
  mutate((s) => {
    s.player.deckIntegrity.current = Math.min(s.player.deckIntegrity.max, Math.max(0, value));
  });
}

/** Pushes an ExploitRound to state.player.hoard. */
export function addRoundToHoard(round) {
  mutate((s) => { s.player.hoard.push(round); });
}

/** Replace player.hoard with the given array. Used by tests to set up known hoard state. */
export function setHoard(rounds) {
  mutate((s) => { s.player.hoard = rounds; });
}

/** Marks a round in state.player.hoard as disclosed (pattern exposed). */
export function markRoundDisclosed(roundId) {
  mutate((s) => {
    const r = s.player.hoard.find((r) => r.id === roundId);
    if (r) r.disclosed = true;
  });
}

/** Removes all disclosed rounds from state.player.hoard. */
export function removeDisclosedRounds() {
  mutate((s) => { s.player.hoard = s.player.hoard.filter((r) => !r.disclosed); });
}

/** Sets the player's equipped loadout (array of gear ids) for the current run. */
export function setLoadout(ids) {
  mutate((s) => { s.player.loadout = [...ids]; });
}
