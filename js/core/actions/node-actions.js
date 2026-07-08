// @ts-check
/**
 * Unified action query — merges global actions with NodeGraph actions.
 *
 * All node-contextual actions (probe, exploit, read, loot, cancel-*, kick,
 * reboot, reconfigure, cancel-trace, access-darknet, etc.) are defined as
 * NodeDef actions on each node in the graph. This module wraps them into
 * game-compatible ActionDefs for the dispatcher and UI.
 */

/** @typedef {import('../types.js').ActionDef} ActionDef */
/** @typedef {import('../types.js').NodeState} NodeState */
/** @typedef {import('../types.js').GameState} GameState */

import { getGlobalActions } from "./global-actions.js";
import { getProgramActions } from "./program-actions.js";
import { A } from "../action-ids.js";
import { activeIceInstances } from "../state/ice.js";
import { isScriptAction } from "./scripts.js";
import { activeProcessOnNode, abortNodeProcesses } from "../processes.js";
import { startAutoBurn } from "../autoburn.js";
// isNodeBusy is the canonical game-layer "is this node busy" check (#288 B1) — ORs graph
// operator busy with process busy. Not yet consumed below: the process early-return is the
// process-specific ABORT *affordance*, kept as activeProcessOnNode on purpose here; Task B2
// unifies it with the graph's operator-abort path.
import { isNodeBusy } from "../busy.js";

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

  // A node running a progressive process (SWEEP, …) is BUSY: the only node action is ABORT.
  // Uniform rule at the actions layer (the graph's NOT_BUSY can't see processes) — future
  // progressive verbs inherit it. Nav-away also aborts (game-ctx nav-cancel handler).
  if (activeProcessOnNode(state, node.id)) {
    return [...global, {
      id: A.ABORT, label: "ABORT", available: () => true,
      desc: () => "Stop the running operation.",
      execute: (n) => abortNodeProcesses(n.id),
    }];
  }

  const graphActions = state.nodeGraph.getAvailableActions(node.id);

  // Apply global state filters the graph can't check
  const filtered = graphActions.filter(action => {
    // Kick requires ICE attention at this specific node — any active instance.
    if (action.id === A.KICK) {
      return activeIceInstances(state).some((i) => i.attentionNodeId === node.id);
    }
    return true;
  });

  // Wrap each graph ActionDef into a game-compatible ActionDef
  const wrapped = filtered.map(ga => wrapGraphAction(ga));

  // Flow programs: a fixed player-owned kit injected as top-level node actions (not scripts,
  // so they stay out of the EXEC submenu — SNIFF needs its own flow picker).
  const programs = getProgramActions(node, state);

  // Group non-core node actions (scripts) under a synthetic EXEC follow-up action.
  const scripts = wrapped.filter(a => isScriptAction(a.id));
  const result = [...global, ...wrapped, ...programs];
  if (scripts.length > 0) result.push(buildExecAction(scripts));
  return result;
}

/**
 * Node-contextual scripts available on this node (non-core actions only),
 * without the synthetic EXEC wrapper. Used by the console (`exec`, `actions`).
 * @param {NodeState | null} node @param {GameState} state @returns {ActionDef[]}
 */
export function getScriptActions(node, state) {
  return getAvailableActions(node, state).filter(a => isScriptAction(a.id));
}

/**
 * Build the synthetic EXEC action from already-wrapped script ActionDefs.
 * Closes over `scripts` so execute() needs no re-query (avoids an import cycle).
 * @param {ActionDef[]} scripts @returns {ActionDef}
 */
function buildExecAction(scripts) {
  const byId = new Map(scripts.map(s => [s.id, s]));
  return {
    id: A.EXEC,
    label: "EXEC",
    available: () => true,
    desc: () => "run a script on this node",
    followup: {
      title: () => "EXEC",
      choices: (node, state) => scripts.map(s => ({
        id: s.id,
        payloadKey: "scriptId",
        render: "action",
        data: { label: s.label, desc: s.desc(node, state) },
      })),
      empty: () => "no scripts available",
    },
    execute: (node, state, ctx, payload) => {
      const script = byId.get(payload?.scriptId);
      script?.execute?.(node, state, ctx, { nodeId: node.id });
    },
  };
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
    followup: ga.followup,
    execute: (node, state, ctx, payload) => {
      // Exploit special case: launch the coherence auto-burn process.
      // No card selection needed — auto-burn reads from player.hoard directly.
      if (ga.id === A.XPLOIT) {
        startAutoBurn(node.id);
        return;
      }
      // All other actions: execute via the graph (effects include set-attr)
      state.nodeGraph.executeAction(node.id, ga.id);
    },
  };
}
