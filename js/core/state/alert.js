// @ts-check
// Pure alert/trace state mutations. No event emission, no orchestration.

import { mutate } from "./index.js";

/** Sets state.globalAlert level. */
export function setGlobalAlert(level) {
  mutate((s) => {
    s.globalAlert = level;
  });
}

/** Sets state.traceSecondsRemaining (pass null to clear). */
export function setTraceCountdown(seconds) {
  mutate((s) => {
    s.traceSecondsRemaining = seconds;
  });
}

/** Sets state.traceTimerId (pass null to clear). */
export function setTraceTimerId(timerId) {
  mutate((s) => {
    s.traceTimerId = timerId;
  });
}

/**
 * Decrements state.traceSecondsRemaining by 1 and returns the new value.
 * @returns {number|null}
 */
export function decrementTraceCountdown() {
  let result = null;
  mutate((s) => {
    if (s.traceSecondsRemaining !== null) {
      s.traceSecondsRemaining -= 1;
      result = s.traceSecondsRemaining;
    }
  });
  return result;
}
