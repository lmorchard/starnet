// @ts-nocheck
// Strudel runtime boot — browser-only. Dynamically imports the vendored @strudel/web bundle
// (importmap "@strudel/web" → dist/strudel.js) so non-Strudel paths never download it.
//
// @strudel/web@1.3.0 matches the strudel.cc dialect. initStrudel() registers the pattern/synth
// globals (note/sound/stack/signal/superdough/evaluate/hush/getAudioContext/samples/setcpm) on
// window ASYNCHRONOUSLY and returns undefined — POLL for readiness, never await it.
// (Findings carried from the audio-engine spikes.)

let _booting = null;

const REQUIRED = ["evaluate", "superdough", "stack", "note", "sound", "signal", "hush", "getAudioContext", "samples"];

/**
 * Boot the Strudel runtime once (idempotent — same promise on repeat calls).
 * Does NOT resume the AudioContext (needs a user gesture; the caller does it).
 * @returns {Promise<object>} handle of the live runtime globals + the AudioContext (`ctx`).
 */
export function bootStrudel() {
  if (_booting) return _booting;
  _booting = (async () => {
    await import("@strudel/web"); // side effect: registers window.initStrudel
    if (typeof window.initStrudel !== "function") {
      throw new Error("[strudel] initStrudel not found after import (bundle problem?)");
    }
    window.initStrudel();
    const t0 = Date.now();
    while (!REQUIRED.every((k) => typeof window[k] === "function")) {
      if (Date.now() - t0 > 10000) throw new Error("[strudel] timed out waiting for runtime globals");
      await new Promise((r) => setTimeout(r, 60));
    }
    const rt = {};
    for (const k of REQUIRED) rt[k] = window[k];
    rt.setcpm = window.setcpm; // may be transpiler-injected only; keep a ref if present
    rt.ctx = window.getAudioContext();
    return rt;
  })();
  return _booting;
}
