// @ts-check
// FETCH loot rings: green rings spawn at the node center and expand+fade
// outward. Rings start fat (node is full) and thin as it drains (progress).
// Self-running: owns a spawn interval + per-ring RAF. Ported from graph.js
// syncLootRings / _spawnLootRing.

import { html } from "lit";
import { NodeOverlay } from "./node-overlay.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const LOOT_RING_SPAWN_MS = 200;
const LOOT_RING_LIFETIME_MS = 800;
const PAD = 12; // padding for ring expansion

class LootRingsOverlay extends NodeOverlay {
  constructor() {
    super();
    this._intervalId = null;
  }

  sync(nodeId, progress) {
    super.sync(nodeId, progress);
    if (this._intervalId === null) {
      this._spawn(); // immediate first ring
      this._intervalId = setInterval(() => this._spawn(), LOOT_RING_SPAWN_MS);
    }
  }

  clear() {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    this.nodeId = null;
    this.progress = 0;
    const svg = this._svg();
    if (svg) {
      svg.style.opacity = "0";
      // Clear any lingering ring elements after fade
      setTimeout(() => {
        if (!this.nodeId && svg) svg.querySelectorAll("circle").forEach((c) => c.remove());
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
    const cx = r + PAD;
    const cy = r + PAD;
    // Rings start fat (node is full) and thin out as it's drained
    const remaining = 1 - this.progress;
    const minWidth = 0.5 + remaining * remaining * r * 0.6;
    const variance = 1 + remaining * 3;
    const strokeWidth = minWidth + Math.random() * variance;

    const ring = document.createElementNS(SVG_NS, "circle");
    ring.setAttribute("cx", String(cx));
    ring.setAttribute("cy", String(cy));
    ring.setAttribute("r", "2");
    ring.setAttribute("fill", "none");
    ring.setAttribute("stroke", "rgba(0,255,160,0.35)");
    ring.setAttribute("stroke-width", String(strokeWidth));
    svg.appendChild(ring);

    const startTime = performance.now();
    const maxR = r + 8;

    function animate(now) {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / LOOT_RING_LIFETIME_MS);
      const currentR = 2 + t * (maxR - 2);
      const opacity = 0.35 * (1 - t); // fade out as it expands
      ring.setAttribute("r", String(currentR));
      ring.setAttribute("stroke", `rgba(0,255,160,${opacity})`);
      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        ring.remove();
      }
    }
    requestAnimationFrame(animate);
  }
}

customElements.define("loot-rings-overlay", LootRingsOverlay);
