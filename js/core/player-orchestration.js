// @ts-check
// Player orchestration — wrappers around state/player.js mutators that
// add caller-layer side effects (run-end on resource depletion).
//
// State submodules are pure data per the project convention. Damage and
// set-to-absolute mutators live there; the run-end consequence of hitting
// zero lives here. Effect atoms in js/core/ice/ ultimately call these
// wrappers (via action-context ctx) rather than the raw state setters.

import { endRun, getState } from "./state.js";
import {
  damagePlayerHealth as setDamageHealth,
  damagePlayerDeck   as setDamageDeck,
  setPlayerHealth        as setHealthRaw,
  setPlayerDeckIntegrity as setDeckRaw,
} from "./state/player.js";

function endRunIfDepleted(pool, outcome) {
  const s = getState();
  if (s.player[pool].current === 0 && s.phase === "playing") endRun(outcome);
}

/** Damages player health. Ends the run with 'burned' if it hits 0. */
export function damagePlayerHealth(amount) {
  setDamageHealth(amount);
  endRunIfDepleted("health", "burned");
}

/** Damages player deck integrity. Ends the run with 'bricked' if it hits 0. */
export function damagePlayerDeck(amount) {
  setDamageDeck(amount);
  endRunIfDepleted("deckIntegrity", "bricked");
}

/** Sets player health to an absolute value. Ends the run with 'burned' if it lands at 0. */
export function setPlayerHealth(value) {
  setHealthRaw(value);
  endRunIfDepleted("health", "burned");
}

/** Sets player deck integrity to an absolute value. Ends the run with 'bricked' if it lands at 0. */
export function setPlayerDeckIntegrity(value) {
  setDeckRaw(value);
  endRunIfDepleted("deckIntegrity", "bricked");
}
