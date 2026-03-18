// @ts-check
/**
 * Global action registry.
 * Actions here are available regardless of which node is selected.
 * They still flow through available() predicates so future mechanics
 * (e.g. a node state that disables jackout) are a single predicate change.
 *
 * node may be null when no node is selected.
 */

/** @typedef {import('../types.js').ActionDef} ActionDef */
/** @typedef {import('../types.js').NodeState} NodeState */
/** @typedef {import('../types.js').GameState} GameState */

import { A } from "../action-ids.js";

/** @type {readonly ActionDef[]} */
export const GLOBAL_ACTIONS = Object.freeze([
  {
    id: A.JACKOUT,
    label: "JACK OUT",
    available: (_node, state) => state.phase === "playing",
    desc: () => "Disconnect and end run.",
    execute: (_node, _state, ctx) => ctx.jackOut(),
  },

  {
    id: A.TARGET,
    label: "TARGET",
    available: (_node, state) =>
      Object.values(state.nodes).some(
        (n) =>
          (n.visibility === "accessible" || n.visibility === "revealed") &&
          !n.rebooting &&
          n.id !== state.selectedNodeId
      ),
    desc: () => "Select a node.",
    execute: (_node, _state, ctx, payload) =>
      ctx.selectNode(/** @type {any} */ (payload)?.nodeId),
  },

  {
    id: A.UNTARGET,
    label: "UNTARGET",
    available: (_node, state) => state.selectedNodeId !== null,
    desc: () => "Clear selection.",
    execute: (_node, _state, ctx) => ctx.deselectNode(),
  },
]);

/**
 * Returns all global actions whose available() predicate is true.
 * @param {NodeState | null} node
 * @param {GameState} state
 * @returns {ActionDef[]}
 */
export function getGlobalActions(node, state) {
  return GLOBAL_ACTIONS.filter((a) => a.available(node, state));
}
