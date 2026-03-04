// @ts-check
// Log renderer — owns the log buffer and log pane DOM.
// Subscribes to LOG_ENTRY events and formats them for display.
// Also provides addLogEntry() for console/cheats to emit log events,
// and getRecentLog() for the 'log' console command.

/** @typedef {import('../core/types.js').LogEntryPayload} LogEntryPayload */
/** @typedef {import('../core/types.js').NodeRevealedPayload} NodeRevealedPayload */
/** @typedef {import('../core/types.js').NodeProbedPayload} NodeProbedPayload */
/** @typedef {import('../core/types.js').NodeAccessedPayload} NodeAccessedPayload */
/** @typedef {import('../core/types.js').NodeAlertRaisedPayload} NodeAlertRaisedPayload */
/** @typedef {import('../core/types.js').NodeReadPayload} NodeReadPayload */
/** @typedef {import('../core/types.js').NodeLootedPayload} NodeLootedPayload */
/** @typedef {import('../core/types.js').NodeReconfiguredPayload} NodeReconfiguredPayload */
/** @typedef {import('../core/types.js').NodeRebootingPayload} NodeRebootingPayload */
/** @typedef {import('../core/types.js').NodeRebootedPayload} NodeRebootedPayload */
/** @typedef {import('../core/types.js').ExploitStartedPayload} ExploitStartedPayload */
/** @typedef {import('../core/types.js').ExploitInterruptedPayload} ExploitInterruptedPayload */
/** @typedef {import('../core/types.js').ExploitSuccessPayload} ExploitSuccessPayload */
/** @typedef {import('../core/types.js').ExploitFailurePayload} ExploitFailurePayload */
/** @typedef {import('../core/types.js').ExploitDisclosedPayload} ExploitDisclosedPayload */
/** @typedef {import('../core/types.js').ExploitPartialBurnPayload} ExploitPartialBurnPayload */
/** @typedef {import('../core/types.js').ExploitSurfacePayload} ExploitSurfacePayload */
/** @typedef {import('../core/types.js').AlertGlobalRaisedPayload} AlertGlobalRaisedPayload */
/** @typedef {import('../core/types.js').AlertTraceStartedPayload} AlertTraceStartedPayload */
/** @typedef {import('../core/types.js').AlertPropagatedPayload} AlertPropagatedPayload */
/** @typedef {import('../core/types.js').IceMovedPayload} IceMovedPayload */
/** @typedef {import('../core/types.js').IceDetectPendingPayload} IceDetectPendingPayload */
/** @typedef {import('../core/types.js').IceDetectedPayload} IceDetectedPayload */
/** @typedef {import('../core/types.js').IceRebootedPayload} IceRebootedPayload */
/** @typedef {import('../core/types.js').MissionStartedPayload} MissionStartedPayload */
/** @typedef {import('../core/types.js').MissionCompletePayload} MissionCompletePayload */
/** @typedef {import('../core/types.js').RunEndedPayload} RunEndedPayload */

import { on, emitEvent, E } from "../core/events.js";
import { initLog, addLogEntry as _addLogEntry, getRecentLog } from "../core/log.js";
import { getState as _getState } from "../core/state.js";


