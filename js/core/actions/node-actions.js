// @ts-check
/**
 * Unified action query — merges global actions with NodeGraph actions.
 *
 * All node-contextual actions (probe, exploit, read, loot, cancel-*, eject,
 * reboot, reconfigure, cancel-trace, access-darknet, etc.) are defined as
 * NodeDef actions on each node in the graph. This module wraps them into
 * game-compatible ActionDefs for the dispatcher and UI.
 */

/** @typedef {import('../types.js').ActionDef} ActionDef */
/** @typedef {import('../types.js').NodeState} NodeState */
/** @typedef {import('../types.js').GameState} GameState */

import { getGlobalActions } from "./global-actions.js";

/**
 * Returns all available actions for the given node and game state.
 * Global actions (jackout, select, deselect) + graph node actions.
 *
 * @param {NodeState | null} node
 * @param {GameState} state
 * @returns {ActionDef[]}
 */
export function getAvailableActions(node, state) {
  const global = getGlobalActions(node, state);
  if (!node || !state.nodeGraph) return global;

  const graphActions = state.nodeGraph.getAvailableActions(node.id);

  // Apply global state filters the graph can't check
  const filtered = graphActions.filter(action => {
    // Eject requires ICE attention at this specific node
    if (action.id === "eject") {
      return !!(state.ice?.active && state.ice.attentionNodeId === node.id);
    }
    return true;
  });

  // Wrap each graph ActionDef into a game-compatible ActionDef
  const wrapped = filtered.map(ga => wrapGraphAction(ga));
  return [...global, ...wrapped];
}

/**
 * Wrap a node-graph ActionDef into a game-compatible ActionDef.
 * @param {import('../node-graph/types.js').ActionDef} ga
 * @returns {ActionDef}
 */
function wrapGraphAction(ga) {
  return {
    id: ga.id,
    label: ga.label,
    available: () => true,
    desc: () => ga.desc || ga.label,
    noSidebar: ga.noSidebar,
    execute: (node, state, ctx, payload) => {
      // Exploit special case: needs exploitId from payload
      if (ga.id === "exploit") {
        const exploitId = payload?.exploitId;
        if (exploitId) ctx.startExploit(node.id, exploitId);
        return;
      }
      // All other actions: execute via the graph (effects include ctx-call)
      state.nodeGraph.executeAction(node.id, ga.id);
    },
  };
}
