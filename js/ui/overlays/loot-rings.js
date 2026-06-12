// @ts-check
// FETCH loot rings: thin faceted (12-gon) "ripple" rings spawn at the node and
// expand + fade outward. Ripples are dense when the node is full and thin out
// (spawn less often) as it drains — spawn cadence tracks remaining loot. Stroke-
// only, vector-CRT. Driven by the base class's managed time loop: it ticks a
// ParticlePool of rings (each ages itself) and accumulates the spawn cadence.

import { html } from "lit";
import { NodeOverlay } from "./node-overlay.js";
import { ringPoints } from "./facet.js";
import { ParticlePool } from "../particle-pool.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const LOOT_RING_LIFETIME_MS = 800;
const SPAWN_MIN_MS = 100;      // dense ripples when the node is full
const SPAWN_PROGRESS_MS = 500; // + progress*this → sparser as it drains
const PAD = 20; // ripples travel this far past the node rim

class LootRingsOverlay extends NodeOverlay {
  constructor() {
    super();
    this._spawnAcc = 0;   // ms accumulated toward the next ring
    this._nextDelay = 0;  // 0 → spawn on the first frame after sync
    this._pool = new ParticlePool(); // in-flight ripple rings
  }

  sync(nodeId, progress) {
    super.sync(nodeId, progress);
    this.startTimeLoop(); // idempotent; the managed loop drives spawn cadence
  }

  // Spawn a ring once the accumulated time reaches the progress-scaled delay
  // (dense when the node is full, sparser as it drains). The base loop stops
  // itself on clear()/disconnect, so there's no timer to leak.
  _timeFrame(now, dtMs) {
    this._pool.tick(now); // age in-flight rings (expand/fade), reap finished ones
    this._spawnAcc += dtMs;
    if (this._spawnAcc >= this._nextDelay) {
      this._spawn(now);
      this._spawnAcc = 0;
      this._nextDelay = SPAWN_MIN_MS + this.progress * SPAWN_PROGRESS_MS;
    }
  }

  clear() {
    super.clear();      // stops the managed loop(s), resets, hides
    this._pool.clear(); // remove any in-flight ring elements
    this._spawnAcc = 0;
    this._nextDelay = 0;
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

  // Spawn one ripple ring as a pool particle: it expands + fades over its lifetime
  // (the pool ticks its update each frame) and removes itself on expiry (restore).
  _spawn(now) {
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

    const birth = now;
    const maxR = r + PAD - 1;
    this._pool.add({
      until: now + LOOT_RING_LIFETIME_MS,
      update: (n) => {
        const t = Math.min(1, (n - birth) / LOOT_RING_LIFETIME_MS);
        const currentR = 2 + t * (maxR - 2);
        const opacity = 0.95 * (1 - t); // fade as it expands
        ring.setAttribute("points", ringPoints(cx, cy, currentR));
        ring.setAttribute("stroke", `rgba(0,255,160,${opacity})`);
      },
      restore: () => ring.remove(),
    });
  }
}

customElements.define("loot-rings-overlay", LootRingsOverlay);
