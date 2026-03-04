// @ts-nocheck — main.js is DOM event wiring; CustomEvent.detail typing noise outweighs benefit here.
import { initGraph, getCy, addIceNode, fitGraph, syncInitialNodes } from "./graph.js";
import { initGame, getState } from "../core/state.js";
import { completeReboot } from "../core/node-orchestration.js";
import { handleExploitExecTimer, handleExploitNoiseTimer } from "../core/actions/exploit-exec.js";
import { handleProbeScanTimer } from "../core/actions/probe-exec.js";
import { handleReadScanTimer } from "../core/actions/read-exec.js";
import { handleLootExtractTimer } from "../core/actions/loot-exec.js";
import { startIce, handleIceTick, handleIceDetect } from "../core/ice.js";
import { initConsole, runCommand } from "./console.js";
import { on, emitEvent, E } from "../core/events.js";
import { tick, TICK_MS, TIMER, getVisibleTimers, pauseTimers, resumeTimers } from "../core/timers.js";
import { handleTraceTick } from "../core/alert.js";
import { initVisualRenderer } from "./visual-renderer.js";
import { initLogRenderer } from "./log-renderer.js";
import { initNodeLifecycle } from "../core/node-lifecycle.js";
import { buildActionContext, initActionDispatcher, buildNodeClickHandler } from "../core/actions/action-context.js";
import { openDarknetsStore } from "./store.js";
import { initGraphBridge } from "../core/graph-bridge.js";

import { buildNetwork as buildCorporateFoothold } from "../../data/networks/corporate-foothold.js";
import { buildNetwork as buildResearchStation } from "../../data/networks/research-station.js";
import { buildNetwork as buildCorporateExchange } from "../../data/networks/corporate-exchange.js";

/** Available graph-based networks. */
const NETWORKS = {
  "corporate-foothold": buildCorporateFoothold,
  "research-station": buildResearchStation,
  "corporate-exchange": buildCorporateExchange,
};

/** Read network name from URL param, default to corporate-foothold. */
function getSelectedNetwork() {
  const p = new URLSearchParams(location.search);
  const name = p.get("network") ?? "corporate-foothold";
  return NETWORKS[name] ?? buildCorporateFoothold;
}

/**
 * Convert a graph network definition to the format initGraph (Cytoscape) expects.
 * @param {{ graphDef: { nodes: any[], edges: [string,string][] }, meta: any }} result
 */
function toCytoscapeFormat(result) {
  const { graphDef, meta } = result;
  return {
    nodes: graphDef.nodes.map(n => ({
      id: n.id,
      type: n.type,
      label: n.attributes?.label ?? n.id,
      grade: n.attributes?.grade ?? "D",
    })),
    edges: graphDef.edges.map(([a, b]) => ({ source: a, target: b })),
    startNode: meta.startNode,
    startCash: meta.startCash,
    moneyCost: meta.moneyCost,
    ice: meta.ice,
  };
}

/** Module-scope so run-again can reuse it. */
const buildNetworkFn = getSelectedNetwork();

function init() {
  const networkResult = buildNetworkFn();
  const cytoscapeNetwork = toCytoscapeFormat(networkResult);

  initLogRenderer();
  const cy = initGraph(cytoscapeNetwork, buildNodeClickHandler(), () => {
    emitEvent("starnet:action", { actionId: "deselect" });
  });
  initConsole();
  initVisualRenderer();  // must subscribe before initGame fires STATE_CHANGED
  initGame(() => networkResult, undefined, { openDarknetsStore });
  initGraphBridge();
  syncInitialNodes(getState().nodes);
  fitGraph(cy);
  addIceNode();  // after layout — ICE polygon shape crashes cola bounding box calc
  startIce();
  setInterval(() => {
    tick(1);
    if (getVisibleTimers().length > 0) emitEvent(E.TIMERS_UPDATED, getState());
  }, TICK_MS);

  // LLM playtesting API — accessible via browser console or Playwright evaluate
  window.starnet = { cmd: runCommand, state: getState };

  // Pause timers when tab is hidden; resume when visible again
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseTimers();
    else resumeTimers();
  });

  // New run button — disabled while procgen is removed; graph networks only for now
  const newRunBtn = document.getElementById("new-run-btn");
  if (newRunBtn) {
    newRunBtn.style.opacity = "0.3";
    newRunBtn.style.pointerEvents = "none";
    newRunBtn.title = "Network selection coming soon";
  }

  // Wire HUD pause button
  let _userPaused = false;
  const pauseBtn = document.getElementById("pause-btn");
  pauseBtn.addEventListener("click", () => {
    _userPaused = !_userPaused;
    if (_userPaused) {
      pauseTimers();
      pauseBtn.textContent = "[ RESUME ]";
      pauseBtn.classList.add("active");
    } else {
      resumeTimers();
      pauseBtn.textContent = "[ PAUSE ]";
      pauseBtn.classList.remove("active");
    }
  });

  // Wire HUD jack-out button
  document.getElementById("jack-out-btn").addEventListener("click", () => {
    emitEvent("starnet:action", { actionId: "jackout" });
  });

  // Wire save/load buttons
  document.getElementById("save-btn").addEventListener("click", () => {
    import("./save-load.js").then(({ saveGame }) => saveGame());
  });
  // Load uses a <label> wrapping a file input — clicking the label natively
  // triggers the file picker without programmatic .click() (most reliable).
  document.getElementById("load-file-input").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    import("./save-load.js").then(({ restoreFromFile }) => restoreFromFile(file));
    e.target.value = ""; // reset so the same file can be loaded again
  });

  const ctx = buildActionContext(openDarknetsStore);
  initActionDispatcher(ctx);

  on(TIMER.ICE_MOVE,     () => handleIceTick());
  on(TIMER.ICE_DETECT,   (payload) => handleIceDetect(payload));
  on(TIMER.TRACE_TICK,   () => handleTraceTick());
  on(TIMER.EXPLOIT_EXEC,   (payload) => handleExploitExecTimer(payload));
  on(TIMER.EXPLOIT_NOISE,  (payload) => handleExploitNoiseTimer(payload));
  on(TIMER.PROBE_SCAN,   (payload) => handleProbeScanTimer(payload));
  on(TIMER.READ_SCAN,    (payload) => handleReadScanTimer(payload));
  on(TIMER.LOOT_EXTRACT, (payload) => handleLootExtractTimer(payload));

  on(TIMER.REBOOT_COMPLETE, (payload) => {
    completeReboot(payload.nodeId);
  });

  on("starnet:action:run-again", () => {
    initGame(() => buildNetworkFn(), undefined, { openDarknetsStore });
    const cy = getCy();
    if (cy) fitGraph(cy);
    addIceNode();
    startIce();
  });
}

document.addEventListener("DOMContentLoaded", init);
