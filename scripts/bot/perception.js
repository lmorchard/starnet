// @ts-check
// Perception layer — reads game state and builds a structured WorldModel
// for strategy functions to score against.

/** @typedef {import('./types.js').WorldModel} WorldModel */
/** @typedef {import('./types.js').WorldNode} WorldNode */

import { getAvailableActions } from "../../js/core/actions/node-actions.js";
import { A } from "../../js/core/action-ids.js";
import { activeIceInstances } from "../../js/core/state/ice.js";

/**
 * Build a WorldModel snapshot from current game state.
 * @param {import('../../js/core/types.js').GameState} state
 * @param {{ failedNodes?: Set<string>, completedActions?: Set<string>, iceCooldown?: Set<string> }} [context]
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
  /** @type {{ nodeId: string, vulnTypes: Set<string> }[]} */
  const minable = [];

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

    if (isOwned && !isWan) {
      owned.push(id);

      // Check for disarm actions
      const actions = availableActions.get(id) ?? getAvailableActions(n, state);
      if (!availableActions.has(id)) availableActions.set(id, actions);
      const disarms = actions.filter(a => a.id.startsWith("disarm"));
      if (disarms.length > 0) hasDisarmActions.push(id);

      // Minable: owned nodes whose mine action is still available (requires gate
      // hides it once the node taps out, so this self-bounds against exhaustion).
      // vulnTypes mirrors generateMinedRound's filter (non-patched, non-hidden) so the
      // mineStrategy vuln-overlap preference reflects what mining can actually yield.
      if (actions.some(a => a.id === A.MINE)) {
        const vulnTypes = new Set(
          (n.vulnerabilities ?? []).filter(v => !v.patched && !v.hidden).map(v => v.id)
        );
        minable.push({ nodeId: id, vulnTypes });
      }

      // Lootable: nodes with read/looted attributes (from "lootable" trait)
      // that haven't been fully looted yet. read/looted are undefined on
      // node types that don't support these actions (gateway, router, etc.)
      if (n.read === false) {
        lootable.push(id);
      } else if (n.read === true && n.looted === false && n.macguffins?.length > 0) {
        lootable.push(id);
      }
    } else if (isAccessible && !isWan) {
      accessible.push(id);

      if (!n.probed) {
        needsProbe.push(id);
      } else if (n.accessLevel !== "owned" && n.vulnerabilities?.length > 0) {
        // Only exploitable if the node has vulnerabilities to target
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

  // Exploit hoard: usable (non-disclosed) rounds are the ammo the auto-burn loop
  // draws from. hoardUsable gates whether XPLOIT is worth proposing at all.
  const hoard = state.player.hoard ?? [];
  const hoardUsable = hoard.filter((r) => !r.disclosed).length;

  // ICE state — aggregate over ALL active instances. isOnSelectedNode and
  // nodeId are any-instance aggregates so evasion (which reads them) keeps
  // working with multiple ICE in play.
  const insts = activeIceInstances(state);
  const ice = {
    instances: insts.map((i) => ({ nodeId: i.attentionNodeId, grade: i.grade })),
    isOnSelectedNode: insts.some((i) => i.attentionNodeId === state.selectedNodeId),
    isActive: insts.length > 0,
    nodeId:
      insts.find((i) => i.attentionNodeId === state.selectedNodeId)?.attentionNodeId ??
      insts[0]?.attentionNodeId ??
      null,
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
    minable,
    ice,
    player,
    hoard,
    hoardUsable,
    availableActions,
    mission,
    gamePhase: state.phase,
    failedNodes: context.failedNodes ?? new Set(),
    completedActions: context.completedActions ?? new Set(),
    iceCooldown: context.iceCooldown ?? new Set(),
    shortestPath,
  };
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
