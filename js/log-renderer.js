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
}

// Convenience wrapper — emits a LOG_ENTRY event.
// Used by console.js and cheats.js for command echo and error feedback.
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
