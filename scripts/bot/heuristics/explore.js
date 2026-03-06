// @ts-check
// Explore heuristic — probe unprobed nodes, exploit probed ones.

/** @typedef {import('../types.js').WorldModel} WorldModel */
/** @typedef {import('../types.js').ScoredAction} ScoredAction */

const STRATEGY = "explore";
const BASE_SELECT_REVEALED = 42;
const BASE_PROBE = 50;
const BASE_EXPLOIT = 45;
const SELECTED_BONUS = 8;
const MISSION_BONUS = 10;
const DISTANCE_PENALTY = 5;

/**
 * @param {WorldModel} world
 * @returns {ScoredAction[]}
 */
export function exploreStrategy(world) {
  /** @type {ScoredAction[]} */
  const proposals = [];

  // Propose selecting revealed (but not yet accessible) nodes to traverse deeper
  for (const nodeId of world.revealed) {
    proposals.push({
      action: "select",
      nodeId,
      score: BASE_SELECT_REVEALED,
      reason: "select revealed node to make accessible",
      strategy: STRATEGY,
      payload: { nodeId },
    });
  }

  // Propose probing unprobed nodes
  for (const nodeId of world.needsProbe) {
    const distance = pathDistance(world, nodeId);
    const missionBonus = isMissionRelevant(world, nodeId) ? MISSION_BONUS : 0;
    const selectedBonus = (nodeId === world.player.selectedNodeId) ? SELECTED_BONUS : 0;
    proposals.push({
      action: "probe",
      nodeId,
      score: BASE_PROBE + missionBonus + selectedBonus - (distance * DISTANCE_PENALTY),
      reason: `probe unprobed node${missionBonus ? " (mission path)" : ""}`,
      strategy: STRATEGY,
    });
  }

  // Propose exploiting probed, unowned nodes
  for (const nodeId of world.needsExploit) {
    const card = pickBestCard(world, nodeId);
    if (!card) continue;

    const distance = pathDistance(world, nodeId);
    const missionBonus = isMissionRelevant(world, nodeId) ? MISSION_BONUS : 0;
    const selectedBonus = (nodeId === world.player.selectedNodeId) ? SELECTED_BONUS : 0;
    proposals.push({
      action: "exploit",
      nodeId,
      score: BASE_EXPLOIT + missionBonus + selectedBonus - (distance * DISTANCE_PENALTY),
      reason: `exploit with ${card.name}${missionBonus ? " (mission path)" : ""}`,
      strategy: STRATEGY,
      payload: { exploitId: card.id },
    });
  }

  return proposals;
}

/**
 * Pick the best card for a node: prefer vuln match, skip failed combos.
 * @param {WorldModel} world
 * @param {string} nodeId
 * @returns {import('../types.js').WorldCard|null}
 */
function pickBestCard(world, nodeId) {
  // Filter out cards that already failed on this node
  const available = world.hand.filter(c =>
    !world.failedExploits.has(`${nodeId}:${c.id}`)
  );
  if (available.length === 0) return null;

  const matchingIds = world.cardMatchesByNode.get(nodeId);
  const matching = matchingIds
    ? available.filter(c => matchingIds.includes(c.id))
    : [];

  if (matching.length > 0) {
    matching.sort((a, b) => b.quality - a.quality || b.usesLeft - a.usesLeft);
    return matching[0];
  }

  // No vuln match — pick highest quality card as a hail mary
  const sorted = [...available].sort((a, b) => b.quality - a.quality || b.usesLeft - a.usesLeft);
  return sorted[0];
}

/**
 * BFS hop distance from currently selected node (or gateway) to target.
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

/**
 * Is this node on the path to the mission target?
 * @param {WorldModel} world
 * @param {string} nodeId
 * @returns {boolean}
 */
function isMissionRelevant(world, nodeId) {
  if (!world.mission.targetNodeId) return false;
  if (nodeId === world.mission.targetNodeId) return true;
  // Check if owning this node opens a path toward the mission target
  const path = world.shortestPath(nodeId, world.mission.targetNodeId);
  return path !== null && path.length <= 4;
}
