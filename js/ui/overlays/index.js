// @ts-check
// Browser-only barrel for node-graph overlay animations. Importing this file
// registers all six overlay custom elements. mountOverlays() creates one
// element per registry descriptor, appends them into a container, and returns
// lookup maps for the game's dispatch (by action) and shared iteration (by key).

import "./probe-sweep.js";
import "./mine-scan.js";
import "./read-sectors.js";
import "./loot-rings.js";
import "./exploit-brackets.js";
import "./ice-detect.js";
import "./lie-low-clock.js";
import { OVERLAY_DESCRIPTORS } from "./registry.js";
import { onViewport, setReticleOverlay } from "../graph.js";
import { mountReticle } from "./selection-reticle.js";
import { FlowLayer } from "./flow-layer.js";
import { OverlayManager } from "./manager.js";
import { A } from "../../core/action-ids.js";

// Actions rendered by the pooled multi-node manager (this session: probe only — the SWEEP fan-out
// case). Others stay on the singleton byAction path until they too need concurrency.
/** @type {Map<string, string>} */
const MANAGED_ACTIONS = new Map([[A.PROBE, "probe-sweep-overlay"]]);

/**
 * @param {HTMLElement} container
 * @returns {{ byKey: Map<string, any>, byAction: Map<string, any>, manager: OverlayManager }}
 */
export function mountOverlays(container) {
  const byKey = new Map();
  const byAction = new Map();
  const manager = new OverlayManager(MANAGED_ACTIONS);
  manager.mount(container);
  for (const d of OVERLAY_DESCRIPTORS) {
    if (d.driver === "action-feedback" && d.action && MANAGED_ACTIONS.has(d.action)) continue; // pooled, not a singleton
    const el = document.createElement(d.tag);
    container.appendChild(el);
    byKey.set(d.key, el);
    if (d.driver === "action-feedback" && d.action) byAction.set(d.action, el);
  }
  return { byKey, byAction, manager };
}

/**
 * Bring up the graph overlay layer, shared by the game (visual-renderer) and the
 * preview harness so new overlays work in both automatically (#167): mount the
 * registry overlays + the selection reticle into the overlay container, register
 * the reticle with graph.js, and wire both to re-anchor on every pan/zoom.
 * @param {HTMLElement} [layer] overlay container; defaults to #overlay-layer
 * @returns {{ overlays: ReturnType<typeof mountOverlays>, reticle: any, flowLayer: FlowLayer }}
 */
export function initializeGraphOverlays(
  layer = /** @type {HTMLElement} */ (document.getElementById("overlay-layer")),
) {
  const overlays = mountOverlays(layer);
  onViewport(() => overlays.byKey.forEach((o) => o.reposition()));
  onViewport(() => overlays.manager.repositionAll());

  const reticle = mountReticle(layer);
  setReticleOverlay(reticle);
  onViewport(() => reticle.reposition());

  // Flow substrate: one always-on canvas layer drawing typed packets along edges. Its rAF loop
  // animates from cached geometry; reposition() (on pan/zoom) re-sizes the backing store and
  // recomputes that cached screen geometry — so the onViewport wiring is load-bearing.
  const flowLayer = new FlowLayer(layer);
  onViewport(() => flowLayer.reposition());

  return { overlays, reticle, flowLayer };
}
