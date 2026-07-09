// @ts-check
// Round-selection seam for the auto-burn process.
//
// E1 ships ONE strategy: blind/random spray (no gear, no de-blur).
// E2-P2 adds "best-match": matched rounds first, then by rarity punch (deterministic).
// params.selection (stamped by startAutoBurn from resolveLoadoutEffects) controls the branch.

/** @typedef {import('./types.js').ExploitRound} ExploitRound */
/** @typedef {import('./types.js').NodeState} NodeState */

import { RNG, randomPick } from "./rng.js";
import { roundMatchesNode } from "./coherence.js";
import { RARITY_PUNCH } from "./balance.js";

/**
 * Pick the next round to burn from the hoard.
 *
 * Strategies:
 *   "best-match" (Analyzer gear): sort usable rounds by match-first, then rarity-punch descending.
 *                                  Deterministic — no RNG consumed.
 *   "blind" / undefined:          random pick from all usable rounds (E1 baseline, unchanged).
 *
 * @param {ExploitRound[]} hoard
 * @param {NodeState} node
 * @param {object}    params - process record; reads params.selection
 * @returns {ExploitRound | null}
 */
export function nextRound(hoard, node, params) {
  const usable = hoard.filter((r) => !r.disclosed);
  if (usable.length === 0) return null;

  if (params?.selection === "best-match") {
    // Primary: matched rounds first (1 vs 0); tiebreak: RARITY_PUNCH descending.
    // Stable because we pick the first element after sort (Array.sort is stable in V8/Node 18+).
    const sorted = [...usable].sort((a, b) => {
      const matchA = roundMatchesNode(a, node) ? 1 : 0;
      const matchB = roundMatchesNode(b, node) ? 1 : 0;
      if (matchB !== matchA) return matchB - matchA; // matched first
      const punchA = RARITY_PUNCH[a.rarity] ?? 1;
      const punchB = RARITY_PUNCH[b.rarity] ?? 1;
      return punchB - punchA; // higher punch first
    });
    return sorted[0];
  }

  // Default / "blind": random spray — type/rarity-blind by design (E1 baseline).
  return randomPick(RNG.COMBAT, usable);
}
