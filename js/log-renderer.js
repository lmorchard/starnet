// @ts-check
// Log renderer — owns the log buffer and log pane DOM.
// Subscribes to LOG_ENTRY events and formats them for display.
// Also provides addLogEntry() for console/cheats to emit log events,
// and getRecentLog() for the 'log' console command.

/** @typedef {import('./types.js').LogEntryPayload} LogEntryPayload */
/** @typedef {import('./types.js').NodeRevealedPayload} NodeRevealedPayload */
/** @typedef {import('./types.js').NodeProbedPayload} NodeProbedPayload */
/** @typedef {import('./types.js').NodeAccessedPayload} NodeAccessedPayload */
/** @typedef {import('./types.js').NodeAlertRaisedPayload} NodeAlertRaisedPayload */
/** @typedef {import('./types.js').NodeReadPayload} NodeReadPayload */
/** @typedef {import('./types.js').NodeLootedPayload} NodeLootedPayload */
/** @typedef {import('./types.js').NodeReconfiguredPayload} NodeReconfiguredPayload */
/** @typedef {import('./types.js').NodeRebootingPayload} NodeRebootingPayload */
/** @typedef {import('./types.js').NodeRebootedPayload} NodeRebootedPayload */
/** @typedef {import('./types.js').ExploitSuccessPayload} ExploitSuccessPayload */
/** @typedef {import('./types.js').ExploitFailurePayload} ExploitFailurePayload */
/** @typedef {import('./types.js').ExploitDisclosedPayload} ExploitDisclosedPayload */
/** @typedef {import('./types.js').ExploitPartialBurnPayload} ExploitPartialBurnPayload */
/** @typedef {import('./types.js').ExploitSurfacePayload} ExploitSurfacePayload */
/** @typedef {import('./types.js').AlertGlobalRaisedPayload} AlertGlobalRaisedPayload */
/** @typedef {import('./types.js').AlertTraceStartedPayload} AlertTraceStartedPayload */
/** @typedef {import('./types.js').AlertPropagatedPayload} AlertPropagatedPayload */
/** @typedef {import('./types.js').IceMovedPayload} IceMovedPayload */
/** @typedef {import('./types.js').IceDetectPendingPayload} IceDetectPendingPayload */
/** @typedef {import('./types.js').IceDetectedPayload} IceDetectedPayload */
/** @typedef {import('./types.js').IceRebootedPayload} IceRebootedPayload */
/** @typedef {import('./types.js').MissionStartedPayload} MissionStartedPayload */
/** @typedef {import('./types.js').MissionCompletePayload} MissionCompletePayload */
/** @typedef {import('./types.js').RunEndedPayload} RunEndedPayload */

import { on, emitEvent, E } from "./events.js";
import { initLog, addLogEntry as _addLogEntry, getRecentLog } from "./log.js";

const PANE_SIZE = 8;  // visible entries in the log pane

export function initLogRenderer() {
  initLog();  // start buffer listener first so it runs before renderLogPane

  on(E.LOG_ENTRY, (/** @type {LogEntryPayload} */ { text, type }) => {
    // Mirror to browser console for LLM playtesting
    if (type === "error") console.warn(text);
    else if (type === "success") console.info(text);
    else console.log(text);
    renderLogPane();
  });

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
  on(E.NODE_PROBED,       (/** @type {NodeProbedPayload} */       { label }) => add(`[NODE] ${label}: vulnerabilities scanned.`, "info"));
  on(E.NODE_ACCESSED,     (/** @type {NodeAccessedPayload} */     { label, prev, next }) => add(`[NODE] ${label}: access ${prev} → ${next}.`, "success"));
  on(E.NODE_ALERT_RAISED, (/** @type {NodeAlertRaisedPayload} */  { label, prev, next }) => add(`[NODE] ${label}: alert ${prev} → ${next}.`, "error"));
  on(E.NODE_READ,         (/** @type {NodeReadPayload} */         { label, macguffinCount }) =>
    add(macguffinCount > 0
      ? `[NODE] ${label}: ${macguffinCount} item(s) found.`
      : `[NODE] ${label}: nothing of value found.`, "info"));
  on(E.NODE_LOOTED,       (/** @type {NodeLootedPayload} */       { label, items, total }) =>
    add(`[NODE] ${label}: looted ${items} item(s). +¥${total.toLocaleString()}`, "success"));
  on(E.NODE_RECONFIGURED, (/** @type {NodeReconfiguredPayload} */ { label }) => add(`[NODE] ${label}: event forwarding disabled.`, "success"));
  on(E.NODE_REBOOTING,    (/** @type {NodeRebootingPayload} */    { label }) => add(`[NODE] ${label}: REBOOTING — offline temporarily.`, "info"));
  on(E.NODE_REBOOTED,     (/** @type {NodeRebootedPayload} */     { label }) => add(`[NODE] ${label}: back online.`, "info"));

  // ── Exploit events ───────────────────────────────────────
  on(E.EXPLOIT_SUCCESS, (/** @type {ExploitSuccessPayload} */ { label, flavor, roll, successChance, matchingVulns }) => {
    add(`[EXPLOIT] ${label} — ${flavor}`, "success");
    add(`[EXPLOIT] Roll: ${roll} vs ${successChance}%${matchingVulns.length > 0 ? " (vuln match)" : ""}`, "meta");
  });
  on(E.EXPLOIT_FAILURE, (/** @type {ExploitFailurePayload} */ { label, flavor, roll, successChance, matchingVulns }) => {
    add(`[EXPLOIT] ${label} — ${flavor}`, "error");
    add(`[EXPLOIT] Roll: ${roll} vs ${successChance}%${matchingVulns.length > 0 ? " (vuln match)" : ""}`, "meta");
  });
  on(E.EXPLOIT_DISCLOSED,    (/** @type {ExploitDisclosedPayload} */   { exploitName }) =>
    add(`[EXPLOIT] ${exploitName}: signature fully disclosed.`, "error"));
  on(E.EXPLOIT_PARTIAL_BURN, (/** @type {ExploitPartialBurnPayload} */ { exploitName, usesRemaining }) =>
    add(`[EXPLOIT] ${exploitName}: signature partially leaked — ${usesRemaining} use${usesRemaining !== 1 ? "s" : ""} remaining.`, "error"));
  on(E.EXPLOIT_SURFACE,      (/** @type {ExploitSurfacePayload} */     { label }) =>
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
  const visible = getRecentLog(PANE_SIZE);
  el.innerHTML = visible.map((entry) => {
    const prefix = (entry.type === "command" || entry.type === "error") ? "" : "&gt; ";
    return `<div class="log-entry log-${entry.type}">${prefix}${entry.text}</div>`;
  }).join("");
  el.scrollTop = el.scrollHeight;
}