export function initLogRenderer() {
  initLog();  // start buffer listener first so it runs before renderLogPane

  on(E.LOG_ENTRY, (/** @type {LogEntryPayload} */ { text, type }) => {
    // Mirror to browser console for LLM playtesting
    if (type === "error") console.warn(text);
    else if (type === "success") console.info(text);
    else console.log(text);
    renderLogPane();
  });

  on(E.COMMAND_ISSUED, (/** @type {{ cmd: string }} */ { cmd }) => add(`> ${cmd}`, "command"));

  // ── Node events ──────────────────────────────────────────
  // Batch multiple simultaneous NODE_REVEALED events (e.g. hub node with several hidden
  // neighbors) into a single log entry via a microtask, rather than N identical lines.
  let pendingSignals = 0;
  on(E.NODE_REVEALED,     (/** @type {NodeRevealedPayload} */     { unlocked }) => {
    if (unlocked) return;
    if (pendingSignals === 0) {
      Promise.resolve().then(() => {
        const n = pendingSignals;
        pendingSignals = 0;
        add(`[NODE] ${n} new signal${n !== 1 ? "s" : ""} detected on network.`, "info");
      });
    }
    pendingSignals++;
  });
  on(E.NODE_ACCESSED,     ({ label, prev, next }) => add(`[NODE] ${label}: access ${prev} → ${next}.`, "success"));
  on(E.NODE_ALERT_RAISED, ({ label, prev, next }) => add(`[NODE] ${label}: alert ${prev} → ${next}.`, "error"));

  // ── Timed action lifecycle log entries (via ACTION_FEEDBACK) ──
  on(E.ACTION_FEEDBACK, ({ nodeId, action, phase, durationTicks }) => {
    const s = _getState();
    const label = s?.nodes[nodeId]?.label ?? nodeId;
    if (phase === "start") {
      const secs = Math.round((durationTicks ?? 0) / 10);
      const prefixes = { probe: "PROBE", exploit: "EXPLOIT", read: "READ", loot: "LOOT" };
      const verbs = { probe: "scanning", exploit: "executing", read: "extracting data", loot: "extracting" };
      const prefix = prefixes[action] ?? action.toUpperCase();
      const verb = verbs[action] ?? "running";
      add(`[${prefix}] ${label}: ${verb} (${secs}s)...`, "info");
    } else if (phase === "cancel") {
      const msgs = { probe: "scan cancelled", exploit: "interrupted", read: "extraction cancelled", loot: "extraction cancelled" };
      const prefix = action === "exploit" ? "EXPLOIT" : action.toUpperCase();
      add(`[${prefix}] ${label}: ${msgs[action] ?? "cancelled"}.`, "info");
    }
  });

  // ── Action resolution log entries (via ACTION_RESOLVED) ──
  on(E.ACTION_RESOLVED, ({ action, label, success, detail }) => {
    if (action === "probe") {
      add(`[NODE] ${label}: vulnerabilities scanned.`, "info");
    } else if (action === "exploit") {
      const d = detail ?? {};
      if (success) {
        add(`[EXPLOIT] ${label} — ${d.flavor}`, "success");
        add(`[EXPLOIT] Roll: ${d.roll} vs ${d.successChance}%${d.matchingVulns?.length > 0 ? " (vuln match)" : ""}`, "meta");
      } else {
        add(`[EXPLOIT] ${label} — ${d.flavor}`, "error");
        add(`[EXPLOIT] Roll: ${d.roll} vs ${d.successChance}%${d.matchingVulns?.length > 0 ? " (vuln match)" : ""}`, "meta");
      }
    } else if (action === "read") {
      const mc = detail?.macguffinCount ?? 0;
      add(mc > 0 ? `[NODE] ${label}: ${mc} item(s) found.` : `[NODE] ${label}: nothing of value found.`, "info");
    } else if (action === "loot") {
      add(`[NODE] ${label}: looted ${detail?.items} item(s). +¥${(detail?.total ?? 0).toLocaleString()}`, "success");
    } else if (action === "reconfigure") {
      add(`[NODE] ${label}: event forwarding disabled.`, "success");
    } else if (action === "reboot-start") {
      add(`[NODE] ${label}: REBOOTING — offline temporarily.`, "info");
    } else if (action === "reboot-complete") {
      add(`[NODE] ${label}: back online.`, "info");
    }
  });

  // Card decay side-effects (still separate events from combat.js)
  on(E.EXPLOIT_DISCLOSED,    ({ exploitName }) =>
    add(`[EXPLOIT] ${exploitName}: signature fully disclosed.`, "error"));
  on(E.EXPLOIT_PARTIAL_BURN, ({ exploitName, usesRemaining }) =>
    add(`[EXPLOIT] ${exploitName}: signature partially leaked — ${usesRemaining} use${usesRemaining !== 1 ? "s" : ""} remaining.`, "error"));
  on(E.EXPLOIT_SURFACE,      ({ label }) =>
    add(`[EXPLOIT] ${label}: deeper attack surface revealed.`, "success"));

  // ── Alert events ─────────────────────────────────────────
  on(E.ALERT_GLOBAL_RAISED, (/** @type {AlertGlobalRaisedPayload} */ { prev, next }) =>
    add(`[ALERT] Global alert: ${prev.toUpperCase()} → ${next.toUpperCase()}`, "error"));
  on(E.ALERT_TRACE_STARTED,   (/** @type {AlertTraceStartedPayload} */ { seconds }) =>
    add(`[ALERT] ⚠ TRACE INITIATED — ${seconds}s to disconnect.`, "error"));
  on(E.ALERT_TRACE_CANCELLED, () =>
    add(`[ALERT] Trace cancelled. Network alert cleared.`, "info"));
  on(E.ALERT_PROPAGATED,    (/** @type {AlertPropagatedPayload} */   { fromLabel, toLabel }) =>
    add(`[ALERT] Event forwarded: ${fromLabel} → ${toLabel}`, "meta"));

  // ── Mission / run events ─────────────────────────────────
  on(E.MISSION_STARTED,  (/** @type {MissionStartedPayload} */  { targetName }) => add(`[MISSION] Objective: retrieve ${targetName}.`, "info"));
  on(E.MISSION_COMPLETE, (/** @type {MissionCompletePayload} */ { targetName }) => add(`[MISSION] ★ Target acquired: ${targetName}.`, "success"));
  on(E.RUN_STARTED,  () => add(`[SYS] Run initialized. Jack in.`, "meta"));
  on(E.RUN_ENDED,    (/** @type {RunEndedPayload} */ { outcome }) =>
    add(`[SYS] Run ended: ${outcome === "caught" ? "TRACED — score forfeit." : "SUCCESS — disconnected clean."}`,
      outcome === "caught" ? "error" : "success"));

  // ── ICE events ───────────────────────────────────────────
  on(E.ICE_MOVED, (/** @type {IceMovedPayload} */ { fromLabel, toLabel, toVisible }) => {
    // Only log when ICE enters visible territory — "ICE leaving" is noise
    if (toVisible) {
      add(`[ICE] Moving: ${fromLabel} → ${toLabel}`, "info");
    }
  });
  on(E.ICE_DETECT_PENDING, (/** @type {IceDetectPendingPayload} */ { label, dwellMs }) =>
    add(`[ICE] ⚠ ${label} — disengage or eject (${Math.round(dwellMs / 1000)}s)`, "error"));
  on(E.ICE_DETECTED,    (/** @type {IceDetectedPayload} */  { label }) => add(`[ICE] ⚠ Detected at ${label} — signal locked.`, "error"));
  on(E.ICE_EJECTED,     () => add(`[ICE] Ejected to adjacent node.`, "success"));
  on(E.ICE_REBOOTED,    (/** @type {IceRebootedPayload} */ { residentLabel }) => add(`[ICE] Sent home: ${residentLabel}.`, "info"));
  on(E.ICE_DISABLED,    () => add(`[ICE] Process terminated — threat neutralized.`, "success"));
}

// Private helper for formatters — emits a LOG_ENTRY event.
function add(text, type = "info") {
  emitEvent(E.LOG_ENTRY, { text, type });
}

// Re-exported from log.js for any callers that import from log-renderer.
export { _addLogEntry as addLogEntry, getRecentLog };

function renderLogPane() {
  const el = document.getElementById("log-entries");
  if (!el) return;
  const visible = getRecentLog();
  el.innerHTML = visible.map((entry) =>
    `<div class="log-entry log-${entry.type}">${entry.text}</div>`
  ).join("");
  el.scrollTop = el.scrollHeight;
}
