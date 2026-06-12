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

import { A } from "../action-ids.js";
import { startTraceCountdown, cancelTraceCountdown, recordMonitorAlert, scrubLogs, lieLow } from "../alert.js";
import { addCash, setMissionComplete, addCardToHand } from "../state/player.js";
import { mineYieldChance, isMineExhausted, generateMinedCard } from "../mining.js";
import { startIce, ejectIce, rebootIce, stopIce, disableIce } from "../ice.js";
import { activeIceInstances } from "../state/ice.js";
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
import { endRun, nextAlertLevel, revealNeighbors } from "../state.js";
import { pauseTimers } from "../timers.js";
import { getState } from "../state.js";
import { setNodeProbed, setNodeAlertState, setNodeRead, collectMacguffins, setNodeLooted, incrementMineAttempts, setMineExhausted } from "../state/node.js";
import { setLastDisturbedNode } from "../state/ice.js";
import { launchExploit } from "../combat.js";
import { getTimedActionAttrNames } from "./timed-actions.js";

/** Convenience: `_ta_<action>_progress` for the given timed action. */
const progressAttr = (action) => getTimedActionAttrNames(action).progressAttr;
/** Convenience: `_ta_<action>_duration` for the given timed action. */
const durationAttr = (action) => getTimedActionAttrNames(action).durationAttr;

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
    recordMonitorAlert: (nodeId) => recordMonitorAlert(nodeId),
    scrubLogs: (nodeId) => scrubLogs(nodeId),
    lieLow: (nodeId) => lieLow(nodeId),
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
      if (!ctx._graph) return;
      const current = ctx._graph.getNodeState(nodeId)?.visibility;
      // Only upgrade visibility — never downgrade from accessible
      if (current !== "accessible") {
        ctx._graph.setNodeAttr(nodeId, "visibility", "revealed");
      }
    },
    log: (message) => emitEvent(E.LOG_ENTRY, { text: message, type: "system" }),

    // ── Game action callbacks ───────────────────────────
    // Probe, read, loot start/cancel now handled by action effects (set-attr)
    // in the trait-based action system. These stubs remain for backward compat.
    startProbe: (_nodeId) => { /* now handled by timed-action operator */ },
    cancelProbe: () => { /* now handled by abort action */ },
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
        ctx._graph.setNodeAttr(nodeId, progressAttr("xploit"), 0);
        ctx._graph.setNodeAttr(nodeId, durationAttr("xploit"), durationTicks);
      }
      // Emit start feedback immediately (operator skips start for pre-set durations)
      emitEvent(E.ACTION_FEEDBACK, { nodeId, action: A.XPLOIT, phase: "start", progress: 0, durationTicks });
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
        ctx._graph.setNodeAttr(exploitingNode.id, progressAttr("xploit"), 0);
        ctx._graph.setNodeAttr(exploitingNode.id, durationAttr("xploit"), 0);
        ctx._graph.setNodeAttr(exploitingNode.id, "activeExploitId", null);
      }
      emitEvent(E.ACTION_FEEDBACK, { nodeId: exploitingNode.id, action: A.XPLOIT, phase: "cancel", progress: 0 });
    },
    abortTimedAction: (nodeId) => {
      // Unified abort — query the node's timed-action operators to find whichever
      // one is active, then clear it generically. No hardcoded action list.
      if (!ctx._graph) return;
      const active = ctx._graph.getActiveTimedAction(nodeId);
      if (!active) return;

      // Exploit is special — has extra attributes (activeExploitId) beyond the
      // standard activeAttr/progressAttr/durationAttr pattern.
      if (active.action === A.XPLOIT) {
        ctx.cancelExploit();
        return;
      }

      ctx._graph.setNodeAttr(nodeId, active.activeAttr, false);
      ctx._graph.setNodeAttr(nodeId, active.progressAttr, 0);
      // Reset duration too: the timed-action operator only re-emits the "start" phase when
      // BOTH progress and duration are 0. A stale duration after a cancel would make a restart
      // skip "start", leaving the overlay/log dispatcher un-armed (it keys off "start").
      ctx._graph.setNodeAttr(nodeId, active.durationAttr, 0);
      emitEvent(E.ACTION_FEEDBACK, { nodeId, action: active.action, phase: "cancel", progress: 0 });
    },
    startRead: (_nodeId) => { /* now handled by timed-action operator */ },
    cancelRead: () => { /* now handled by cancel-read action effects */ },
    startLoot: (_nodeId) => { /* now handled by timed-action operator */ },
    cancelLoot: () => { /* now handled by cancel-loot action effects */ },
    ejectIce: (nodeId) => ejectIce(nodeId),
    rebootNode: (nodeId) => {
      // Legacy stub — reboot now handled by startReboot + timed-action operator
    },
    reconfigureNode: (nodeId) => {
      const s = getState();
      const node = s.nodes[nodeId];
      if (!node) return;
      emitEvent(E.ACTION_RESOLVED, { action: A.CORRUPT, nodeId, label: node.label });
    },

    startReboot: (nodeId) => {
      const s = getState();
      const node = s.nodes[nodeId];
      if (!node || node.rebooting) return;

      // Send the ICE present on this node home (the instance AT nodeId, not just
      // the first active one — multi-instance correctness).
      const ice = activeIceInstances(s).find((i) => i.attentionNodeId === nodeId);
      if (ice) {
        rebootIce(nodeId);
        emitEvent(E.ICE_REBOOTED, {
          iceId: ice.id,
          residentNodeId: ice.hostNodeId ?? null,
          residentLabel: s.nodes[ice.hostNodeId]?.label ?? ice.hostNodeId,
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
        ctx._graph.setNodeAttr(nodeId, progressAttr("reboot"), 0);
        ctx._graph.setNodeAttr(nodeId, durationAttr("reboot"), durationTicks);
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
      const raised = nextAlertLevel(prevAlert);
      if (raised !== prevAlert) {
        setNodeAlertState(nodeId, raised);
      }

      emitEvent(E.ACTION_RESOLVED, { action: A.PROBE, nodeId, label: node.label });
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
      emitEvent(E.ACTION_RESOLVED, { action: A.DUMP, nodeId, label: node.label, detail: { macguffinCount: (node.macguffins ?? []).length } });
    },

    resolveLoot: (nodeId) => {
      const s = getState();
      const node = s.nodes[nodeId];
      if (!node || node.looted) return;

      // Trap node (honey-pot): reaching for the bait springs the counter-trace.
      // Mark looted, poison the node (its trigger fires startTrace), pay nothing.
      if (node.trap) {
        setNodeLooted(nodeId);
        ctx._graph.setNodeAttr(nodeId, "poisoned", true);
        emitEvent(E.ACTION_RESOLVED, { action: A.FETCH, nodeId, label: node.label, detail: { items: 0, total: 0, trap: true } });
        return;
      }

      const { items, total } = collectMacguffins(nodeId);
      if (items.length === 0) {
        setNodeLooted(nodeId);
        return;
      }

      setNodeLooted(nodeId);
      addCash(total);
      emitEvent(E.ACTION_RESOLVED, { action: A.FETCH, nodeId, label: node.label, detail: { items: items.length, total } });

      if (s.mission && !s.mission.complete) {
        const gotMission = items.some((m) => m.id === s.mission.targetMacguffinId);
        if (gotMission) {
          setMissionComplete();
          emitEvent(E.MISSION_COMPLETE, { targetName: s.mission.targetName });
        }
      }
    },

    resolveMine: (nodeId) => {
      const s = getState();
      const node = s.nodes[nodeId];
      if (!node) return;

      // Trap node (honey-pot): data-mining trips the counter-trace, yields nothing.
      if (node.trap) {
        ctx._graph.setNodeAttr(nodeId, "poisoned", true);
        setLastDisturbedNode(nodeId);
        emitEvent(E.ACTION_RESOLVED, { action: A.MINE, nodeId, label: node.label, detail: { outcome: "trap" } });
        return;
      }

      const grade = node.grade ?? "D";
      const attempts = node.mineAttempts ?? 0;       // prior attempts
      const chance = mineYieldChance(grade, attempts);
      const hit = random(RNG.MINE) < chance;

      let card = null;
      if (hit) { card = generateMinedCard(node); if (card) addCardToHand(card); }

      incrementMineAttempts(nodeId);                  // attempts → attempts+1
      const exhausted = isMineExhausted(grade, attempts + 1);
      if (exhausted) setMineExhausted(nodeId, true);

      setLastDisturbedNode(nodeId);                   // keep ICE interested at resolution
      emitEvent(E.ACTION_RESOLVED, {
        action: A.MINE, nodeId, label: node.label,
        detail: {
          outcome: hit ? "card" : "miss",
          rarity: card?.rarity ?? null,
          cardName: card?.name ?? null,
          quality: card?.quality ?? null,
          attempts: attempts + 1,
          exhausted,
        },
      });
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

// ── Cancel timed actions on navigation ──
// When the player selects a different node or deselects, cancel any in-progress
// timed action. Critical for evasion gameplay — the player must be able to
// disengage quickly. Wrapped in an init function so the headless harness can
// re-register it after clearHandlers() between runs; the browser registers it
// once at module load (see call below).
export function initNavigationCancelHandler() {
  on(E.PLAYER_NAVIGATED, () => {
  const s = getState();
  const graph = s.nodeGraph;
  if (!graph) return;

  for (const nodeId of graph.getNodeIds()) {
    const attrs = graph.getNodeState(nodeId);
    // Reset duration along with progress on every cancel: the timed-action operator only
    // re-emits "start" when both are 0, so a stale duration would leave a restarted action's
    // overlay/log un-armed. (XPLOIT already cleared its ctx-set duration below.)
    if (attrs.probing) {
      graph.setNodeAttr(nodeId, "probing", false);
      graph.setNodeAttr(nodeId, progressAttr("probe"), 0);
      graph.setNodeAttr(nodeId, durationAttr("probe"), 0);
      emitEvent(E.ACTION_FEEDBACK, { nodeId, action: A.PROBE, phase: "cancel", progress: 0 });
    }
    if (attrs.exploiting) {
      graph.setNodeAttr(nodeId, "exploiting", false);
      graph.setNodeAttr(nodeId, progressAttr("xploit"), 0);
      graph.setNodeAttr(nodeId, durationAttr("xploit"), 0);
      graph.setNodeAttr(nodeId, "activeExploitId", null);
      emitEvent(E.ACTION_FEEDBACK, { nodeId, action: A.XPLOIT, phase: "cancel", progress: 0 });
    }
    if (attrs.reading) {
      graph.setNodeAttr(nodeId, "reading", false);
      graph.setNodeAttr(nodeId, progressAttr("dump"), 0);
      graph.setNodeAttr(nodeId, durationAttr("dump"), 0);
      emitEvent(E.ACTION_FEEDBACK, { nodeId, action: A.DUMP, phase: "cancel", progress: 0 });
    }
    if (attrs.looting) {
      graph.setNodeAttr(nodeId, "looting", false);
      graph.setNodeAttr(nodeId, progressAttr("fetch"), 0);
      graph.setNodeAttr(nodeId, durationAttr("fetch"), 0);
      emitEvent(E.ACTION_FEEDBACK, { nodeId, action: A.FETCH, phase: "cancel", progress: 0 });
    }
    if (attrs.mining) {
      graph.setNodeAttr(nodeId, "mining", false);
      graph.setNodeAttr(nodeId, progressAttr("mine"), 0);
      graph.setNodeAttr(nodeId, durationAttr("mine"), 0);
      emitEvent(E.ACTION_FEEDBACK, { nodeId, action: A.MINE, phase: "cancel", progress: 0 });
    }
    if (attrs.lyingLow) {
      graph.setNodeAttr(nodeId, "lyingLow", false);
      graph.setNodeAttr(nodeId, progressAttr("lie-low"), 0);
      graph.setNodeAttr(nodeId, durationAttr("lie-low"), 0);
      emitEvent(E.ACTION_FEEDBACK, { nodeId, action: A.LIE_LOW, phase: "cancel", progress: 0 });
    }
  }
  });
}

// Register once at module load for the browser entry point (one run per page load).
initNavigationCancelHandler();

