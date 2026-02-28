// @ts-check
// Alert subsystem — node alert propagation, global alert computation, trace countdown.
// Registers event listeners so state.js can emit NODE_ALERT_RAISED / NODE_RECONFIGURED
// without importing this module (no circular dependency).

/** @typedef {import('./types.js').GlobalAlertLevel} GlobalAlertLevel */

import { getState, endRun, ALERT_ORDER } from "./state.js";
import { setNodeAlertState } from "./state/node.js";
import { setGlobalAlert, setTraceCountdown, setTraceTimerId, decrementTraceCountdown } from "./state/alert.js";
import { setIceDetectedAt, incrementIceDetectionCount } from "./state/ice.js";
import { emitEvent, on, E } from "./events.js";
import { scheduleRepeating, cancelEvent, TIMER } from "./timers.js";
import { hasBehavior, getBehaviors } from "./node-types.js";

/** @type {GlobalAlertLevel[]} */
const GLOBAL_ALERT_ORDER = ["green", "yellow", "red", "trace"];

// Detection thresholds: cumulative detections before trace starts, by ICE grade
const DETECTION_TRACE_THRESHOLD = { S: 1, A: 1, B: 2, C: 2, D: 3, F: 3 };

// ── Event-driven hooks ────────────────────────────────────

// When any node alert raises, propagate if it's a detection node; otherwise
// recompute global alert directly. Runs synchronously before STATE_CHANGED fires.
on(E.NODE_ALERT_RAISED, ({ nodeId }) => {
  const s = getState();
  const node = s.nodes[nodeId];
  if (!node) return;
  const ctx = { propagateAlertEvent, startTraceCountdown, recomputeGlobalAlert };
  const handled = getBehaviors(node).some((atom) => {
    if (atom.onAlertRaised) { atom.onAlertRaised(node, s, ctx); return true; }
    return false;
  });
  if (!handled) recomputeGlobalAlert();
});

// Reconfiguring a node — dispatch onReconfigured atom, then recompute.
on(E.NODE_RECONFIGURED, ({ nodeId }) => {
  const s = getState();
  const node = s.nodes[nodeId];
  if (!node) return;
  const ctx = { recomputeGlobalAlert };
  getBehaviors(node).forEach((atom) => atom.onReconfigured?.(node, s, ctx));
});

// ── Propagation ───────────────────────────────────────────

export function propagateAlertEvent(fromNodeId) {
  const s = getState();
  const fromNode = s.nodes[fromNodeId];
  if (!fromNode || fromNode.eventForwardingDisabled) return;

  (s.adjacency[fromNodeId] || []).forEach((neighborId) => {
    const neighbor = s.nodes[neighborId];
    if (neighbor && hasBehavior(neighbor, "monitor")) {
      const idx = ALERT_ORDER.indexOf(neighbor.alertState);
      if (idx < ALERT_ORDER.length - 1) {
        setNodeAlertState(neighborId, ALERT_ORDER[idx + 1]);
      }
      emitEvent(E.ALERT_PROPAGATED, {
        fromNodeId,
        fromLabel: fromNode.label,
        toNodeId: neighborId,
        toLabel: neighbor.label,
      });
      recomputeGlobalAlert();
    }
  });
}

function recomputeGlobalAlert() {
  const s = getState();
  const monitors  = Object.values(s.nodes).filter((n) => hasBehavior(n, "monitor"));
  const detectors = Object.values(s.nodes).filter(
    (n) => hasBehavior(n, "detection") || hasBehavior(n, "direct-trace")
  );

  const redMonitors    = monitors.filter((n) => n.alertState === "red").length;
  const redDetectors   = detectors.filter((n) => n.alertState === "red"   && !n.eventForwardingDisabled).length;
  const yellowDetectors = detectors.filter((n) => n.alertState !== "green" && !n.eventForwardingDisabled).length;

  /** @type {GlobalAlertLevel} */
  let newLevel = "green";
  if (yellowDetectors >= 1)                  newLevel = "yellow";
  if (redDetectors >= 1)                     newLevel = "red";
  if (redDetectors >= 2 || redMonitors >= 1) newLevel = "trace";

  // Only escalate, never de-escalate
  const current = GLOBAL_ALERT_ORDER.indexOf(s.globalAlert);
  const next    = GLOBAL_ALERT_ORDER.indexOf(newLevel);
  if (next > current) {
    const prev = s.globalAlert;
    setGlobalAlert(newLevel);
    emitEvent(E.ALERT_GLOBAL_RAISED, { prev, next: newLevel });
    if (newLevel === "trace" && s.traceSecondsRemaining === null) {
      startTraceCountdown();
    }
  }
}

