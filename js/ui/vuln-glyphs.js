// @ts-check
// Vulnerability-type glyph vocabulary — pure data + SVG generation, mirroring
// node-glyphs.js. One ideographic, no-curves mark per vuln type (issue #117),
// shown on exploit cards and in the node panel so card↔node matching reads as a
// shared glyph (a visual lock-and-key).
//
// First-stab alchemical/iconographic marks: color encodes the vuln's rarity tier
// (common = teal, uncommon = amber, rare = magenta) and shape complexity climbs
// with tier, so rarity reads in the glyph family. Tune shapes in the preview
// swatch sheet. This module is pure (no DOM) so it is unit-testable.

/**
 * @typedef {{ color: string, body: string }} Glyph
 * `body` is stroke-only inner SVG (polygon/line/rect/polyline), authored on a
 * 0 0 64 64 viewBox. `color` is applied as the stroke by vulnGlyphSvg().
 */

const COMMON = "#3fd9c9"; // teal
const UNCOMMON = "#ffb020"; // amber
const RARE = "#ff5cc8"; // magenta

/** @type {Record<string, Glyph>} */
export const VULN_GLYPHS = {
  // ── common (simple single marks — classical elements + salt/cross) ──
  "unpatched-ssh":   { color: COMMON, body: `<polygon points="32,18 46,44 18,44"/>` }, // fire △
  "weak-auth":       { color: COMMON, body: `<polygon points="18,20 46,20 32,46"/>` }, // water ▽
  "stale-firmware":  { color: COMMON, body: `<polygon points="18,20 46,20 32,46"/><line x1="24" y1="30" x2="40" y2="30"/>` }, // earth ▽+bar
  "open-telnet":     { color: COMMON, body: `<polygon points="32,18 46,44 18,44"/><line x1="24" y1="36" x2="40" y2="36"/>` }, // air △+bar
  "buffer-overflow": { color: COMMON, body: `<rect x="20" y="20" width="24" height="24"/><line x1="20" y1="32" x2="44" y2="32"/>` }, // salt ▢⊖
  "snmp-public":     { color: COMMON, body: `<line x1="32" y1="16" x2="32" y2="48"/><line x1="16" y1="32" x2="48" y2="32"/>` }, // cross +

  // ── uncommon (paired/crossed 2–3 element marks) ──
  "path-traversal":  { color: UNCOMMON, body: `<line x1="18" y1="44" x2="46" y2="44"/><polyline points="22,40 40,22"/><polyline points="31,22 40,22 40,31"/>` }, // escape arrow over a floor
  "deserialization": { color: UNCOMMON, body: `<rect x="18" y="18" width="28" height="28"/><rect x="26" y="26" width="12" height="12"/>` }, // nested squares
  "side-channel":    { color: UNCOMMON, body: `<line x1="32" y1="19" x2="32" y2="32"/><line x1="32" y1="32" x2="40" y2="38"/><line x1="44" y1="20" x2="20" y2="44" stroke-dasharray="3 3"/>` }, // clock hands + dashed leak
  "race-condition":  { color: UNCOMMON, body: `<line x1="20" y1="27" x2="42" y2="27"/><polyline points="38,23 42,27 38,31"/><line x1="44" y1="39" x2="22" y2="39"/><polyline points="26,35 22,39 26,43"/>` }, // opposing arrows (TOCTOU)
  "kernel-exploit":  { color: UNCOMMON, body: `<polygon points="32,18 45,25 45,39 32,46 19,39 19,25"/><line x1="28" y1="32" x2="36" y2="32"/><line x1="32" y1="28" x2="32" y2="36"/>` }, // ring-0 hexagon + core cross

  // ── rare (3-element composites) ──
  "zero-day-rce":           { color: RARE, body: `<polygon points="32,16 43,33 21,33"/><line x1="32" y1="33" x2="32" y2="48"/><line x1="25" y1="41" x2="39" y2="41"/>` }, // sulfur (△ over cross)
  "supply-chain":           { color: RARE, body: `<polygon points="16,32 22,28 28,32 22,36"/><polygon points="26,32 32,28 38,32 32,36"/><polygon points="36,32 42,28 48,32 42,36"/>` }, // three linked diamonds (chain)
  "hardware-backdoor":      { color: RARE, body: `<rect x="22" y="22" width="20" height="20"/><line x1="27" y1="18" x2="27" y2="22"/><line x1="37" y1="18" x2="37" y2="22"/><line x1="42" y1="42" x2="48" y2="48"/>` }, // chip + pins + hidden tail
  "cryptographic-weakness": { color: RARE, body: `<polygon points="32,17 45,24 45,40 32,47 19,40 19,24"/><polyline points="33,19 28,32 36,32 31,45"/>` }, // cipher hexagon + lightning crack
};

/**
 * Generic fallback for any unmapped id — a square with a diagonal slash, neutral teal.
 * @type {Glyph}
 */
export const FALLBACK_VULN_GLYPH = {
  color: "#7fd9c9",
  body: `<polygon points="22,22 42,22 42,42 22,42"/><line x1="22" y1="22" x2="42" y2="42"/>`,
};

/** All explicitly-mapped vuln ids (excludes the fallback). */
export const ALL_VULN_GLYPH_IDS = Object.keys(VULN_GLYPHS);

/**
 * @param {string} id vuln type id
 * @returns {Glyph} the type's glyph, or the fallback.
 */
export function vulnGlyphFor(id) {
  return VULN_GLYPHS[id] || FALLBACK_VULN_GLYPH;
}

/**
 * Full standalone SVG markup for a vuln glyph (stroke = tier color).
 * @param {string} id
 * @returns {string}
 */
export function vulnGlyphSvg(id) {
  const { color, body } = vulnGlyphFor(id);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;
}

/**
 * Glyph as an <img>-ready `src` data URI (# percent-encoded).
 * @param {string} id
 * @returns {string}
 */
export function vulnGlyphDataUri(id) {
  return "data:image/svg+xml," + encodeURIComponent(vulnGlyphSvg(id));
}
