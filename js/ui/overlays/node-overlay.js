// @ts-check
// Base class for node-anchored SVG overlay animations. Light-DOM Lit element:
// render() returns the static SVG skeleton (single source of that effect's
// markup); subclasses do per-frame imperative geometry in _render() against
// their own SVG children. Loop effects (loot, exploit) own their RAF/interval
// as instance fields and start/stop them in sync()/clear().
//
// Contract used by visual-renderer (game) and preview.js (harness):
//   sync(nodeId, progress)  — set target + progress [0..1], re-render
//   clear()                 — hide and reset
//   reposition()            — re-anchor on pan/zoom without changing progress

import { html } from "lit";
import { StarnetElement } from "../components/starnet-element.js";
import { getCy } from "../graph.js";
import { easeToward } from "./ease.js";

// Below this gap between displayed and target progress, the smoothing loop has
// effectively converged and parks itself (a later sync() restarts it).
const SMOOTH_EPSILON = 0.0005;

export class NodeOverlay extends StarnetElement {
  constructor() {
    super();
    this.nodeId = null;
    this.progress = 0;
    // Lit renders asynchronously, so the SVG children don't exist until
    // firstUpdated(). sync()/reposition() no-op until then, then _render() runs.
    this._ready = false;
    // Progress smoothing (opt-in via enableProgressSmoothing). When off, behavior
    // is identical to the original: render on sync(), displayProgress === progress.
    this._smoothing = false;
    this._tau = 120;
    this._displayProgress = 0;
    this._raf = null;
    this._lastFrame = 0;
    // Time mode (opt-in via startTimeLoop): a managed per-frame loop for
    // time-driven effects (spawn cadence, flicker), so subclasses don't hand-roll
    // setTimeout/setInterval that leak on disconnect. Separate from the smoothing
    // loop above; an overlay may run both.
    this._timeRaf = null;
    this._timeLast = 0;
  }

  /**
   * Opt in to display-rate smoothing. Progress is fed at the ~10fps game tick, but
   * effects whose geometry is a continuous function of progress look choppy unless
   * they render at display rate. With smoothing on, an internal rAF eases a
   * displayed progress toward the tick-fed target; subclasses read
   * `this.displayProgress` (not `this.progress`) in _render(). Only for continuous
   * motion — discrete-fill / CSS-driven overlays should NOT enable it.
   * @param {number} [tauMs] smoothing time-constant (larger = smoother + more lag)
   */
  enableProgressSmoothing(tauMs = 120) {
    this._smoothing = true;
    this._tau = tauMs;
  }

  /** Progress to render from: the eased value when smoothing, else the raw target. */
  get displayProgress() {
    return this._smoothing ? this._displayProgress : this.progress;
  }

  _smoothFrame(now) {
    const dt = this._lastFrame ? now - this._lastFrame : 16;
    this._lastFrame = now;
    this._displayProgress = easeToward(this._displayProgress, this.progress, dt, this._tau);
    const converged =
      this.nodeId === null || Math.abs(this.progress - this._displayProgress) <= SMOOTH_EPSILON;
    if (converged) this._displayProgress = this.progress; // snap to target
    if (this._ready) this._render();
    if (converged) {
      this._raf = null;
      this._lastFrame = 0;
    } else {
      this._raf = requestAnimationFrame((t) => this._smoothFrame(t));
    }
  }