// ── Global alert ──────────────────────────────────────────

export function raiseGlobalAlert() {
  const s = getState();
  const prev = s.globalAlert;
  const idx = GLOBAL_ALERT_ORDER.indexOf(s.globalAlert);
  if (idx < GLOBAL_ALERT_ORDER.length - 1) {
    setGlobalAlert(GLOBAL_ALERT_ORDER[idx + 1]);
  }
  const updated = getState().globalAlert;
  if (prev !== updated) {
    emitEvent(E.ALERT_GLOBAL_RAISED, { prev, next: updated });
  }
  if (updated === "trace" && getState().traceSecondsRemaining === null) {
    startTraceCountdown();
  }
}

// ── Trace countdown ───────────────────────────────────────

export function startTraceCountdown() {
  setTraceCountdown(60);
  emitEvent(E.ALERT_TRACE_STARTED, { seconds: 60 });
  const timerId = scheduleRepeating(TIMER.TRACE_TICK, 1000);
  setTraceTimerId(timerId);
}

export function handleTraceTick() {
  const s = getState();
  if (!s || s.phase !== "playing") return;
  const remaining = decrementTraceCountdown();
  if (remaining !== null && remaining <= 0) {
    endRun("caught");
  }
}

export function cancelTraceCountdown() {
  const s = getState();
  if (s.traceTimerId !== null) {
    cancelEvent(s.traceTimerId);
    setTraceTimerId(null);
  }
  setTraceCountdown(null);
  setGlobalAlert("green");
  emitEvent(E.ALERT_TRACE_CANCELLED, {});
}

// Bypass escalation-only rule — cheat use only
export function forceGlobalAlert(level) {
  if (!GLOBAL_ALERT_ORDER.includes(level)) return;
  const s = getState();
  const prev = s.globalAlert;
  setGlobalAlert(level);
  if (level !== prev) {
    emitEvent(E.ALERT_GLOBAL_RAISED, { prev, next: level });
  }
  if (level === "trace" && getState().traceSecondsRemaining === null) {
    startTraceCountdown();
  }
}

// ── ICE detection ─────────────────────────────────────────

export function recordIceDetection(nodeId) {
  const s = getState();
  if (!s.ice?.active) return;
  setIceDetectedAt(nodeId);
  incrementIceDetectionCount();

  // Each detection escalates global alert one step (capped at red).
  // The threshold check below handles the jump to trace.
  const curIdx = GLOBAL_ALERT_ORDER.indexOf(s.globalAlert);
  const redIdx = GLOBAL_ALERT_ORDER.indexOf("red");
  if (curIdx < redIdx) {
    const prev = s.globalAlert;
    setGlobalAlert(GLOBAL_ALERT_ORDER[curIdx + 1]);
    emitEvent(E.ALERT_GLOBAL_RAISED, { prev, next: getState().globalAlert });
  }

  // Re-read state after mutations
  const updated = getState();
  if (updated.traceSecondsRemaining !== null) return;
  const threshold = DETECTION_TRACE_THRESHOLD[updated.ice.grade] ?? 2;
  if (updated.ice.detectionCount >= threshold) {
    if (updated.globalAlert !== "trace") {
      const prev = updated.globalAlert;
      setGlobalAlert("trace");
      emitEvent(E.ALERT_GLOBAL_RAISED, { prev, next: "trace" });
    }
    startTraceCountdown();
  }
}
