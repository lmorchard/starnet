// @ts-check
// Loot heuristic — read and loot owned nodes, prioritize mission target.

/** @typedef {import('../types.js').WorldModel} WorldModel */
/** @typedef {import('../types.js').ScoredAction} ScoredAction */

const STRATEGY = "loot";
const BASE_READ = 60;
const BASE_LOOT = 62;
const MISSION_BONUS = 20;
const DISTANCE_PENALTY = 3;

/**
 * @param {WorldModel} world
 * @returns {ScoredAction[]}
 */
export function lootStrategy(world) {
  /** @type {ScoredAction[]} */
  const proposals = [];

  for (const nodeId of world.lootable) {
    const node = world.nodes.get(nodeId);
    if (!node) continue;

    const distance = pathDistance(world, nodeId);
    const hasMissionTarget = world.mission.targetNodeId === nodeId;
    const missionBonus = hasMissionTarget ? MISSION_BONUS : 0;

    if (node.read === false) {
      // Needs reading first
      proposals.push({
        action: "read",
        nodeId,
        score: BASE_READ + missionBonus - (distance * DISTANCE_PENALTY),
        reason: `read owned node${hasMissionTarget ? " (MISSION TARGET)" : ""}`,
        strategy: STRATEGY,
      });
    } else if (node.looted === false && node.macguffins?.length > 0) {
      // Read but not looted
      proposals.push({
        action: "loot",
        nodeId,
        score: BASE_LOOT + missionBonus - (distance * DISTANCE_PENALTY),
        reason: `loot ${node.macguffins.length} item(s)${hasMissionTarget ? " (MISSION TARGET)" : ""}`,
        strategy: STRATEGY,
      });
    }
  }

  return proposals;
}

/**
 * @param {WorldModel} world
 * @param {string} nodeId
 * @returns {number}
 */
function pathDistance(world, nodeId) {
  const from = world.player.selectedNodeId;
  if (!from) return 0;
  const path = world.shortestPath(from, nodeId);
  return path ? path.length - 1 : 99;
}
