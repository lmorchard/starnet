// @ts-nocheck — main.js is DOM event wiring; CustomEvent.detail typing noise outweighs benefit here.
import { NETWORK } from "../data/network.js";
import { initGraph, getCy, addIceNode } from "./graph.js";
import { initState, getState, reconfigureNode, readNode, lootNode, endRun, ejectIce, rebootNode, completeReboot, emit } from "./state.js";
import { startExploit, cancelExploit, handleExploitExecTimer } from "./exploit-exec.js";
import { startProbe, cancelProbe, handleProbeScanTimer } from "./probe-exec.js";
import { navigateTo, navigateAway } from "./navigation.js";
import { addLogEntry } from "./log.js";
import { startIce, handleIceTick, handleIceDetect } from "./ice.js";
import { initConsole, runCommand, pushHistory } from "./console.js";
import { on, emitEvent, E } from "./events.js";
import { tick, TICK_MS, TIMER, getVisibleTimers } from "./timers.js";
import { handleTraceTick, cancelTraceCountdown } from "./alert.js";
import { initVisualRenderer } from "./visual-renderer.js";
import { initLogRenderer } from "./log-renderer.js";
import { initNodeLifecycle } from "./node-lifecycle.js";
import { getAvailableActions } from "./node-actions.js";

// Log a UI-sourced command to both the log pane and the console history.
function logCommand(cmd) {
  addLogEntry(`> ${cmd}`, "command");
  pushHistory(cmd);
}

function init() {
  initLogRenderer();
  const cy = initGraph(NETWORK, onNodeClick, () => {
    emitEvent("starnet:action", { actionId: "deselect" });
  });
  addIceNode();
  initConsole();
  initVisualRenderer();  // must subscribe before initState fires STATE_CHANGED
  initState(NETWORK);
  fitGraph(cy);
  startIce();
  setInterval(() => {
    tick(1);
    if (getVisibleTimers().length > 0) emitEvent(E.TIMERS_UPDATED, getState());
  }, TICK_MS);

  // LLM playtesting API — accessible via browser console or Playwright evaluate
  window.starnet = { cmd: runCommand, state: getState };

  // ── ActionContext ─────────────────────────────────────────
  const ctx = {
    getState,
    selectNode:       (nodeId) => navigateTo(nodeId),
    deselectNode:     ()       => navigateAway(),
    startProbe:       (nodeId) => startProbe(nodeId),
    cancelProbe:      ()       => cancelProbe(),
    startExploit:     (nodeId, exploitId) => startExploit(nodeId, exploitId),
    cancelExploit:    ()       => cancelExploit(),
    readNode:         (nodeId) => readNode(nodeId),
    lootNode:         (nodeId) => lootNode(nodeId),
    ejectIce:         ()       => ejectIce(),
    rebootNode:       (nodeId) => rebootNode(nodeId),
    jackOut:          ()       => endRun("success"),
    logCommand,
    reconfigureNode:  (nodeId) => reconfigureNode(nodeId),
    cancelTrace:      ()       => cancelTraceCountdown(),
  };

  // Wire HUD jack-out button
  document.getElementById("jack-out-btn").addEventListener("click", () => {
    emitEvent("starnet:action", { actionId: "jackout" });
  });

  // ── Unified action dispatcher ─────────────────────────────
  // All UI and console actions fire "starnet:action" with { actionId, nodeId?, ...payload }.
  // fromConsole suppresses the command echo (console already logged it).
  on("starnet:action", ({ actionId, nodeId, fromConsole, ...payload }) => {
    const state = getState();
    const node = nodeId
      ? state.nodes[nodeId]
      : (state.selectedNodeId ? state.nodes[state.selectedNodeId] : null);
    const available = getAvailableActions(node, state);
    const action = available.find((a) => a.id === actionId);
    if (!action?.execute) return;
    if (!fromConsole) {
      // For exploit, log the card reference rather than the nodeId (matches console output)
      const logStr = (actionId === "exploit" && (payload.cardIndex ?? payload.exploitId))
        ? `exploit ${payload.cardIndex ?? payload.exploitId}`
        : actionId + (nodeId ? ` ${nodeId}` : "");
      ctx.logCommand(logStr);
    }
    action.execute(node, state, ctx, { nodeId, ...payload });
  });

  on(TIMER.ICE_MOVE,     () => handleIceTick());
  on(TIMER.ICE_DETECT,   (payload) => handleIceDetect(payload));
  on(TIMER.TRACE_TICK,   () => handleTraceTick());
  on(TIMER.EXPLOIT_EXEC, (payload) => handleExploitExecTimer(payload));
  on(TIMER.PROBE_SCAN,   (payload) => handleProbeScanTimer(payload));

  on(TIMER.REBOOT_COMPLETE, (payload) => {
    completeReboot(payload.nodeId);
  });

  on("starnet:action:run-again", () => {
    initState(NETWORK);
    const cy = getCy();
    if (cy) fitGraph(cy);
    addIceNode();
    startIce();
  });
}

function fitGraph(cy) {
  const visible = cy.nodes(".accessible, .revealed");
  if (visible.length <= 1) {
    // Single node — fit would zoom in absurdly; just center at a sane zoom level
    cy.zoom(1.5);
    cy.center(visible);
  } else {
    cy.fit(visible, 50);
  }
}

function onNodeClick(nodeId) {
  const s = getState();
  const node = s.nodes[nodeId];
  if (!node || node.visibility === "hidden") return;
  if (s.selectedNodeId === nodeId) {
    emitEvent("starnet:action", { actionId: "deselect" });
  } else {
    emitEvent("starnet:action", { actionId: "select", nodeId });
  }
}

document.addEventListener("DOMContentLoaded", init);
