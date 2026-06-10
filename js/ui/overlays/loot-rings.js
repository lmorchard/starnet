// @ts-check
// FETCH loot rings: thin faceted (12-gon) "ripple" rings spawn at the node and
// expand + fade outward. Ripples are dense when the node is full and thin out
// (spawn less often) as it drains — spawn cadence tracks remaining loot. Stroke-
// only, vector-CRT. Self-running: a self-rescheduling spawn timer + per-ring RAF.

import { html } from "lit";
import { NodeOverlay } from "./node-overlay.js";
import { ringPoints } from "./facet.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const LOOT_RING_LIFETIME_MS = 800;
const SPAWN_MIN_MS = 100;      // dense ripples when the node is full
const SPAWN_PROGRESS_MS = 500; // + progress*this → sparser as it drains
const PAD = 20; // ripples travel this far past the node rim

class LootRingsOverlay extends NodeOverlay {
  constructor() {
    super();
    this._timer = null;
    this._running = false;
  }

  sync(nodeId, progress) {
    super.sync(nodeId, progress);
    if (!this._running) {
      this._running = true;
      this._tick();
    }
  }

  _tick() {
    if (!this._running) return;
    this._spawn();
    const delay = SPAWN_MIN_MS + this.progress * SPAWN_PROGRESS_MS;
    this._timer = setTimeout(() => this._tick(), delay);
  }

  clear() {
    this._running = false;
    if (this._timer !== null) { clearTimeout(this._timer); this._timer = null; }
    this.nodeId = null;
    this.progress = 0;
    const svg = this._svg();
    if (svg) {
      svg.style.opacity = "0";
      setTimeout(() => {
        if (!this.nodeId && svg) svg.querySelectorAll("polygon").forEach((c) => c.remove());
      }, 200);
    }
  }

  render() {
    return html`
      <svg style="position:absolute; opacity:0; pointer-events:none; overflow:visible; z-index:5; transition:opacity 0.15s ease;"></svg>`;
  }

  _render() {
    const svg = this._svg();
    if (!svg) return;
    const a = this._anchor();
    if (!a) { svg.style.opacity = "0"; return; }
    const { pos, r } = a;
    this._place(svg, pos, r, PAD);
    const size = (r + PAD) * 2;
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  }

  _spawn() {
    const svg = this._svg();
    if (!svg) return;
    const a = this._anchor();
    if (!a) return;
    const r = a.r;
    const cx = r + PAD, cy = r + PAD;
    const strokeWidth = 1.5 + Math.random() * 0.7; // crisp ripple line

    const ring = document.createElementNS(SVG_NS, "polygon");
    ring.setAttribute("fill", "none");
    ring.setAttribute("stroke", "rgba(0,255,160,0.95)");
    ring.setAttribute("stroke-width", String(strokeWidth));
    ring.setAttribute("stroke-linejoin", "round");
    ring.setAttribute("points", ringPoints(cx, cy, 2));
    svg.appendChild(ring);

    const startTime = performance.now();
    const maxR = r + PAD - 1;

    function animate(now) {
      const t = Math.min(1, (now - startTime) / LOOT_RING_LIFETIME_MS);
      const currentR = 2 + t * (maxR - 2);
      const opacity = 0.95 * (1 - t); // fade as it expands
      ring.setAttribute("points", ringPoints(cx, cy, currentR));
      ring.setAttribute("stroke", `rgba(0,255,160,${opacity})`);
      if (t < 1) requestAnimationFrame(animate);
      else ring.remove();
    }
    requestAnimationFrame(animate);
  }
}

customElements.define("loot-rings-overlay", LootRingsOverlay);
