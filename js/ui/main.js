// @ts-check
import { initGraph } from "./graph.js";
import { getState, toggleMenuOpen, toggleHandCollapsed } from "../core/state.js";
import { handleIceTick, handleIceDetect } from "../core/ice.js";
import { initConsole, runCommand } from "./console.js";
import { on, emitEvent, E } from "../core/events.js";
import { tick, TICK_MS, TIMER, getVisibleTimers, pauseTimers, resumeTimers } from "../core/timers.js";
import { handleTraceTick } from "../core/alert.js";
import { initVisualRenderer } from "./visual-renderer.js";
import { initLogRenderer } from "./log-renderer.js";
import { initAudioRenderer, toggleMusic, isMusicEnabled } from "../audio/audio-renderer.js";
import { initSfxRenderer, isSfxEnabled, toggleSfx } from "../audio/sfx/renderer.js";
import { getAudioEngine } from "../audio/engine-select.js";
import { buildActionContext, initActionDispatcher, buildNodeClickHandler } from "../core/actions/action-context.js";
import { openDarknetsStore } from "./store.js";
import { initGraphBridge } from "../core/graph-bridge.js";
import { initDynamicActions } from "../core/console-commands/dynamic-actions.js";
import { initRng } from "../core/rng.js";
import { toCytoscapeFormat } from "./run-control.js";
import { openHub, initHub, quickStartRun } from "./hub.js";
import { initProfileRunCommit } from "./profile-store.js";
import { initResizers } from "./resizers.js";
import "./hub-commands.js";
import "../audio/music-commands.js";
import "../audio/sfx/commands.js";
import "../audio/strudel/commands.js";   // `audio engine <tone|strudel>` — registered for both engines

import { NAMED_NETWORKS, DEFAULT_NETWORK, buildGenerated } from "../../data/networks/index.js";

/** Read network from URL params. Supports hand-crafted networks and generated. */
function getSelectedNetwork() {
  const p = new URLSearchParams(location.search);
  const name = p.get("network") ?? DEFAULT_NETWORK;

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

  return NAMED_NETWORKS[name] ?? NAMED_NETWORKS[DEFAULT_NETWORK];
}

/** Module-scope: the default network builder, used to seed the empty graph at boot. */
const buildNetworkFn = getSelectedNetwork();

function init() {
  // Initialize the RNG streams up front. Previously initGame did this at boot, but
  // now boot opens the hub first, and the hub bootstraps a fresh profile (generating
  // a starter exploit hand) before any run — so the RNG must be ready beforehand.
  // Each run's initGame re-seeds per its own seed afterward.
  initRng();

  // Build the cytoscape instance once from a default topology. The board starts
  // empty; the hub launches the first (and every) run via run-control's startRun,
  // which resets the graph to the chosen target's topology.
  const cytoscapeNetwork = toCytoscapeFormat(buildNetworkFn());

  initLogRenderer();
  initGraph(cytoscapeNetwork, buildNodeClickHandler(), () => {
    emitEvent("starnet:action", { actionId: "untarget" });
  });
  initConsole();
  initResizers();  // apply saved layout + wire the resize splitters
  initVisualRenderer();  // must subscribe before initGame fires STATE_CHANGED
  // Audio engine select (boot-time; switching requires a reload). Strudel is the default; the legacy
  // Tone engine loads only when explicitly selected, so default users never download its bundle.
  let audioEngine = null;   // exposed as window.starnet.audio (Tone engine, or null under Strudel)
  if (getAudioEngine() === "strudel") {
    import("../audio/strudel/index.js").then((m) => m.initStrudelEngine());
  } else {
    audioEngine = initAudioRenderer();   // browser-only reactive audio; silent until a run starts
    initSfxRenderer();
  }
  initGraphBridge();
  initDynamicActions();
  initProfileRunCommit();  // wire RUN_ENDED → commit results back to the profile
  initHub();               // wire the hub component's events to the controller

  let prevVisibleCount = 0;
  setInterval(() => {
    if (!getState()) return;  // no active run yet (player is in the hub at boot)
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
  /** @type {any} */ (window).starnet = { cmd: runCommand, state: getState, audio: audioEngine };

  // Pause timers when tab is hidden; resume when visible again
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseTimers();
    else resumeTimers();
  });

  // Bridge: forward DOM CustomEvents from web components to the event bus.
  // Components dispatch "starnet:action" as DOM events (bubbling); the action
  // dispatcher listens on the event bus. This listener connects the two.
  document.addEventListener("starnet:action", (e) => {
    emitEvent("starnet:action", /** @type {CustomEvent} */ (e).detail);
  });

  // Hand collapse toggle — mirrors the console `hand` command.
  document.addEventListener("starnet:toggle-hand", () => {
    const c = toggleHandCollapsed();
    const handEl = /** @type {any} */ (document.getElementById("hand-strip"));
    if (handEl) handEl.collapsed = c;
  });

  // Wire HUD actions via <starnet-hud> custom events. hudEl is the custom element,
  // typed `any` so its component props (.paused) and CustomEvent details don't need casts.
  let _userPaused = false;
  const hudEl = /** @type {any} */ (document.getElementById("hud"));
  hudEl.musicEnabled = isMusicEnabled();  // reflect the persisted music preference
  hudEl.sfxEnabled = isSfxEnabled();
  // Keep the menu button in sync however music is toggled (button OR `music` console command).
  on(E.MUSIC_CHANGED, ({ enabled }) => { hudEl.musicEnabled = enabled; });
  on(E.SFX_CHANGED, ({ enabled }) => { hudEl.sfxEnabled = enabled; });
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
      case "toggle-menu": {
        const open = toggleMenuOpen();
        hudEl.menuOpen = open;
        break;
      }
      case "toggle-music":
        toggleMusic();  // emits MUSIC_CHANGED → the handler above updates the button
        break;
      case "toggle-sfx":
        toggleSfx();  // emits SFX_CHANGED → the handler above updates the button
        break;
    }
  });

  const ctx = buildActionContext(openDarknetsStore);
  initActionDispatcher(ctx);

  on(TIMER.ICE_MOVE,     (payload) => handleIceTick(payload));
  on(TIMER.ICE_DETECT,   (payload) => handleIceDetect(payload));
  on(TIMER.TRACE_TICK,   () => handleTraceTick());
  // Probe, exploit, read, loot, reboot timers removed — timed-action operator drives these

  // End-screen button / legacy run-again event → return to the hub, where the
  // player re-equips and launches the next target. (The RUN_ENDED commit to the
  // profile has already run by this point.)
  const returnToHub = () => openHub();
  on("starnet:action:run-again", returnToHub);
  document.getElementById("end-screen")?.addEventListener("run-again", returnToHub);

  // Boot. An explicit ?network= deep-link is a fast-start request — skip the overworld
  // hub and jack straight into that network with a canned starter loadout. Otherwise (or
  // if the fast-start can't prepare a loadout) boot into the hub.
  const wantsFastStart = new URLSearchParams(location.search).has("network");
  if (!(wantsFastStart && quickStartRun(buildNetworkFn()))) {
    openHub();
  }
}

document.addEventListener("DOMContentLoaded", init);
