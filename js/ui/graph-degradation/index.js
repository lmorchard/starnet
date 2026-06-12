// @ts-check
// Graph-panel degradation effects — high-level wiring over two independent effects:
//  - Health plasma (./health-plasma.js): a transparent WebGL plasma over the graph
//    whose density/heartbeat scale with health damage, plus a CSS haze filter on #cy.
//  - Deck perturbation (./deck-perturbation.js): chaos in the REAL Cytoscape graph
//    via a lightweight particle system, scaling with deck damage.
// This module owns the shared per-frame rAF loop, the latest params pulled from game state,
// and the #cy haze filter; it drives the two effects each frame. Split per issue #166.

import { degradationParams, buildGraphFilterString } from "./params.js";
import { getCy } from "../graph.js";
import { initHealthPlasma, drawHealthPlasma, stopHealthPlasma } from "./health-plasma.js";
import {
  initDeckPerturbation, applyDeckPerturbation, restoreDeck, discardDeck,
  hasRestorableDeck, hasAnyDeckState,
} from "./deck-perturbation.js";

let raf = 0;
let cyEl = null;
// Latest params (set by updateFromState; read by the rAF loop).
let cur = {
  health: { severity: 0, overlayOpacity: 0 },
  deck: { severity: 0 },
};
// Kept in sync with buildGraphFilterString's base return so the change-gate
// correctly skips the first DOM write while healthy.
let curFilter = "url(#starnet-bloom)";

/** @param {number} now */
function loop(now) {
  // Health plasma (WebGL) advances its flow clock every frame and renders when degraded.
  drawHealthPlasma(now, cur.health);
  // Deck chaos perturbs the real graph via Cytoscape (independent of WebGL).
  applyDeckPerturbation(now, cur.deck.severity);
  raf = requestAnimationFrame(loop);
}

/** Inject the canvas + compile the program. Idempotent; safe no-op without DOM/WebGL. */
export function initGraphDegradation() {
  if (raf) return; // loop already running
  const container = document.getElementById("graph-container");
  if (!container) return;
  initHealthPlasma(container);
  initDeckPerturbation(container);
  // Always run the loop: deck perturbation works through Cytoscape even without WebGL.
  raf = requestAnimationFrame(loop);
}

/** Pull the live pools from game state and apply params (plasma uniforms + #cy haze filter). */
export function updateFromState(state) {
  const p = degradationParams(state);
  cur = p;
  const filter = buildGraphFilterString(p.health);
  if (filter !== curFilter) {
    curFilter = filter;
    const cy = cyEl || (cyEl = document.getElementById("cy"));
    if (cy) cy.style.filter = filter;
  }
}

/**
 * Stop the rAF loop and reset module state (e.g. teardown). Removes the injected
 * canvas, restores any deck perturbation, and clears cached handles so a subsequent
 * initGraphDegradation() re-initializes cleanly.
 */
export function stopGraphDegradation() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  const cy = getCy();
  if (cy && hasRestorableDeck()) {
    restoreDeck(cy); // graph still live → restore positions/styles, then clear deck state
  } else if (hasAnyDeckState()) {
    // Graph already disposed: we can't restore to a dead cy, but the module must still
    // return to a clean baseline so a later restart can't inherit stale particles / a stuck
    // grid flag. Discard without restoring.
    discardDeck();
  }
  stopHealthPlasma();
  // Reset the health CSS filter to the base bloom so the graph doesn't stay blurred/hue-shifted
  // after teardown, and clear the cached filter/DOM handle so a subsequent
  // initGraphDegradation() starts from a clean (healthy) baseline.
  const cyDom = cyEl || document.getElementById("cy");
  if (cyDom) cyDom.style.filter = "url(#starnet-bloom)";
  curFilter = "url(#starnet-bloom)";
  cyEl = null;
  cur = { health: { severity: 0, overlayOpacity: 0 }, deck: { severity: 0 } };
}
