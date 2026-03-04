// @ts-check
// ActionContext factory and unified action dispatcher.
// Extracted from main.js so both are independently testable.

/** @typedef {import('../types.js').ActionContext} ActionContext */

import { getState, getVersion, endRun } from "../state.js";
import { reconfigureNode, rebootNode } from "../node-orchestration.js";
import { ejectIce } from "../ice.js";
import { addLogEntry } from "../log.js";
import { navigateTo, navigateAway } from "../navigation.js";
import { cancelTraceCountdown } from "../alert.js";
import { getAvailableActions } from "./node-actions.js";
import { on, emitEvent, E } from "../events.js";
import { pauseTimers, resumeTimers } from "../timers.js";

/**
 * Build the wired ActionContext — maps abstract ctx methods to concrete state mutators.
 * @param {(state: import('../types.js').GameState) => void} [openDarknetsStore] Optional browser-side store opener; no-op in headless contexts.
 * @returns {ActionContext}
 */
export function buildActionContext(openDarknetsStore = () => {}) {
  return {
    getState,
    selectNode:       (nodeId) => navigateTo(nodeId),
    deselectNode:     ()       => navigateAway(),
    // Probe/read/loot start/cancel now handled by trait-based action effects
    // (set-attr) and the timed-action operator. These stubs exist for type compat.
    startProbe:       () => {},
    cancelProbe:      () => {},
    startExploit:     () => {},
    cancelExploit:    () => {},
    startRead:        () => {},
    cancelRead:       () => {},
    startLoot:        () => {},
    cancelLoot:       () => {},
    ejectIce:         ()       => ejectIce(),
    rebootNode:       (nodeId) => rebootNode(nodeId),
    jackOut:          ()       => endRun("success"),
    reconfigureNode:  (nodeId) => reconfigureNode(nodeId),
    cancelTrace:      ()       => cancelTraceCountdown(),
    openDarknetsStore: () => {
      pauseTimers();
      openDarknetsStore(getState());
    },
  };
}

/**
 * Build the node click handler for graph.js — translates a Cytoscape tap
 * into a select or deselect action event based on current selection state.
 * @returns {(nodeId: string) => void}
 */
export function buildNodeClickHandler() {
  return (nodeId) => {
    const s = getState();
    const node = s.nodes[nodeId];
    if (!node || node.visibility === "hidden") return;
    const isDeselect = s.selectedNodeId === nodeId;
    emitEvent("starnet:action", {
      actionId: isDeselect ? "deselect" : "select",
      ...(isDeselect ? {} : { nodeId }),
    });
  };
}

/**
 * Register the unified starnet:action dispatcher.
 * All UI and console actions fire "starnet:action" with { actionId, nodeId?, ...payload }.
 * fromConsole suppresses the COMMAND_ISSUED echo (console already logged it via submitCommand).
 * @param {ActionContext} ctx
 */
export function initActionDispatcher(ctx) {
  on("starnet:action", ({ actionId, nodeId, fromConsole, ...payload }) => {
    const state = ctx.getState();
    const node = nodeId
      ? state.nodes[nodeId]
      : (state.selectedNodeId ? state.nodes[state.selectedNodeId] : null);
    const available = getAvailableActions(node, state);
    const action = available.find((a) => a.id === actionId);
    if (!action?.execute) {
      if (fromConsole) addLogEntry(`${actionId}: not available.`, "error");
      return;
    }
    if (!fromConsole) {
      // For exploit, log the card reference rather than the nodeId (matches console output)
      const logStr = (actionId === "exploit" && (payload.cardIndex ?? payload.exploitId))
        ? `exploit ${payload.cardIndex ?? payload.exploitId}`
        : actionId + (nodeId ? ` ${nodeId}` : "");
      emitEvent(E.COMMAND_ISSUED, { cmd: logStr });
    }
    const versionBefore = getVersion();
    action.execute(node, state, ctx, { nodeId, ...payload });
    // Emit STATE_CHANGED once after the action if any state mutation occurred.
    if (getVersion() !== versionBefore) {
      emitEvent(E.STATE_CHANGED, ctx.getState());
    }
  });
}
