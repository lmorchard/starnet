// @ts-check
// Expandable registry of game signals exposed to Strudel songs. Each entry maps a signal NAME
// (referenced in a song, e.g. `progress`/`threat`) to a pure derive(state)->0..1 function.
//
// To expose a new game variable to music, add ONE entry here (and it appears in the preview tool
// automatically). Pure — no runtime/DOM. The browser-side bridge (js/audio/strudel/signal-bridge.js)
// installs each as a live Strudel signal and refreshes them on STATE_CHANGED.
import { deriveProgress, deriveThreat } from "./signals.js";

/** @typedef {import('../core/types.js').GameState} GameState */

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** @type {Record<string, (state: GameState) => number>} */
export const SIGNAL_REGISTRY = {
  progress: deriveProgress,
  threat: deriveThreat,
};

/** @returns {string[]} the registered signal names. */
export function signalNames() {
  return Object.keys(SIGNAL_REGISTRY);
}

/**
 * Compute every registered signal's value (0..1) from a game-state snapshot.
 * Returns 0 for each when state is missing.
 * @param {GameState|null|undefined} state
 * @returns {Record<string, number>}
 */
export function computeSignals(state) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const [name, derive] of Object.entries(SIGNAL_REGISTRY)) {
    out[name] = state ? clamp01(derive(state)) : 0;
  }
  return out;
}
