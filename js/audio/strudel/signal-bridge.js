// @ts-nocheck
// Installs the registered game signals (js/audio/signal-registry.js) as live global Strudel
// signals a song can reference by name (e.g. `gameProgress`, `gameThreat`), and refreshes their values on
// STATE_CHANGED. Browser-only.
//
// A song authored in strudel.cc references the same names; there the author fakes them (a prelude
// of `let gameProgress = signal(() => ...)` or slider-driven values). In-game / in the preview tool
// these are the REAL game values — that's the injection point. Bidirectional by shared naming.
import { on, E } from "../../core/events.js";
import { getState } from "../../core/state.js";
import { SIGNAL_REGISTRY, computeSignals } from "../signal-registry.js";

/**
 * @param {object} rt runtime handle from bootStrudel() (needs rt.signal)
 * @returns {{ getLive: () => Record<string, number>, setLive: (name: string, v: number) => void, names: string[] }}
 *   `setLive` lets the preview tool drive signals from sliders (no game running).
 */
export function installGameSignals(rt) {
  /** @type {Record<string, number>} live 0..1 values the Strudel signals sample each cycle */
  let live = computeSignals(getState());

  for (const name of Object.keys(SIGNAL_REGISTRY)) {
    // window.<name> is a Strudel signal re-sampling the live value every cycle — songs use it directly.
    window[name] = rt.signal(() => live[name] ?? 0);
  }

  // Recompute unconditionally: computeSignals(null) → defaults (0), so signals reset between runs
  // instead of getting stuck at the last run's values.
  on(E.STATE_CHANGED, (state) => { live = computeSignals(state); });

  return {
    names: Object.keys(SIGNAL_REGISTRY),
    getLive: () => ({ ...live }),
    setLive: (name, v) => { if (name in live) live[name] = v; },
  };
}
