// @ts-check
// Pure intensity-mapping for the graph-degradation overlays. No DOM, no WebGL,
// no state imports — maps the player resource pools to effect parameters so the
// math is unit-testable; the WebGL/CSS application lives in graph-degradation.js.

/** Below this fraction of the HEALTH pool the effect is invisible; it ramps from here down. */
export const HEALTH_THRESHOLD = 0.9;
/**
 * The plasma's MAX intensity (reached at empty health) is capped to what the effect used to look
 * like at ~30% health — the un-capped peak read too much like a migraine aura. The full 90→0%
 * health range is remapped linearly onto 0→this cap, so the onset is unchanged but the worst
 * case is gentler and the whole new range is spread across the descent.
 */
export const HEALTH_PEAK_SEVERITY = (HEALTH_THRESHOLD - 0.3) / HEALTH_THRESHOLD;

// Tuned maxima reached at empty (severity 1). These + the thresholds are the knobs
// #141 will tune by hand in the preview harness.
const HEALTH_MAX = { overlayOpacity: 1.0, blurPx: 2.5, hueDeg: 40, minContrast: 0.65 };
// Exponent (<1) applied to severity for the plasma overlay only: a concave curve
// so the plasma fades in aggressively — high opacity early in health loss — while
// `severity` (and the haze it drives) stays linear.
const HEALTH_OVERLAY_RAMP = 0.45;
// Health fraction at/below which the plasma overlay is fully saturated (opacity max),
// rather than only reaching full at empty. So the effect is all-but-opaque by ~15%.
const HEALTH_OVERLAY_FULL = 0.15;
// Deck damage = chaos in the REAL graph via Cytoscape's model. `severity` is the single
// deck output; it drives the particle spawn rate and node count module-side (the shake is a
// fixed 1–2px axis-locked micro-tremor, not a severity-scaled amplitude).
// Deck severity is a steep CONVEX ramp of damage taken (no hard threshold): a sparse "did
// I see that?" above ~90% deck and ~1 event every few seconds at ~75%, then accelerating
// HARD into overwhelming, near-continuous chaos below ~25%. The high exponent keeps the top
// sparse while making the descent dramatic; the module's SPAWN_K sets the peak rate (and
// lets multiple events fire per tick once severity is high — a true chaos floor).
const DECK_CHAOS_EXP = 4.0;

/** Linear severity above a threshold (used by the HEALTH layer). @returns {number} 0..1 */
function severity(cur, max, threshold) {
  if (!max || max <= 0) return 0;
  const frac = Math.max(0, Math.min(1, cur / max));
  return Math.max(0, Math.min(1, (threshold - frac) / threshold));
}

/** Convex severity from fraction-of-damage-taken (used by the DECK layer). @returns {number} 0..1 */
function deckSeverity(cur, max) {
  if (!max || max <= 0) return 0;
  const frac = Math.max(0, Math.min(1, cur / max));
  return Math.pow(1 - frac, DECK_CHAOS_EXP);
}

/**
 * @param {{player?:{health?:{current:number,max:number},deckIntegrity?:{current:number,max:number}}}} state
 * @returns {{health:object, deck:object}}
 */
export function degradationParams(state) {
  const h = state?.player?.health ?? { current: 100, max: 100 };
  const d = state?.player?.deckIntegrity ?? { current: 100, max: 100 };
  // Scale the linear health severity down by the peak cap: empty health now reaches only what
  // ~30% health used to (gentler worst case), with the full range remapped across the descent.
  const hs = severity(h.current, h.max, HEALTH_THRESHOLD) * HEALTH_PEAK_SEVERITY;
  const ds = deckSeverity(d.current, d.max);
  // Overlay opacity rides a separate severity that saturates to 1 at HEALTH_OVERLAY_FULL
  // (so the plasma is all-but-opaque by ~15% health), shaped by the aggressive ramp.
  const hSat = Math.min(1, (hs * HEALTH_THRESHOLD) / (HEALTH_THRESHOLD - HEALTH_OVERLAY_FULL));
  return {
    health: {
      severity: hs,
      overlayOpacity: Math.pow(hSat, HEALTH_OVERLAY_RAMP) * HEALTH_MAX.overlayOpacity,
      blurPx: hs * HEALTH_MAX.blurPx,
      hueDeg: hs * HEALTH_MAX.hueDeg,
      contrast: 1 - hs * (1 - HEALTH_MAX.minContrast),
    },
    deck: {
      severity: ds,
    },
  };
}

/**
 * Compose the CSS filter chain for #cy: the base bloom reference plus health-driven
 * haze when degraded. (Coupled by design to the #starnet-bloom filter injected by
 * graph.js.) Deck damage is applied separately as a #cy transform + a WebGL overlay
 * corruption layer, not as a CSS/SVG filter.
 * @param {{severity:number, blurPx:number, hueDeg:number, contrast:number}} health
 * @returns {string}
 */
export function buildGraphFilterString(health) {
  const base = "url(#starnet-bloom)";
  if (!health || health.severity <= 0) return base;
  return `${base} blur(${health.blurPx.toFixed(2)}px) hue-rotate(${health.hueDeg.toFixed(1)}deg) contrast(${health.contrast.toFixed(3)})`;
}
