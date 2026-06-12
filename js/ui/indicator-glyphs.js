// @ts-check
// Stroke-only vector indicator glyphs — alert lamps, connection status,
// tick meters, and mission marks. All glyphs are fill="none" stroke-only
// with a baked-in phosphene drop-shadow glow, so data URIs are self-contained
// and correctly colored. No DOM; pure functions; deterministic output.
//
// Shape vocabulary (colorblind-safe: state encoded in shape, not color alone):
//   Alert lamp:  hexagon (safe/green) · point-up triangle (warning/amber) ·
//                inverted triangle (danger/red)
//   Conn status: small hexagon, colored by connection state
//   Tick meter:  vertical tick ladder, lit ticks show count + tier color
//   Mission:     checkmark (complete) · X (failed)
//
// Coordinates derived from indicator-lab.html (approved prototype).

/** @typedef {{ ticks?: number }} TickMeterOpts */

// ── palette ───────────────────────────────────────────────────────────────────

const GREEN = "#39ff7a";
const AMBER = "#c9d11e";
const RED   = "#ff5a4d";
const CYAN  = "#3fd9c9";
const DIM   = "#2a3a55";

// ── SVG wrapper ───────────────────────────────────────────────────────────────

/**
 * Wrap an SVG body in a full standalone SVG element with stroke defaults and
 * a phosphene glow filter (feDropShadow on a named filter id "g").
 *
 * @param {string} viewBox   - e.g. "16 16" -> becomes "0 0 16 16"
 * @param {string} body      - inner SVG elements (no fill overrides)
 * @param {string} color     - stroke color (also used as glow flood-color)
 * @param {number} [blur=1.6] - feDropShadow stdDeviation
 * @returns {string}
 */
function svgWrap(viewBox, body, color, blur = 1.6) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBox}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">`
    + `<defs><filter id="g" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="0" stdDeviation="${blur}" flood-color="${color}"/></filter></defs>`
    + `<g filter="url(#g)">${body}</g></svg>`;
}

/** Encode an SVG string as an `<img src>`-ready data URI. */
const dataUri = (/** @type {string} */ svg) =>
  "data:image/svg+xml," + encodeURIComponent(svg);

// ── lampHex body ──────────────────────────────────────────────────────────────
// Points computed from lab: r=6.4, center=8, starting at -π/2, step π/3.
// Result: "8,1.6 13.5,4.8 13.5,11.2 8,14.4 2.5,11.2 2.5,4.8"
const HEX_POINTS = "8,1.6 13.5,4.8 13.5,11.2 8,14.4 2.5,11.2 2.5,4.8";
const HEX_BODY = `<polygon points="${HEX_POINTS}"/>`;

// ── alertLampSvg ──────────────────────────────────────────────────────────────

/**
 * Status lamp whose shape encodes alert level (colorblind-safe):
 *   "green"  → hexagon (safe)
 *   "yellow" → point-up triangle (warning)
 *   "red"    → inverted triangle (danger)
 *   "trace"  → inverted triangle (danger — highest severity, same shape as red)
 * Unknown/missing level defaults to green hexagon.
 *
 * @param {string} level — "green" | "yellow" | "red" | "trace"
 * @returns {string} standalone SVG markup
 */
export function alertLampSvg(level) {
  switch (level) {
    case "yellow":
      return svgWrap("16 16",
        `<polygon points="8,2.5 13.5,13.5 2.5,13.5"/>`,
        AMBER);
    case "red":
    case "trace":
      return svgWrap("16 16",
        `<polygon points="2.5,2.5 13.5,2.5 8,13.5"/>`,
        RED);
    case "green":
    default:
      return svgWrap("16 16", HEX_BODY, GREEN);
  }
}

/**
 * Alert lamp as an `<img src>`-ready data URI.
 * @param {string} level — "green" | "yellow" | "red" | "trace"
 * @returns {string}
 */
export function alertLampDataUri(level) {
  return dataUri(alertLampSvg(level));
}

// ── connStatusSvg ─────────────────────────────────────────────────────────────

/**
 * Connection-status lamp — small stroked hexagon, color encodes state:
 *   "detecting" → red
 *   "active"    → cyan
 *   anything else ("passive", "") → dim
 *
 * @param {string} status
 * @returns {string} standalone SVG markup
 */
export function connStatusSvg(status) {
  let color;
  switch (status) {
    case "detecting": color = RED;  break;
    case "active":    color = CYAN; break;
    default:          color = DIM;  break;
  }
  return svgWrap("16 16", HEX_BODY, color);
}

/**
 * Connection-status lamp as a data URI.
 * @param {string} status
 * @returns {string}
 */
export function connStatusDataUri(status) {
  return dataUri(connStatusSvg(status));
}

// ── tickMeterSvg ──────────────────────────────────────────────────────────────

/**
 * Tier color from fraction.
 * @param {number} frac — clamped 0..1
 * @returns {string}
 */
function tierColor(frac) {
  return frac > 0.6 ? GREEN : frac > 0.3 ? AMBER : RED;
}

/**
 * Vertical tick-ladder magnitude meter.
 *   - N ticks (default 5) across a 64×18 viewBox.
 *   - `frac` clamped to [0,1]; `lit = round(frac*N)` ticks are full-height (y 3→15),
 *     remaining ticks are dim stubs (y 10→15).
 *   - Tier color: frac>0.6 green / >0.3 amber / else red.
 *   - Glow uses the lit tier color.
 *
 * @param {number} frac — 0..1 (clamped)
 * @param {TickMeterOpts} [opts]
 * @returns {string} standalone SVG markup
 */
export function tickMeterSvg(frac, opts = {}) {
  const N = opts.ticks ?? 5;
  const f = Math.max(0, Math.min(1, frac));
  const lit = Math.round(f * N);
  const color = tierColor(f);

  const W = 64, H = 18;
  const gap = W / (N + 1);
  let body = "";
  for (let i = 0; i < N; i++) {
    const x = (gap * (i + 1)).toFixed(1);
    const isLit = i < lit;
    body += `<line x1="${x}" y1="${isLit ? 3 : 10}" x2="${x}" y2="15"`
          + ` stroke="${isLit ? color : DIM}"`
          + ` stroke-width="${isLit ? 2 : 1.4}"/>`;
  }

  // Build SVG manually to allow per-line stroke overrides (no top-level stroke override).
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" fill="none">`
    + `<defs><filter id="g" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="0" stdDeviation="1.6" flood-color="${color}"/></filter></defs>`
    + `<g filter="url(#g)">${body}</g></svg>`;
}

/**
 * Tick meter as a data URI.
 * @param {number} frac
 * @param {TickMeterOpts} [opts]
 * @returns {string}
 */
export function tickMeterDataUri(frac, opts = {}) {
  return dataUri(tickMeterSvg(frac, opts));
}

// ── missionMarkSvg ────────────────────────────────────────────────────────────

/**
 * Mission completion mark — straight-segment only (no curves):
 *   "complete" → green checkmark polyline
 *   "failed"   → red X (two crossed lines)
 *
 * @param {string} state — "complete" | "failed"
 * @returns {string} standalone SVG markup
 */
export function missionMarkSvg(state) {
  if (state === "complete") {
    return svgWrap("16 16",
      `<polyline points="3,9 7,13 14,4"/>`,
      GREEN);
  }
  // "failed" or anything else → red X
  return svgWrap("16 16",
    `<line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/>`,
    RED);
}

/**
 * Mission mark as a data URI.
 * @param {string} state — "complete" | "failed"
 * @returns {string}
 */
export function missionMarkDataUri(state) {
  return dataUri(missionMarkSvg(state));
}
