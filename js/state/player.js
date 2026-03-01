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

/** Pushes a card to state.player.hand. */
export function addCardToHand(card) {
  mutate((s) => {
    s.player.hand.push(card);
  });
}

/** Sets state.executingExploit (pass null to clear). */
export function setExecutingExploit(data) {
  mutate((s) => {
    s.executingExploit = data;
  });
}

/** Increments state.executingExploit.noiseTick. No-op if not executing. */
export function incrementNoiseTick() {
  mutate((s) => {
    if (s.executingExploit) s.executingExploit.noiseTick++;
  });
}

/** Sets state.activeProbe (pass null to clear). */
export function setActiveProbe(data) {
  mutate((s) => {
    s.activeProbe = data;
  });
}

/** Sets state.activeRead (pass null to clear). */
export function setActiveRead(data) {
  mutate((s) => {
    s.activeRead = data;
  });
}

/** Sets state.activeLoot (pass null to clear). */
export function setActiveLoot(data) {
  mutate((s) => {
    s.activeLoot = data;
  });
}

/** Marks the current mission as complete. */
export function setMissionComplete() {
  mutate((s) => {
    if (s.mission) s.mission.complete = true;
  });
}

/**
 * Apply card decay — updates usesRemaining and decayState on a card in hand.
 * @param {string} cardId
 * @param {number} usesRemaining
 * @param {import('../types.js').DecayState} decayState
 */
export function applyCardDecay(cardId, usesRemaining, decayState) {
  mutate((s) => {
    const card = s.player.hand.find((c) => c.id === cardId);
    if (card) {
      card.usesRemaining = usesRemaining;
      card.decayState = decayState;
    }
  });
}
