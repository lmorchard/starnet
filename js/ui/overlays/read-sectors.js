// @ts-check
// DUMP read-sectors: green pie wedges filling in random order as the dump
// progresses. Sector count + fill order reseed on a new target. Progress is
// scaled so all sectors are full at 90% (looks complete just before done).
// Ported from graph.js _renderReadSectors.

import { html } from "lit";
import { NodeOverlay } from "./node-overlay.js";

class ReadSectorsOverlay extends NodeOverlay {
  constructor() {
    super();
    this._count = 0;
    this._order = [];
  }

  sync(nodeId, progress) {
    if (nodeId !== this.nodeId) {
      this._count = 7 + Math.floor(Math.random() * 14); // 7–20
      this._order = Array.from({ length: this._count }, (_, i) => i);
      // Fisher-Yates shuffle
      for (let i = this._order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this._order[i], this._order[j]] = [this._order[j], this._order[i]];
      }
    }
    this.nodeId = nodeId;
    // Scale so all sectors are filled at 90% progress
    this.progress = Math.max(0, Math.min(1, progress / 0.9));
    if (this._ready) this._render();
  }

  clear() {
    this._count = 0;
    this._order = [];
    super.clear();
  }

  render() {
    return html`
      <svg style="position:absolute; opacity:0; pointer-events:none; overflow:visible; z-index:5; transition:opacity 0.15s ease;">
        <path class="fill" fill="rgba(0,255,65,0.15)"></path>
        <circle class="ring" fill="none" stroke="#00ff41" stroke-width="1" stroke-opacity="0.45"></circle>
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
    const filledCount = Math.floor(p * this._count);

    if (filledCount <= 0) {
      fill.setAttribute("d", "");
      return;
    }
    if (filledCount >= this._count) {
      // Full circle
      fill.setAttribute("d",
        `M ${r},${r} m 0,-${r} a ${r},${r} 0 1,1 0,${r * 2} a ${r},${r} 0 1,1 0,-${r * 2} Z`);
      return;
    }

    // Build path from filled sectors (each is a pie wedge)
    const sliceAngle = (2 * Math.PI) / this._count;
    let d = "";
    for (let i = 0; i < filledCount; i++) {
      const idx = this._order[i];
      const startAngle = idx * sliceAngle - Math.PI / 2; // start from 12 o'clock
      const endAngle = startAngle + sliceAngle;
      const x1 = r + r * Math.cos(startAngle);
      const y1 = r + r * Math.sin(startAngle);
      const x2 = r + r * Math.cos(endAngle);
      const y2 = r + r * Math.sin(endAngle);
      const largeArc = sliceAngle > Math.PI ? 1 : 0;
      d += `M ${r},${r} L ${x1},${y1} A ${r},${r} 0 ${largeArc},1 ${x2},${y2} Z `;
    }
    fill.setAttribute("d", d.trim());
  }
}

customElements.define("read-sectors-overlay", ReadSectorsOverlay);
