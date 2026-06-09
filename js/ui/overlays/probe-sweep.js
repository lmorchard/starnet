// @ts-check
// PROBE sweep: cyan pie-slice arc sweeping clockwise from 12 o'clock (player
// action convention). Pure progress-driven. Ported from graph.js _renderProbeSweep.

import { html } from "lit";
import { NodeOverlay } from "./node-overlay.js";

class ProbeSweepOverlay extends NodeOverlay {
  render() {
    return html`
      <svg style="position:absolute; opacity:0; pointer-events:none; overflow:visible; z-index:5; transition:opacity 0.15s ease;">
        <path class="fill" fill="rgba(0,255,255,0.18)"></path>
        <circle class="ring" fill="none" stroke="#00ffff" stroke-width="1" stroke-opacity="0.45"></circle>
      </svg>`;
  }

  _render() {
    const svg = this._svg();
    if (!svg) return;
    const a = this._anchor();
    if (!a) { svg.style.opacity = "0"; return; }
    const { pos, r } = a;
    this._place(svg, pos, r);

    const ring = svg.querySelector(".ring");
    ring.setAttribute("cx", String(r));
    ring.setAttribute("cy", String(r));
    ring.setAttribute("r", String(r - 1));

    const fill = svg.querySelector(".fill");
    const p = this.progress;
    if (p <= 0) {
      fill.setAttribute("d", "");
    } else if (p >= 1) {
      // Full circle — two half-arcs to avoid degenerate arc case
      fill.setAttribute("d",
        `M ${r},${r} m 0,-${r} a ${r},${r} 0 1,1 0,${r * 2} a ${r},${r} 0 1,1 0,-${r * 2} Z`);
    } else {
      // Pie slice from 12 o'clock sweeping clockwise
      const angle = p * 2 * Math.PI;
      const endX = r + r * Math.sin(angle);
      const endY = r - r * Math.cos(angle);
      fill.setAttribute("d",
        `M ${r},${r} L ${r},${0} A ${r},${r} 0 ${p > 0.5 ? 1 : 0},1 ${endX},${endY} Z`);
    }
  }
}

customElements.define("probe-sweep-overlay", ProbeSweepOverlay);
