// @ts-check
// Alert subsystem — global alert escalation (two sensors) and the trace countdown.

/** @typedef {import('./types.js').GlobalAlertLevel} GlobalAlertLevel */

import { getState, endRun } from "./state.js";
import { setGlobalAlert, setTraceCountdown, setTraceTimerId, decrementTraceCountdown } from "./state/alert.js";
import { setIceDetectedAt, incrementIceDetectionCount, activeIceInstances } from "./state/ice.js";
import { emitEvent, E } from "./events.js";
import { scheduleRepeating, cancelEvent, TIMER } from "./timers.js";

/** @type {GlobalAlertLevel[]} */
const GLOBAL_ALERT_ORDER = ["green", "yellow", "red", "trace"];

// Detection thresholds: cumulative detections before trace starts, by ICE grade
const DETECTION_TRACE_THRESHOLD = { S: 1, A: 1, B: 2, C: 2, D: 3, F: 3 };

// Security-grid trace gate: accumulated monitor alerts before trace starts, by network grade.
// Mirrors DETECTION_TRACE_THRESHOLD (ICE) but kept separate so the passive grid and the active
// ICE pursuit can be tuned independently.
const MONITOR_TRACE_THRESHOLD = { S: 4, A: 5, B: 7, C: 9, D: 12, F: 15 };

// Global alert escalation now flows entirely through the two sensors:
//   - recordIceDetection (active ICE pursuit), below
//   - recordMonitorAlert (passive security grid: IDS → monitor), below
// plus set-piece startTrace alarms. The legacy node-type-counting layer
// (recomputeGlobalAlert / propagateAlertEvent / raiseGlobalAlert, gated on
// alertState + eventForwardingDisabled) was retired in #173.

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
 * countdown begins. This is the active-ICE-pursuit sensor; the passive security
 * grid (exploit-failure → IDS → monitor) is the separate recordMonitorAlert sensor.
 * Both feed the same global alert ladder. See MANUAL.md "Detection".
 */
export function recordIceDetection(nodeId, iceId) {
  const s = getState();
  const ice = iceId ? s.ice?.instances?.[iceId] : activeIceInstances(s)[0];
  if (!ice) return;
  setIceDetectedAt(nodeId, ice.id);
  incrementIceDetectionCount(ice.id);

  // ICE detection drives the global alert directly (MANUAL.md "Detection"):
  // each detection steps the alert up; after a grade-scaled number of detections
  // the trace countdown begins (S/A:1, B/C:2, D/F:3). The active-ICE sensor; the
  // passive grid sensor (recordMonitorAlert) climbs the same ladder in parallel.
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

/**
 * Record an alert reaching a security monitor — the passive security-grid sensor. The
 * counterpart to recordIceDetection: each alert steps the global alert up one level (capped
 * below trace), and once a grade-scaled number of alerts have accumulated on the monitor the
 * trace countdown begins. The accumulated count lives on the monitor's graph node (so it
 * serializes with the graph). An alert only reaches a monitor via an un-corrupted IDS relay,
 * so corrupting the IDS (forwardingEnabled:false) severs this sensor. See MANUAL.md "Detection".
 * @param {string} monitorId
 */
export function recordMonitorAlert(monitorId) {
  const s = getState();
  const graph = s.nodeGraph;
  if (!graph) return;

  const count = (graph.getNodeState(monitorId)?.alertCount ?? 0) + 1;
  graph.setNodeAttr(monitorId, "alertCount", count);

  const threat = s.spec?.threat ?? "C";
  const threshold = MONITOR_TRACE_THRESHOLD[threat] ?? 2;
  if (count >= threshold) {
    if (getState().traceSecondsRemaining === null) startTraceCountdown();
    return;
  }
  // Sub-threshold: step the alert up one level for feedback, capped below trace.
  const idx = GLOBAL_ALERT_ORDER.indexOf(getState().globalAlert);
  if (idx < GLOBAL_ALERT_ORDER.indexOf("red")) {
    const prev = getState().globalAlert;
    const next = GLOBAL_ALERT_ORDER[idx + 1];
    setGlobalAlert(next);
    emitEvent(E.ALERT_GLOBAL_RAISED, { prev, next });
  }
}

// ── Cooldown (grid-only relief; #174) ─────────────────────

/** @returns {string[]} security-monitor node ids in the current state */
function monitorNodeIds(s) {
  return Object.keys(s.nodes).filter((id) => s.nodes[id].type === "security-monitor");
}

/**
 * Ease the security grid below trace: reset `alertCount` on the given monitors and lower the
 * global alert. Grid-only — never touches ICE detectionCount. No-op (returns false) at trace,
 * where relief is jack-out or own→cancel-trace. Emits ALERT_COOLED for the log.
 * @param {string[]} monitorIds
 * @param {"green"|"step"} mode  green = drop to green; step = down one level
 * @returns {boolean} true if it cooled (i.e. not blocked by an active trace)
 */
function coolGrid(monitorIds, mode) {
  const s = getState();
  if (s.globalAlert === "trace") return false; // below-trace only
  const graph = s.nodeGraph;
  for (const id of monitorIds) graph?.setNodeAttr(id, "alertCount", 0);
  const idx = GLOBAL_ALERT_ORDER.indexOf(s.globalAlert);
  const targetIdx = mode === "green" ? 0 : Math.max(0, idx - 1);
  if (targetIdx < idx) {
    const prev = s.globalAlert;
    const next = GLOBAL_ALERT_ORDER[targetIdx];
    setGlobalAlert(next);
    emitEvent(E.ALERT_COOLED, { prev, next });
  }
  return true;
}

/**
 * Scrub one compromised monitor's logs: reset its accumulated alertCount and ease the global
 * alert one level. Below-trace only. (Player relief lever — see #174.)
 * @param {string} monitorId
 */
export function scrubLogs(monitorId) {
  coolGrid([monitorId], "step");
}

/**
 * Lie low at the WAN node: fully calm the security grid (every monitor → 0, global → green) and
 * spend one per-run use. No-op while a trace is running. When uses run out, mark the WAN node
 * `lieLowExhausted` so the action gates itself off (fiction: a human admin has clocked the tether).
 * @param {string} wanNodeId
 */
export function lieLow(wanNodeId) {
  const s = getState();
  const graph = s.nodeGraph;
  if (!graph) return;
  if (!coolGrid(monitorNodeIds(s), "green")) return; // at trace — no-op, no use spent
  const remaining = (graph.getNodeState(wanNodeId)?.lieLowUsesRemaining ?? 0) - 1;
  graph.setNodeAttr(wanNodeId, "lieLowUsesRemaining", Math.max(0, remaining));
  if (remaining <= 0) graph.setNodeAttr(wanNodeId, "lieLowExhausted", true);
}
