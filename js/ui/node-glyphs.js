// @ts-check
// Node glyph vocabulary — pure data + SVG generation for graph node rendering.
//
// Design (issue #126): every node renders as a common faceted dodecagon
// container (state color rides on border/fill, unchanged) with an ideographic,
// no-curves glyph inside it (type identity: shape + hue). State is NOT baked
// into glyphs.
//
// This module is pure (no DOM / no Cytoscape) so it is unit-testable. graph.js
// and preview.js consume it.

/**
 * Dodecagon points for Cytoscape `shape-polygon-points`, normalized to [-1, 1]
 * about the node center (radius -> 1). Replaces the circle/ellipse everywhere.
 */
export const CONTAINER_POLYGON_POINTS =
  "0 -1 0.5 -0.866 0.866 -0.5 1 0 0.866 0.5 0.5 0.866 0 1 -0.5 0.866 -0.866 0.5 -1 0 -0.866 -0.5 -0.5 -0.866";

/**
 * @typedef {{ color: string, body: string }} Glyph
 * `body` is stroke-only inner SVG (polygon/line/rect/polyline), authored on a
 * 0 0 64 64 viewBox. `color` is applied as the stroke by glyphSvg().
 */

/** @type {Record<string, Glyph>} */
export const NODE_GLYPHS = {
  // ── Core 10 ──────────────────────────────────────────────
  wan: { color: "#66ccff", body: `<polygon points="32,20 42,26 42,38 32,44 22,38 22,26"/><line x1="22" y1="32" x2="42" y2="32"/><line x1="32" y1="20" x2="32" y2="44"/>` },
  gateway: { color: "#00ffff", body: `<polyline points="22,44 22,28 32,20 42,28 42,44"/><line x1="28" y1="44" x2="28" y2="34"/><line x1="36" y1="44" x2="36" y2="34"/>` },
  router: { color: "#88ff33", body: `<rect x="28" y="28" width="8" height="8"/><polyline points="29,21 32,17 35,21"/><line x1="32" y1="17" x2="32" y2="28"/><polyline points="29,43 32,47 35,43"/><line x1="32" y1="47" x2="32" y2="36"/><polyline points="21,29 17,32 21,35"/><line x1="17" y1="32" x2="28" y2="32"/><polyline points="43,29 47,32 43,35"/><line x1="47" y1="32" x2="36" y2="32"/>` },
  firewall: { color: "#cc55ff", body: `<rect x="22" y="24" width="20" height="16"/><line x1="22" y1="32" x2="42" y2="32"/><line x1="32" y1="24" x2="32" y2="32"/><line x1="27" y1="32" x2="27" y2="40"/><line x1="37" y1="32" x2="37" y2="40"/>` },
  workstation: { color: "#9fb9c9", body: `<rect x="22" y="22" width="20" height="14"/><line x1="32" y1="36" x2="32" y2="42"/><line x1="26" y1="42" x2="38" y2="42"/>` },
  ids: { color: "#ff4488", body: `<polygon points="20,32 26,25 38,25 44,32 38,39 26,39"/><polygon points="32,28 35,30 35,34 32,36 29,34 29,30"/>` },
  "security-monitor": { color: "#ff8800", body: `<polygon points="32,20 41,25 41,35 32,40 23,35 23,25"/><polygon points="32,28 35,30 32,34 29,30"/><line x1="32" y1="14" x2="32" y2="20"/><line x1="32" y1="40" x2="32" y2="46"/><line x1="18" y1="30" x2="23" y2="30"/><line x1="41" y1="30" x2="46" y2="30"/>` },
  fileserver: { color: "#33ff99", body: `<rect x="23" y="21" width="18" height="6"/><rect x="23" y="29" width="18" height="6"/><rect x="23" y="37" width="18" height="6"/><line x1="27" y1="24" x2="29" y2="24"/><line x1="27" y1="32" x2="29" y2="32"/><line x1="27" y1="40" x2="29" y2="40"/>` },
  cryptovault: { color: "#ffcc22", body: `<rect x="22" y="22" width="20" height="20"/><polygon points="32,27 37,30 37,36 32,39 27,36 27,30"/><line x1="32" y1="32" x2="36" y2="29"/>` },
  mine: { color: "#ff2a2a", body: `<polygon points="32,24 39,28 39,36 32,40 25,36 25,28"/><line x1="32" y1="24" x2="32" y2="18"/><line x1="39" y1="28" x2="44" y2="24"/><line x1="39" y1="36" x2="44" y2="40"/><line x1="32" y1="40" x2="32" y2="46"/><line x1="25" y1="36" x2="20" y2="40"/><line x1="25" y1="28" x2="20" y2="24"/>` },

  // ── Set-piece 8 ──────────────────────────────────────────
  "key-server": { color: "#44ddcc", body: `<polygon points="25,26 30,29 30,35 25,38 20,35 20,29"/><line x1="30" y1="32" x2="44" y2="32"/><line x1="38" y1="32" x2="38" y2="37"/><line x1="43" y1="32" x2="43" y2="36"/>` },
  vault: { color: "#ffaa22", body: `<polyline points="26,30 26,25 32,21 38,25 38,30"/><rect x="23" y="30" width="18" height="13"/><polygon points="32,33 35,35 34,39 30,39 29,35"/>` },
  "routing-panel": { color: "#66dd66", body: `<rect x="21" y="24" width="22" height="16"/><rect x="25" y="28" width="3" height="3"/><rect x="31" y="28" width="3" height="3"/><rect x="37" y="28" width="3" height="3"/><rect x="25" y="34" width="3" height="3"/><rect x="31" y="34" width="3" height="3"/><rect x="37" y="34" width="3" height="3"/>` },
  "routing-switch": { color: "#66dd66", body: `<rect x="21" y="28" width="22" height="9"/><rect x="33" y="26" width="9" height="13"/><line x1="24" y1="32.5" x2="29" y2="32.5"/>` },
  "data-relay": { color: "#4499ff", body: `<polyline points="27,44 32,28 37,44"/><line x1="29" y1="38" x2="35" y2="38"/><polyline points="27,25 24,28 27,31"/><polyline points="37,25 40,28 37,31"/><line x1="32" y1="28" x2="32" y2="24"/>` },
  "watchdog-daemon": { color: "#ff8800", body: `<polygon points="32,20 42,24 42,33 32,43 22,33 22,24"/><polygon points="27,30 32,27 37,30 32,33"/>` },
  "tripwire-sensor": { color: "#ff4488", body: `<polygon points="20,27 20,37 28,32"/><rect x="42" y="29" width="6" height="6"/><line x1="28" y1="32" x2="42" y2="32" stroke-dasharray="3 3"/><line x1="35" y1="23" x2="35" y2="41"/>` },
  "alarm-latch": { color: "#ff5522", body: `<polyline points="25,40 28,28 36,28 39,40"/><line x1="22" y1="40" x2="42" y2="40"/><line x1="32" y1="28" x2="32" y2="24"/><line x1="32" y1="40" x2="32" y2="44"/>` },
};

