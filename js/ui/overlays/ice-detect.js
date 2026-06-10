// @ts-check
// ICE DETECTION: a 12-segment polygon around the node whose edges fade in
// counter-clockwise (adversarial convention) as the dwell timer fills, then
// flash to a full bright cage on detection. Angular / no-curves (see CLAUDE.md).

import { html } from "lit";
import { NodeOverlay } from "./node-overlay.js";
import { detectionPolygonSegments, ICE_MAGENTA } from "../ice-glyphs.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const RING_GAP = 10;   // px screen-space gap outside the node
const SIDES = 12;
const DIM = 0.20;      // resting opacity of an unlit segment — faint full cage is
                       // visible from the start, then segments brighten CCW so the
                       // "polygon closing around the node" reads clearly.

class IceDetectOverlay extends NodeOverlay {
  // Called on ICE_DETECTED: flash all segments to full, then fade out.
  completeAndClear() {
    if (this.nodeId) {
      this.progress = 1;
      if (this._ready) this._render();
    }
    this.clear();
  }

  render() {
    // Empty SVG shell; the 12 <line> segments are created imperatively in
    // _render() via createElementNS. (The bundled lit.js exports no `svg` tag,
    // and interpolating `html` <line> templates would create HTML-namespace
    // elements that never paint — so we build real SVG nodes directly, the same
    // way loot-rings.js does.)
    // No own glow — the global graph bloom (#overlay-layer SVG filter) handles it.
    return html`
      <svg style="position:absolute; opacity:0; pointer-events:none; overflow:visible; z-index:6;
                  transition:opacity 0.15s ease;">
      </svg>`;
  }

  _render() {
    const svg = this._svg();
    if (!svg) return;
    const a = this._anchor();
    if (!a) { svg.style.opacity = "0"; return; }
    const { pos, r } = a;
    const rRing = r + RING_GAP;
    this._place(svg, pos, r, RING_GAP);

    // Lazily create the segment lines as real SVG elements (once).
    let lines = svg.querySelectorAll("line.seg");
    if (lines.length !== SIDES) {
      svg.querySelectorAll("line.seg").forEach((l) => l.remove());
      for (let i = 0; i < SIDES; i++) {
        const ln = document.createElementNS(SVG_NS, "line");
        ln.setAttribute("class", "seg");
        ln.setAttribute("stroke", ICE_MAGENTA);
        ln.setAttribute("stroke-width", "4.5");
        ln.setAttribute("stroke-linecap", "round");
        svg.appendChild(ln);
      }
      lines = svg.querySelectorAll("line.seg");
    }

    // Local SVG origin places the node center at (rRing, rRing) after _place().
    const ox = rRing, oy = rRing;
    const segs = detectionPolygonSegments(SIDES, rRing);
    const p = this.progress;
    lines.forEach((ln, i) => {
      const s = segs[i];
      ln.setAttribute("x1", (ox + s.x1).toFixed(2));
      ln.setAttribute("y1", (oy + s.y1).toFixed(2));
      ln.setAttribute("x2", (ox + s.x2).toFixed(2));
      ln.setAttribute("y2", (oy + s.y2).toFixed(2));
      // Gradual per-segment fade-in as progress sweeps CCW; all full at p>=1.
      const o = Math.max(DIM, Math.min(1, p * SIDES - i));
      ln.setAttribute("stroke-opacity", o.toFixed(3));
    });
  }
}

customElements.define("ice-detect-overlay", IceDetectOverlay);
