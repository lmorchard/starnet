// @ts-nocheck
// One-shot SFX engine — fires superdough voices from cue specs. The strudel counterpart to the
// Tone sfx/engine.js play() path. Browser-only (needs the live runtime + AudioContext).
import { CUES } from "./data/cues.js";

const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/**
 * @param {object} rt  runtime handle from bootStrudel() (needs rt.superdough + rt.ctx)
 */
export function createSfx(rt) {
  let enabled = true;
  // Dedupe per distinct cue spec (the CUES entries are stable singletons), so e.g. the
  // xploit.ok and xploit.fail specs never suppress each other within the window — they're
  // different objects. Identical specs fired twice within 50ms collapse (anti machine-gun).
  const lastBySpec = new WeakMap();

  return {
    setEnabled(on) { enabled = !!on; },
    isEnabled() { return enabled; },

    /**
     * Fire a cue spec. Dedupes the same spec within 50ms (avoids machine-gunning identical cues).
     * @param {object} spec  a CUES entry ({ ...superdoughValue, _dur })
     */
    play(spec) {
      if (!enabled || !spec) return;
      const t = nowMs();
      if (t - (lastBySpec.get(spec) ?? -1e9) < 50) return;
      lastBySpec.set(spec, t);
      const { _dur, ...value } = spec;
      // @strudel/web 1.3.0: superdough SKIPS haps scheduled in the past (t < ctx.currentTime).
      // Fire at ctx.currentTime (+ a tiny lookahead) — NOT 0 (which 1.0.3 tolerated but 1.3.0 drops).
      try { rt.superdough(value, rt.ctx.currentTime + 0.01, _dur ?? 0.2); } catch (_) { /* dropped voice */ }
    },

    /** Fire a cue by id (console `sfx test` / harness). @param {string} id */
    playCue(id) { this.play(CUES[id]); },
  };
}
