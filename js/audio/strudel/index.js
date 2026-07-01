// @ts-nocheck
// In-game Strudel + superdough audio engine — owns music (reactive songs), one-shot SFX, and
// action drones when the "strudel" engine is selected (js/audio/engine-select.js). Built on the
// 1.3.0 base from #266 (runtime + signal registry/bridge + GeneralUser GS soundfont) + the song
// model (evaluate strudel-song content), replacing #262's bespoke score interpreter.
//
// Browser-only. Tone-default users never load this (main.js dynamic-imports it only when selected).
// Pref/event ownership stays in the Tone renderer modules: setMusicEnabled/setSfxEnabled still write
// localStorage + emit MUSIC_CHANGED/SFX_CHANGED even when Tone isn't running, so the HUD buttons +
// music/sfx commands keep working — this engine just listens.
import { on, E } from "../../core/events.js";
import { bootStrudel } from "./runtime.js";
import { loadGameSoundfont } from "./soundfont.js";
import { installGameSignals } from "./signal-bridge.js";
import { createSfx } from "./sfx.js";
import { resolveCue } from "./data/cues.js";
import { createDroneVoice } from "./drones.js";
import { DRONES, resolveDrone } from "./data/drones.js";
import { loadSongs, HUB_ID } from "./songs/index.js";

const SFX_EVENTS = [
  E.NODE_REVEALED, E.NODE_ACCESSED, E.ACTION_RESOLVED,
  E.ALERT_GLOBAL_RAISED, E.ICE_DETECTED, E.ALERT_TRACE_STARTED,
];

let _started = false;
const loadPref = (key, dflt = true) => {
  try { const v = localStorage.getItem(key); return v === null ? dflt : v === "true"; } catch { return dflt; }
};

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
  installGameSignals(rt);                // progress/threat as live signals + STATE_CHANGED bridge
  let musicEnabled = loadPref("starnet:music-enabled");
  let runActive = false;
  let runSong = null;                    // the run's picked song

  const hubSong = songs.find((s) => s.id === HUB_ID) || null;
  const runSongs = songs.filter((s) => s.id !== HUB_ID);

  // ---- Music (reactive songs) — play via the repl; stop via repl hush (clears $: patterns) ------
  const play = (song) => { if (song) { try { rt.evaluate(song.code); } catch (e) { console.warn("[strudel] song eval failed:", e); } } };
  const stop = () => { try { rt.evaluate("hush()"); } catch (_) {} };
  const desired = () => (runActive ? runSong : hubSong);
  const refresh = () => { if (musicEnabled) play(desired()); else stop(); };

  refresh();                             // hub song at boot (if enabled)
  on(E.RUN_STARTED, () => {
    runActive = true;                                     // random run score (like the Tone engine)
    runSong = runSongs[Math.floor(Math.random() * runSongs.length)] || runSongs[0] || hubSong;
    refresh();
  });
  on(E.RUN_ENDED, () => { runActive = false; refresh(); });
  on(E.MUSIC_CHANGED, ({ enabled }) => { musicEnabled = !!enabled; refresh(); });

  // ---- One-shot SFX -----------------------------------------------------------------------------
  const sfx = createSfx(rt);
  sfx.setEnabled(loadPref("starnet:sfx-enabled"));
  for (const type of SFX_EVENTS) {
    on(type, (payload) => { const spec = resolveCue(type, payload); if (spec) sfx.play(spec); });
  }

  // ---- Action drones (sustained, progress-driven; raw Web Audio) --------------------------------
  const drones = new Map();
  const stopAllDrones = () => { for (const d of drones.values()) d.stop(); drones.clear(); };
  on(E.ACTION_FEEDBACK, (payload) => {
    if (!sfx.isEnabled()) return;
    const { nodeId, action, phase, progress } = payload || {};
    const key = `${nodeId}:${action}`;
    if (phase === "start") {
      if (drones.has(key)) return;
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
  on(E.SFX_CHANGED, ({ enabled }) => { sfx.setEnabled(!!enabled); if (!enabled) stopAllDrones(); });

  /** @type {any} */ (window).strudelEngine = { rt, sfx, drones };
  console.log("[strudel] in-game engine booted (songs + sfx + drones)");
}
