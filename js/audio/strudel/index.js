// @ts-nocheck
// In-game Strudel + superdough audio engine — owns music (reactive songs), one-shot SFX, and
// action drones. The single audio engine (#267 retired the legacy Tone.js engine). Built on the
// 1.3.0 base from #266 (runtime + signal registry/bridge + GeneralUser GS soundfont) + the song
// model (evaluate strudel-song content).
//
// Browser-only — main.js dynamic-imports it so the @strudel/web bundle downloads lazily.
// Music/SFX on/off prefs + the MUSIC_CHANGED/SFX_CHANGED events live in js/audio/audio-prefs.js;
// this engine reads them at boot and listens for changes.
import { on, emitEvent, E } from "../../core/events.js";
import { getState } from "../../core/state.js";
import { bootStrudel } from "./runtime.js";
import { loadGameSoundfont } from "./soundfont.js";
import { installGameSignals } from "./signal-bridge.js";
import { createSfx } from "./sfx.js";
import { resolveCue, resolveActionCue } from "./data/cues.js";
import { createDroneVoice } from "./drones.js";
import { DRONES, resolveActionDrone } from "./data/drones.js";
import { loadSongs, HUB_ID } from "./songs/index.js";
import { isMusicEnabled, isSfxEnabled } from "../audio-prefs.js";

const SFX_EVENTS = [
  E.NODE_REVEALED, E.NODE_ACCESSED, E.ACTION_RESOLVED,
  E.ALERT_GLOBAL_RAISED, E.ICE_DETECTED, E.ALERT_TRACE_STARTED,
];

let _started = false;
let _sfx = null;   // the live SFX instance (set in wire()), for the `sfx test <cue>` command

/** Play a one-shot cue by id — for the console `sfx test <cue>` command. No-op until the engine boots. */
export function playSfxCue(id) { _sfx?.playCue(id); }

/** Wire and boot the in-game Strudel engine. Idempotent. */
export function initStrudelEngine() {
  if (_started) return;
  _started = true;
  function arm() {
    window.removeEventListener("pointerdown", arm);
    window.removeEventListener("keydown", arm);
    bootStrudel()
      .then(async (rt) => {
        await rt.ctx.resume();
        await loadGameSoundfont();       // register gus_* (needed by songs); ~32MB, once
        try { await rt.samples("github:tidalcycles/dirt-samples"); } catch (_) { /* offline: drums silent */ }
        const songs = await loadSongs().catch((e) => { console.warn("[strudel] song load failed:", e); return []; });
        wire(rt, songs);
      })
      .catch((e) => console.warn("[strudel] boot failed:", e));
  }
  window.addEventListener("pointerdown", arm);
  window.addEventListener("keydown", arm);
}

function wire(rt, songs = []) {
  installGameSignals(rt);                // gameProgress/gameThreat as live signals + STATE_CHANGED bridge
  let musicEnabled = isMusicEnabled();
  let runActive = false;
  let runSong = null;                    // the run's picked song

  const hubSong = songs.find((s) => s.id === HUB_ID) || null;
  const runSongs = songs.filter((s) => s.id !== HUB_ID);
  const pickRunSong = () => runSongs[Math.floor(Math.random() * runSongs.length)] || runSongs[0] || hubSong;
  let override = null;                    // explicit `music set/next` selection (song id); overrides the run/hub pick

  // ---- Music (reactive songs) — play via the repl; stop via repl hush (clears $: patterns) ------
  const play = (song) => {
    if (!song) return;
    try { rt.evaluate(song.code); emitEvent(E.MUSIC_SONG_CHANGED, { id: song.id, name: song.name }); }
    catch (e) { console.warn("[strudel] song eval failed:", e); }
  };
  const stop = () => { try { rt.evaluate("hush()"); } catch (_) {} };
  const byId = (id) => songs.find((s) => s.id === id) || null;
  const desired = () => (override && byId(override)) || (runActive ? runSong : hubSong);
  const refresh = () => { if (musicEnabled) play(desired()); else stop(); };

  // Boot-race guard: if a run is already live by the time the engine booted (the RUN_STARTED
  // handler below wasn't registered yet when it fired), reflect that so we play a run song, not hub.
  if (getState()) { runActive = true; runSong = pickRunSong(); }
  refresh();                             // hub or run song at boot (if enabled)

  on(E.RUN_STARTED, () => {
    runActive = true;                    // random run score (like the Tone engine); clears any manual pick
    override = null;
    runSong = pickRunSong();
    refresh();
  });
  on(E.RUN_ENDED, () => { runActive = false; override = null; refresh(); });
  on(E.MUSIC_CHANGED, ({ enabled }) => { musicEnabled = !!enabled; refresh(); });
  // `music set/next/random` (console) → switch immediately (persists until the next run).
  on(E.MUSIC_SONG_SELECT, ({ songId }) => { override = songId; refresh(); });

  // ---- One-shot SFX -----------------------------------------------------------------------------
  const sfx = createSfx(rt);
  _sfx = sfx;                            // expose for the `sfx test <cue>` command
  sfx.setEnabled(isSfxEnabled());
  for (const type of SFX_EVENTS) {
    on(type, (payload) => { const spec = resolveCue(type, payload); if (spec) sfx.play(spec); });
  }

  // ---- Action drones (sustained, progress-driven; raw Web Audio) --------------------------------
  // #187 Phase 3: drone + completion-cue ids resolve via resolveActionDrone/resolveActionCue
  // (inline payload.feedback → central ACTION_FEEDBACK_PROFILES → the legacy resolveDrone()
  // fallback for drones / DEFAULT_PROFILE otherwise) — see js/audio/strudel/data/drones.js and
  // data/cues.js. `feedback` only rides the "start" payload (operators.js), so the resolved
  // completion cue is remembered per in-flight action for playback at "complete".
  const drones = new Map();
  const pendingCues = new Map();
  const stopAllDrones = () => { for (const d of drones.values()) d.stop(); drones.clear(); pendingCues.clear(); };
  on(E.ACTION_FEEDBACK, (payload) => {
    if (!sfx.isEnabled()) return;
    const { nodeId, action, phase, progress, feedback } = payload || {};
    const key = `${nodeId}:${action}`;
    if (phase === "start") {
      if (!drones.has(key)) {
        const id = resolveActionDrone(action, feedback);
        if (id) drones.set(key, createDroneVoice(rt.ctx, DRONES[id]));
      }
      pendingCues.set(key, resolveActionCue(action, feedback));
    } else if (phase === "progress") {
      drones.get(key)?.setProgress(progress ?? 0);
    } else if (phase === "complete" || phase === "cancel") {
      drones.get(key)?.stop();
      drones.delete(key);
      if (phase === "complete") {
        const cueId = pendingCues.get(key);
        if (cueId) sfx.playCue(cueId);
      }
      pendingCues.delete(key);
    }
  });
  on(E.RUN_ENDED, stopAllDrones);
  on(E.SFX_CHANGED, ({ enabled }) => { sfx.setEnabled(!!enabled); if (!enabled) stopAllDrones(); });

  /** @type {any} */ (window).strudelEngine = { rt, sfx, drones };
  console.log("[strudel] in-game engine booted (songs + sfx + drones)");
}
