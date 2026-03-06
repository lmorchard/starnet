// @ts-check
// Scoring engine — collects proposals from all strategies, picks the winner.

/** @typedef {import('./types.js').WorldModel} WorldModel */
/** @typedef {import('./types.js').ScoredAction} ScoredAction */
/** @typedef {import('./types.js').Strategy} Strategy */

/**
 * Run all strategies against the world model and return the highest-scored action.
 * @param {WorldModel} world
 * @param {Strategy[]} strategies
 * @param {{ verbose?: boolean }} [opts]
 * @returns {ScoredAction|null}
 */
export function score(world, strategies, opts = {}) {
  /** @type {ScoredAction[]} */
  const proposals = [];

  for (const strategy of strategies) {
    const results = strategy(world);
    proposals.push(...results);
  }

  if (proposals.length === 0) return null;

  proposals.sort((a, b) => b.score - a.score);

  if (opts.verbose) {
    console.log(`[SCORING] ${proposals.length} proposals:`);
    for (const p of proposals.slice(0, 10)) {
      console.log(`  ${p.score.toFixed(0).padStart(5)} | ${p.action} ${p.nodeId ?? ""} | ${p.reason} [${p.strategy}]`);
    }
  }

  return proposals[0];
}
