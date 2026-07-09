// @ts-check
/**
 * The single game-layer "is this node busy?" contract (#288 B1). ORs the two busy
 * sources that previously lived in separate layers: the node-graph operator busy
 * (graph.isNodeBusy — an active timed-action operator) and the process-framework
 * busy (activeProcessOnNode — SWEEP, autoburn, …). The graph can't see
 * state.processes, so this OR happens here, at the layer that has both.
 *
 * Note on scope: the graph's own NOT_BUSY condition stays operator-only on purpose —
 * getAvailableActions (node-actions.js) early-returns an [ABORT]-only menu whenever a
 * process is active, before the graph ever evaluates a node's action conditions, so
 * the graph never needs process-awareness. This helper is the contract for
 * game-layer consumers.
 */

/** @typedef {import('./types.js').GameState} GameState */

import { activeProcessOnNode } from "./processes.js";

/**
 * @param {{ id: string } | null} node
 * @param {GameState} state
 * @returns {boolean}
 */
export function isNodeBusy(node, state) {
  if (!node) return false;
  const operatorBusy = !!state.nodeGraph?.isNodeBusy(node.id);
  return operatorBusy || activeProcessOnNode(state, node.id);
}
