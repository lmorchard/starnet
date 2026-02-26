// @ts-nocheck — main.js is DOM event wiring; CustomEvent.detail typing noise outweighs benefit here.
import { NETWORK } from "../data/network.js";
import { initGraph, getCy, addIceNode } from "./graph.js";
import { initState, getState, selectNode, deselectNode, probeNode, reconfigureNode, readNode, lootNode, endRun, ejectIce, rebootNode, completeReboot, emit } from "./state.js";
import { launchExploit } from "./combat.js";
import { addLogEntry } from "./log.js";
import { startIce, handleIceTick, handleIceDetect } from "./ice.js";
import { initConsole, runCommand, pushHistory } from "./console.js";
import { on, emitEvent, E } from "./events.js";
import { tick, TICK_MS, TIMER, getVisibleTimers } from "./timers.js";
import { handleTraceTick, cancelTraceCountdown } from "./alert.js";
import { initVisualRenderer, setSidebarMode } from "./visual-renderer.js";
import { initLogRenderer } from "./log-renderer.js";

// Current UI mode for the sidebar: 'node' | 'exploit-select'
// Kept here (not in visual-renderer) because it's set by action event handlers.
let sidebarMode = "node";

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
    if (sidebarMode !== "node") {
      setSidebarMode("node");
      sidebarMode = "node";
      addLogEntry("Action cancelled.", "info");
    }
    selectNode(nodeId);
  });

  on("starnet:action:deselect", () => {
    deselectNode();
    setSidebarMode("node");
    sidebarMode = "node";
  });

  on(TIMER.ICE_MOVE,   () => handleIceTick());
  on(TIMER.ICE_DETECT, (payload) => handleIceDetect(payload));
  on(TIMER.TRACE_TICK, () => handleTraceTick());

  on("starnet:action:probe", ({ nodeId, fromConsole }) => {
    if (!fromConsole) logCommand(`probe ${nodeId}`);
    probeNode(nodeId);
    setSidebarMode("node");
    sidebarMode = "node";
  });

  on("starnet:action:exploit", () => {
    setSidebarMode("exploit-select");
    sidebarMode = "exploit-select";
    emitEvent(E.STATE_CHANGED, getState());
  });

  on("starnet:action:escalate", () => {
    setSidebarMode("exploit-select");
    sidebarMode = "exploit-select";
    emitEvent(E.STATE_CHANGED, getState());
  });

  on("starnet:action:cancel", () => {
    setSidebarMode("node");
    sidebarMode = "node";
    emitEvent(E.STATE_CHANGED, getState());
  });

  on("starnet:action:launch-exploit", ({ nodeId, exploitId, cardIndex, fromConsole }) => {
    if (!fromConsole) logCommand(`exploit ${cardIndex ?? exploitId}`);

    // Click UI (exploit-select mode): stay in exploit-select on failure.
    const clickMode = sidebarMode === "exploit-select" && !fromConsole;
    if (!clickMode) {
      setSidebarMode("node");
      sidebarMode = "node";
    }

    const result = launchExploit(nodeId, exploitId);

    if (clickMode && result?.success) {
      setSidebarMode("node");
      sidebarMode = "node";
      emitEvent(E.STATE_CHANGED, getState());
    }
  });

  on("starnet:action:reconfigure", ({ nodeId, fromConsole }) => {
    if (!fromConsole) logCommand(`reconfigure ${nodeId}`);
    reconfigureNode(nodeId);
    setSidebarMode("node");
    sidebarMode = "node";
  });

  on("starnet:action:read", ({ nodeId, fromConsole }) => {
    if (!fromConsole) logCommand(`read ${nodeId}`);
    readNode(nodeId);
    setSidebarMode("node");
    sidebarMode = "node";
  });

  on("starnet:action:loot", ({ nodeId, fromConsole }) => {
    if (!fromConsole) logCommand(`loot ${nodeId}`);
    lootNode(nodeId);
    setSidebarMode("node");
    sidebarMode = "node";
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
    setSidebarMode("node");
    sidebarMode = "node";
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
