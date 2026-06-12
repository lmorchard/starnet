// @ts-check
// LIE LOW clock: while the player lies low at the WAN node, a dodecagon "clock" face draws
// over the node — its 12 edges light up chunkily one-at-a-time, clockwise, as the wait
// progresses (the PROBE facet-reveal idiom), while hour + minute hands spin clockwise in
// fast-forward (the "time passing" motion). Stroke-only, phosphene glow (vector-CRT).

import { html } from "lit";
import { NodeOverlay } from "./node-overlay.js";
import { FACET_SIDES, facetVertices } from "./facet.js";
import { easeToward } from "./ease.js";
import { ledOpacity, handAngles } from "./lie-low-clock-geom.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const COLOR = "#00ffff";

class LieLowClockOverlay extends NodeOverlay {
  constructor() {
    super();
    this._edgeP = 0;   // eased progress for the chunky edge reveal
    this._spinMs = 0;  // accumulated active time, drives the fast-forward hands
  }

  render() {
    return html`
      <svg style="position:absolute; opacity:0; pointer-events:none; overflow:visible; z-index:5; transition:opacity 0.15s ease;">
        <g class="leds"></g>
        <line class="hand-hour" stroke="${COLOR}" stroke-width="3" stroke-linecap="round" stroke-opacity="0.9"></line>
        <line class="hand-min"  stroke="${COLOR}" stroke-width="2" stroke-linecap="round" stroke-opacity="0.9"></line>
      </svg>`;
  }

  // sync() sets the target + progress (base). Also run the managed time loop so the hands
  // keep spinning and the edge reveal eases at display rate (not the ~10fps game tick).
  /** @param {string} nodeId @param {number} progress */
  sync(nodeId, progress) {
    super.sync(nodeId, progress);
    this.startTimeLoop();
  }

  _timeFrame(now, dtMs) {
    this._edgeP = easeToward(this._edgeP, this.progress, dtMs, 120);
    this._spinMs += dtMs;
    this._render();
  }

  clear() {
    super.clear(); // stops the time loop + hides
    this._edgeP = 0;
    this._spinMs = 0;
  }

  _render() {
    const svg = this._svg();
    if (!svg) return;
    const a = this._anchor();
    if (!a) { svg.style.opacity = "0"; return; }
    const { pos, r } = a;
    this._place(svg, pos, r);
    const cx = r, cy = r, rr = r - 1;

    // 12 dodecagon edges as LED segments — each whole edge alpha-fades in as the wait
    // progress enters its slot (chunky, clockwise; see ledOpacity).
    const group = svg.querySelector(".leds");
    if (group.childElementCount !== FACET_SIDES) {
      group.replaceChildren();
      for (let i = 0; i < FACET_SIDES; i++) {
        const seg = document.createElementNS(SVG_NS, "line");
        seg.setAttribute("stroke", COLOR);
        seg.setAttribute("stroke-width", "3");
        seg.setAttribute("stroke-linecap", "round");
        group.appendChild(seg);
      }
    }
    const v = facetVertices(cx, cy, rr); // 12 verts, first at 12 o'clock, clockwise
    for (let i = 0; i < FACET_SIDES; i++) {
      const p1 = v[i], p2 = v[(i + 1) % FACET_SIDES];
      const seg = group.children[i];
      seg.setAttribute("x1", p1.x.toFixed(2)); seg.setAttribute("y1", p1.y.toFixed(2));
      seg.setAttribute("x2", p2.x.toFixed(2)); seg.setAttribute("y2", p2.y.toFixed(2));
      seg.setAttribute("stroke-opacity", ledOpacity(this._edgeP, i, FACET_SIDES).toFixed(3));
    }

    // Hour + minute hands, clockwise fast-forward spin.
    const { hour, minute } = handAngles(this._spinMs / 1000);
    this._hand(svg, ".hand-hour", cx, cy, hour, rr * 0.5);
    this._hand(svg, ".hand-min", cx, cy, minute, rr * 0.8);
  }

  /** @param {SVGElement} svg @param {string} sel @param {number} cx @param {number} cy @param {number} ang @param {number} len */
  _hand(svg, sel, cx, cy, ang, len) {
    const h = svg.querySelector(sel);
    h.setAttribute("x1", String(cx));
    h.setAttribute("y1", String(cy));
    h.setAttribute("x2", (cx + Math.cos(ang) * len).toFixed(2));
    h.setAttribute("y2", (cy + Math.sin(ang) * len).toFixed(2));
  }
}

customElements.define("lie-low-clock-overlay", LieLowClockOverlay);
