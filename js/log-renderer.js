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

const MAX_LOG = 200;  // full buffer (pane shows a smaller visible slice)
const PANE_SIZE = 8;  // visible entries in the log pane
/** @type {LogEntryPayload[]} */
const logBuffer = [];

export function initLogRenderer() {
  on(E.LOG_ENTRY, (/** @type {LogEntryPayload} */ { text, type }) => {
    logBuffer.push({ text, type });
    if (logBuffer.length > MAX_LOG) logBuffer.splice(0, logBuffer.length - MAX_LOG);
    // Mirror to browser console for LLM playtesting
    if (type === "error") console.error(text);
    else if (type === "success") console.info(text);
    else console.log(text);
    renderLogPane();
  });

  // ── Node events ──────────────────────────────────────────
  on(E.NODE_REVEALED,     (/** @type {NodeRevealedPayload} */     { label, unlocked }) => {
    if (!unlocked) add(`[NODE] Signal detected.`, "info");
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
  on(E.ALERT_TRACE_STARTED, (/** @type {AlertTraceStartedPayload} */ { seconds }) =>
    add(`[ALERT] ⚠ TRACE INITIATED — ${seconds}s to disconnect.`, "error"));
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

// Public convenience wrapper — same as add(), for console.js and cheats.js.
export function addLogEntry(text, type = "info") {
  emitEvent(E.LOG_ENTRY, { text, type });
}

// Returns last n entries from the buffer (for the 'log' console command).
export function getRecentLog(n = 20) {
  return logBuffer.slice(-n);
}

function renderLogPane() {
  const el = document.getElementById("log-entries");
  if (!el) return;
  const visible = logBuffer.slice(-PANE_SIZE);
  el.innerHTML = visible.map((entry) => {
    const prefix = (entry.type === "command" || entry.type === "error") ? "" : "&gt; ";
    return `<div class="log-entry log-${entry.type}">${prefix}${entry.text}</div>`;
  }).join("");
  el.scrollTop = el.scrollHeight;
}
