// @ts-check
// Explore heuristic — probe unprobed nodes, exploit probed ones.

/** @typedef {import('../types.js').WorldModel} WorldModel */
/** @typedef {import('../types.js').ScoredAction} ScoredAction */

import { A } from "../../../js/core/action-ids.js";

const STRATEGY = "explore";
const BASE_SELECT_REVEALED = 42;
const BASE_PROBE = 50;
const BASE_EXPLOIT = 45;
const SELECTED_BONUS = 8;
const MISSION_BONUS = 10;
const DISTANCE_PENALTY = 5;

// Node types that are dangerous to probe (trigger alert escalation)
const DANGEROUS_TYPES = new Set(["ids", "security-monitor"]);
const DANGEROUS_PENALTY = 10;
const ICE_COOLDOWN_PENALTY = 20;

/**
 * @param {WorldModel} world
 * @returns {ScoredAction[]}
 */
export function exploreStrategy(world) {
  /** @type {ScoredAction[]} */
  const proposals = [];

  // Propose selecting revealed (but not yet accessible) nodes to traverse deeper
  for (const nodeId of world.revealed) {
    const node = world.nodes.get(nodeId);
    const dangerPenalty = (node && DANGEROUS_TYPES.has(node.type)) ? DANGEROUS_PENALTY : 0;
    proposals.push({
      action: A.TARGET,
      nodeId,
      score: BASE_SELECT_REVEALED - dangerPenalty,
      reason: "select revealed node to make accessible",
      strategy: STRATEGY,
      payload: { nodeId },
    });
  }

  // Propose probing unprobed nodes (penalize ICE-cooled nodes)
  for (const nodeId of world.needsProbe) {
    const distance = pathDistance(world, nodeId);
    const missionBonus = isMissionRelevant(world, nodeId) ? MISSION_BONUS : 0;
    const selectedBonus = (nodeId === world.player.selectedNodeId) ? SELECTED_BONUS : 0;
    const cooldownPenalty = world.iceCooldown.has(nodeId) ? ICE_COOLDOWN_PENALTY : 0;
    proposals.push({
      action: A.PROBE,
      nodeId,
      score: BASE_PROBE + missionBonus + selectedBonus - (distance * DISTANCE_PENALTY) - cooldownPenalty,
      reason: `probe unprobed node${missionBonus ? " (mission path)" : ""}`,
      strategy: STRATEGY,
    });
  }

  // Propose exploiting probed, unowned nodes via auto-burn (no card payload).
  // Only worth launching when the hoard has usable ammo; otherwise supply/mine
  // handle replenishment. Skip nodes that already stalled (heat-ceiling/dry).
  for (const nodeId of world.needsExploit) {
    if (world.hoardUsable <= 0) continue;
    if (world.failedNodes.has(nodeId)) continue;

    const distance = pathDistance(world, nodeId);
    const missionBonus = isMissionRelevant(world, nodeId) ? MISSION_BONUS : 0;
    const selectedBonus = (nodeId === world.player.selectedNodeId) ? SELECTED_BONUS : 0;
    const cooldownPenalty = world.iceCooldown.has(nodeId) ? ICE_COOLDOWN_PENALTY : 0;

    proposals.push({
      action: A.XPLOIT,
      nodeId,
      score: BASE_EXPLOIT + missionBonus + selectedBonus - (distance * DISTANCE_PENALTY) - cooldownPenalty,
      reason: `auto-burn hoard${missionBonus ? " (mission path)" : ""}`,
      strategy: STRATEGY,
      payload: {},
    });
  }

  return proposals;
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
