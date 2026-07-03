// @ts-check
// Browser-only barrel for node-graph overlay animations. Importing this file
// registers all overlay custom elements. mountOverlays() creates one
// element per registry descriptor, appends them into a container, and returns
// lookup maps for the game's dispatch (by overlay name, #187 Phase 3) and
// shared iteration (by key). Pooled overlays (#298) are excluded from byName —
// they are managed by OverlayManager instead (one pooled element per animating node).

import "./probe-sweep.js";
import "./mine-scan.js";
import "./read-sectors.js";
import "./loot-rings.js";
import "./exploit-brackets.js";
import "./ice-detect.js";
import "./lie-low-clock.js";
import "./generic-process.js";
import { OVERLAY_DESCRIPTORS } from "./registry.js";
import { onViewport, setReticleOverlay } from "../graph.js";
import { mountReticle } from "./selection-reticle.js";
import { FlowLayer } from "./flow-layer.js";
import { OverlayManager } from "./manager.js";

/**
 * @param {HTMLElement} container
 * @returns {{ byKey: Map<string, any>, byName: Map<string, any>, manager: OverlayManager }}
 */
export function mountOverlays(container) {
  const byKey = new Map();
  const byName = new Map();
  // Build the pooled name→tag map from descriptors marked pooled: true.
  const pooledNameTags = new Map(
    OVERLAY_DESCRIPTORS.filter((d) => d.pooled).map((d) => [d.name, d.tag])
  );
  const manager = new OverlayManager(pooledNameTags);
  manager.mount(container);
  for (const d of OVERLAY_DESCRIPTORS) {
    // Pooled overlays are not singletons — the manager owns them.
    if (d.pooled) continue;
    const el = document.createElement(d.tag);
    container.appendChild(el);
    byKey.set(d.key, el);
    if (d.driver === "action-feedback") byName.set(d.name, el);
  }
  return { byKey, byName, manager };
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
