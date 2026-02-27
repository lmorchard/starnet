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

// Log a UI-sourced command to both the log pane and the console history.
function logCommand(cmd) {
  addLogEntry(`> ${cmd}`, "command");
  pushHistory(cmd);
}

function init() {
  initLogRenderer();
  const cy = initGraph(NETWORK, onNodeClick, () => {
    emitEvent("starnet:action:deselect", {});
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

  // Wire HUD jack-out button
  document.getElementById("jack-out-btn").addEventListener("click", () => {
    emitEvent("starnet:action:jackout", {});
  });

  // ── Action event listeners ────────────────────────────────
  // Click-sourced events (no fromConsole flag) echo their equivalent command to the log.

  on("starnet:action:select", ({ nodeId, fromConsole }) => {
    if (!fromConsole) logCommand(`select ${nodeId}`);
    navigateTo(nodeId);
  });

  on("starnet:action:deselect", ({ fromConsole } = {}) => {
    if (!fromConsole) logCommand("deselect");
    navigateAway();
  });

  on(TIMER.ICE_MOVE,    () => handleIceTick());
  on(TIMER.ICE_DETECT,  (payload) => handleIceDetect(payload));
  on(TIMER.TRACE_TICK,  () => handleTraceTick());
  on(TIMER.EXPLOIT_EXEC, (payload) => handleExploitExecTimer(payload));
  on(TIMER.PROBE_SCAN,   (payload) => handleProbeScanTimer(payload));

  on("starnet:action:probe", ({ nodeId, fromConsole }) => {
    if (!fromConsole) logCommand(`probe ${nodeId}`);
    startProbe(nodeId);
  });

  on("starnet:action:cancel-probe", ({ fromConsole } = {}) => {
    if (!fromConsole) logCommand("cancel-probe");
    cancelProbe();
  });

  on("starnet:action:launch-exploit", ({ nodeId, exploitId, cardIndex, fromConsole }) => {
    if (!fromConsole) logCommand(`exploit ${cardIndex ?? exploitId}`);
    startExploit(nodeId, exploitId);
  });

  on("starnet:action:cancel-exploit", ({ fromConsole } = {}) => {
    if (!fromConsole) logCommand("cancel-exploit");
    cancelExploit();
  });

  on("starnet:action:reconfigure", ({ nodeId, fromConsole }) => {
    if (!fromConsole) logCommand(`reconfigure ${nodeId}`);
    reconfigureNode(nodeId);
  });

  on("starnet:action:read", ({ nodeId, fromConsole }) => {
    if (!fromConsole) logCommand(`read ${nodeId}`);
    readNode(nodeId);
  });

  on("starnet:action:loot", ({ nodeId, fromConsole }) => {
    if (!fromConsole) logCommand(`loot ${nodeId}`);
    lootNode(nodeId);
  });

  on("starnet:action:cancel-trace", ({ fromConsole }) => {
    if (!fromConsole) logCommand(`cancel-trace`);
    cancelTraceCountdown();
  });

  on("starnet:action:jackout", ({ fromConsole } = {}) => {
    if (!fromConsole) logCommand(`jackout`);
    endRun("success");
  });

  on("starnet:action:eject", ({ fromConsole } = {}) => {
    if (!fromConsole) logCommand(`eject`);
    ejectIce();
  });

  on("starnet:action:reboot", ({ nodeId, fromConsole }) => {
    if (!fromConsole) logCommand(`reboot ${nodeId}`);
    rebootNode(nodeId);
  });

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
    emitEvent("starnet:action:deselect", {});
  } else {
    emitEvent("starnet:action:select", { nodeId });
  }
}

document.addEventListener("DOMContentLoaded", init);
