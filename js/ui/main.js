// @ts-nocheck — main.js is DOM event wiring; CustomEvent.detail typing noise outweighs benefit here.
import { NETWORK } from "../../data/network.js";
import { generateNetwork } from "../core/network/network-gen.js";
import { initGraph, getCy, addIceNode, fitGraph } from "./graph.js";
import { initState, getState } from "../core/state.js";
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
import { openLevelSelect } from "./level-select.js";

/** Read seed/time/money from URL search params. Returns null if any are missing. */
function getNetworkParams() {
  const p = new URLSearchParams(location.search);
  const seed  = p.get("seed");
  const time  = p.get("time")?.toUpperCase();
  const money = p.get("money")?.toUpperCase();
  if (seed && time && money) return { seed, timeCost: time, moneyCost: money };
  return null;
}

/** Active network for this session — generated from URL params or static fallback. */
let network = NETWORK;
{
  const params = getNetworkParams();
  if (params) {
    try {
      network = generateNetwork(params.seed, params.timeCost, params.moneyCost);
    } catch (err) {
      console.warn("[starnet] generateNetwork failed, using static network:", err);
    }
  }
}

function init() {
  initLogRenderer();
  const cy = initGraph(network, buildNodeClickHandler(), () => {
    emitEvent("starnet:action", { actionId: "deselect" });
  });
  addIceNode();
  initConsole();
  initVisualRenderer();  // must subscribe before initState fires STATE_CHANGED
  initState(network);
  fitGraph(cy);
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

  // Wire new run button
  document.getElementById("new-run-btn").addEventListener("click", openLevelSelect);

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

  const ctx = buildActionContext();
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
    initState(network);
    const cy = getCy();
    if (cy) fitGraph(cy);
    addIceNode();
    startIce();
  });
}

document.addEventListener("DOMContentLoaded", init);
