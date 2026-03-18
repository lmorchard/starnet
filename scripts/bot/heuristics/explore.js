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

  // Propose exploiting probed, unowned nodes (penalize ICE-cooled nodes)
  for (const nodeId of world.needsExploit) {
    const card = pickBestCard(world, nodeId);
    if (!card) continue;

    const distance = pathDistance(world, nodeId);
    const missionBonus = isMissionRelevant(world, nodeId) ? MISSION_BONUS : 0;
    const selectedBonus = (nodeId === world.player.selectedNodeId) ? SELECTED_BONUS : 0;
    const cooldownPenalty = world.iceCooldown.has(nodeId) ? ICE_COOLDOWN_PENALTY : 0;

    // Slight penalty for hail-mary (non-matching) exploits — prefer matches
    // but still willing to try non-matching cards over just exploring
    const matchingIds = world.cardMatchesByNode.get(nodeId) ?? [];
    const matchPenalty = matchingIds.includes(card.id) ? 0 : 5;

    proposals.push({
      action: A.XPLOIT,
      nodeId,
      score: BASE_EXPLOIT + missionBonus + selectedBonus - (distance * DISTANCE_PENALTY) - matchPenalty - cooldownPenalty,
      reason: `exploit with ${card.name}${missionBonus ? " (mission path)" : ""}${matchPenalty ? " (hail-mary)" : ""}`,
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
