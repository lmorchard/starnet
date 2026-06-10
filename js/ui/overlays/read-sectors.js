// @ts-check
// DUMP read-sectors: the node's 12 dodecagon facets light up (stroke-only wedge
// outlines) in random order as the dump progresses. Faceted to match the node
// container; no fills. Progress scaled so all facets are lit at 90%.

import { html } from "lit";
import { NodeOverlay } from "./node-overlay.js";
import { FACET_SIDES, facetVertices, ringPoints } from "./facet.js";

class ReadSectorsOverlay extends NodeOverlay {
  constructor() {
    super();
    this._order = [];
  }

  sync(nodeId, progress) {
    if (nodeId !== this.nodeId) {
      // Visual-only shuffle of the 12 facets (per the visual-randomness convention).
      this._order = Array.from({ length: FACET_SIDES }, (_, i) => i);
      for (let i = this._order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this._order[i], this._order[j]] = [this._order[j], this._order[i]];
      }
    }
    this.nodeId = nodeId;
    this.progress = Math.max(0, Math.min(1, progress / 0.9));
    if (this._ready) this._render();
  }

  clear() {
    this._order = [];
    super.clear();
  }

  render() {
    return html`
      <svg style="position:absolute; opacity:0; pointer-events:none; overflow:visible; z-index:5; transition:opacity 0.15s ease;">
        <polygon class="ring" fill="none" stroke="#00ff41" stroke-width="1" stroke-opacity="0.35"></polygon>
        <path class="sectors" fill="none" stroke="#00ff41" stroke-width="1.2" stroke-opacity="0.85"></path>
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
    svg.querySelector(".ring").setAttribute("points", ringPoints(r, r, rr));

    const sectors = svg.querySelector(".sectors");
    const filled = Math.floor(this.progress * FACET_SIDES);
    if (filled <= 0) { sectors.setAttribute("d", ""); return; }
    const v = facetVertices(r, r, rr);
    let d = "";
    for (let i = 0; i < filled; i++) {
      const idx = this._order[i];
      const p1 = v[idx];
      const p2 = v[(idx + 1) % FACET_SIDES];
      d += `M ${r},${r} L ${p1.x.toFixed(2)},${p1.y.toFixed(2)} L ${p2.x.toFixed(2)},${p2.y.toFixed(2)} Z `;
    }
    sectors.setAttribute("d", d.trim());
  }
}

customElements.define("read-sectors-overlay", ReadSectorsOverlay);
