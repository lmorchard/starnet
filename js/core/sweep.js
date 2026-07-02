// @ts-check
/**
 * SWEEP — a progressive, depth-bounded, abortable probe flood-fill; the breadth counterpart to
 * selective PROBE. The first client of the process framework (js/core/processes.js).
 *
 * It behaves like **parallel probes propagating through the network**: each wave starts a REAL
 * timed probe on every frontier node at once (grade-scaled probe duration + probe animation +
 * resolveProbe on completion, all via the existing timed-action operator). The wave advances to the
 * next recursive layer only once its probes finish — so nodes reveal over real probe-time, not
 * instantly. Propagation is gate-bounded (resolveProbe reveals neighbors only through probe-gate
 * nodes → stops at routers/firewalls/IDS/monitors) and capped by a player-chosen depth.
 *
 * Heat: each node hit charges HEAT_COST.sweep up front (a visible rise per node) plus the probe's
 * own HEAT_COST.probe on completion — a wide/deep sweep is loud.
 */

/** @typedef {import('./types.js').GameState} GameState */

import { getState } from "./state.js";
import { setNodeVisible } from "./state/node.js";
import { addProcess, updateProcess, nextProcessId } from "./state/process.js";
import { registerProcess, activeProcessOnNode } from "./processes.js";
import { recordHeat } from "./alert.js";
import { HEAT_COST, SWEEP_MAX_DEPTH } from "./balance.js";
import { getTimedActionAttrNames } from "./node-graph/timed-actions.js";
import { emitEvent, E } from "./events.js";

const PROBE_PROGRESS = getTimedActionAttrNames("probe").progressAttr;

/** Neighbors a wave can reach next: visible, PROBEABLE (hackable — has a `probing` flag; WAN-likes
 *  don't and can't be probed, so we never wait on them), not already probed/probing. */
const reachableFrom = (s, id) =>
  (s.adjacency[id] || []).filter((n) => {
    const node = s.nodes[n];
    return node && node.visibility !== "hidden" && typeof node.probing === "boolean"
      && !node.probed && !node.probing;
  });

/** Start a real timed probe on each node in parallel (operator animates + resolves), charging sweep heat per node. */
function startWave(ids) {
  const graph = getState().nodeGraph;
  for (const id of ids) {
    setNodeVisible(id, "accessible");        // connect — a reached node comes online
    graph.setNodeAttr(id, "probing", true);  // the timed-action operator runs the probe (duration/anim/resolveProbe)
    graph.setNodeAttr(id, PROBE_PROGRESS, 0);
    recordHeat(HEAT_COST.sweep);             // each node hit raises cumulative heat
  }
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
  // Wave 0 probes the origin only if it's unprobed AND probeable (hackable). An already-probed or
  // non-probeable origin (e.g. WAN) starts the sweep from its revealed children.
  const probeOrigin = typeof origin?.probing === "boolean" && !origin.probed;
  const frontier = probeOrigin ? [originId] : reachableFrom(s, originId);
  const depth = probeOrigin ? 0 : 1;
  if (frontier.length === 0) return; // nothing to sweep
  startWave(frontier);
  addProcess({ id: nextProcessId(), type: "sweep", nodeId: originId, depthCap: cap, depth, frontier });
  emitEvent(E.PROCESS_STARTED, { type: "sweep", nodeId: originId, depthCap: cap });
}

registerProcess("sweep", {
  step(proc, s) {
    // Wait until this wave's parallel probes all finish (the operator clears `probing` + resolves each).
    if (proc.frontier.some((id) => s.nodes[id]?.probing)) return false;
    // Wave complete — its nodes are probed/revealed. Announce it, then compute the next recursive layer.
    emitEvent(E.PROCESS_STEP, { type: "sweep", nodeId: proc.nodeId, depth: proc.depth, count: proc.frontier.length, nodes: proc.frontier });
    const next = [...new Set(proc.frontier.flatMap((id) => reachableFrom(s, id)))];
    const depth = proc.depth + 1;
    if (depth > proc.depthCap || next.length === 0) return true; // done
    startWave(next);
    updateProcess(proc.id, { depth, frontier: next });
    return false;
  },
  onAbort(proc, s) {
    // Cancel the current wave's in-flight probes so they don't resolve after the sweep is aborted.
    const graph = s.nodeGraph;
    for (const id of proc.frontier || []) {
      if (s.nodes[id]?.probing) { graph.setNodeAttr(id, "probing", false); graph.setNodeAttr(id, PROBE_PROGRESS, 0); }
    }
  },
});
