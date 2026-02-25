// Log renderer — owns the log buffer and log pane DOM.
// Subscribes to LOG_ENTRY events and formats them for display.
// Also provides addLogEntry() for console/cheats to emit log events,
// and getRecentLog() for the 'log' console command.

import { on, emitEvent, E } from "./events.js";

const MAX_LOG = 200;  // full buffer (pane shows a smaller visible slice)
const PANE_SIZE = 8;  // visible entries in the log pane
const logBuffer = []; // { text, type }

export function initLogRenderer() {
  on(E.LOG_ENTRY, ({ text, type }) => {
    logBuffer.push({ text, type });
    if (logBuffer.length > MAX_LOG) logBuffer.splice(0, logBuffer.length - MAX_LOG);
    renderLogPane();
  });

  // ── Node events ──────────────────────────────────────────
  on(E.NODE_REVEALED,     ({ label }) => add(`[NODE] Signal detected.`, "info"));
  on(E.NODE_PROBED,       ({ label }) => add(`[NODE] ${label}: vulnerabilities scanned.`, "info"));
  on(E.NODE_ACCESSED,     ({ label, prev, next }) => add(`[NODE] ${label}: access ${prev} → ${next}.`, "success"));
  on(E.NODE_ALERT_RAISED, ({ label, prev, next }) => add(`[NODE] ${label}: alert ${prev} → ${next}.`, "error"));
  on(E.NODE_READ,         ({ label, macguffinCount }) =>
    add(macguffinCount > 0
      ? `[NODE] ${label}: ${macguffinCount} item(s) found.`
      : `[NODE] ${label}: nothing of value found.`, "info"));
  on(E.NODE_LOOTED,       ({ label, items, total }) =>
    add(`[NODE] ${label}: looted ${items} item(s). +¥${total.toLocaleString()}`, "success"));
  on(E.NODE_RECONFIGURED, ({ label }) => add(`[NODE] ${label}: event forwarding disabled.`, "success"));
  on(E.NODE_REBOOTING,    ({ label }) => add(`[NODE] ${label}: REBOOTING — offline temporarily.`, "info"));
  on(E.NODE_REBOOTED,     ({ label }) => add(`[NODE] ${label}: back online.`, "info"));

  // ── Exploit events ───────────────────────────────────────
  on(E.EXPLOIT_SUCCESS, ({ label, flavor, roll, successChance, matchingVulns }) => {
    add(`[EXPLOIT] ${label} — ${flavor}`, "success");
    add(`[EXPLOIT] Roll: ${roll} vs ${successChance}%${matchingVulns.length > 0 ? " (vuln match)" : ""}`, "meta");
  });
  on(E.EXPLOIT_FAILURE, ({ label, flavor, roll, successChance, matchingVulns }) => {
    add(`[EXPLOIT] ${label} — ${flavor}`, "error");
    add(`[EXPLOIT] Roll: ${roll} vs ${successChance}%${matchingVulns.length > 0 ? " (vuln match)" : ""}`, "meta");
  });
  on(E.EXPLOIT_DISCLOSED,    ({ exploitName }) =>
    add(`[EXPLOIT] ${exploitName}: signature fully disclosed.`, "error"));
  on(E.EXPLOIT_PARTIAL_BURN, ({ exploitName, usesRemaining }) =>
    add(`[EXPLOIT] ${exploitName}: signature partially leaked — ${usesRemaining} use${usesRemaining !== 1 ? "s" : ""} remaining.`, "error"));
  on(E.EXPLOIT_SURFACE,      ({ label }) =>
    add(`[EXPLOIT] ${label}: deeper attack surface revealed.`, "success"));

  // ── Alert events ─────────────────────────────────────────
  on(E.ALERT_GLOBAL_RAISED, ({ prev, next }) =>
    add(`[ALERT] Global alert: ${prev.toUpperCase()} → ${next.toUpperCase()}`, "error"));
  on(E.ALERT_TRACE_STARTED, ({ seconds }) =>
    add(`[ALERT] ⚠ TRACE INITIATED — ${seconds}s to disconnect.`, "error"));
  on(E.ALERT_PROPAGATED,    ({ fromLabel, toLabel }) =>
    add(`[ALERT] Event forwarded: ${fromLabel} → ${toLabel}`, "meta"));

  // ── Mission / run events ─────────────────────────────────
  on(E.MISSION_STARTED,  ({ targetName }) => add(`[MISSION] Objective: retrieve ${targetName}.`, "info"));
  on(E.MISSION_COMPLETE, ({ targetName }) => add(`[MISSION] ★ Target acquired: ${targetName}.`, "success"));
  on(E.RUN_STARTED,  () => add(`[SYS] Run initialized. Jack in.`, "meta"));
  on(E.RUN_ENDED,    ({ outcome }) =>
    add(`[SYS] Run ended: ${outcome === "caught" ? "TRACED — score forfeit." : "SUCCESS — disconnected clean."}`,
      outcome === "caught" ? "error" : "success"));

  // ── ICE events ───────────────────────────────────────────
  on(E.ICE_MOVED, ({ fromLabel, toLabel, fromVisible, toVisible }) => {
    if (fromVisible || toVisible) {
      add(`[ICE] Moving: ${fromLabel} → ${toLabel}`, "error");
    }
  });
  on(E.ICE_DETECT_PENDING, ({ label, dwellMs }) =>
    add(`[ICE] ⚠ ${label} — disengage or eject (${Math.round(dwellMs / 1000)}s)`, "error"));
  on(E.ICE_DETECTED,    ({ label }) => add(`[ICE] ⚠ Detected at ${label} — signal locked.`, "error"));
  on(E.ICE_EJECTED,     () => add(`[ICE] Ejected to adjacent node.`, "success"));
  on(E.ICE_REBOOTED,    ({ residentLabel }) => add(`[ICE] Sent home: ${residentLabel}.`, "info"));
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
