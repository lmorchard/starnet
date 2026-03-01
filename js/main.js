// @ts-nocheck — main.js is DOM event wiring; CustomEvent.detail typing noise outweighs benefit here.
import { NETWORK } from "../data/network.js";
import { initGraph, getCy, addIceNode, fitGraph } from "./graph.js";
import { initState, getState } from "./state.js";
import { completeReboot } from "./node-orchestration.js";
import { handleExploitExecTimer, handleExploitNoiseTimer } from "./exploit-exec.js";
import { handleProbeScanTimer } from "./probe-exec.js";
import { handleReadScanTimer } from "./read-exec.js";
import { startIce, handleIceTick, handleIceDetect } from "./ice.js";
import { initConsole, runCommand } from "./console.js";
import { on, emitEvent, E } from "./events.js";
import { tick, TICK_MS, TIMER, getVisibleTimers, pauseTimers, resumeTimers } from "./timers.js";
import { handleTraceTick } from "./alert.js";
import { initVisualRenderer } from "./visual-renderer.js";
import { initLogRenderer } from "./log-renderer.js";
import { initNodeLifecycle } from "./node-lifecycle.js";
import { buildActionContext, initActionDispatcher, buildNodeClickHandler } from "./action-context.js";

function init() {
  initLogRenderer();
  const cy = initGraph(NETWORK, buildNodeClickHandler(), () => {
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

  // Pause timers when tab is hidden; resume when visible again
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseTimers();
    else resumeTimers();
  });

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

document.addEventListener("DOMContentLoaded", init);
