// @ts-check
// ICE forms — pure SVG generation, no DOM. Mirrors node-glyphs.js. All forms are
// stroke-only / straight-segment (retro vector display, no curves — see CLAUDE.md).
// Consumed by graph.js (presence overlay) and overlays/ice-detect.js (detection),
// and demoed in preview.js.

export const ICE_RED = "#ff2a2a";
export const ICE_MAGENTA = "#ff00aa";

/**
 * "Strike Cage" ICE presence form — angular mandibles draped OVER the node
 * capsule from above (brainstorm concept C). The node fills viewBox 0 0 100 100;
 * the cage body looms above it (negative-y, shown via overflow:visible) and the
 * mandibles hook down over the node's top rim and upper sides — grasping the whole
 * capsule, not the inner glyph. Authored stroke-only.
 * @returns {string} an <svg> string
 */
export function iceStrikeCage() {
  const seg = `fill="none" stroke="${ICE_RED}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"`;
  return `<svg viewBox="0 0 100 100" overflow="visible" style="overflow:visible">
    <g class="ice-cage">
      <polyline ${seg} points="14,-34 50,-52 86,-34"/>
      <polyline ${seg} points="14,-34 6,-6 14,20 34,32"/>
      <polyline ${seg} points="86,-34 94,-6 86,20 66,32"/>
      <polyline ${seg} points="14,-6 30,10"/>
      <polyline ${seg} points="86,-6 70,10"/>
    </g>
  </svg>`;
}

/**
 * Endpoints for an `sides`-gon of radius `r` centered on the origin, ordered
 * counter-clockwise from the top (adversarial rotation convention). Each entry
 * is one polygon edge; the renderer maps dwell progress → per-segment opacity.
 * @param {number} sides
 * @param {number} r
 * @returns {{x1:number,y1:number,x2:number,y2:number}[]}
 */
export function detectionPolygonSegments(sides = 12, r = 30) {
  const pts = [];
  for (let i = 0; i <= sides; i++) {
    const a = (90 + (360 / sides) * i) * Math.PI / 180; // top, increasing → CCW on screen
    pts.push({ x: r * Math.cos(a), y: -r * Math.sin(a) });
  }
  const segs = [];
  for (let i = 0; i < sides; i++) {
    segs.push({ x1: pts[i].x, y1: pts[i].y, x2: pts[i + 1].x, y2: pts[i + 1].y });
  }
  return segs;
}
