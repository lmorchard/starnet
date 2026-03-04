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

/** @type {GlobalAlertLevel[]} */
const GLOBAL_ALERT_ORDER = ["green", "yellow", "red", "trace"];

// Node types that act as detectors (IDS) or monitors (security-monitor)
const DETECTOR_TYPES = new Set(["ids"]);
const MONITOR_TYPES = new Set(["security-monitor"]);

// Detection thresholds: cumulative detections before trace starts, by ICE grade
const DETECTION_TRACE_THRESHOLD = { S: 1, A: 1, B: 2, C: 2, D: 3, F: 3 };

// ── Event-driven hooks ────────────────────────────────────

/**
 * Register alert event handlers. Called at module load and can be re-called
 * after clearHandlers() (e.g. in the bot census loop).
 */
export function initAlertHandlers() {
  on(E.NODE_ALERT_RAISED, ({ nodeId }) => {
    const s = getState();
    const node = s.nodes[nodeId];
    if (!node) return;

    // When a graph is active, alert propagation is handled by graph operators/triggers.
    // Just recompute global alert from node states.
    if (s.nodeGraph) {
      recomputeGlobalAlert();
      return;
    }

    // Legacy path: IDS detection nodes propagate alerts to monitors
    if (DETECTOR_TYPES.has(node.type)) {
      propagateAlertEvent(nodeId);
    }
    recomputeGlobalAlert();
  });

  on(E.NODE_RECONFIGURED, ({ nodeId }) => {
    const s = getState();
    const node = s.nodes[nodeId];
    if (!node) return;
    recomputeGlobalAlert();
  });
}

// Register on first import
initAlertHandlers();

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
  const monitors  = Object.values(s.nodes).filter((n) => MONITOR_TYPES.has(n.type));
  const detectors = Object.values(s.nodes).filter((n) => DETECTOR_TYPES.has(n.type));

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

/**
 * Record an ICE detection event. Raises alert on all IDS nodes, which
 * propagate to security monitors via the normal forwarding path.
 */
export function recordIceDetection(nodeId) {
  const s = getState();
  if (!s.ice?.active) return;
  setIceDetectedAt(nodeId);
  incrementIceDetectionCount();

  // Raise alert on all IDS (detection) nodes
  const detectors = Object.entries(s.nodes).filter(([, n]) => DETECTOR_TYPES.has(n.type));
  for (const [detId, det] of detectors) {
    const prevAlert = det.alertState;
    const idx = ALERT_ORDER.indexOf(prevAlert);
    if (idx < ALERT_ORDER.length - 1) {
      const nextAlert = ALERT_ORDER[idx + 1];
      setNodeAlertState(detId, nextAlert);
      emitEvent(E.NODE_ALERT_RAISED, { nodeId: detId, label: det.label, prev: prevAlert, next: nextAlert });
    }
  }
}
