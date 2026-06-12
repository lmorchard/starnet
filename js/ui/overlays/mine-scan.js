// @ts-check
// MINE scan: H+V crosshair whose intersection roams a Lissajous path, damping
// toward node center as it completes (locks on). Square reticle rides the
// intersection and spins clockwise (player action). Ported from graph.js
// _renderMineScan. Lissajous params reseed on a new target (visual-only
// randomness per convention), staying stable within a run for pan/zoom + scrub.

import { html } from "lit";
import { NodeOverlay } from "./node-overlay.js";

class MineScanOverlay extends NodeOverlay {
  constructor() {
    super();
    this._fx = 2.5;
    this._fy = 3.5;
    this._phase = Math.PI / 2;
    // Continuous Lissajous roam + reticle spin — render at display rate, not the
    // ~10fps game tick, so it doesn't lurch in-game (smooth in the 60fps preview).
    this.enableProgressSmoothing(120);
  }

  sync(nodeId, progress) {
    if (nodeId !== this.nodeId) {
      this._fx = 2 + Math.random() * 1.5;        // 2.0–3.5
      this._fy = 3 + Math.random() * 1.5;        // 3.0–4.5
      this._phase = Math.random() * Math.PI * 2; // 0–2π
    }
    super.sync(nodeId, progress);
  }

  render() {
    return html`
      <svg style="position:absolute; opacity:0; pointer-events:none; overflow:visible; z-index:5; transition:opacity 0.15s ease;">
        <line class="h" stroke="#cc00cc" stroke-width="2" stroke-opacity="0.5"></line>
        <line class="v" stroke="#cc00cc" stroke-width="2" stroke-opacity="0.5"></line>
        <rect class="box" fill="none" stroke="#ff44ff" stroke-width="1" stroke-opacity="0.9"></rect>
      </svg>`;
  }

  _render() {
    const svg = this._svg();
    if (!svg) return;
    const a = this._anchor();
    if (!a) { svg.style.opacity = "0"; return; }
    const { pos, r } = a;
    const size = r * 2;
    this._place(svg, pos, r);

    const p = this.displayProgress;
    // Lissajous roam in overlay coords [0..size], center at r. Amplitude eases
    // to 0 as p→1 so the crosshair settles onto center (lock-on).
    const amp = r * 0.62 * (1 - p * p);
    const ix = r + amp * Math.sin(2 * Math.PI * this._fx * p);
    const iy = r + amp * Math.sin(2 * Math.PI * this._fy * p + this._phase);

    const h = svg.querySelector(".h");
    const v = svg.querySelector(".v");
    const box = svg.querySelector(".box");

    h.setAttribute("x1", "0"); h.setAttribute("y1", String(iy));
    h.setAttribute("x2", String(size)); h.setAttribute("y2", String(iy));
    v.setAttribute("x1", String(ix)); v.setAttribute("y1", "0");
    v.setAttribute("x2", String(ix)); v.setAttribute("y2", String(size));

    const side = r * 0.42;
    box.setAttribute("x", String(ix - side / 2));
    box.setAttribute("y", String(iy - side / 2));
    box.setAttribute("width", String(side));
    box.setAttribute("height", String(side));
    // Clockwise spin about the reticle center (player action).
    box.setAttribute("transform", `rotate(${p * 360} ${ix} ${iy})`);
  }
}

customElements.define("mine-scan-overlay", MineScanOverlay);
