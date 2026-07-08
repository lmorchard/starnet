// @ts-check
// Round-selection seam for the auto-burn process.
//
// E1 ships ONE strategy: blind/random spray (no gear, no de-blur).
// A future gear-driven "best-match-first" strategy and a manual burn-composition
// rung slot in here WITHOUT reworking the loop, the hoard, or the action.
// params.strategy is reserved but unused in E1.
// DO NOT branch on gear or add other strategies now — the seam is the entire
// forward-compat surface.

/** @typedef {import('./types.js').ExploitRound} ExploitRound */
/** @typedef {import('./types.js').NodeState} NodeState */

import { RNG, randomPick } from "./rng.js";

/**
 * Pick the next round to burn from the hoard.
 * E1: blind/random spray — type/rarity-blind by design (gear de-blurs later).
 *
 * @param {ExploitRound[]} hoard
 * @param {NodeState} _node  - reserved; unused in E1 (de-blurring needs gear)
 * @param {object}    _params - reserved; strategy hook (unused in E1)
 * @returns {ExploitRound | null}
 */
export function nextRound(hoard, _node, _params) {
  const usable = hoard.filter((r) => !r.disclosed);
  if (usable.length === 0) return null;
  return randomPick(RNG.COMBAT, usable); // blind spray; type/rarity-blind by design
}
