// @ts-nocheck — main.js is DOM event wiring; CustomEvent.detail typing noise outweighs benefit here.
import { initGraph, getCy, addIceNode, fitGraph, syncInitialNodes } from "./graph.js";
import { initGame, getState } from "../core/state.js";
import { startIce, handleIceTick, handleIceDetect } from "../core/ice.js";
import { initConsole, runCommand } from "./console.js";
import { on, emitEvent, E } from "../core/events.js";
import { tick, TICK_MS, TIMER, getVisibleTimers, pauseTimers, resumeTimers } from "../core/timers.js";
import { handleTraceTick } from "../core/alert.js";
import { initVisualRenderer } from "./visual-renderer.js";
import { initLogRenderer } from "./log-renderer.js";
import { buildActionContext, initActionDispatcher, buildNodeClickHandler } from "../core/actions/action-context.js";
import { openDarknetsStore } from "./store.js";
import { initGraphBridge } from "../core/graph-bridge.js";
import { initDynamicActions } from "../core/console-commands/dynamic-actions.js";

import { buildNetwork as buildCorporateFoothold } from "../../data/networks/corporate-foothold.js";
import { buildNetwork as buildResearchStation } from "../../data/networks/research-station.js";
import { buildNetwork as buildCorporateExchange } from "../../data/networks/corporate-exchange.js";
import { buildNetwork as buildGenerated } from "../../data/networks/generated.js";

/** Available graph-based networks. */
const NETWORKS = {
  "corporate-foothold": buildCorporateFoothold,
  "research-station": buildResearchStation,
  "corporate-exchange": buildCorporateExchange,
};

/** Read network from URL params. Supports hand-crafted networks and generated. */
function getSelectedNetwork() {
  const p = new URLSearchParams(location.search);
  const name = p.get("network") ?? "corporate-foothold";

  if (name === "generated") {
    const spec = {
      threat:     p.get("threat")?.toUpperCase() ?? "C",
      wealth:     p.get("wealth")?.toUpperCase() ?? "B",
      complexity: p.get("complexity")?.toUpperCase() ?? "C",
      depth:      p.get("depth")?.toUpperCase() ?? "C",
    };
    const recipe = p.get("recipe");
    const lanGrade = p.get("lanGrade")?.toUpperCase() ?? p.get("lan-grade")?.toUpperCase();
    if (recipe) spec.recipeId = recipe;
    if (lanGrade) spec.lanGrade = lanGrade;
    const seed = p.get("seed") ?? "gen-" + Date.now();
    const result = buildGenerated({ seed, spec });
    return () => result;
  }

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
    emitEvent("starnet:action", { actionId: "untarget" });
  });
  initConsole();
  initVisualRenderer();  // must subscribe before initGame fires STATE_CHANGED
  initGame(() => networkResult, undefined, { openDarknetsStore });
  initGraphBridge();
  initDynamicActions();
  syncInitialNodes(getState().nodes);
  fitGraph(cy);
  addIceNode();  // after layout — ICE polygon shape crashes cola bounding box calc
  startIce();
  let prevVisibleCount = 0;
  setInterval(() => {
    tick(1);
    const count = getVisibleTimers().length;
    // Emit on the falling edge to zero too, so timer-driven UI (e.g. the sidebar
    // ICE DETECTION countdown) clears when the last visible timer is cancelled.
    // Otherwise the last-rendered countdown lingers forever after the player
    // leaves the dwell node.
    if (count > 0 || prevVisibleCount > 0) emitEvent(E.TIMERS_UPDATED, getState());
    prevVisibleCount = count;
  }, TICK_MS);

  // LLM playtesting API — accessible via browser console or Playwright evaluate
  window.starnet = { cmd: runCommand, state: getState };

  // Pause timers when tab is hidden; resume when visible again
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseTimers();
    else resumeTimers();
  });

  // Bridge: forward DOM CustomEvents from web components to the event bus.
  // Components dispatch "starnet:action" as DOM events (bubbling); the action
  // dispatcher listens on the event bus. This listener connects the two.
  document.addEventListener("starnet:action", (e) => {
    emitEvent("starnet:action", e.detail);
  });

  // Wire HUD actions via <starnet-hud> custom events
  let _userPaused = false;
  const hudEl = document.getElementById("hud");
  hudEl.addEventListener("hud-action", (e) => {
    const { action, file } = e.detail;
    switch (action) {
      case "new-run":
        import("./level-select.js").then(m => m.openLevelSelect());
        break;
      case "pause":
        _userPaused = !_userPaused;
        if (_userPaused) pauseTimers(); else resumeTimers();
        hudEl.paused = _userPaused;
        break;
      case "save":
        import("./save-load.js").then(({ saveGame }) => saveGame());
        break;
      case "load":
        if (file) import("./save-load.js").then(({ restoreFromFile }) => restoreFromFile(file, { openDarknetsStore }));
        break;
      case "jackout":
        emitEvent("starnet:action", { actionId: "jackout" });
        break;
    }
  });

  const ctx = buildActionContext(openDarknetsStore);
  initActionDispatcher(ctx);

  on(TIMER.ICE_MOVE,     () => handleIceTick());
  on(TIMER.ICE_DETECT,   (payload) => handleIceDetect(payload));
  on(TIMER.TRACE_TICK,   () => handleTraceTick());
  // Probe, exploit, read, loot, reboot timers removed — timed-action operator drives these

  // Run-again: from end screen component (custom event) or legacy event bus
  const runAgainHandler = () => {
    initGame(() => buildNetworkFn(), undefined, { openDarknetsStore });
    const cy = getCy();
    if (cy) fitGraph(cy);
    addIceNode();
    startIce();
  };
  on("starnet:action:run-again", runAgainHandler);
  document.getElementById("end-screen")?.addEventListener("run-again", runAgainHandler);
}

document.addEventListener("DOMContentLoaded", init);
