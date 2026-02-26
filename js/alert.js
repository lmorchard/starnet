// @ts-check
// Alert subsystem — node alert propagation, global alert computation, trace countdown.
// Registers event listeners so state.js can emit NODE_ALERT_RAISED / NODE_RECONFIGURED
// without importing this module (no circular dependency).

/** @typedef {import('./types.js').GlobalAlertLevel} GlobalAlertLevel */

import { getState, endRun, emit, ALERT_ORDER } from "./state.js";
import { emitEvent, on, E } from "./events.js";
import { scheduleRepeating, cancelEvent, TIMER } from "./timers.js";

/** @type {GlobalAlertLevel[]} */
const GLOBAL_ALERT_ORDER = ["green", "yellow", "red", "trace"];

export const DETECTION_TYPES = new Set(["ids"]);
export const MONITOR_TYPES   = new Set(["security-monitor"]);

// Detection thresholds: cumulative detections before trace starts, by ICE grade
const DETECTION_TRACE_THRESHOLD = { S: 1, A: 1, B: 2, C: 2, D: 3, F: 3 };

// ── Event-driven hooks ────────────────────────────────────

// When any node alert raises, propagate if it's a detection node; otherwise
// recompute global alert directly. Runs synchronously before STATE_CHANGED fires.
on(E.NODE_ALERT_RAISED, ({ nodeId }) => {
  const s = getState();
  const node = s.nodes[nodeId];
  if (!node) return;
  if (DETECTION_TYPES.has(node.type)) {
    propagateAlertEvent(nodeId);
  } else {
    recomputeGlobalAlert();
  }
});

// Reconfiguring an IDS severs the propagation chain — recompute global alert.
on(E.NODE_RECONFIGURED, () => {
  recomputeGlobalAlert();
});

// ── Propagation ───────────────────────────────────────────

export function propagateAlertEvent(fromNodeId) {
  const s = getState();
  const fromNode = s.nodes[fromNodeId];
  if (!fromNode || fromNode.eventForwardingDisabled) return;

  (s.adjacency[fromNodeId] || []).forEach((neighborId) => {
    const neighbor = s.nodes[neighborId];
    if (neighbor && MONITOR_TYPES.has(neighbor.type)) {
      const idx = ALERT_ORDER.indexOf(neighbor.alertState);
      if (idx < ALERT_ORDER.length - 1) {
        neighbor.alertState = ALERT_ORDER[idx + 1];
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
  const monitors  = Object.values(s.nodes).filter((n) => MONITOR_TYPES.has(n.type));
  const detectors = Object.values(s.nodes).filter((n) => DETECTION_TYPES.has(n.type));

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
    s.globalAlert = newLevel;
    emitEvent(E.ALERT_GLOBAL_RAISED, { prev, next: s.globalAlert });
    if (s.globalAlert === "trace" && s.traceSecondsRemaining === null) {
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
    s.globalAlert = GLOBAL_ALERT_ORDER[idx + 1];
    emitEvent(E.ALERT_GLOBAL_RAISED, { prev, next: s.globalAlert });
  }
  if (s.globalAlert === "trace" && s.traceSecondsRemaining === null) {
    startTraceCountdown();
  }
  emit();
}

// ── Trace countdown ───────────────────────────────────────

export function startTraceCountdown() {
  const s = getState();
  s.traceSecondsRemaining = 60;
  emitEvent(E.ALERT_TRACE_STARTED, { seconds: 60 });
  s.traceTimerId = scheduleRepeating(TIMER.TRACE_TICK, 1000);
  emit();
}

export function handleTraceTick() {
  const s = getState();
  if (!s || s.phase !== "playing") return;
  s.traceSecondsRemaining -= 1;
  if (s.traceSecondsRemaining <= 0) {
    endRun("caught");
  } else {
    emit();
  }
}

export function cancelTraceCountdown() {
  const s = getState();
  if (s.traceTimerId !== null) {
    cancelEvent(s.traceTimerId);
    s.traceTimerId = null;
  }
  s.traceSecondsRemaining = null;
  s.globalAlert = "green";
  emitEvent(E.ALERT_TRACE_CANCELLED, {});
  emit();
}

// Bypass escalation-only rule — cheat use only
export function forceGlobalAlert(level) {
  if (!GLOBAL_ALERT_ORDER.includes(level)) return;
  const s = getState();
  const prev = s.globalAlert;
  s.globalAlert = level;
  if (level !== prev) {
    emitEvent(E.ALERT_GLOBAL_RAISED, { prev, next: level });
  }
  if (level === "trace" && s.traceSecondsRemaining === null) {
    startTraceCountdown();
  }
  emit();
}

// ── ICE detection ─────────────────────────────────────────

export function recordIceDetection(nodeId) {
  const s = getState();
  if (!s.ice?.active) return;
  s.ice.detectedAtNode = nodeId;
  s.ice.detectionCount++;
  if (s.traceSecondsRemaining !== null) return;
  const threshold = DETECTION_TRACE_THRESHOLD[s.ice.grade] ?? 2;
  if (s.ice.detectionCount >= threshold) {
    startTraceCountdown();
  }
}
