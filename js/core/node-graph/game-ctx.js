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
import { addCash, setMissionComplete } from "../state/player.js";
import { startIce, ejectIce } from "../ice.js";
import { setGlobalAlert } from "../state/alert.js";
import { emitEvent, E } from "../events.js";
// Exploit duration formula: higher quality = longer execution (more complex payload).
// Range: 2s (quality=0) to 7s (quality=1).
function exploitDuration(quality) {
  return Math.round((2 + quality * 5) * 1000); // ms
}
import { rebootNode, reconfigureNode } from "../node-orchestration.js";
import { endRun, ALERT_ORDER, revealNeighbors } from "../state.js";
import { pauseTimers } from "../timers.js";
import { getState } from "../state.js";
import { setNodeProbed, setNodeAlertState, setNodeRead, collectMacguffins, setNodeLooted } from "../state/node.js";
import { setLastDisturbedNode } from "../state/ice.js";
import { launchExploit } from "../combat.js";

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
    // Probe, read, loot start/cancel now handled by action effects (set-attr)
    // in the trait-based action system. These stubs remain for backward compat.
    startProbe: (_nodeId) => { /* now handled by timed-action operator */ },
    cancelProbe: () => { /* now handled by cancel-probe action effects */ },
    startExploit: (nodeId, exploitId) => {
      // Exploit is special: needs exploitId from event payload to compute duration.
      // Set node attributes so the timed-action operator drives the lifecycle.
      const s = getState();
      const node = s.nodes[nodeId];
      const exploit = s.player.hand.find((c) => c.id === exploitId);
      if (!node || !exploit || exploit.decayState === "disclosed" || exploit.usesRemaining === 0) return;

      const durationMs = exploitDuration(exploit.quality);
      const durationTicks = Math.round(durationMs / 100); // 100ms per tick
      if (ctx._graph) {
        ctx._graph.setNodeAttr(nodeId, "exploiting", true);
        ctx._graph.setNodeAttr(nodeId, "activeExploitId", exploitId);
        ctx._graph.setNodeAttr(nodeId, "_ta_exploit_progress", 0);
        ctx._graph.setNodeAttr(nodeId, "_ta_exploit_duration", durationTicks);
      }
      // Alert ICE immediately
      setLastDisturbedNode(nodeId);
    },
    cancelExploit: () => {
      // Find the node that's exploiting and reset it
      const s = getState();
      const exploitingNode = Object.values(s.nodes).find(n => /** @type {any} */ (n).exploiting);
      if (!exploitingNode) return;
      if (ctx._graph) {
        ctx._graph.setNodeAttr(exploitingNode.id, "exploiting", false);
        ctx._graph.setNodeAttr(exploitingNode.id, "_ta_exploit_progress", 0);
        ctx._graph.setNodeAttr(exploitingNode.id, "_ta_exploit_duration", 0);
        ctx._graph.setNodeAttr(exploitingNode.id, "activeExploitId", null);
      }
      emitEvent(E.ACTION_FEEDBACK, { nodeId: exploitingNode.id, action: "exploit", phase: "cancel", progress: 0 });
    },
    startRead: (_nodeId) => { /* now handled by timed-action operator */ },
    cancelRead: () => { /* now handled by cancel-read action effects */ },
    startLoot: (_nodeId) => { /* now handled by timed-action operator */ },
    cancelLoot: () => { /* now handled by cancel-loot action effects */ },
    ejectIce: () => ejectIce(),
    rebootNode: (nodeId) => rebootNode(nodeId),
    reconfigureNode: (nodeId) => reconfigureNode(nodeId),
    openDarknetsStore: () => {
      pauseTimers();
      openStore(getState());
    },

    // ── Resolve methods (called by timed-action operator on completion) ──

    resolveProbe: (nodeId) => {
      const s = getState();
      const node = s.nodes[nodeId];
      if (!node || node.probed) return;

      setNodeProbed(nodeId);
      setLastDisturbedNode(nodeId);

      if ((node.gateAccess ?? "probed") === "probed") {
        revealNeighbors(nodeId);
      }

      const prevAlert = node.alertState ?? "green";
      const idx = ALERT_ORDER.indexOf(prevAlert);
      if (idx >= 0 && idx < ALERT_ORDER.length - 1) {
        setNodeAlertState(nodeId, ALERT_ORDER[idx + 1]);
      }

      emitEvent(E.NODE_PROBED, { nodeId, label: node.label });
      const newAlert = getState().nodes[nodeId]?.alertState;
      if (newAlert && newAlert !== prevAlert) {
        emitEvent(E.NODE_ALERT_RAISED, { nodeId, label: node.label, prev: prevAlert, next: newAlert });
      }
    },

    resolveExploit: (nodeId) => {
      const s = getState();
      const node = s.nodes[nodeId];
      const exploitId = /** @type {any} */ (node)?.activeExploitId;
      if (!exploitId) return;
      launchExploit(nodeId, exploitId);
    },

    resolveRead: (nodeId) => {
      const s = getState();
      const node = s.nodes[nodeId];
      if (!node || node.read) return;

      setNodeRead(nodeId);
      emitEvent(E.NODE_READ, { nodeId, label: node.label, macguffinCount: (node.macguffins ?? []).length });
    },

    resolveLoot: (nodeId) => {
      const s = getState();
      const node = s.nodes[nodeId];
      if (!node || node.looted) return;

      const { items, total } = collectMacguffins(nodeId);
      if (items.length === 0) {
        setNodeLooted(nodeId);
        return;
      }

      setNodeLooted(nodeId);
      addCash(total);
      emitEvent(E.NODE_LOOTED, { nodeId, label: node.label, items: items.length, total });

      if (s.mission && !s.mission.complete) {
        const gotMission = items.some((m) => m.id === s.mission.targetMacguffinId);
        if (gotMission) {
          setMissionComplete();
          emitEvent(E.MISSION_COMPLETE, { targetName: s.mission.targetName });
        }
      }
    },

    resolveReboot: (nodeId) => rebootNode(nodeId),

    emitActionFeedback: (nodeId, action, phase, progress, result) => {
      emitEvent(E.ACTION_FEEDBACK, { nodeId, action, phase, progress, result });
    },
  };

  return ctx;
}
