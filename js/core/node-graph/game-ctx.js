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
import { startIce, ejectIce, rebootIce, stopIce, disableIce } from "../ice.js";
import { on } from "../events.js";
import { setSelectedNode } from "../state/game.js";
import { setNodeRebooting } from "../state/node.js";
import { RNG, random } from "../rng.js";
import { setGlobalAlert } from "../state/alert.js";
import { emitEvent, E } from "../events.js";
// Exploit duration formula: higher quality = longer execution (more complex payload).
// Range: 2s (quality=0) to 7s (quality=1).
function exploitDuration(quality) {
  return Math.round((2 + quality * 5) * 1000); // ms
}
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
    stopIce: () => stopIce(),
    disableIce: () => { stopIce(); disableIce(); },
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
      // Emit start feedback immediately (operator skips start for pre-set durations)
      emitEvent(E.ACTION_FEEDBACK, { nodeId, action: "exploit", phase: "start", progress: 0, durationTicks });
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
    rebootNode: (nodeId) => {
      // Legacy stub — reboot now handled by startReboot + timed-action operator
    },
    reconfigureNode: (nodeId) => {
      const s = getState();
      const node = s.nodes[nodeId];
      if (!node) return;
      emitEvent(E.ACTION_RESOLVED, { action: "reconfigure", nodeId, label: node.label });
    },

    startReboot: (nodeId) => {
      const s = getState();
      const node = s.nodes[nodeId];
      if (!node || node.rebooting) return;

      // Send ICE home if on this node
      if (s.ice?.active && s.ice.attentionNodeId === nodeId) {
        rebootIce();
        emitEvent(E.ICE_REBOOTED, {
          residentNodeId: s.ice.residentNodeId,
          residentLabel: s.nodes[s.ice.residentNodeId]?.label ?? s.ice.residentNodeId,
        });
      }

      // Deselect
      if (s.selectedNodeId === nodeId) {
        setSelectedNode(null);
      }

      // Set rebooting + random duration (1-3s = 10-30 ticks)
      const durationTicks = 10 + Math.round(random(RNG.WORLD) * 20);
      if (ctx._graph) {
        ctx._graph.setNodeAttr(nodeId, "rebooting", true);
        ctx._graph.setNodeAttr(nodeId, "_ta_reboot_progress", 0);
        ctx._graph.setNodeAttr(nodeId, "_ta_reboot_duration", durationTicks);
      }

      emitEvent(E.ACTION_RESOLVED, { action: "reboot-start", nodeId, label: node.label, detail: { durationMs: durationTicks * 100 } });
      emitEvent(E.ACTION_FEEDBACK, { nodeId, action: "reboot", phase: "start", progress: 0, durationTicks });
    },
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

      emitEvent(E.ACTION_RESOLVED, { action: "probe", nodeId, label: node.label });
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
      emitEvent(E.ACTION_RESOLVED, { action: "read", nodeId, label: node.label, detail: { macguffinCount: (node.macguffins ?? []).length } });
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
      emitEvent(E.ACTION_RESOLVED, { action: "loot", nodeId, label: node.label, detail: { items: items.length, total } });

      if (s.mission && !s.mission.complete) {
        const gotMission = items.some((m) => m.id === s.mission.targetMacguffinId);
        if (gotMission) {
          setMissionComplete();
          emitEvent(E.MISSION_COMPLETE, { targetName: s.mission.targetName });
        }
      }
    },

    resolveReboot: (nodeId) => {
      // Legacy alias
    },

    completeReboot: (nodeId) => {
      const s = getState();
      const node = s.nodes[nodeId];
      if (!node) return;
      setNodeRebooting(nodeId, false);
      emitEvent(E.ACTION_RESOLVED, { action: "reboot-complete", nodeId, label: node.label });
    },

    emitActionFeedback: (nodeId, action, phase, progress, result) => {
      emitEvent(E.ACTION_FEEDBACK, { nodeId, action, phase, progress, result });
    },

    volatileDetonate: (nodeId) => {
      const s = getState();
      const node = s.nodes[nodeId];
      if (!node) return;
      const effect = node.volatileEffect ?? "reset";
      if (effect === "reset") {
        // Revert to locked/unprobed — player lost their work
        if (ctx._graph) {
          ctx._graph.setNodeAttr(nodeId, "accessLevel", "locked");
          ctx._graph.setNodeAttr(nodeId, "probed", false);
          ctx._graph.setNodeAttr(nodeId, "vulnerabilities", []);
          ctx._graph.setNodeAttr(nodeId, "_volatile_armed", false);
        }
      } else if (effect === "disable") {
        // Node goes dark permanently
        if (ctx._graph) {
          ctx._graph.setNodeAttr(nodeId, "visibility", "hidden");
          ctx._graph.setNodeAttr(nodeId, "_volatile_armed", false);
        }
      } else if (effect === "corrupt") {
        // Macguffins destroyed, node stays owned
        if (ctx._graph) {
          ctx._graph.setNodeAttr(nodeId, "macguffins", []);
          ctx._graph.setNodeAttr(nodeId, "looted", true);
          ctx._graph.setNodeAttr(nodeId, "_volatile_armed", false);
        }
      }
      emitEvent(E.ACTION_RESOLVED, {
        action: "volatile-detonate", nodeId, label: node.label,
        detail: { effect },
      });
      emitEvent(E.LOG_ENTRY, {
        text: `[VOLATILE] ${node.label}: ${effect === "reset" ? "NODE RESET — access revoked." : effect === "disable" ? "NODE DISABLED — gone dark." : "DATA CORRUPTED — loot destroyed."}`,
        type: "error",
      });
    },
  };

  return ctx;
}

// ── Cancel timed actions on navigation (module-level, runs once) ──
// When the player selects a different node or deselects, cancel any in-progress
// timed action. Critical for evasion gameplay — the player must be able to
// disengage quickly.
on(E.PLAYER_NAVIGATED, () => {
  const s = getState();
  const graph = s.nodeGraph;
  if (!graph) return;

  for (const nodeId of graph.getNodeIds()) {
    const attrs = graph.getNodeState(nodeId);
    if (attrs.probing) {
      graph.setNodeAttr(nodeId, "probing", false);
      graph.setNodeAttr(nodeId, "_ta_probe_progress", 0);
      emitEvent(E.ACTION_FEEDBACK, { nodeId, action: "probe", phase: "cancel", progress: 0 });
    }
    if (attrs.exploiting) {
      graph.setNodeAttr(nodeId, "exploiting", false);
      graph.setNodeAttr(nodeId, "_ta_exploit_progress", 0);
      graph.setNodeAttr(nodeId, "_ta_exploit_duration", 0);
      graph.setNodeAttr(nodeId, "activeExploitId", null);
      emitEvent(E.ACTION_FEEDBACK, { nodeId, action: "exploit", phase: "cancel", progress: 0 });
    }
    if (attrs.reading) {
      graph.setNodeAttr(nodeId, "reading", false);
      graph.setNodeAttr(nodeId, "_ta_read_progress", 0);
      emitEvent(E.ACTION_FEEDBACK, { nodeId, action: "read", phase: "cancel", progress: 0 });
    }
    if (attrs.looting) {
      graph.setNodeAttr(nodeId, "looting", false);
      graph.setNodeAttr(nodeId, "_ta_loot_progress", 0);
      emitEvent(E.ACTION_FEEDBACK, { nodeId, action: "loot", phase: "cancel", progress: 0 });
    }
  }
});

