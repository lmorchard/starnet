// @ts-check
// PROBE sweep: a clockwise radar sweep (player-action convention) that lights up
// the node's 12 dodecagon edges as discrete "LED" segments — each brightens from
// dim to full as the sweep front crosses it, then stays lit. Chunky + stroke-only
// (vector-CRT). A faint radial "hand" marks the sweep front.

import { html } from "lit";
import { NodeOverlay } from "./node-overlay.js";
import { FACET_SIDES, facetVertices } from "./facet.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const TOP = -Math.PI / 2; // 12 o'clock, matching facet.js
const OFF = 0.12; // unlit segment opacity (the dim ring)
const ON = 0.95;  // fully-lit segment opacity

class ProbeSweepOverlay extends NodeOverlay {
  constructor() {
    super();
    // Continuous radial sweep "hand" + sweep-front cross-fade — render at display
    // rate so the hand doesn't step around the dial at the ~10fps game tick.
    this.enableProgressSmoothing(120);
  }

  render() {
    return html`
      <svg style="position:absolute; opacity:0; pointer-events:none; overflow:visible; z-index:5; transition:opacity 0.15s ease;">
        <g class="leds"></g>
        <line class="hand" stroke="#00ffff" stroke-width="1.5" stroke-opacity="0.8"></line>
      </svg>`;
  }

  _render() {
    const svg = this._svg();
    if (!svg) return;
    const a = this._anchor();
    if (!a) { svg.style.opacity = "0"; return; }
    const { pos, r } = a;
    this._place(svg, pos, r);
    const rr = r - 1;

    // Lazily create the 12 LED segment lines once.
    const group = svg.querySelector(".leds");
    if (group.childElementCount !== FACET_SIDES) {
      group.replaceChildren();
      for (let i = 0; i < FACET_SIDES; i++) {
        const seg = document.createElementNS(SVG_NS, "line");
        seg.setAttribute("stroke", "#00ffff");
        seg.setAttribute("stroke-width", "3");
        seg.setAttribute("stroke-linecap", "round");
        group.appendChild(seg);
      }
    }

    const v = facetVertices(r, r, rr); // 12 vertices, first at 12 o'clock, clockwise
    const segs = group.children;
    const p = this.displayProgress;
    const front = p * FACET_SIDES; // fractional count of segments the sweep has crossed
    for (let i = 0; i < FACET_SIDES; i++) {
      const a1 = v[i];
      const a2 = v[(i + 1) % FACET_SIDES];
      const seg = segs[i];
      seg.setAttribute("x1", a1.x.toFixed(2)); seg.setAttribute("y1", a1.y.toFixed(2));
      seg.setAttribute("x2", a2.x.toFixed(2)); seg.setAttribute("y2", a2.y.toFixed(2));
      let op;
      if (front >= i + 1) op = ON;                              // fully crossed → lit
      else if (front > i) op = OFF + (ON - OFF) * (front - i);  // sweep crossing → brightening
      else op = OFF;                                            // not yet reached → dim
      seg.setAttribute("stroke-opacity", op.toFixed(3));
    }

    // Radial hand marks the sweep front (collapsed to a point at rest).
    const hand = svg.querySelector(".hand");
    hand.setAttribute("x1", String(r));
    hand.setAttribute("y1", String(r));
    if (p <= 0) {
      hand.setAttribute("x2", String(r));
      hand.setAttribute("y2", String(r));
    } else {
      const ang = TOP + p * 2 * Math.PI;
      hand.setAttribute("x2", (r + rr * Math.cos(ang)).toFixed(2));
      hand.setAttribute("y2", (r + rr * Math.sin(ang)).toFixed(2));
    }
  }
}

customElements.define("probe-sweep-overlay", ProbeSweepOverlay);
