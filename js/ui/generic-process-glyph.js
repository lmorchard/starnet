// @ts-check
// Pure geometry for the generic default "process running" overlay (#187 Phase 4b) — a segmented
// polygon ring around a node whose edges light up clockwise from the top as progress goes 0→1.
// Straight polygon-edge chords (NOT arcs) per the retro-vector "no easy curves" rule (CLAUDE.md).
// No DOM here — unit-testable; consumed by both the overlay element
// (js/ui/overlays/generic-process.js) and the preview harness.
//
// Each of the `segments` edges is a chord centered on its own "slot" angle — 12 o'clock plus
// `i * step`, stepping clockwise (same convention as facet.js's vertex angles) — shortened
// symmetrically by `gapFrac` so a small gap separates neighboring edges. `rotationRad` lets the
// caller apply the idle CW spin (~8deg/s, see the overlay element) without this module knowing
// about wall-clock time. This module does NOT compute opacity/pulse — it only reports geometry +
// lit/leading classification; the overlay element layers the (time-driven) shimmer on top.

/** Default segment count — matches the node dodecagon (facet.js FACET_SIDES). */
export const GENERIC_PROCESS_SEGMENTS = 12;

/** Default inter-segment gap, as a fraction of each segment's angular span. */
export const GENERIC_PROCESS_GAP_FRAC = 0.18;

/** First segment centered at 12 o'clock (straight up); SVG y is down, so up = -PI/2. */
const TOP = -Math.PI / 2;

/**
 * @typedef {Object} ProcessRingEdge
 * @property {number} index
 * @property {number} x1 @property {number} y1
 * @property {number} x2 @property {number} y2
 * @property {boolean} lit       - fully filled (progress has passed this segment)
 * @property {boolean} leading   - the currently-filling segment (pulses in the overlay)
 */

/**
 * @typedef {Object} ProcessRingGeometry
 * @property {ProcessRingEdge[]} edges
 * @property {number} litCount
 * @property {number|null} leadingIndex - index of the currently-filling edge, or null once
 *   progress reaches 1 (nothing left to fill).
 */

/**
 * Compute the segmented-ring geometry for a given progress.
 * @param {number} progress       0..1 (clamped; non-finite treated as 0)
 * @param {number} [segments]
 * @param {number} [gapFrac]      fraction of each segment's angular span omitted (split evenly
 *   between both ends, so the drawn chord stays centered on the segment's slot angle)
 * @param {number} [rotationRad]  additional clockwise rotation applied to every edge (idle spin)
 * @param {number} [radius]       ring radius; edges are centered on (0,0) — the caller translates
 *   to the node's screen position
 * @returns {ProcessRingGeometry}
 */
export function generateProcessRing(
  progress,
  segments = GENERIC_PROCESS_SEGMENTS,
  gapFrac = GENERIC_PROCESS_GAP_FRAC,
  rotationRad = 0,
  radius = 1,
) {
  const p = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const litFloat = p * segments;
  const litCount = Math.min(segments, Math.floor(litFloat));
  const leadingIndex = litCount >= segments ? null : litCount;

  const step = (2 * Math.PI) / segments;
  const half = (step * (1 - gapFrac)) / 2;

  /** @type {ProcessRingEdge[]} */
  const edges = [];
  for (let i = 0; i < segments; i++) {
    const center = TOP + i * step + rotationRad;
    const a1 = center - half;
    const a2 = center + half;
    edges.push({
      index: i,
      x1: radius * Math.cos(a1), y1: radius * Math.sin(a1),
      x2: radius * Math.cos(a2), y2: radius * Math.sin(a2),
      lit: i < litCount,
      leading: i === leadingIndex,
    });
  }

  return { edges, litCount, leadingIndex };
}
