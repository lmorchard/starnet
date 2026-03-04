// @ts-check
/**
 * Game CtxInterface bridge — wires NodeGraph ctx callbacks to real game functions.
 *
 * The ctx object is injected into NodeGraph at construction time. Set-piece
 * operators and triggers call ctx methods via ctx-call effects. NodeDef
 * actions also call ctx methods for game actions (probe, exploit, etc.).
 *
 * The `graph` reference is late-bound: create ctx with graph=null, construct
 * the NodeGraph with this ctx, then set ctx._graph = graph. This breaks
 * the circular dependency (graph needs ctx, ctx needs graph).
 */

/** @typedef {import('./types.js').CtxInterface} CtxInterface */

import { startTraceCountdown, cancelTraceCountdown } from "../alert.js";
import { addCash } from "../state/player.js";
import { startIce, ejectIce } from "../ice.js";
import { setGlobalAlert } from "../state/alert.js";
import { emitEvent, E } from "../events.js";
import { startProbe, cancelProbe } from "../actions/probe-exec.js";
import { startExploit, cancelExploit } from "../actions/exploit-exec.js";
import { startRead, cancelRead } from "../actions/read-exec.js";
import { startLoot, cancelLoot } from "../actions/loot-exec.js";
import { rebootNode, reconfigureNode } from "../node-orchestration.js";
import { endRun } from "../state.js";
import { pauseTimers } from "../timers.js";
import { getState } from "../state.js";

/**
 * Build the real CtxInterface for game integration.
 *
 * @param {{ openDarknetsStore?: (state: any) => void }} [opts]
 * @returns {CtxInterface & { _graph: import('./runtime.js').NodeGraph | null }}
 */
export function buildGameCtx(opts = {}) {
  const openStore = opts.openDarknetsStore ?? (() => {});

  /** @type {CtxInterface & { _graph: import('./runtime.js').NodeGraph | null }} */
  const ctx = {
    // Late-bound graph reference — set after NodeGraph construction
    _graph: null,

    // ── Set-piece callbacks ─────────────────────────────
    startTrace: () => startTraceCountdown(),
    cancelTrace: () => cancelTraceCountdown(),
    giveReward: (amount) => addCash(amount),
    spawnICE: (_nodeId) => startIce(),
    setGlobalAlert: (level) => setGlobalAlert(level),
    enableNode: (nodeId) => {
      if (ctx._graph) ctx._graph.setNodeAttr(nodeId, "visibility", "accessible");
    },
    disableNode: (nodeId) => {
      if (ctx._graph) ctx._graph.setNodeAttr(nodeId, "visibility", "hidden");
    },
    revealNode: (nodeId) => {
      if (ctx._graph) ctx._graph.setNodeAttr(nodeId, "visibility", "revealed");
    },
    log: (message) => emitEvent(E.LOG_ENTRY, { text: message, type: "system" }),

    // ── Game action callbacks ───────────────────────────
    startProbe: (nodeId) => startProbe(nodeId),
    cancelProbe: () => cancelProbe(),
    startExploit: (nodeId, exploitId) => startExploit(nodeId, exploitId),
    cancelExploit: () => cancelExploit(),
    startRead: (nodeId) => startRead(nodeId),
    cancelRead: () => cancelRead(),
    startLoot: (nodeId) => startLoot(nodeId),
    cancelLoot: () => cancelLoot(),
    ejectIce: () => ejectIce(),
    rebootNode: (nodeId) => rebootNode(nodeId),
    reconfigureNode: (nodeId) => reconfigureNode(nodeId),
    openDarknetsStore: () => {
      pauseTimers();
      openStore(getState());
    },
  };

  return ctx;
}
