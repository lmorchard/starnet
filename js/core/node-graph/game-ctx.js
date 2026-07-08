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
import { startTraceCountdown, cancelTraceCountdown, recordMonitorAlert, scrubLogs, lieLow, recordHeat } from "../alert.js";
import { HEAT_COST } from "../balance.js";
import { addCash, setMissionComplete, addCardToHand, addRoundToHoard } from "../state/player.js";
import { mineYieldChance, isMineExhausted, generateMinedRound } from "../mining.js";
import { startIce, ejectIce, rebootIce, stopIce, disableIce } from "../ice.js";
import { activeIceInstances } from "../state/ice.js";
import { on } from "../events.js";
import { setSelectedNode } from "../state/game.js";
import { setNodeRebooting } from "../state/node.js";
import { RNG, random } from "../rng.js";
import { setGlobalAlert } from "../state/alert.js";
import { emitEvent, E } from "../events.js";
import { endRun, nextAlertLevel, revealNeighbors } from "../state.js";
import { pauseTimers } from "../timers.js";
import { getState } from "../state.js";
import { abortNodeProcesses } from "../processes.js";
import { setNodeProbed, setNodeAlertState, setNodeRead, collectMacguffins, setNodeLooted, incrementMineAttempts, setMineExhausted } from "../state/node.js";
import { setLastDisturbedNode } from "../state/ice.js";
import { getTimedActionAttrNames, ABORTABLE_TIMED_ACTIONS, TIMED_ACTIONS } from "./timed-actions.js";
import { sniffFlow, replayCredential } from "../programs.js";

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
    recordHeat: (amount) => recordHeat(amount),
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
      // getActiveAbortableTimedAction (not getActiveTimedAction) is deliberate
      // (#187 Phase 2 review fix): defense in depth so this is a no-op on a
      // non-abortable active action (reboot) even if invoked outside the normal
      // ABORT_ACTION.requires gate, which already excludes it.
      if (!ctx._graph) return;
      const active = ctx._graph.getActiveAbortableTimedAction(nodeId);
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
    jackOut: () => endRun("success"),

    // ── Resolve methods (called by timed-action operator on completion) ──

    resolveProbe: (nodeId) => {
      const s = getState();
      const node = s.nodes[nodeId];
      if (!node || node.probed) return;

      setNodeProbed(nodeId);
      setLastDisturbedNode(nodeId);
      recordHeat(HEAT_COST.probe); // probing is activity — it raises heat

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

      let round = null;
      if (hit) { round = generateMinedRound(node); addRoundToHoard(round); }

      incrementMineAttempts(nodeId);                  // attempts → attempts+1
      const exhausted = isMineExhausted(grade, attempts + 1);
      if (exhausted) setMineExhausted(nodeId, true);

      setLastDisturbedNode(nodeId);                   // keep ICE interested at resolution
      emitEvent(E.ACTION_RESOLVED, {
        action: A.MINE, nodeId, label: node.label,
        detail: {
          outcome: hit ? "round" : "miss",
          rarity: round?.rarity ?? null,
          types: round?.types ?? null,
          attempts: attempts + 1,
          exhausted,
        },
      });
    },

    // ── Flow-program resolvers (called by the sniff/replay timed-action operator on completion) ──
    // The per-play flowId is stashed on the node as `_sniff_flow_id` at arm time (armTimedProgram)
    // so the operator's onComplete stays static + serializable. Reads it back, then clears it.
    resolveSniff: (nodeId) => {
      const s = getState();
      const flowId = /** @type {any} */ (s.nodes[nodeId])?._sniff_flow_id;
      if (flowId == null) return;
      sniffFlow(s, nodeId, flowId);
      if (ctx._graph) ctx._graph.setNodeAttr(nodeId, "_sniff_flow_id", null);
    },
    resolveReplay: (nodeId) => {
      replayCredential(getState(), nodeId);
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

  // Derive the abortable set from the TIMED_ACTIONS registry (#225) rather than hand-enumerating
  // each action — adding a new abortable timed action now cancels correctly with no edit here.
  // The registry `action` id is exactly the ACTION_FEEDBACK action constant (A.PROBE === "probe",
  // etc.), so emitting `def.action` matches the former per-branch A.* payloads byte-for-byte.
  for (const nodeId of graph.getNodeIds()) {
    const attrs = graph.getNodeState(nodeId);
    for (const def of ABORTABLE_TIMED_ACTIONS) {
      if (!attrs[def.activeAttr]) continue;
      // Reset duration along with progress on every cancel: the timed-action operator only
      // re-emits "start" when both are 0, so a stale duration would leave a restarted action's
      // overlay/log un-armed.
      graph.setNodeAttr(nodeId, def.activeAttr, false);
      graph.setNodeAttr(nodeId, progressAttr(def.action), 0);
      graph.setNodeAttr(nodeId, durationAttr(def.action), 0);
      // Extra per-action cleanup (e.g. xploit's activeExploitId), centralized in the registry.
      for (const attr of def.clearOnCancel ?? []) graph.setNodeAttr(nodeId, attr, null);
      emitEvent(E.ACTION_FEEDBACK, { nodeId, action: def.action, phase: "cancel", progress: 0 });
    }

    // Generalized fallback (#187 Phase 2): a synthesized timed action (declarative
    // ActionDef.timed) isn't in the TIMED_ACTIONS registry, so the enumerated loop
    // above can't see it by name. getActiveTimedAction finds it structurally (any
    // active timed-action operator) instead — cancel it the same way. Skip anything
    // already IN the registry: the loop above either already reset it (abortable),
    // or it's intentionally excluded (reboot — involuntary, ABORT can't touch it).
    const active = graph.getActiveTimedAction(nodeId);
    if (active && !TIMED_ACTIONS.some((t) => t.action === active.action)) {
      graph.setNodeAttr(nodeId, active.activeAttr, false);
      graph.setNodeAttr(nodeId, active.progressAttr, 0);
      graph.setNodeAttr(nodeId, active.durationAttr, 0);
      emitEvent(E.ACTION_FEEDBACK, { nodeId, action: active.action, phase: "cancel", progress: 0 });
    }
  }
  // Progressive processes (SWEEP, …) also cancel on navigation — parity with timed actions.
  for (const proc of [...getState().processes]) abortNodeProcesses(proc.nodeId);
  });
}

// Register once at module load for the browser entry point (one run per page load).
initNavigationCancelHandler();

