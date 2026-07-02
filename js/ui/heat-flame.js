// @ts-check
// Pure vector-flame geometry for the heat history strip ("Ember Scope") — no DOM, no Math.random.
// Renders `state.heat` (as a 0..1 fraction of the fixed gauge scale) as a stroke-only flame: a
// jagged crown contour riding the current heat height, with discrete contour lines stacked below
// it at a FIXED pixel gap. Lines are added/removed only at the bottom as the flame grows/shrinks —
// they never redistribute. Color runs red (crown) → yellow (base); lower lines fade out.
//
// The animated sweep + phosphor persistence lives in the <starnet-heat-scope> component, which
// samples a frozen per-column seed `r` (its only entropy) and calls these functions. Keeping the
// geometry pure and deterministic makes it unit-testable without a browser — mirroring the
// waveform.js / <starnet-waveform> split.

const YELLOW = [255, 225, 55];
const RED = [255, 40, 40];

/**
 * Deterministic bounded pseudo-noise in (-1, 1) from a frozen column seed `r` and index `k`.
 * @param {number} r frozen per-column seed (the component's only source of entropy)
 * @param {number} k sample index (e.g. band index) for decorrelated values per column
 * @returns {number}
 */
export function flameNoise(r, k) {
  return (Math.sin(r * 12.9898 + k * 4.1414) * 43758.5453) % 1;
}

/**
 * @typedef {{ base: number, span: number, gap: number, jag: number }} FlameGeom
 * base = baseline y (bottom of the strip), span = full drawable height, gap = px between bands,
 * jag = jitter amount 0..1.
 */

/**
 * Y of contour band `j` for a column. j=0 is the crown (top edge); higher j are lower tongues,
 * each a fixed `gap` px below the one above. Jitter is strongest at the crown and damps toward
 * the base, so the top reads flame-y and the bottom stays calm. Even at `level === 0` the crown
 * keeps a small idle jitter (the `0.4` floor) so the resting baseline shimmers rather than
 * sitting dead-flat — a deliberate liveliness choice.
 * @param {number} level heat fraction 0..1
 * @param {number} r frozen per-column seed
 * @param {number} j band index (0 = crown)
 * @param {FlameGeom} geom
 * @returns {number}
 */
export function bandY(level, r, j, { base, span, gap, jag }) {
  const jitMag = flameNoise(r, 1) * jag * 3 * (0.4 + level); // 0.4 floor → idle shimmer at heat 0
  const jitDamp = Math.max(0, 1 - j * 0.14); // 1 at the crown → 0 lower down
  return base - level * span + j * gap - jitMag * jitDamp;
}

/**
 * Does band `j` have room above the baseline for this column's flame height? Bands are added and
 * removed ONLY at the bottom, so this is monotone in both `j` and `level`.
 * @param {number} level heat fraction 0..1
 * @param {number} j band index (0 = crown)
 * @param {{ span: number, gap: number }} geom
 * @returns {boolean}
 */
export function bandExists(level, j, { span, gap }) {
  return level * span >= j * gap + 0.5;
}

/**
 * Stroke color for band index `j`: crown (j=0) red → deepest band (j=maxBands-1) yellow.
 * Keyed to band index (not the current visible count) so a line's color stays stable as bands
 * add/remove — a tall flame reveals the full spectrum, a short one is all-red crown.
 * @param {number} j band index (0 = crown)
 * @param {number} maxBands band-count cap
 * @returns {string} `rgb(r,g,b)`
 */
export function bandColor(j, maxBands) {
  const u = maxBands > 1 ? 1 - j / (maxBands - 1) : 1; // 1 = red crown, 0 = yellow base
  const c = YELLOW.map((v, i) => Math.round(v + (RED[i] - v) * u));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/**
 * Alpha multiplier by band index: crown is opaque (1), lower bands progressively more transparent
 * so the newest bottom line emerges faintly. `fade` (0..1) scales the falloff.
 * @param {number} j band index (0 = crown)
 * @param {number} maxBands band-count cap
 * @param {number} fade falloff strength 0..1
 * @returns {number}
 */
export function bandAlpha(j, maxBands, fade) {
  if (j === 0) return 1;
  const t = maxBands > 1 ? j / (maxBands - 1) : 0;
  return 1 - fade * t;
}
