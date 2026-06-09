// @ts-check
// Selection reticle: a dashed, slowly-spinning ring with cardinal tick marks
// that anchors to the selected node. Unlike the action effects it's
// selection-driven (not in the action registry) and progress is unused —
// sync(nodeId) shows it, clear() hides it. The slow spin is CSS (.reticle-group
// + reticle-spin keyframes in style.css). Ported from graph.js syncReticle.

import { html } from "lit";
import { NodeOverlay } from "./node-overlay.js";

const GAP = 12; // node radius → ring gap

class SelectionReticle extends NodeOverlay {
  render() {
    return html`
      <svg class="selection-reticle" style="position:absolute; opacity:0; pointer-events:none; overflow:visible; z-index:6;">
        <g class="reticle-group">
          <circle class="ring" cx="30" cy="30" r="28" fill="none" stroke="#cc00cc"
                  stroke-width="1.5" stroke-dasharray="6 3" stroke-opacity="0.75"></circle>
          <line class="tick-n" stroke="#cc00cc" stroke-width="1.5" stroke-opacity="0.9"></line>
          <line class="tick-s" stroke="#cc00cc" stroke-width="1.5" stroke-opacity="0.9"></line>
          <line class="tick-e" stroke="#cc00cc" stroke-width="1.5" stroke-opacity="0.9"></line>
          <line class="tick-w" stroke="#cc00cc" stroke-width="1.5" stroke-opacity="0.9"></line>
        </g>
      </svg>`;
  }

  _render() {
    const svg = this._svg();
    if (!svg) return;
    const a = this._anchor();
    if (!a) { svg.style.opacity = "0"; return; }
    const { pos } = a;
    this._place(svg, pos, a.r, GAP); // half = a.r + GAP = ring radius

    const r = a.r + GAP;
    const ringR = r - 2;
    const tickLen = Math.max(6, ringR * 0.22); // ~22% of ring radius, min 6px

    const ring = svg.querySelector(".ring");
    ring.setAttribute("cx", String(r));
    ring.setAttribute("cy", String(r));
    ring.setAttribute("r", String(ringR));

    // Four inward-pointing tick marks at cardinal positions
    const ticks = {
      n: [r, r - ringR, r, r - ringR + tickLen],
      s: [r, r + ringR, r, r + ringR - tickLen],
      e: [r + ringR, r, r + ringR - tickLen, r],
      w: [r - ringR, r, r - ringR + tickLen, r],
    };
    for (const [dir, [x1, y1, x2, y2]] of Object.entries(ticks)) {
      const el = svg.querySelector(`.tick-${dir}`);
      el.setAttribute("x1", String(x1)); el.setAttribute("y1", String(y1));
      el.setAttribute("x2", String(x2)); el.setAttribute("y2", String(y2));
    }
  }
}

customElements.define("selection-reticle", SelectionReticle);

/**
 * Create and append the reticle element into a container; returns it.
 * @param {HTMLElement} container
 * @returns {any}
 */
export function mountReticle(container) {
  const el = document.createElement("selection-reticle");
  container.appendChild(el);
  return el;
}
