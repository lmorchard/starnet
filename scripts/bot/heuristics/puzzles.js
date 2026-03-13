// @ts-check
// Puzzle heuristic — execute set-piece actions on owned nodes.
// Generic: proposes any available action that isn't in the bot's known set.
// Covers activate, scan-lock, crack-vault, unlock-vault, extract-token, etc.
// Each action is proposed at most once per node per run.

/** @typedef {import('../types.js').WorldModel} WorldModel */
/** @typedef {import('../types.js').ScoredAction} ScoredAction */

const STRATEGY = "puzzle";
const BASE_PUZZLE = 60;

/** Actions the bot already handles via other heuristics */
const KNOWN_ACTIONS = new Set([
  "probe", "exploit", "read", "loot", "reboot",
  "select", "deselect", "jackout", "reconfigure", "cancel-trace",
  "cancel-probe", "cancel-exploit", "cancel-read", "cancel-loot",
  "eject", "access-darknet",
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
