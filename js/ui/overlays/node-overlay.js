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

export class NodeOverlay extends StarnetElement {
  constructor() {
    super();
    this.nodeId = null;
    this.progress = 0;
    // Lit renders asynchronously, so the SVG children don't exist until
    // firstUpdated(). sync()/reposition() no-op until then, then _render() runs.
    this._ready = false;
  }

  firstUpdated() {
    this._ready = true;
    this._render();
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
    this.nodeId = nodeId;
    this.progress = Math.max(0, Math.min(1, progress));
    if (this._ready) this._render();
  }

  /** Re-anchor on pan/zoom without changing progress. */
  reposition() {
    if (this._ready) this._render();
  }

  clear() {
    this.nodeId = null;
    this.progress = 0;
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
