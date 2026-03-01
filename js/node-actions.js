// @ts-check
/**
 * Node-contextual action registry.
 * Actions here operate on a selected node. Each is a self-contained ActionDef:
 * available predicate, display desc, and execute handler (via injected ctx).
 *
 * No imports from state.js, events.js, or game-logic modules — all mutations
 * go through ActionContext (dependency injection for testability).
 */

/** @typedef {import('./types.js').ActionDef} ActionDef */
/** @typedef {import('./types.js').NodeState} NodeState */
/** @typedef {import('./types.js').GameState} GameState */
/** @typedef {import('./types.js').ActionContext} ActionContext */

/** @type {readonly ActionDef[]} */
export const NODE_ACTIONS = Object.freeze([
  {
    id: "probe",
    label: "PROBE",
    available: (node, state) =>
      node.accessLevel === "locked" &&
      !node.probed &&
      !node.rebooting &&
      state.activeProbe?.nodeId !== node.id &&
      state.executingExploit?.nodeId !== node.id,
    desc: () => "Reveal vulnerabilities. Raises local alert.",
    execute: (node, _state, ctx) => ctx.startProbe(node.id),
  },

  {
    id: "cancel-probe",
    label: "CANCEL PROBE",
    available: (node, state) => state.activeProbe?.nodeId === node.id,
    desc: () => "Abort vulnerability scan.",
    execute: (_node, _state, ctx) => ctx.cancelProbe(),
  },

  {
    id: "exploit",
    label: "EXPLOIT",
    noSidebar: true,  // triggered via exploit card clicks, not sidebar button
    available: (node, state) =>
      node.visibility === "accessible" &&
      !node.rebooting &&
      node.accessLevel !== "owned" &&
      state.executingExploit?.nodeId !== node.id,
    desc: (node) => `Attack ${node.id} with an exploit card.`,
    execute: (node, _state, ctx, payload) =>
      ctx.startExploit(node.id, /** @type {any} */ (payload)?.exploitId),
  },

  {
    id: "cancel-exploit",
    label: "CANCEL EXPLOIT",
    available: (node, state) => state.executingExploit?.nodeId === node.id,
    desc: (node, state) => {
      const card = state.player.hand.find(
        (c) => c.id === state.executingExploit?.exploitId
      );
      return `Abort ${card?.name ?? "exploit"} execution.`;
    },
    execute: (_node, _state, ctx) => ctx.cancelExploit(),
  },

  {
    id: "read",
    label: "READ",
    available: (node, state) =>
      (node.accessLevel === "compromised" || node.accessLevel === "owned") &&
      !node.read &&
      !node.rebooting &&
      state.activeRead?.nodeId !== node.id &&
      state.executingExploit?.nodeId !== node.id,
    desc: (node) =>
      node.accessLevel === "compromised"
        ? "Scan node contents for loot or connections."
        : "Scan node contents.",
    execute: (node, _state, ctx) => ctx.startRead(node.id),
  },

  {
    id: "cancel-read",
    label: "CANCEL READ",
    available: (node, state) => state.activeRead?.nodeId === node.id,
    desc: () => "Abort data extraction.",
    execute: (_node, _state, ctx) => ctx.cancelRead(),
  },

  {
    id: "loot",
    label: "LOOT",
    available: (node) =>
      node.accessLevel === "owned" &&
      node.read &&
      node.macguffins.some((m) => !m.collected),
    desc: () => "Collect macguffins for cash.",
    execute: (node, _state, ctx) => ctx.lootNode(node.id),
  },

  {
    id: "eject",
    label: "EJECT",
    available: (node, state) =>
      node.accessLevel === "owned" &&
      !!(state.ice?.active && state.ice.attentionNodeId === node.id),
    desc: () => "Boot ICE attention to a random adjacent node.",
    execute: (_node, _state, ctx) => ctx.ejectIce(),
  },

  {
    id: "reboot",
    label: "REBOOT",
    available: (node) => node.accessLevel === "owned" && !node.rebooting,
    desc: () => "Force ICE home and take node offline 1–3s.",
    execute: (node, _state, ctx) => ctx.rebootNode(node.id),
  },
]);

/**
 * Returns all node-contextual actions whose available() predicate is true.
 * @param {NodeState} node
 * @param {GameState} state
 * @returns {ActionDef[]}
 */
export function getNodeActions(node, state) {
  if (node.type === "wan") return []; // WAN has only type-specific actions
  return NODE_ACTIONS.filter((a) => a.available(node, state));
}

// ── Unified query ──────────────────────────────────────────

import { getGlobalActions } from "./global-actions.js";
import { getActions as getTypeActions } from "./node-types.js";

/**
 * Returns all available actions for the given node and game state,
 * merging global actions, node-contextual actions, and type-specific actions.
 * @param {NodeState | null} node
 * @param {GameState} state
 * @returns {ActionDef[]}
 */
export function getAvailableActions(node, state) {
  const global = getGlobalActions(node, state);
  if (!node) return global;
  return [
    ...global,
    ...getNodeActions(node, state),
    ...getTypeActions(node, state),
  ];
}