/**
 * Generic fallback for any unmapped type — a microchip / IC, neutral teal.
 * @type {Glyph}
 */
export const FALLBACK_GLYPH = {
  color: "#7fd9c9",
  body: `<rect x="24" y="24" width="16" height="16"/><line x1="28" y1="20" x2="28" y2="24"/><line x1="36" y1="20" x2="36" y2="24"/><line x1="28" y1="40" x2="28" y2="44"/><line x1="36" y1="40" x2="36" y2="44"/><line x1="20" y1="28" x2="24" y2="28"/><line x1="20" y1="36" x2="24" y2="36"/><line x1="40" y1="28" x2="44" y2="28"/><line x1="40" y1="36" x2="44" y2="36"/>`,
};

/** All explicitly-mapped types (excludes the fallback). */
export const ALL_GLYPH_TYPES = Object.keys(NODE_GLYPHS);

/**
 * @param {string} type
 * @returns {Glyph} the type's glyph, or the microchip fallback.
 */
export function glyphFor(type) {
  return NODE_GLYPHS[type] || FALLBACK_GLYPH;
}

/**
 * Full standalone SVG markup for a type's glyph (stroke = type hue).
 * @param {string} type
 * @returns {string}
 */
export function glyphSvg(type) {
  const { color, body } = glyphFor(type);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;
}

