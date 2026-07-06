// @ts-check
// Pure geometry module: stroke-only vector packet glyphs for typed data flows.
// Mirrors js/ui/node-glyphs.js / js/ui/ice-glyphs.js. Single source of each glyph's shape
// (centered point arrays); both the SVG body (preview swatches) and the canvas draw path
// (live flow layer) are derived from it, so they can't drift.
//
// Every packet is drawn as an inner type glyph wrapped in a faceted 12-sided container ring
// (mirrors the dodecagon node container in node-glyphs.js), so a packet reads as one discrete
// encapsulated object travelling the wire. Coordinates are centered on the origin.
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
 * Encapsulating container: a stroke-only 12-sided ring drawn around every packet glyph so it
 * reads as a discrete encapsulated object on the wire. Circumradius comfortably clears the
 * ~5-unit glyphs. First vertex at 12 o'clock, going clockwise — the same faceted dodecagon
 * the node containers use (node-glyphs.js CONTAINER_POLYGON_POINTS), scaled to glyph space.
 */
const CONTAINER_RADIUS = 7;
const CONTAINER_PTS = [
  [0, -1], [0.5, -0.866], [0.866, -0.5], [1, 0], [0.866, 0.5], [0.5, 0.866],
  [0, 1], [-0.5, 0.866], [-0.866, 0.5], [-1, 0], [-0.866, -0.5], [-0.5, -0.866],
].map(([x, y]) => [x * CONTAINER_RADIUS, y * CONTAINER_RADIUS]);

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

/** Serialize a centered point array as an SVG polygon/polyline element. */
function svgPoly(/** @type {number[][]} */ pts, /** @type {string} */ color, /** @type {boolean} */ closed) {
  const points = pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const tag = closed ? "polygon" : "polyline";
  return `<${tag} points="${points}" fill="none" stroke="${color}" stroke-width="${STROKE_WIDTH}"/>`;
}

/** Build the inner-glyph SVG body from geometry (centered coords, matching the canvas path). */
function svgBody(/** @type {{color:string,pts:number[][],closed:boolean}} */ g) {
  return svgPoly(g.pts, g.color, g.closed);
}

/** The encapsulating container ring as an SVG polygon in the given color. */
function containerSvg(/** @type {string} */ color) {
  return svgPoly(CONTAINER_PTS, color, true);
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
 * Packet markup (no <svg> wrapper), centered coords: the encapsulating container ring plus the
 * inner glyph. When `encrypted`, a dim "?" inside a dim container replaces the type glyph.
 * Single source of the container + encrypted treatment, shared by flowSvg and the canvas layer.
 * @param {string} type
 * @param {{ encrypted?: boolean }} [opts]
 * @returns {string}
 */
export function flowGlyphBody(type, opts = {}) {
  if (opts.encrypted) {
    return (
      containerSvg(ENCRYPTED_COLOR) +
      `<text x="0" y="3.2" font-size="9" font-family="monospace" text-anchor="middle" fill="${ENCRYPTED_COLOR}">?</text>`
    );
  }
  const g = flowGlyphFor(type);
  if (!g.body) return ""; // unknown type: nothing (matches the canvas no-op)
  return containerSvg(g.color) + g.body;
}

/**
 * Standalone packet SVG string (centered viewBox, stroke-only). The viewBox spans the container
 * ring plus a stroke's-worth of margin.
 * @param {string} type
 * @param {{ encrypted?: boolean }} [opts]
 * @returns {string}
 */
export function flowSvg(type, opts = {}) {
  return `<svg viewBox="-8 -8 16 16" xmlns="http://www.w3.org/2000/svg">${flowGlyphBody(type, opts)}</svg>`;
}

/**
 * Packet glyph as an `<img src>`-ready data URI (matches the HUD indicator-glyph pattern).
 * Lets DOM/Lit consumers show the glyph without lit's `svg` tag (not in the local lit bundle).
 * @param {string} type
 * @param {{ encrypted?: boolean }} [opts]
 * @returns {string}
 */
export function flowGlyphDataUri(type, opts = {}) {
  return "data:image/svg+xml," + encodeURIComponent(flowSvg(type, opts));
}

/** Stroke a centered point array as a path on the canvas (caller has set stroke color/width). */
function strokePoly(/** @type {CanvasRenderingContext2D} */ ctx, /** @type {number[][]} */ pts, /** @type {boolean} */ closed) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (closed) ctx.closePath();
  ctx.stroke();
}

/**
 * Draw a packet glyph onto a 2D canvas context, centered on the current origin (the caller has
 * already translated/scaled the context and set lineWidth). Draws the encapsulating container
 * ring plus the inner type glyph — or a dim container + "?" when encrypted. Stroke-only,
 * matching the vector aesthetic. Used by the live canvas flow layer.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} type
 * @param {{ encrypted?: boolean }} [opts]
 */
export function drawFlowGlyph(ctx, type, opts = {}) {
  // Per-glyph phosphene glow: a canvas shadow scoped to this tiny glyph (cheap, no filter, no
  // extra compositing layer). The caller save()/restore()s per packet, so these reset on their
  // own. shadowBlur is in device px (not affected by the ctx scale), so it reads consistently.
  if (opts.encrypted) {
    ctx.strokeStyle = ENCRYPTED_COLOR;
    ctx.fillStyle = ENCRYPTED_COLOR;
    ctx.shadowColor = ENCRYPTED_COLOR;
    ctx.shadowBlur = GLYPH_GLOW;
    strokePoly(ctx, CONTAINER_PTS, true); // encapsulating container ring
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
  strokePoly(ctx, CONTAINER_PTS, true); // encapsulating container ring
  strokePoly(ctx, g.pts, g.closed); // inner type glyph
}
