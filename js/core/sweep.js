// @ts-check
/**
 * SWEEP — a progressive, depth-bounded, abortable probe flood-fill; the breadth counterpart to
 * selective PROBE. The first client of the process framework (js/core/processes.js).
 *
 * Propagation is completion-driven: when a sweep node's probe resolves, the forwarder
 * (initSweepForwarding) sends sweep-pulse{ttl-1} to each now-revealed reachable neighbor and
 * clears the node's _cascade_ttl. The process step() is a liveness watcher — it returns true
 * (ended) when no node carries _cascade_ttl. Gate-bounded (resolveProbe reveals neighbors only
 * through probe-gate nodes → stops at routers/firewalls/IDS/monitors) and depth-capped.
 *
 * Heat: each node hit charges HEAT_COST.sweep up front (via the sweep-cascade operator) plus the
 * probe's own HEAT_COST.probe on completion — a wide/deep sweep is loud.
 */

/** @typedef {import('./types.js').GameState} GameState */

import { getState } from "./state.js";
import { addProcess, nextProcessId } from "./state/process.js";
import { registerProcess, activeProcessOnNode } from "./processes.js";
import { SWEEP_MAX_DEPTH } from "./balance.js";
import { getTimedActionAttrNames } from "./node-graph/timed-actions.js";
import { on, off, emitEvent, E } from "./events.js";
import { A } from "./action-ids.js";

const PROBE_PROGRESS = getTimedActionAttrNames("probe").progressAttr;

/** Neighbors a wave can reach next: visible, PROBEABLE (hackable — has a `probing` flag; WAN-likes
 *  don't and can't be probed, so we never wait on them), not already probed/probing. */
const reachableFrom = (s, id) =>
  (s.adjacency[id] || []).filter((n) => {
    const node = s.nodes[n];
    return node && node.visibility !== "hidden" && typeof node.probing === "boolean"
      && !node.probed && !node.probing;
  });

/** Forward the sweep wave one hop when a sweep-probe completes.
 * Safe to call multiple times — uses an off() guard to ensure at most one copy is active.
 * Called from initGame() so it survives clearHandlers() between test runs/harness resets.
 */
let _sweepHandler = null;
export function initSweepForwarding() {
  if (_sweepHandler) off(E.ACTION_RESOLVED, _sweepHandler);
  _sweepHandler = ({ action, nodeId }) => {
    if (action !== A.PROBE) return;
    const s = getState();
    const graph = s.nodeGraph;
    const node = s.nodes[nodeId];
    if (!graph || !node) return;
    const ttl = node._cascade_ttl;
    if (ttl == null) return;                          // not part of a sweep cascade
    graph.setNodeAttr(nodeId, "_cascade_ttl", null);  // this node's hop is done
    const targets = ttl > 0 ? reachableFrom(s, nodeId) : [];
    for (const nId of targets) {
      graph.sendMessage(nId, { type: "sweep-pulse", payload: { ttl: ttl - 1, source: "player" } });
    }
    // Each probe completion is a sweep step — the wave advanced (even a terminal leaf reports).
    const proc = s.processes.find((p) => p.type === "sweep");
    emitEvent(E.PROCESS_STEP, { type: "sweep", nodeId: proc?.nodeId ?? nodeId, count: targets.length, nodes: targets });
  };
  on(E.ACTION_RESOLVED, _sweepHandler);
}

/**
 * Begin a sweep from `originId` up to `depthCap` child-layers (clamped to SWEEP_MAX_DEPTH). If the
 * origin is unprobed, wave 0 probes it (revealing its neighbors); if it's already probed/owned, the
 * first wave is its revealed children. No-op if a process is already active on this node.
 * @param {string} originId @param {number} depthCap
 */
export function startSweep(originId, depthCap) {
  const s = getState();
  const graph = s.nodeGraph;
  if (!graph || activeProcessOnNode(s, originId)) return;
  const cap = Number.isFinite(depthCap) ? Math.min(Math.max(1, depthCap), SWEEP_MAX_DEPTH) : SWEEP_MAX_DEPTH;
  const origin = s.nodes[originId];
  const probeOrigin = typeof origin?.probing === "boolean" && !origin.probed;
  // Wave-0 targets: the origin itself if it's still probeable, else its already-revealed children.
  const targets = probeOrigin ? [originId] : reachableFrom(s, originId);
  if (targets.length === 0) return;
  addProcess({ id: nextProcessId(), type: "sweep", nodeId: originId, source: "player", depthCap: cap });
  emitEvent(E.PROCESS_STARTED, { type: "sweep", nodeId: originId, depthCap: cap });
  for (const id of targets) graph.sendMessage(id, { type: "sweep-pulse", payload: { ttl: cap, source: "player" } });
}

registerProcess("sweep", {
  step(_proc, s) {
    // The cascade is live while any node still carries a stamped hop. Ragged: each branch
    // advances on its own probe completion (see initSweepForwarding). Done when none remain.
    return !Object.values(s.nodes).some((n) => n._cascade_ttl != null);
  },
  onAbort(_proc, s) {
    // Cancel every in-flight sweep probe so none resolve after the sweep is aborted.
    const graph = s.nodeGraph;
    for (const n of Object.values(s.nodes)) {
      if (n._cascade_ttl == null) continue;
      graph.setNodeAttr(n.id, "_cascade_ttl", null);
      if (n.probing) { graph.setNodeAttr(n.id, "probing", false); graph.setNodeAttr(n.id, PROBE_PROGRESS, 0); }
    }
  },
});
