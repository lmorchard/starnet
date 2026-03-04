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
