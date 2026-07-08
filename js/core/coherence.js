// @ts-check
// Coherence erosion math — chip() and rollDisclosure() pure functions.
// Part of the "exploit hoard + coherence auto-burn" combat rework (E1 Phase 1).
// No game-loop wiring — pure math only.

/** @typedef {import('./types.js').ExploitRound} ExploitRound */
/** @typedef {import('./types.js').NodeState} NodeState */

import { RNG, random } from "./rng.js";
import {
  CHIP_FACTOR,
  RARITY_PUNCH,
  TYPE_BITE,
  CHIP_JITTER,
  DISCLOSURE_CHANCE,
} from "./balance.js";

// ── Match predicate ───────────────────────────────────────────────────────────

/**
 * True if the round's type list intersects the node's currently-revealed
 * vulnerabilities (probed, not patched, not hidden).
 * Mirrors the semantics of exploits.js:matchingVulnIds but for ExploitRound.types.
 * @param {ExploitRound} round
 * @param {NodeState} node
 * @returns {boolean}
 */
function roundMatchesNode(round, node) {
  if (!node?.probed) return false;
  const knownVulnIds = (node.vulnerabilities ?? [])
    .filter((v) => !v.patched && !v.hidden)
    .map((v) => v.id);
  return round.types.some((t) => knownVulnIds.includes(t));
}

// ── Core formulas ─────────────────────────────────────────────────────────────

/**
 * Compute how many coherence points a single round chips from a node.
 *
 * Formula:
 *   CHIP_FACTOR[grade] * RARITY_PUNCH[rarity] * (1 + (match ? TYPE_BITE : 0)) * jitterFactor
 *
 * where jitterFactor is 1 +/- CHIP_JITTER drawn from RNG.COMBAT when rollJitter is true,
 * otherwise exactly 1.
 *
 * @param {ExploitRound} round
 * @param {NodeState} node
 * @param {boolean} [rollJitter] - set false in tests for deterministic assertions
 * @returns {number} positive chip value
 */
export function chip(round, node, rollJitter = true) {
  const grade = node.grade ?? "C";
  const match = roundMatchesNode(round, node);
  const baseFactor = (CHIP_FACTOR[grade] ?? CHIP_FACTOR["C"]) *
                     (RARITY_PUNCH[round.rarity] ?? 1) *
                     (1 + (match ? TYPE_BITE : 0));

  let jitterFactor = 1;
  if (rollJitter) {
    // Map [0,1) to [1-CHIP_JITTER, 1+CHIP_JITTER]
    jitterFactor = 1 + (random(RNG.COMBAT) * 2 - 1) * CHIP_JITTER;
  }

  return baseFactor * jitterFactor;
}

/**
 * Roll whether a round becomes disclosed (its pattern exposed) after use.
 * Reuses the existing DISCLOSURE_CHANCE table from balance.js — higher-grade
 * nodes are more likely to finger the round's type signature.
 *
 * @param {string} grade
 * @returns {boolean}
 */
export function rollDisclosure(grade) {
  return random(RNG.COMBAT) <= (DISCLOSURE_CHANCE[grade] ?? 0);
}
