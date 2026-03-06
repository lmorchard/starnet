// @ts-check
// Perception layer — reads game state and builds a structured WorldModel
// for strategy functions to score against.

/** @typedef {import('./types.js').WorldModel} WorldModel */
/** @typedef {import('./types.js').WorldNode} WorldNode */
/** @typedef {import('./types.js').WorldCard} WorldCard */

import { getAvailableActions } from "../../js/core/actions/node-actions.js";

/**
 * Build a WorldModel snapshot from current game state.
 * @param {import('../../js/core/types.js').GameState} state
 * @param {{ failedExploits?: Set<string> }} [context]
 * @returns {WorldModel}
 */
export function perceive(state, context = {}) {
  const nodes = /** @type {Map<string, WorldNode>} */ (new Map());
  const accessible = [];
  const owned = [];
  const needsProbe = [];
  const needsExploit = [];
  const lootable = [];
  const security = [];
  const hasDisarmActions = [];

  /** @type {Map<string, import('../../js/core/types.js').ActionDef[]>} */
  const availableActions = new Map();

  /** @type {string[]} */
  const revealed = [];

  // Categorize all visible nodes
  for (const [id, n] of Object.entries(state.nodes)) {
    if (n.visibility === "hidden") continue;

    nodes.set(id, /** @type {WorldNode} */ (n));

    // Get available actions for accessible nodes
    if (n.visibility === "accessible") {
      const actions = getAvailableActions(n, state);
      availableActions.set(id, actions);
    }

    const isWan = n.type === "wan";
    const isAccessible = n.visibility === "accessible";
    const isOwned = n.accessLevel === "owned";

    if (isOwned) {
      owned.push(id);

      // Check for disarm actions
      const actions = availableActions.get(id) ?? getAvailableActions(n, state);
      if (!availableActions.has(id)) availableActions.set(id, actions);
      const disarms = actions.filter(a => a.id.startsWith("disarm"));
      if (disarms.length > 0) hasDisarmActions.push(id);

      // Lootable: not read, or read but not looted with macguffins
      if (n.read === false) {
        lootable.push(id);
      } else if (n.looted === false && n.macguffins?.length > 0) {
        lootable.push(id);
      }
    } else if (isAccessible && !isWan) {
      accessible.push(id);

      if (!n.probed) {
        needsProbe.push(id);
      } else if (n.accessLevel !== "owned") {
        needsExploit.push(id);
      }
    } else if (n.visibility === "revealed" && !isWan) {
      // Revealed but not yet accessible — selecting it will make it accessible
      revealed.push(id);
    }

    // Security nodes (any access level)
    if (n.type === "ids" || n.type === "security-monitor") {
      security.push(id);
    }
  }

  // Build card-to-node match map
  /** @type {Map<string, string[]>} */
  const cardMatchesByNode = new Map();
  const hand = buildHand(state);

  for (const [nodeId, node] of nodes) {
    if (!node.vulnerabilities?.length) continue;
    const vulnTypes = new Set(node.vulnerabilities.map(v => v.type));
    const matching = hand.filter(c => vulnTypes.has(c.vulnType)).map(c => c.id);
    if (matching.length > 0) cardMatchesByNode.set(nodeId, matching);
  }

  // ICE state
  const ice = {
    nodeId: state.ice?.attentionNodeId ?? null,
    isOnSelectedNode: !!(state.ice?.active && state.ice.attentionNodeId === state.selectedNodeId),
    isActive: state.ice?.active ?? false,
  };

  // Player state
  const player = {
    selectedNodeId: state.selectedNodeId,
    cash: state.player.cash,
    alertLevel: state.globalAlert,
    traceActive: state.traceSecondsRemaining !== null,
    traceCountdown: state.traceSecondsRemaining,
  };

  // Mission state
  const mission = buildMission(state);

  // BFS shortest path through owned/accessible nodes
  const shortestPath = (fromId, toId) =>
    bfsPath(fromId, toId, state.adjacency, state.nodes);

  return {
    nodes,
    adjacency: state.adjacency,
    revealed,
    accessible,
    owned,
    needsProbe,
    needsExploit,
    lootable,
    security,
    hasDisarmActions,
    ice,
    player,
    hand,
    cardMatchesByNode,
    availableActions,
    mission,
    gamePhase: state.phase,
    failedExploits: context.failedExploits ?? new Set(),
    shortestPath,
  };
}

/**
 * Build hand summary from state.
 * @param {import('../../js/core/types.js').GameState} state
 * @returns {WorldCard[]}
 */
function buildHand(state) {
  return (state.player.hand ?? [])
    .filter(c => (c.uses ?? 1) > 0)
    .map(c => ({
      id: c.id,
      name: c.name,
      vulnType: c.vulnType,
      quality: c.quality ?? 50,
      usesLeft: c.uses ?? 1,
    }));
}

/**
 * Build mission summary, finding which node has the target macguffin.
 * @param {import('../../js/core/types.js').GameState} state
 * @returns {import('./types.js').WorldMission}
 */
function buildMission(state) {
  const m = state.mission;
  if (!m) return { targetMacguffinId: null, targetName: null, complete: false, targetNodeId: null };

  let targetNodeId = null;
  if (!m.complete) {
    for (const [nodeId, node] of Object.entries(state.nodes)) {
      if (node.macguffins?.some(mg => mg.id === m.targetMacguffinId)) {
        targetNodeId = nodeId;
        break;
      }
    }
  }

  return {
    targetMacguffinId: m.targetMacguffinId,
    targetName: m.targetName,
    complete: m.complete,
    targetNodeId,
  };
}

/**
 * BFS through accessible/owned nodes to find shortest path.
 * Returns array of node IDs from start to end (inclusive), or null if unreachable.
 * @param {string} fromId
 * @param {string} toId
 * @param {Object<string, string[]>} adjacency
 * @param {Object<string, any>} nodes
 * @returns {string[]|null}
 */
function bfsPath(fromId, toId, adjacency, nodes) {
  if (fromId === toId) return [fromId];

  const visited = new Set([fromId]);
  /** @type {Map<string, string>} */
  const parent = new Map();
  const queue = [fromId];

  while (queue.length > 0) {
    const current = queue.shift();
    for (const neighbor of (adjacency[current] ?? [])) {
      if (visited.has(neighbor)) continue;
      const n = nodes[neighbor];
      if (!n || n.visibility === "hidden") continue;
      // Can traverse through accessible or owned nodes
      if (n.visibility !== "accessible") continue;

      visited.add(neighbor);
      parent.set(neighbor, current);

      if (neighbor === toId) {
        // Reconstruct path
        const path = [toId];
        let step = toId;
        while (parent.has(step)) {
          step = parent.get(step);
          path.unshift(step);
        }
        return path;
      }
      queue.push(neighbor);
    }
  }
  return null;
}
