// @ts-check
// The single in-place run-start path, shared by first boot, run-again, and the
// hub launch. Extracted from main.js so hub.js can start runs without a circular
// import on main.js.

import { resetGraph, syncInitialNodes, getCy, fitGraph, addIceNode } from "./graph.js";
import { initGame, getState } from "../core/state.js";
import { startIce } from "../core/ice.js";
import { openDarknetsStore } from "./store.js";

/**
 * Convert a graph network definition to the format initGraph (Cytoscape) expects.
 * @param {{ graphDef: { nodes: any[], edges: [string,string][] }, meta: any }} result
 */
export function toCytoscapeFormat(result) {
  const { graphDef, meta } = result;
  return {
    nodes: graphDef.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      label: n.attributes?.label ?? n.id,
      grade: n.attributes?.grade ?? "D",
    })),
    edges: graphDef.edges.map(([a, b]) => ({ source: a, target: b })),
    startNode: meta.startNode,
    startCash: meta.startCash,
    moneyCost: meta.moneyCost,
    ice: meta.ice,
  };
}

/**
 * Start (or restart) a run in place.
 *
 * Order matters. initGame fires NODE_STATE_CHANGED events while constructing the
 * NodeGraph (setting vulns/macguffins on every node). On a re-init the global
 * `state` still points at the *previous* run during that window, so visual-renderer
 * would re-add the previous run's revealed nodes to the board. So: initGame first,
 * THEN resetGraph (wipes both the old board and any stale re-adds), THEN rebuild
 * the board from the authoritative new state via syncInitialNodes (Phase 3a root cause).
 *
 * The generated target's deterministic seed rides in `meta.seed`; thread it into
 * initGame so the run-time RNG (vulns, loot, combat rolls) is reproducible for a
 * given target — not reseeded from Math.random() each launch (#142). Variety
 * across launches comes from the hub-visit counter rolling fresh target seeds.
 * Falls back to a random seed when meta.seed is absent.
 * @param {{ graphDef: any, meta: any }} networkResult
 */
export function startRun(networkResult) {
  initGame(() => networkResult, networkResult.meta?.seed, { openDarknetsStore });
  resetGraph(toCytoscapeFormat(networkResult));
  syncInitialNodes(getState().nodes);
  const cy = getCy();
  if (cy) fitGraph(cy);
  addIceNode();  // after layout — ICE polygon shape crashes cola bounding box calc
  startIce();
}
