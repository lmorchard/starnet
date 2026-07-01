// @ts-check
// Alert subsystem — global alert escalation (two sensors) and the trace countdown.

/** @typedef {import('./types.js').GlobalAlertLevel} GlobalAlertLevel */

import { getState, endRun } from "./state.js";
import { setGlobalAlert, setTraceCountdown, setTraceTimerId, decrementTraceCountdown } from "./state/alert.js";
import { setIceDetectedAt, incrementIceDetectionCount, activeIceInstances } from "./state/ice.js";
import { addHeat, decayHeat, setHeatDecayTimerId } from "./state/flow.js";
import { emitEvent, E } from "./events.js";
import { scheduleRepeating, cancelEvent, TIMER } from "./timers.js";
import { DETECTION_TRACE_THRESHOLD, MONITOR_TRACE_THRESHOLD, TRACE_SECONDS, HEAT_ALARM_THRESHOLD, HEAT_DISCHARGE_FRAC, HEAT_DECAY_PER_TICK, HEAT_DECAY_MS, LIE_LOW_HEAT_DROP } from "./balance.js";

/** @type {GlobalAlertLevel[]} */
const GLOBAL_ALERT_ORDER = ["green", "yellow", "red", "trace"];

// Global alert escalation now flows entirely through the two sensors:
//   - recordIceDetection (active ICE pursuit), below
//   - recordMonitorAlert (passive security grid: IDS → monitor), below
// plus set-piece startTrace alarms. The legacy node-type-counting layer
// (recomputeGlobalAlert / propagateAlertEvent / raiseGlobalAlert, gated on
// alertState + eventForwardingDisabled) was retired in #173.
// Trace thresholds (DETECTION_/MONITOR_TRACE_THRESHOLD) and the countdown
// durations (TRACE_SECONDS) are tuning knobs — see js/core/balance.js (#169).

// ── Trace countdown ───────────────────────────────────────

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
  // Event-idempotent: bail when there is no trace to cancel. The security trait's
  // owned-cancel-trace trigger is repeating and calls this every evaluation cycle
  // while the monitor stays owned; without this guard each cycle re-emits
  // ALERT_TRACE_CANCELLED (spamming the log) and re-forces the alert to green.
  if (s.traceTimerId === null && s.traceSecondsRemaining === null && s.globalAlert !== "trace") {
    return;
  }
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

// ── Heat: decaying meter + trip-line ratchet (anti-tedium arc) ─────────────

/**
 * Record heat from any activity (probe/xploit/programs). Heat accumulates on state.heat and is
 * bled off by the HEAT_DECAY timer. Crossing a network's (hidden, grade-scaled) HEAT_ALARM_THRESHOLD
 * TRIPS the ratchet: one escalation-only step up the alert ladder, then heat is discharged (→
 * threshold*HEAT_DISCHARGE_FRAC) so it must rebuild — a rising-edge without a separate armed flag.
 * A big enough sustained burst climbs to trace; paced activity cools below the bar and never trips.
 * Alert never lowers here — that's the subversion levers' job (scrub/corrupt/cancel-trace).
 * @param {number} amount
 */
export function recordHeat(amount) {
  if (getState().heatDecayTimerId === null) startHeatDecay(); // self-start decay on first heat
  const total = addHeat(amount);
  emitEvent(E.HEAT_CHANGED, { amount, total });

  const s = getState();
  const threat = s.spec?.threat ?? "C";
  const threshold = HEAT_ALARM_THRESHOLD[threat] ?? 9;
  if (total < threshold) return; // under the bar — no trip

  // Trip: discharge heat so it must rebuild, then step the ladder up one (escalation-only).
  decayHeat(total - threshold * HEAT_DISCHARGE_FRAC);
  const cur = s.globalAlert;
  const next = GLOBAL_ALERT_ORDER[Math.min(GLOBAL_ALERT_ORDER.indexOf(cur) + 1, GLOBAL_ALERT_ORDER.length - 1)];
  if (next === cur) return; // already at trace — heat discharged, but the ladder can't rise; don't emit
  setGlobalAlert(next);
  emitEvent(E.HEAT_ALARM, { level: next });
  emitEvent(E.ALERT_GLOBAL_RAISED, { prev: cur, next });
  if (next === "trace" && getState().traceSecondsRemaining === null) startTraceCountdown();
}

/** Start the always-on HEAT_DECAY repeating timer (idempotent). Called lazily on first heat. */
export function startHeatDecay() {
  if (getState().heatDecayTimerId !== null) return;
  setHeatDecayTimerId(scheduleRepeating(TIMER.HEAT_DECAY, HEAT_DECAY_MS));
}

/** HEAT_DECAY timer handler — bleeds heat down each interval. Wire like handleTraceTick. */
export function handleHeatDecay() {
  const s = getState();
  if (!s || s.phase !== "playing" || s.heat <= 0) return;
  decayHeat(HEAT_DECAY_PER_TICK);
}

// ── Alert de-escalation via subversion (scrub-logs; #174) ─────────────────────

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
 * Scrub one open monitor's logs: reset its accumulated alertCount and ease the global
 * alert one level. Below-trace only. (Player relief lever — see #174.)
 * @param {string} monitorId
 */
export function scrubLogs(monitorId) {
  coolGrid([monitorId], "step");
}

/**
 * Lie low at the WAN node: shed **heat** fast (accelerated cooling — you spend time going quiet)
 * and spend one per-run use. Heat-only under the two-layer model — it does NOT lower the alert
 * ladder (that ratchet only comes down by subverting security systems: scrub-logs / corrupt /
 * cancel-trace). When uses run out, mark the WAN node `lieLowExhausted` so the action gates itself
 * off (fiction: a human admin has clocked the tether).
 * @param {string} wanNodeId
 */
export function lieLow(wanNodeId) {
  const s = getState();
  const graph = s.nodeGraph;
  if (!graph) return;
  if (s.globalAlert === "trace") return; // trace running — shedding heat can't help; don't waste a use
  const total = decayHeat(LIE_LOW_HEAT_DROP);
  emitEvent(E.HEAT_CHANGED, { amount: -LIE_LOW_HEAT_DROP, total });
  const remaining = (graph.getNodeState(wanNodeId)?.lieLowUsesRemaining ?? 0) - 1;
  graph.setNodeAttr(wanNodeId, "lieLowUsesRemaining", Math.max(0, remaining));
  if (remaining <= 0) graph.setNodeAttr(wanNodeId, "lieLowExhausted", true);
}
