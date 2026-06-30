// @ts-nocheck
// Strudel + superdough audio engine — the single module that owns music, one-shot SFX, and
// action drones when the "strudel" engine is selected (js/audio/engine-select.js). The faithful
// promotion of js/audio/strudel-spike.js (branch strudel-ingame-spike).
//
// Browser-only — do NOT import from headless entry points (scripts/playtest.js, bot/cli.js).
// Tone-default users never load this module (main.js dynamic-imports it only when selected).
//
// Pref + event ownership stays in the Tone renderer modules: setMusicEnabled/setSfxEnabled still
// write localStorage + emit MUSIC_CHANGED/SFX_CHANGED even when the Tone engine isn't running, so
// the HUD buttons + music/sfx console commands keep working — this engine just listens.
import { on, E } from "../../core/events.js";
import { getState } from "../../core/state.js";
import { deriveProgress, deriveThreat } from "../signals.js";
import { bootStrudel } from "./runtime.js";
import { createMusic } from "./music.js";
import { createSfx } from "./sfx.js";
import { resolveCue } from "./data/cues.js";
import { createDroneVoice } from "./drones.js";
import { DRONES, resolveDrone } from "./data/drones.js";
import { CORPORATE } from "./data/corporate.js";

// Phase-1 one-shot SFX events (issue #254). Other routed events resolve to no cue for now.
const SFX_EVENTS = [
  E.NODE_REVEALED, E.NODE_ACCESSED, E.ACTION_RESOLVED,
  E.ALERT_GLOBAL_RAISED, E.ICE_DETECTED, E.ALERT_TRACE_STARTED,
];

let _started = false;

// Client prefs (same keys the Tone renderers use; read directly since those modules aren't inited).
function loadPref(key, dflt = true) {
  try { const v = localStorage.getItem(key); return v === null ? dflt : v === "true"; }
  catch { return dflt; }
}

/** Wire and boot the Strudel engine. Idempotent. */
export function initStrudelEngine() {
  if (_started) return;
  _started = true;

  // AudioContext needs a user gesture; boot + resume on the first one (pointer or key).
  function arm() {
    window.removeEventListener("pointerdown", arm);
    window.removeEventListener("keydown", arm);
    bootStrudel()
      .then((rt) => rt.ctx.resume().then(() => wire(rt)))
      .catch((e) => console.warn("[strudel] boot failed:", e));
  }
  window.addEventListener("pointerdown", arm);
  window.addEventListener("keydown", arm);
}

/** Wire music (+ SFX/drones in later slices) once the runtime is live. */
function wire(rt) {
  const music = createMusic(rt);
  let musicEnabled = loadPref("starnet:music-enabled");

  // Seed the axes from current state, then start if enabled.
  const s = getState();
  if (s) { music.setProgress(deriveProgress(s)); music.setThreat(deriveThreat(s)); }
  if (musicEnabled) music.start(CORPORATE);

  on(E.STATE_CHANGED, (state) => {
    if (!state) return;
    music.setProgress(deriveProgress(state));
    music.setThreat(deriveThreat(state));
  });

  // The HUD music toggle / `music on|off` command emit MUSIC_CHANGED (via the Tone renderer's
  // setMusicEnabled, which still runs); react to it here.
  on(E.MUSIC_CHANGED, ({ enabled }) => {
    musicEnabled = !!enabled;
    if (musicEnabled) music.start(CORPORATE);
    else music.stop();
  });

  // ---- One-shot SFX -----------------------------------------------------------------------------
  const sfx = createSfx(rt);
  sfx.setEnabled(loadPref("starnet:sfx-enabled"));
  for (const type of SFX_EVENTS) {
    on(type, (payload) => {
      const spec = resolveCue(type, payload);
      if (spec) sfx.play(spec);   // dedupe is per-spec (see sfx.js) — variants never collide
    });
  }
  // ---- Action drones (sustained, progress-driven; raw Web Audio) --------------------------------
  const drones = new Map(); // "<nodeId>:<action>" → voice handle
  const stopAllDrones = () => { for (const d of drones.values()) d.stop(); drones.clear(); };
  on(E.ACTION_FEEDBACK, (payload) => {
    if (!sfx.isEnabled()) return;   // drones are SFX — gated by the SFX pref
    const { nodeId, action, phase, progress } = payload || {};
    const key = `${nodeId}:${action}`;
    if (phase === "start") {
      if (drones.has(key)) return;  // already running (duplicate start) — don't restart
      const id = resolveDrone(action);
      if (!id) return;
      drones.set(key, createDroneVoice(rt.ctx, DRONES[id]));
    } else if (phase === "progress") {
      drones.get(key)?.setProgress(progress ?? 0);
    } else if (phase === "complete" || phase === "cancel") {
      drones.get(key)?.stop();
      drones.delete(key);
    }
  });
  on(E.RUN_ENDED, stopAllDrones);

  // The HUD SFX toggle / `sfx on|off` command emit SFX_CHANGED (via the Tone renderer); react here.
  on(E.SFX_CHANGED, ({ enabled }) => {
    sfx.setEnabled(!!enabled);
    if (!enabled) stopAllDrones();   // silence any in-progress drones immediately
  });

  // Expose a debug handle for the browser playtest API / perf harness.
  /** @type {any} */ (window).strudelEngine = { rt, music, sfx, drones, createDroneVoice, DRONES };
  console.log("[strudel] engine booted (music + sfx + drones live)");
}
