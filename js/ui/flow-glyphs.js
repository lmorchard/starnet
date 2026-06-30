// @ts-check
// Pure geometry module: stroke-only vector packet glyphs for typed data flows.
// Mirrors js/ui/node-glyphs.js / js/ui/ice-glyphs.js. Single source of each glyph's shape
// (centered point arrays); both the SVG body (preview swatches) and the canvas draw path
// (live flow layer) are derived from it, so they can't drift.
//
// Vector-beam aesthetic: stroke-only, no fills. Shape carries type (colorblind-safe); color
// is the redundant cue. "encrypted" is a render/concealment state, not a sixth type.

/** The five semantic packet types. */
export const FLOW_TYPES = ["money", "data", "audit", "control", "credential"];

/** Dim phosphene used for concealed/encrypted flows. */
export const ENCRYPTED_COLOR = "#5a7f8a";

const STROKE_WIDTH = 0.7;

/** Canvas shadowBlur (device px) for the per-glyph phosphene glow on the live flow layer. */
const GLYPH_GLOW = 4;

/**
 * Canonical glyph geometry, centered on the origin in a ~[-5,5] space. `closed` polygons
 * close their path; open ones (the control chevron) don't.
 * @type {Record<string, { color: string, pts: number[][], closed: boolean }>}
 */
const GLYPH_GEOM = {
  money:      { color: "#ffcf5c", closed: true,  pts: [[0, -5], [5, 0], [0, 5], [-5, 0]] },              // ◇ diamond
  data:       { color: "#5cd6ff", closed: true,  pts: [[-4, -4], [4, -4], [4, 4], [-4, 4]] },             // ▢ square
  audit:      { color: "#ff5c5c", closed: true,  pts: [[0, -5], [4.5, 4], [-4.5, 4]] },                   // △ triangle
  control:    { color: "#ffa94d", closed: false, pts: [[-4, -4], [2, 0], [-4, 4]] },                      // › chevron
  credential: { color: "#ff6cc7", closed: true,  pts: [[5, 0], [2.5, 4.3], [-2.5, 4.3], [-5, 0], [-2.5, -4.3], [2.5, -4.3]] }, // ⬡ hexagon
};

/** Build an SVG body string from geometry, shifting the centered points into a 0 0 12 12 box. */
function svgBody(/** @type {{color:string,pts:number[][],closed:boolean}} */ g) {
  const points = g.pts.map(([x, y]) => `${(x + 6).toFixed(2)},${(y + 6).toFixed(2)}`).join(" ");
  const tag = g.closed ? "polygon" : "polyline";
  return `<${tag} points="${points}" fill="none" stroke="${g.color}" stroke-width="${STROKE_WIDTH}"/>`;
}

/**
 * Per-type glyph: stroke color + SVG body markup (0 0 12 12 viewBox), derived from GLYPH_GEOM.
 * @type {Record<string, { color: string, body: string }>}
 */
export const FLOW_GLYPHS = /** @type {Record<string, {color:string, body:string}>} */ (
  Object.fromEntries(Object.entries(GLYPH_GEOM).map(([k, g]) => [k, { color: g.color, body: svgBody(g) }]))
);

/**
 * Glyph for a type, or a neutral fallback for unknown types (no throw).
 * @param {string} type
 * @returns {{ color: string, body: string }}
 */
export function flowGlyphFor(type) {
  return FLOW_GLYPHS[type] ?? { color: ENCRYPTED_COLOR, body: "" };
}

/**
 * Inner glyph markup (no <svg> wrapper), 0 0 12 12 space. When `encrypted`, a dim "?" replaces
 * the type glyph. Single source of the encrypted treatment, shared by flowSvg and the layer.
 * @param {string} type
 * @param {{ encrypted?: boolean }} [opts]
 * @returns {string}
 */
export function flowGlyphBody(type, opts = {}) {
  return opts.encrypted
    ? `<text x="6" y="9.2" font-size="9" font-family="monospace" text-anchor="middle" fill="${ENCRYPTED_COLOR}">?</text>`
    : flowGlyphFor(type).body;
}

/**
 * Standalone packet SVG string (viewBox 0 0 12 12, stroke-only).
 * @param {string} type
 * @param {{ encrypted?: boolean }} [opts]
 * @returns {string}
 */
export function flowSvg(type, opts = {}) {
  return `<svg viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">${flowGlyphBody(type, opts)}</svg>`;
}

/**
 * Draw a packet glyph onto a 2D canvas context, centered on the current origin in the same
 * ~[-5,5] space (the caller has already translated/scaled the context and set lineWidth).
 * Stroke-only, matching the vector aesthetic. Used by the live canvas flow layer.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} type
 * @param {{ encrypted?: boolean }} [opts]
 */
export function drawFlowGlyph(ctx, type, opts = {}) {
  // Per-glyph phosphene glow: a canvas shadow scoped to this tiny glyph (cheap, no filter, no
  // extra compositing layer). The caller save()/restore()s per packet, so these reset on their
  // own. shadowBlur is in device px (not affected by the ctx scale), so it reads consistently.
  if (opts.encrypted) {
    ctx.fillStyle = ENCRYPTED_COLOR;
    ctx.shadowColor = ENCRYPTED_COLOR;
    ctx.shadowBlur = GLYPH_GLOW;
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", 0, 0);
    return;
  }
  const g = GLYPH_GEOM[type];
  if (!g) return; // unknown type: draw nothing
  ctx.strokeStyle = g.color;
  ctx.shadowColor = g.color;
  ctx.shadowBlur = GLYPH_GLOW;
  ctx.beginPath();
  ctx.moveTo(g.pts[0][0], g.pts[0][1]);
  for (let i = 1; i < g.pts.length; i++) ctx.lineTo(g.pts[i][0], g.pts[i][1]);
  if (g.closed) ctx.closePath();
  ctx.stroke();
}