  _stopSmoothing() {
    if (this._raf !== null) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }
    this._lastFrame = 0;
  }

  /**
   * Start the managed time loop: calls `_timeFrame(now, dtMs)` every frame until
   * stopped. Idempotent. Auto-stopped by clear() and disconnectedCallback(), so a
   * subclass never needs to hand-roll (or leak) a setTimeout/setInterval.
   */
  startTimeLoop() {
    if (this._timeRaf !== null) return;
    this._timeLast = 0;
    this._timeRaf = requestAnimationFrame((t) => this._timeFrameLoop(t));
  }

  /** Stop the managed time loop. */
  stopTimeLoop() {
    if (this._timeRaf !== null) {
      cancelAnimationFrame(this._timeRaf);
      this._timeRaf = null;
    }
    this._timeLast = 0;
  }

  _timeFrameLoop(now) {
    const dt = this._timeLast ? now - this._timeLast : 16;
    this._timeLast = now;
    this._timeFrame(now, dt);
    // _timeFrame may have stopped the loop (e.g. lost its anchor); only reschedule
    // if it's still meant to be running.
    if (this._timeRaf !== null) {
      this._timeRaf = requestAnimationFrame((t) => this._timeFrameLoop(t));
    }
  }

  /**
   * Subclass hook: per-frame work for time-driven effects (spawn cadence, flicker).
   * @param {number} now    high-res timestamp (ms)
   * @param {number} dtMs   ms since the previous frame
   */
  _timeFrame(now, dtMs) {} // eslint-disable-line no-unused-vars

  firstUpdated() {
    this._ready = true;
    this._render();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // Stop both managed loops if the element is removed without an explicit clear(),
    // so neither keeps firing against a detached element.
    this._stopSmoothing();
    this.stopTimeLoop();
  }

  /**
   * Resolve the anchored node's rendered position + radius, or null if the
   * graph or node isn't available.
   * @returns {{ pos: { x: number, y: number }, r: number } | null}
   */
  _anchor() {
    const cy = getCy();
    if (!cy || !this.nodeId) return null;
    const node = cy.getElementById(this.nodeId);
    if (!node || node.length === 0) return null;
    return { pos: node.renderedPosition(), r: node.renderedWidth() / 2 };
  }

  /**
   * Position and show the root <svg>, sized to (r+pad)*2 and centered on the node.
   * @param {SVGElement} svg
   * @param {{ x: number, y: number }} pos
   * @param {number} r
   * @param {number} [pad]
   */
  _place(svg, pos, r, pad = 0) {
    const half = r + pad;
    svg.style.width = `${half * 2}px`;
    svg.style.height = `${half * 2}px`;
    svg.style.left = `${pos.x - half}px`;
    svg.style.top = `${pos.y - half}px`;
    svg.style.opacity = "1";
  }

  /** @returns {SVGElement|null} */
  _svg() {
    return this.querySelector("svg");
  }

  /** Hide the root <svg>. */
  _hide() {
    const svg = this._svg();
    if (svg) svg.style.opacity = "0";
  }

  /**
   * @param {string} nodeId
   * @param {number} progress
   */
  sync(nodeId, progress) {
    const newTarget = nodeId !== this.nodeId;
    this.nodeId = nodeId;
    // Sanitize before clamping — a non-finite progress (e.g. a malformed payload)
    // would otherwise render invalid SVG and stall the smoothing loop's convergence.
    const p = Number(progress);
    this.progress = Number.isFinite(p) ? Math.max(0, Math.min(1, p)) : 0;
    if (this._smoothing) {
      // A fresh target node starts at its synced value (no ease-in from a stale
      // displayed progress); then the rAF loop drives all rendering.
      if (newTarget) this._displayProgress = this.progress;
      if (this._raf === null) {
        this._lastFrame = 0;
        this._raf = requestAnimationFrame((t) => this._smoothFrame(t));
      }
      return;
    }
    if (this._ready) this._render();
  }

  /** Re-anchor on pan/zoom without changing progress. */
  reposition() {
    if (this._ready) this._render();
  }

  clear() {
    this._stopSmoothing();
    this.stopTimeLoop();
    this.nodeId = null;
    this.progress = 0;
    this._displayProgress = 0;
    this._hide();
  }

  /**
   * Subclass: imperative per-frame geometry. Must early-return and hide when
   * there's no target (`!this.nodeId`) or the node is gone (`_anchor()` null).
   */
  _render() {}

  // Subclass overrides render() to return the static <svg> skeleton via html``.
  render() {
    return html``;
  }
}
