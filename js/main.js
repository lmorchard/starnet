// @ts-nocheck — main.js is DOM event wiring; CustomEvent.detail typing noise outweighs benefit here.
import { NETWORK } from "../data/network.js";
import { initGraph, getCy, addIceNode } from "./graph.js";
import { initState, getState, selectNode, deselectNode, probeNode, launchExploit, reconfigureNode, readNode, lootNode, endRun, ejectIce, rebootNode, completeReboot } from "./state.js";
import { addLogEntry } from "./log-renderer.js";
import { startIce, stopIce, handleIceTick, handleIceDetect, cancelIceDwell } from "./ice.js";
import { initConsole, runCommand } from "./console.js";
import { on, emitEvent, E } from "./events.js";
import { initVisualRenderer, setSidebarMode } from "./visual-renderer.js";
import { initLogRenderer } from "./log-renderer.js";

// Current UI mode for the sidebar: 'node' | 'exploit-select'
// Kept here (not in visual-renderer) because it's set by action event handlers.
let sidebarMode = "node";

function init() {
  initLogRenderer();
  const cy = initGraph(NETWORK, onNodeClick, () => {
    document.dispatchEvent(new CustomEvent("starnet:action:deselect", { detail: {} }));
  });
  addIceNode();
  initConsole();
  initVisualRenderer();  // must subscribe before initState fires STATE_CHANGED
  initState(NETWORK);
  fitGraph(cy);
  startIce();

  // LLM playtesting API — accessible via browser console or Playwright evaluate
  window.starnet = { cmd: runCommand, state: getState };

  on(E.STATE_CHANGED, (s) => {
    if (s.phase === "ended") stopIce();
  });

  // Wire HUD jack-out button
  document.getElementById("jack-out-btn").addEventListener("click", () => {
    document.dispatchEvent(new CustomEvent("starnet:action:jackout", { detail: {} }));
  });

  // ── Action event listeners ────────────────────────────────
  // Click-sourced events (no fromConsole flag) echo their equivalent command to the log.

  document.addEventListener("starnet:action:select", (evt) => {
    if (!evt.detail.fromConsole) addLogEntry(`> select ${evt.detail.nodeId}`, "command");
    if (sidebarMode !== "node") {
      setSidebarMode("node");
      sidebarMode = "node";
      addLogEntry("Action cancelled.", "info");
    }
    selectNode(evt.detail.nodeId);
  });

  document.addEventListener("starnet:action:deselect", () => {
    cancelIceDwell();
    deselectNode();
    setSidebarMode("node");
    sidebarMode = "node";
  });

  document.addEventListener("starnet:timer:ice-move", () => handleIceTick());
  document.addEventListener("starnet:timer:ice-detect", (evt) => handleIceDetect(evt.detail));

  document.addEventListener("starnet:action:probe", (evt) => {
    if (!evt.detail.fromConsole) addLogEntry(`> probe ${evt.detail.nodeId}`, "command");
    probeNode(evt.detail.nodeId);
    setSidebarMode("node");
    sidebarMode = "node";
  });

  document.addEventListener("starnet:action:exploit", () => {
    setSidebarMode("exploit-select");
    sidebarMode = "exploit-select";
    emitEvent(E.STATE_CHANGED, getState());
  });

  document.addEventListener("starnet:action:escalate", () => {
    setSidebarMode("exploit-select");
    sidebarMode = "exploit-select";
    emitEvent(E.STATE_CHANGED, getState());
  });

  document.addEventListener("starnet:action:cancel", () => {
    setSidebarMode("node");
    sidebarMode = "node";
    emitEvent(E.STATE_CHANGED, getState());
  });

  document.addEventListener("starnet:action:launch-exploit", (evt) => {
    const { nodeId, exploitId } = evt.detail;
    if (!evt.detail.fromConsole) addLogEntry(`> exploit ${nodeId} ${exploitId}`, "command");

    // Click UI (exploit-select mode): stay in exploit-select on failure.
    const clickMode = sidebarMode === "exploit-select" && !evt.detail.fromConsole;
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

  document.addEventListener("starnet:action:reconfigure", (evt) => {
    if (!evt.detail.fromConsole) addLogEntry(`> reconfigure ${evt.detail.nodeId}`, "command");
    reconfigureNode(evt.detail.nodeId);
    setSidebarMode("node");
    sidebarMode = "node";
  });

  document.addEventListener("starnet:action:read", (evt) => {
    if (!evt.detail.fromConsole) addLogEntry(`> read ${evt.detail.nodeId}`, "command");
    readNode(evt.detail.nodeId);
    setSidebarMode("node");
    sidebarMode = "node";
  });

  document.addEventListener("starnet:action:loot", (evt) => {
    if (!evt.detail.fromConsole) addLogEntry(`> loot ${evt.detail.nodeId}`, "command");
    lootNode(evt.detail.nodeId);
    setSidebarMode("node");
    sidebarMode = "node";
  });

  document.addEventListener("starnet:action:jackout", (evt) => {
    if (!evt.detail.fromConsole) addLogEntry(`> jackout`, "command");
    endRun("success");
  });

  document.addEventListener("starnet:action:eject", (evt) => {
    if (!evt.detail.fromConsole) addLogEntry(`> eject`, "command");
    ejectIce();
  });

  document.addEventListener("starnet:action:reboot", (evt) => {
    if (!evt.detail.fromConsole) addLogEntry(`> reboot ${evt.detail.nodeId}`, "command");
    rebootNode(evt.detail.nodeId);
  });

  document.addEventListener("starnet:timer:reboot-complete", (evt) => {
    completeReboot(evt.detail.nodeId);
  });

  document.addEventListener("starnet:action:run-again", () => {
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
    document.dispatchEvent(new CustomEvent("starnet:action:deselect", { detail: {} }));
  } else {
    document.dispatchEvent(
      new CustomEvent("starnet:action:select", { detail: { nodeId } })
    );
  }
}

document.addEventListener("DOMContentLoaded", init);