/**
 * Glyph as a Cytoscape-ready `background-image` data URI (# percent-encoded).
 * @param {string} type
 * @returns {string}
 */
export function glyphDataUri(type) {
  return "data:image/svg+xml," + encodeURIComponent(glyphSvg(type));
}

// ── Node face: dodecagon-clipped fence hatch + glyph (vector CRT pass) ──
// State is NOT baked into the glyph; the fence-hatch density + dimmed hue encode
// access level. The dodecagon OUTLINE is intentionally absent here — it stays as
// the native Cytoscape border so border-driven state pulses keep working.

const FACE_C = 32; // glyph viewBox center
const FACE_R = 30; // dodecagon radius on the 0..64 box

/** Dodecagon points on the 0..64 glyph viewBox, derived from CONTAINER_POLYGON_POINTS. */
const FACE_POLYGON_POINTS = (() => {
  const n = CONTAINER_POLYGON_POINTS.trim().split(/\s+/).map(Number);
  const pts = [];
  for (let i = 0; i < n.length; i += 2) {
    pts.push(`${(FACE_C + n[i] * FACE_R).toFixed(2)},${(FACE_C + n[i + 1] * FACE_R).toFixed(2)}`);
  }
  return pts.join(" ");
})();

/**
 * Fence-hatch tuning per access level: line gap (px on the 0..64 box) + a dimmed,
 * desaturated shade of the state color (so the border stays the brightest element).
 * @type {Record<string, { gap: number, color: string }>}
 */
const FENCE = {
  locked: { gap: 11,  color: "#246060" },
  owned:  { gap: 4.5, color: "#1c8a4a" },
};
const FENCE_OPACITY = 0.42;
const FENCE_WIDTH = 0.8;

/**
 * Y positions (on the 0..64 box) of the fence-hatch lines for an access level.
 * Empty array for any unmapped level (e.g. obscured / unknown).
 * @param {string} accessLevel
 * @returns {number[]}
 */
export function fenceYs(accessLevel) {
  const cfg = FENCE[accessLevel];
  if (!cfg) return [];
  const ys = [];
  for (let y = FACE_C - FACE_R + 1; y < FACE_C + FACE_R; y += cfg.gap) {
    ys.push(Number(y.toFixed(1)));
  }
  return ys;
}

/**
 * Full standalone node-face SVG: dodecagon-clipped fence hatch (state) + glyph (type).
 * @param {string} type
 * @param {string} accessLevel
 * @returns {string}
 */
export function nodeFaceSvg(type, accessLevel) {
  const { color, body } = glyphFor(type);
  const cfg = FENCE[accessLevel];
  let fence = "";
  if (cfg) {
    const lines = fenceYs(accessLevel)
      .map((y) => `<line x1="0" y1="${y}" x2="64" y2="${y}"/>`)
      .join("");
    fence =
      `<defs><clipPath id="sf"><polygon points="${FACE_POLYGON_POINTS}"/></clipPath></defs>` +
      `<g clip-path="url(#sf)" stroke="${cfg.color}" stroke-width="${FENCE_WIDTH}" opacity="${FENCE_OPACITY}">${lines}</g>`;
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none" stroke-linejoin="round" stroke-linecap="round">` +
    fence +
    `<g stroke="${color}" stroke-width="2">${body}</g>` +
    `</svg>`
  );
}

/**
 * Node face as a Cytoscape-ready `background-image` data URI (# percent-encoded).
 * @param {string} type
 * @param {string} accessLevel
 * @returns {string}
 */
export function nodeFaceDataUri(type, accessLevel) {
  return "data:image/svg+xml," + encodeURIComponent(nodeFaceSvg(type, accessLevel));
}
