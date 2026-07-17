// @ts-check
// Bot entry point — initialize game, assemble strategies, run loop, return stats.

/** @typedef {import('./types.js').BotRunStats} BotRunStats */
/** @typedef {import('./types.js').Strategy} Strategy */

import { initHeadlessEngine, resetGame } from "../lib/headless-engine.js";
import { runLoop } from "./loop.js";
import { setLoadout } from "../../js/core/state/player.js";

// Default strategies
import { exploreStrategy } from "./heuristics/explore.js";
import { lootStrategy } from "./heuristics/loot.js";
import { securityStrategy } from "./heuristics/security.js";
import { trapsStrategy } from "./heuristics/traps.js";
import { evasionStrategy } from "./heuristics/evasion.js";
import { supplyStrategy } from "./heuristics/supply.js";
import { mineStrategy } from "./heuristics/mine.js";
import { puzzleStrategy, resetPuzzleTracking } from "./heuristics/puzzles.js";

/** @type {Strategy[]} */
const DEFAULT_STRATEGIES = [
  exploreStrategy,
  lootStrategy,
  securityStrategy,
  trapsStrategy,
  evasionStrategy,
  supplyStrategy,
  mineStrategy,
  puzzleStrategy,
];

let engineInitialized = false;

/**
 * Named loadout presets for census runs.
 * These equip the preset directly at run start — no buy-in required.
 * @type {Record<string, string[]>}
 */
export const LOADOUT_PRESETS = {
  bare:     [],
  analyzer: ["analyzer"],
  ghost:    ["dampener", "recon-rig"],
  smash:    ["analyzer", "recon-rig"],
};

/** Default loadout for single-bot-cli runs (sensible smart+quiet combo). */
export const DEFAULT_BOT_LOADOUT = ["analyzer", "dampener"];

/**
 * Run the bot against a network.
 *
 * @param {() => { graphDef: any, meta: any }} buildNetworkFn
 * @param {{ seed?: string, strategies?: Strategy[], tickBudget?: number, verbose?: boolean, loadout?: string[] }} [opts]
 * @returns {BotRunStats}
 */
export function runBot(buildNetworkFn, opts = {}) {
  if (!engineInitialized) {
    initHeadlessEngine();
    engineInitialized = true;
  }

  resetGame(buildNetworkFn, opts.seed);
  resetPuzzleTracking();

  // Equip the requested loadout (default: analyzer+dampener for single runs).
  // Census overrides this per-preset. bare=[] disables gear entirely.
  const loadout = opts.loadout ?? DEFAULT_BOT_LOADOUT;
  setLoadout(loadout);

  const strategies = opts.strategies ?? DEFAULT_STRATEGIES;
  return runLoop(strategies, {
    tickBudget: opts.tickBudget,
    verbose: opts.verbose,
  });
}
