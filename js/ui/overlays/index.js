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

/**
 * @param {HTMLElement} container
 * @returns {{ byKey: Map<string, any>, byAction: Map<string, any> }}
 */
export function mountOverlays(container) {
  const byKey = new Map();
  const byAction = new Map();
  for (const d of OVERLAY_DESCRIPTORS) {
    const el = document.createElement(d.tag);
    container.appendChild(el);
    byKey.set(d.key, el);
    if (d.driver === "action-feedback" && d.action) byAction.set(d.action, el);
  }
  return { byKey, byAction };
}

/**
 * Bring up the graph overlay layer, shared by the game (visual-renderer) and the
 * preview harness so new overlays work in both automatically (#167): mount the
 * registry overlays + the selection reticle into the overlay container, register
 * the reticle with graph.js, and wire both to re-anchor on every pan/zoom.
 * @param {HTMLElement} [layer] overlay container; defaults to #overlay-layer
 * @returns {{ overlays: ReturnType<typeof mountOverlays>, reticle: any }}
 */
export function initializeGraphOverlays(
  layer = /** @type {HTMLElement} */ (document.getElementById("overlay-layer")),
) {
  const overlays = mountOverlays(layer);
  onViewport(() => overlays.byKey.forEach((o) => o.reposition()));

  const reticle = mountReticle(layer);
  setReticleOverlay(reticle);
  onViewport(() => reticle.reposition());

  return { overlays, reticle };
}
