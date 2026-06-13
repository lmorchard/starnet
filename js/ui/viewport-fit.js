// @ts-check
// Pure viewport-fit comparison — no DOM, no Cytoscape.
//
// The select-and-fit in graph.js pans/zooms to frame the selected node's neighborhood.
// That animation emits pan/zoom events every frame, which suspend the CRT bloom (a perf
// measure for real gestures). When the viewport is ALREADY framing the selection, the
// fit moves nothing yet still animates — flashing the bloom off and back on as the action
// menu appears. graph.js asks Cytoscape what fit() would produce (cy.getFitViewport) and
// uses this predicate to skip the animation when it would be imperceptible, so the bloom
// only dims for fits that actually move the view.

/**
 * @typedef {{ zoom: number, pan: { x: number, y: number } }} Viewport
 */

/**
 * Is the current viewport already at the fit target, within tolerance?
 *
 * Zoom is compared relatively (a fixed absolute zoom delta is more noticeable at low zoom
 * than high), pan as straight-line rendered-pixel distance.
 *
 * @param {Viewport} current  the live viewport (cy.zoom() / cy.pan())
 * @param {Viewport | null | undefined} target  what fit would produce (cy.getFitViewport)
 * @param {{ zoomTol?: number, panTol?: number }} [tol]
 *   zoomTol — max relative zoom difference (default 0.02 = 2%)
 *   panTol  — max pan distance in rendered px (default 3)
 * @returns {boolean} true if a fit to `target` would be imperceptible and can be skipped
 */
export function viewportMatchesFit(current, target, { zoomTol = 0.02, panTol = 3 } = {}) {
  if (!current || !target) return false;
  const base = Math.abs(current.zoom) || 1;
  const relZoom = Math.abs(target.zoom - current.zoom) / base;
  const panDist = Math.hypot(target.pan.x - current.pan.x, target.pan.y - current.pan.y);
  return relZoom <= zoomTol && panDist <= panTol;
}
