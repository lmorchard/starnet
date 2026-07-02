// @ts-check
// GENERIC PROCESS overlay (#187 Phase 4b): the fallback "something is happening" overlay for any
// timed action without a bespoke one — DEFAULT_PROFILE.overlay in feedback-profiles.js. A
// 12-sided segmented polygon ring around the node whose edges light up clockwise from the top as
// progress goes 0→1, plus a slow idle CW spin and a pulsing leading edge so the effect still
// reads even while progress sits still between ticks. Stroke-only, straight polygon-edge chords
// (not arcs) per the retro-vector "no easy curves" rule; relies on the shared #overlay-bloom
// layer filter for glow — no per-element filter/drop-shadow (CLAUDE.md "one glow owner per
// layer"). Geometry comes from js/ui/generic-process-glyph.js (pure, unit-tested).
//
// Locked values from the Phase 4a feel loop with Les (docs/dev-sessions/2026-07-02-1031-timed-
// actions-phase1/notes.md): hue 141 (green), stroke 2.0, unlit opacity ~0.10, gap 0.18, idle spin
// ~8deg/s CW, leading-edge pulse amplitude ~0.5, ring radius ~3.4x the node's rendered radius
// (the lab used ~54px around a ~16px node).

import { html } from "lit";
import { NodeOverlay } from "./node-overlay.js";
import { GENERIC_PROCESS_SEGMENTS, GENERIC_PROCESS_GAP_FRAC, generateProcessRing } from "../generic-process-glyph.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const COLOR = "hsl(141, 100%, 60%)";
const STROKE_WIDTH = "2";
const OFF = 0.10; // unlit edge opacity
const ON = 1;      // lit edge opacity
const RADIUS_FACTOR = 3.4; // ring radius as a multiple of the node's rendered radius
const SPIN_RAD_PER_MS = (8 * Math.PI) / 180 / 1000; // ~8deg/s clockwise idle spin
const PULSE_PARAM = 0.5;    // leading-edge shimmer amplitude (locked value)
const PULSE_RATE_MS = 120;  // fast shimmer

class GenericProcessOverlay extends NodeOverlay {
  constructor() {
    super();
    // Accumulated active time (ms) — drives the idle spin + leading-edge pulse continuously,
    // same managed-loop idiom as lie-low-clock.js, so this never adds an ad-hoc per-element RAF.
    this._spinMs = 0;
  }

  render() {
    return html`
      <svg style="position:absolute; opacity:0; pointer-events:none; overflow:visible; z-index:5; transition:opacity 0.15s ease;">
        <g class="edges"></g>
      </svg>`;
  }

  /** @param {string} nodeId @param {number} progress */
  sync(nodeId, progress) {
    super.sync(nodeId, progress);
    this.startTimeLoop(); // idle spin + leading-edge pulse run continuously while active
  }

  _timeFrame(now, dtMs) {
    this._spinMs += dtMs;
    this._render();
  }

  clear() {
    super.clear(); // stops the time loop + hides
    this._spinMs = 0;
  }

  _render() {
    const svg = this._svg();
    if (!svg) return;
    const a = this._anchor();
    if (!a) { svg.style.opacity = "0"; return; }
    const { pos, r } = a;
    // The ring is wider than the node itself (the lab used ~54px around a ~16px node), so give
    // the SVG enough padding to draw it without clipping.
    const ringRadius = r * RADIUS_FACTOR;
    this._place(svg, pos, ringRadius);
    const cx = ringRadius, cy = ringRadius;

    const group = svg.querySelector(".edges");
    if (group.childElementCount !== GENERIC_PROCESS_SEGMENTS) {
      group.replaceChildren();
      for (let i = 0; i < GENERIC_PROCESS_SEGMENTS; i++) {
        const seg = document.createElementNS(SVG_NS, "line");
        seg.setAttribute("stroke", COLOR);
        seg.setAttribute("stroke-width", STROKE_WIDTH);
        seg.setAttribute("stroke-linecap", "round");
        group.appendChild(seg);
      }
    }

    const rotationRad = (this._spinMs * SPIN_RAD_PER_MS) % (2 * Math.PI);
    const { edges } = generateProcessRing(
      this.progress, GENERIC_PROCESS_SEGMENTS, GENERIC_PROCESS_GAP_FRAC, rotationRad, ringRadius,
    );
    // Subtle shimmer on the leading (currently-filling) edge only — a fast sine wobble around
    // full brightness, same shape as the Phase 4a lab's `1 + pulse*0.5*sin(t/120)`.
    const shimmer = 1 + PULSE_PARAM * 0.5 * Math.sin(this._spinMs / PULSE_RATE_MS);
    const leadOpacity = Math.max(OFF, Math.min(1, ON * 0.9 * shimmer));

    for (const edge of edges) {
      const seg = group.children[edge.index];
      seg.setAttribute("x1", (cx + edge.x1).toFixed(2));
      seg.setAttribute("y1", (cy + edge.y1).toFixed(2));
      seg.setAttribute("x2", (cx + edge.x2).toFixed(2));
      seg.setAttribute("y2", (cy + edge.y2).toFixed(2));
      const op = edge.lit ? ON : edge.leading ? leadOpacity : OFF;
      seg.setAttribute("stroke-opacity", op.toFixed(3));
    }
  }
}

customElements.define("generic-process-overlay", GenericProcessOverlay);
