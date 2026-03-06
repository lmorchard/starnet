// @ts-check
// Traps heuristic — discover and use disarm actions on owned nodes.

/** @typedef {import('../types.js').WorldModel} WorldModel */
/** @typedef {import('../types.js').ScoredAction} ScoredAction */

const STRATEGY = "traps";
const BASE_DISARM = 65;

/**
 * @param {WorldModel} world
 * @returns {ScoredAction[]}
 */
export function trapsStrategy(world) {
  /** @type {ScoredAction[]} */
  const proposals = [];

  for (const nodeId of world.hasDisarmActions) {
    const actions = world.availableActions.get(nodeId) ?? [];
    for (const action of actions) {
      if (!action.id.startsWith("disarm")) continue;
      proposals.push({
        action: action.id,
        nodeId,
        score: BASE_DISARM,
        reason: `disarm trap: ${action.label ?? action.id}`,
        strategy: STRATEGY,
      });
    }
  }

  return proposals;
}
