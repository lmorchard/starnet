// @ts-check
// Bot entry point — initialize game, assemble strategies, run loop, return stats.

/** @typedef {import('./types.js').BotRunStats} BotRunStats */
/** @typedef {import('./types.js').Strategy} Strategy */

import { initHeadlessEngine, resetGame } from "../lib/headless-engine.js";
import { runLoop } from "./loop.js";

// Default strategies
import { exploreStrategy } from "./heuristics/explore.js";
import { lootStrategy } from "./heuristics/loot.js";
import { securityStrategy } from "./heuristics/security.js";
import { trapsStrategy } from "./heuristics/traps.js";
import { evasionStrategy } from "./heuristics/evasion.js";
import { cardsStrategy } from "./heuristics/cards.js";

/** @type {Strategy[]} */
const DEFAULT_STRATEGIES = [
  exploreStrategy,
  lootStrategy,
  securityStrategy,
  trapsStrategy,
  evasionStrategy,
  cardsStrategy,
];

let engineInitialized = false;

/**
 * Run the bot against a network.
 *
 * @param {() => { graphDef: any, meta: any }} buildNetworkFn
 * @param {{ seed?: string, strategies?: Strategy[], tickBudget?: number, verbose?: boolean }} [opts]
 * @returns {BotRunStats}
 */
export function runBot(buildNetworkFn, opts = {}) {
  if (!engineInitialized) {
    initHeadlessEngine();
    engineInitialized = true;
  }

  resetGame(buildNetworkFn, opts.seed);

  const strategies = opts.strategies ?? DEFAULT_STRATEGIES;
  return runLoop(strategies, {
    tickBudget: opts.tickBudget,
    verbose: opts.verbose,
  });
}
