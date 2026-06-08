// @ts-check
// Puzzle heuristic — execute set-piece actions on owned nodes.
// Generic: proposes any available action that isn't in the bot's known set.
// Covers activate, scan-lock, crack-vault, unlock-vault, extract-token, etc.
// Each action is proposed at most once per node per run.

/** @typedef {import('../types.js').WorldModel} WorldModel */
/** @typedef {import('../types.js').ScoredAction} ScoredAction */

import { A } from "../../../js/core/action-ids.js";

const STRATEGY = "puzzle";
const BASE_PUZZLE = 60;

/** Actions the bot already handles via other heuristics */
const KNOWN_ACTIONS = new Set([
  A.PROBE, A.XPLOIT, A.DUMP, A.FETCH, A.REBOOT,
  A.TARGET, A.UNTARGET, A.JACKOUT, A.CORRUPT, A.CANCEL_TRACE,
  A.ABORT, A.EJECT, A.ACCESS_DARKNET,
  A.MINE, // handled by mineStrategy (card-blocked fallback) — not a proactive puzzle action
]);

/** Track "nodeId:actionId" pairs we've already proposed to avoid loops */
const completed = new Set();

/** Reset tracking between runs */
export function resetPuzzleTracking() { completed.clear(); }

/**
 * @param {WorldModel} world
 * @returns {ScoredAction[]}
 */
export function puzzleStrategy(world) {
  /** @type {ScoredAction[]} */
  const proposals = [];

  for (const nodeId of world.owned) {
    const actions = world.availableActions.get(nodeId) ?? [];
    for (const action of actions) {
      if (KNOWN_ACTIONS.has(action.id)) continue;
      if (action.id.startsWith("disarm")) continue; // handled by traps heuristic
      if (action.id.startsWith("cancel")) continue;

      const key = `${nodeId}:${action.id}`;
      if (completed.has(key)) continue;
      completed.add(key);

      proposals.push({
        action: action.id,
        nodeId,
        score: BASE_PUZZLE,
        reason: `puzzle: ${action.label} on ${nodeId}`,
        strategy: STRATEGY,
      });
    }
  }

  return proposals;
}
