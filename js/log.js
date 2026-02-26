// @ts-check
// Pure log buffer — no DOM, no game event formatters.
// Shared by console.js, cheats.js, log-renderer.js, and the headless harness.

import { on, emitEvent, E } from "./events.js";

const MAX_LOG = 200;

/** @type {Array<{text: string, type: string}>} */
const logBuffer = [];

// Call once at startup to start buffering LOG_ENTRY events.
export function initLog() {
  on(E.LOG_ENTRY, ({ text, type }) => {
    logBuffer.push({ text, type });
    if (logBuffer.length > MAX_LOG) logBuffer.splice(0, logBuffer.length - MAX_LOG);
  });
}

export function addLogEntry(text, type = "info") {
  emitEvent(E.LOG_ENTRY, { text, type });
}

// Returns last n entries from the buffer (for the 'log' console command).
export function getRecentLog(n = 20) {
  return logBuffer.slice(-n);
}
