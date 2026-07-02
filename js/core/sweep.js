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
import { registerOperator } from "./node-graph/operators.js";
import { emitEvent, E } from "./events.js";

const PROBE_PROGRESS = getTimedActionAttrNames("probe").progressAttr;

/**
 * sweep-cascade — on a `sweep-pulse`, bring an unprobed probeable node online and start its probe,
 * stamping the remaining depth as `_cascade_ttl` so the completion forwarder (Task 5) can propagate
 * ttl-1. No-op on already-probed / probing / non-probeable nodes and on ttl < 1.
 */
registerOperator("sweep-cascade", (_config, attrs, message, _ctx) => {
  if (!message || message.type !== "sweep-pulse") return {};
  if (typeof attrs.probing !== "boolean" || attrs.probed || attrs.probing) return {};
  const ttl = message.payload?.ttl ?? 0;
  if (ttl < 1) return {};
  return {
    attributes: { visibility: "accessible", probing: true, [PROBE_PROGRESS]: 0, _cascade_ttl: ttl },
    events: [{ type: "operator-effect", payload: { effect: "ctx-call", method: "recordHeat", args: [HEAT_COST.sweep] } }],
  };
});

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
  const probeOrigin = typeof origin?.probing === "boolean" && !origin.probed;
  // Wave-0 targets: the origin itself if it's still probeable, else its already-revealed children.
  const targets = probeOrigin ? [originId] : reachableFrom(s, originId);
  if (targets.length === 0) return;
  addProcess({ id: nextProcessId(), type: "sweep", nodeId: originId, source: "player", depthCap: cap });
  emitEvent(E.PROCESS_STARTED, { type: "sweep", nodeId: originId, depthCap: cap });
  for (const id of targets) graph.sendMessage(id, { type: "sweep-pulse", payload: { ttl: cap, source: "player" } });
}

registerProcess("sweep", {
  step(proc, s) {
    // frontier is populated by Task 5's forwarding logic; without it, nothing to step.
    if (!proc.frontier) return false;
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
    // frontier is the tracked wave (Task 5 onwards); fall back to just the origin for Task 4 records.
    const graph = s.nodeGraph;
    const wave = proc.frontier?.length > 0 ? proc.frontier : [proc.nodeId];
    for (const id of wave) {
      if (s.nodes[id]?.probing) { graph.setNodeAttr(id, "probing", false); graph.setNodeAttr(id, PROBE_PROGRESS, 0); }
    }
  },
});
