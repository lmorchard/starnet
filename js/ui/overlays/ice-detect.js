// @ts-check
// ICE DETECTION sweep: magenta arc sweeping counter-clockwise (adversarial /
// system action convention) just outside the node, brightening as the dwell
// timer fills. On detection, snap to a full circle then clear. Ported from
// graph.js syncIceDetectSweep / _renderIceDetectSweep / completeAndClearIceDetectSweep.

import { html } from "lit";
import { NodeOverlay } from "./node-overlay.js";

const RING_GAP = 10; // px screen-space gap outside the node

class IceDetectOverlay extends NodeOverlay {
  // Called on ICE_DETECTED: snap ring to full circle, then fade out.
  completeAndClear() {
    if (this.nodeId) {
      this.progress = 1;
      if (this._ready) this._render();
    }
    this.clear();
  }

  render() {
    return html`
      <svg style="position:absolute; opacity:0; pointer-events:none; overflow:visible; z-index:5; transition:opacity 0.15s ease;">
        <path class="arc" fill="none" stroke="#ff00aa" stroke-width="4" stroke-linecap="round"></path>
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

    const arc = svg.querySelector(".arc");
    const p = this.progress;
    const ox = rRing, oy = rRing;
    arc.setAttribute("stroke-opacity", String(0.45 + 0.5 * p)); // dim → bright

    if (p <= 0) {
      arc.setAttribute("d", "");
    } else if (p >= 1) {
      // Full circle — two CCW semi-arcs to avoid degenerate arc case
      arc.setAttribute("d",
        `M ${ox},${oy - rRing} a ${rRing},${rRing} 0 1,0 0,${rRing * 2} a ${rRing},${rRing} 0 1,0 0,-${rRing * 2}`);
    } else {
      // Counter-clockwise: negate X component, sweep-flag=0
      const angle = p * 2 * Math.PI;
      const endX = ox - rRing * Math.sin(angle);
      const endY = oy - rRing * Math.cos(angle);
      arc.setAttribute("d",
        `M ${ox},${oy - rRing} A ${rRing},${rRing} 0 ${p > 0.5 ? 1 : 0},0 ${endX},${endY}`);
    }
  }
}

customElements.define("ice-detect-overlay", IceDetectOverlay);
