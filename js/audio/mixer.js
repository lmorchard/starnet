// @ts-check
// Pure mixing logic: score + (progress, threat) → per-layer gains + master filter.

/** Clamp x into [0,1]. @param {number} x */
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Linear interpolate. @param {number} a @param {number} b @param {number} t */
const lerp = (a, b, t) => a + (b - a) * clamp01(t);

/**
 * Smooth Hermite ramp from 0 at `lo` to 1 at `hi`.
 * @param {number} lo @param {number} hi @param {number} x @returns {number}
 */
export function smoothstep(lo, hi, x) {
  if (hi <= lo) return x >= hi ? 1 : 0;
  const t = clamp01((x - lo) / (hi - lo));
  return t * t * (3 - 2 * t);
}

/**
 * @typedef {Object} MasterFilterSpec
 * @property {number} cutoffLo
 * @property {number} cutoffHi
 * @property {number} qLo
 * @property {number} qHi
 */

/**
 * The subset of a score the mixer reads. Real scores carry more fields
 * (bpm, patterns, synth configs) which the mixer ignores.
 * @typedef {Object} AudioScore
 * @property {LayerSpec[]} layers
 * @property {MasterFilterSpec} masterFilter
 */

/**
 * @typedef {Object} LayerSpec
 * @property {string} key
 * @property {"base"|"progress"|"threat"} axis
 * @property {number} [baseGain]
 * @property {number} [progressBoost]
 * @property {number} [lo]
 * @property {number} [hi]
 */

/**
 * @param {AudioScore} score
 * @param {number} progress 0..1
 * @param {number} threat 0..1
 * @returns {{gains: Record<string, number>, masterCutoff: number, masterQ: number}}
 */
export function computeMix(score, progress, threat) {
  /** @type {Record<string, number>} */
  const gains = {};
  for (const layer of score.layers) {
    if (layer.axis === "base") {
      gains[layer.key] = clamp01((layer.baseGain ?? 0) + (layer.progressBoost ?? 0) * progress);
    } else {
      const axisVal = layer.axis === "threat" ? threat : progress;
      gains[layer.key] = smoothstep(layer.lo ?? 0, layer.hi ?? 1, axisVal);
    }
  }
  const mf = score.masterFilter;
  // Both axes brighten the mix (open the cutoff); resonance stays threat-driven, so
  // progress reads as celebratory brightness while threat adds menacing resonance.
  const openness = Math.max(progress, threat);
  return {
    gains,
    masterCutoff: lerp(mf.cutoffLo, mf.cutoffHi, openness),
    masterQ: lerp(mf.qLo, mf.qHi, threat),
  };
}
