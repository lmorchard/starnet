// @ts-check
// Alert subsystem — node alert propagation, global alert computation, trace countdown.
// Registers event listeners so state.js can emit NODE_ALERT_RAISED / NODE_RECONFIGURED
// without importing this module (no circular dependency).

/** @typedef {import('./types.js').GlobalAlertLevel} GlobalAlertLevel */

import { getState, endRun, ALERT_ORDER } from "./state.js";
import { setNodeAlertState } from "./state/node.js";
import { setGlobalAlert, setTraceCountdown, setTraceTimerId, decrementTraceCountdown } from "./state/alert.js";
import { setIceDetectedAt, incrementIceDetectionCount, activeIceInstances } from "./state/ice.js";
import { emitEvent, on, E } from "./events.js";
import { A } from "./action-ids.js";
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

  on(E.ACTION_RESOLVED, ({ action }) => {
    if (action === A.CORRUPT) recomputeGlobalAlert();
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

/** Trace countdown duration scales with network threat grade. */
const TRACE_SECONDS = { S: 30, A: 40, B: 45, C: 60, D: 75, F: 90 };

export function startTraceCountdown() {
  const s = getState();
  // Trace is the top alert level. Guarantee globalAlert reflects it regardless of
  // how trace was triggered — alert escalation (recompute/raise paths set it
  // before calling here) OR a set-piece alarm via ctx.startTrace(), which would
  // otherwise leave globalAlert at green/yellow and desync the HUD + peakAlert
  // stat from traceFired (#114 WS3).
  if (s.globalAlert !== "trace") {
    const prev = s.globalAlert;
    setGlobalAlert("trace");
    emitEvent(E.ALERT_GLOBAL_RAISED, { prev, next: "trace" });
  }
  const threat = s.spec?.threat ?? "C";
  const seconds = TRACE_SECONDS[threat] ?? 60;
  setTraceCountdown(seconds);
  emitEvent(E.ALERT_TRACE_STARTED, { seconds });
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
 * Record an ICE detection event. Drives the global alert directly: each
 * detection steps the alert up one level (capped below trace), and once the
 * grade-scaled detection count is reached (DETECTION_TRACE_THRESHOLD), the trace
 * countdown begins. This is the ICE pursuit layer — it does NOT colour IDS nodes
 * or propagate through the security monitor (that's the separate exploit-failure
 * puzzle layer in recomputeGlobalAlert). See MANUAL.md "Detection".
 */
export function recordIceDetection(nodeId, iceId) {
  const s = getState();
  const ice = iceId ? s.ice?.instances?.[iceId] : activeIceInstances(s)[0];
  if (!ice) return;
  setIceDetectedAt(nodeId, ice.id);
  incrementIceDetectionCount(ice.id);

  // ICE detection drives the global alert directly (MANUAL.md "Detection"):
  // each detection steps the alert up; after a grade-scaled number of detections
  // the trace countdown begins (S/A:1, B/C:2, D/F:3). This is the ICE *pursuit*
  // layer — distinct from the exploit-failure → IDS → monitor *puzzle* layer
  // (recomputeGlobalAlert). Trace here is gated purely on detection COUNT, not on
  // counting red IDS nodes (which is unreachable on a 1-detector network).
  //
  // Trace gate: TOTAL detections across ALL instances vs the detecting instance's
  // grade threshold (instances share the run grade in production).
  const count = Object.values(s.ice?.instances ?? {}).reduce((n, i) => n + i.detectionCount, 0);
  const threshold = DETECTION_TRACE_THRESHOLD[ice.grade] ?? 2;
  if (count >= threshold) {
    if (getState().traceSecondsRemaining === null) startTraceCountdown();
    return;
  }
  // Sub-threshold: step the alert up one level for feedback, capped below trace
  // (trace is threshold-gated for ICE — a later detection starts the clock).
  const idx = GLOBAL_ALERT_ORDER.indexOf(s.globalAlert);
  if (idx < GLOBAL_ALERT_ORDER.indexOf("red")) {
    const prev = s.globalAlert;
    const next = GLOBAL_ALERT_ORDER[idx + 1];
    setGlobalAlert(next);
    emitEvent(E.ALERT_GLOBAL_RAISED, { prev, next });
  }
}
