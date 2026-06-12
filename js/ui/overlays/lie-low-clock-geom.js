// @ts-check
// Pure math for the lie-low clock overlay (no DOM — unit-testable). The overlay itself
// (lie-low-clock.js) draws a dodecagon "clock" on the WAN node while LIE LOW runs: edges
// light up chunkily one-at-a-time as the wait progresses (like the PROBE facet reveal),
// while hour + minute hands spin clockwise in fast-forward.

/** First vertex / 12 o'clock. SVG y is down, so up = -PI/2; clockwise = +. */
export const TOP = -Math.PI / 2;

/** Minute-hand revolutions per second — the "fast-forward" spin rate. */
export const SPIN_RPS = 2.5;

export const LED_OFF = 0.12; // unlit edge opacity (the dim ring)
export const LED_ON = 0.95;  // fully-lit edge opacity
/** Fraction of each edge's progress slot over which it alpha-fades in (chunky, not a creep). */
export const LED_FADE_FRAC = 0.35;

/**
 * Opacity for dodecagon edge `i` at the given lie-low progress. Each WHOLE edge fades in
 * one at a time, clockwise, as progress enters its `1/sides` slot — discrete per edge (no
 * partial geometric fill along an edge), matching the PROBE facet reveal.
 * @param {number} progress 0..1
 * @param {number} i edge index (0 = the 12 o'clock edge, increasing clockwise)
 * @param {number} sides polygon side count
 * @param {{off?:number,on?:number,fadeFrac?:number}} [opts]
 * @returns {number} stroke-opacity 0..1
 */
export function ledOpacity(progress, i, sides, opts = {}) {
  const { off = LED_OFF, on = LED_ON, fadeFrac = LED_FADE_FRAC } = opts;
  const slot = 1 / sides;
  const a = Math.max(0, Math.min(1, (progress - i * slot) / (slot * fadeFrac)));
  return off + (on - off) * a;
}

/**
 * Hour + minute hand angles (radians; 12 o'clock = TOP, clockwise positive) for the
 * fast-forward spin at `elapsedSec`. The minute hand sweeps at `rps`; the hour hand 12x slower.
 * @param {number} elapsedSec seconds the lie-low has been running
 * @param {number} [rps]
 * @returns {{ hour: number, minute: number }}
 */
export function handAngles(elapsedSec, rps = SPIN_RPS) {
  return {
    minute: TOP + elapsedSec * rps * 2 * Math.PI,
    hour: TOP + elapsedSec * (rps / 12) * 2 * Math.PI,
  };
}
