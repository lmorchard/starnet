// @ts-check
// Pure faceted-geometry helpers for vector-CRT overlay effects. A real vector
// CRT draws straight segments, so overlay rings/sweeps are polygonal (default
// 12-gon, matching the dodecagon node container with a vertex at 12 o'clock)
// rather than smooth circles/arcs. No DOM here — unit-testable.

/** Polygon side count matching the node dodecagon. */
export const FACET_SIDES = 12;

/** First vertex at 12 o'clock (straight up). SVG y is down, so up = -PI/2. */
const TOP = -Math.PI / 2;

/**
 * Vertices of a regular polygon, first at 12 o'clock, stepping clockwise.
 * @param {number} cx @param {number} cy @param {number} r
 * @param {number} [sides] @param {number} [rot] start angle (radians)
 * @returns {{x:number,y:number}[]}
 */
export function facetVertices(cx, cy, r, sides = FACET_SIDES, rot = TOP) {
  const step = (2 * Math.PI) / sides;
  const out = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + i * step;
    out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return out;
}

/** Join vertices into an SVG points string. @param {{x:number,y:number}[]} verts */
function toPointsStr(verts) {
  return verts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

/**
 * Closed regular-polygon points string for `<polygon points=...>`.
 * @returns {string}
 */
export function ringPoints(cx, cy, r, sides = FACET_SIDES, rot = TOP) {
  return toPointsStr(facetVertices(cx, cy, r, sides, rot));
}

/**
 * Faceted-arc polyline points for `<polyline points=...>`, from 12 o'clock
 * through `progress` (0..1) of a full turn. dir=+1 clockwise, -1 counter-cw.
 * Walks the polygon vertices crossed, then appends the exact swept endpoint so
 * the leading edge tracks progress. Empty string for progress<=0; full closed
 * ring (sides points) for progress>=1.
 * @param {number} cx @param {number} cy @param {number} r
 * @param {number} progress @param {number} [dir]
 * @param {number} [sides] @param {number} [rot]
 * @returns {string}
 */
export function arcPoints(cx, cy, r, progress, dir = 1, sides = FACET_SIDES, rot = TOP) {
  if (progress <= 0) return "";
  if (progress >= 1) return ringPoints(cx, cy, r, sides, rot);
  const full = 2 * Math.PI;
  const sweep = progress * full;
  const step = full / sides;
  const at = (ang) => ({ x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
  const pts = [at(rot)];
  for (let k = 1; k <= sides; k++) {
    const seg = k * step;
    if (seg < sweep) pts.push(at(rot + dir * seg));
    else break;
  }
  pts.push(at(rot + dir * sweep)); // exact leading edge
  return toPointsStr(pts);
}
