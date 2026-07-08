// @ts-check
import { RNG, random } from "./rng.js";
import { generateRound } from "./hoard.js";

/** @typedef {import('./types.js').Grade} Grade */
/** @typedef {import('./types.js').ExploitRound} ExploitRound */

export const MINE_TAPOUT = 0.05;            // yield chance below this → vein tapped out
export const MINE_BASE  = { S: 0.95, A: 0.90, B: 0.85, C: 0.80, D: 0.70, F: 0.60 };
export const MINE_DECAY = { S: 0.85, A: 0.82, B: 0.78, C: 0.72, D: 0.65, F: 0.55 };

// Grade → rarity weights (roll via RNG.MINE). Tilts richer with grade.
export const MINE_RARITY = {
  S: [["common", 0.40], ["uncommon", 0.40], ["rare", 0.20]],
  A: [["common", 0.50], ["uncommon", 0.35], ["rare", 0.15]],
  B: [["common", 0.60], ["uncommon", 0.30], ["rare", 0.10]],
  C: [["common", 0.70], ["uncommon", 0.25], ["rare", 0.05]],
  D: [["common", 0.85], ["uncommon", 0.14], ["rare", 0.01]],
  F: [["common", 0.95], ["uncommon", 0.05], ["rare", 0.00]],
};

/** Yield chance for the (attempts+1)-th attempt, given prior attempt count. */
export function mineYieldChance(grade, attempts) {
  const base = MINE_BASE[grade] ?? MINE_BASE.D;
  const decay = MINE_DECAY[grade] ?? MINE_DECAY.D;
  return base * Math.pow(decay, attempts);
}

/** True if a node with this grade has tapped out after `attempts` attempts. */
export function isMineExhausted(grade, attempts) {
  return mineYieldChance(grade, attempts) < MINE_TAPOUT;
}

export function rollMineRarity(grade) {
  const table = MINE_RARITY[grade] ?? MINE_RARITY.D;
  let roll = random(RNG.MINE);
  for (const [rarity, weight] of table) { roll -= weight; if (roll <= 0) return rarity; }
  return "common";
}

/**
 * Generate a node-shaped ExploitRound from a node's own vulnerabilities, with
 * rarity rolled by node grade. Falls back to a fully random (grade-rarity) round
 * if the node has no usable (non-patched, non-hidden) vulns.
 * @param {import('./types.js').NodeState} node
 * @returns {ExploitRound}
 */
export function generateMinedRound(node) {
  const grade = node.grade ?? "D";
  const rarity = rollMineRarity(grade);
  const vulns = (node.vulnerabilities ?? []).filter((v) => !v.patched && !v.hidden);
  const types = vulns.length ? vulns.map((v) => v.id) : null;
  return generateRound(rarity, types);
}
