// @ts-check
// Probe execution timing — schedules the scan timer, handles cancellation,
// and calls through to probeNode on completion.
// Imported by main.js; keeps timing logic out of state.js and main.js.

/** @typedef {import('./types.js').GameState} GameState */

import { getState, emit, probeNode } from "./state.js";
import { emitEvent, on, E } from "./events.js";
import { scheduleEvent, cancelEvent, TIMER } from "./timers.js";

// Cancel any running probe scan when the player navigates away.
on(E.PLAYER_NAVIGATED, () => cancelProbe());

// Duration table: grade → milliseconds.
// Shorter than exploit timing — probing is a recon action, not an attack.
const PROBE_DURATIONS = { S: 5000, A: 4000, B: 3000, C: 2000, D: 2000, F: 1000 };

/**
 * Returns probe scan duration in ms for the given node grade.
 * @param {string} grade
 * @returns {number}
 */
export function probeDuration(grade) {
  return PROBE_DURATIONS[grade] ?? 1000;
}

/**
 * Begin a probe scan — schedules a timer; does not resolve immediately.
 * Sets lastDisturbedNodeId immediately so ICE reacts during the scan window.
 * Returns true if the scan started, false if blocked by a guard.
 * @param {string} nodeId
 * @returns {boolean}
 */
export function startProbe(nodeId) {
  const s = getState();

  if (s.activeProbe) {
    emitEvent(E.LOG_ENTRY, {
      text: "[PROBE] Scan already in progress — wait or cancel-probe.",
      type: "error",
    });
    emit();
    return false;
  }

  const node = s.nodes[nodeId];
  if (!node || node.probed || node.rebooting) return false;

  // Alert ICE immediately — disturbance happens when the scan starts.
  s.lastDisturbedNodeId = nodeId;

  const durationMs = probeDuration(node.grade);
  const timerId = scheduleEvent(
    TIMER.PROBE_SCAN,
    durationMs,
    { nodeId },
    { label: "SCANNING" }
  );

  s.activeProbe = { nodeId, timerId };
  emitEvent(E.PROBE_SCAN_STARTED, { nodeId, label: node.label, durationMs });
  emit();
  return true;
}

/**
 * Cancel a running probe scan. No-op if nothing is scanning.
 */
export function cancelProbe() {
  const s = getState();
  if (!s.activeProbe) return;

  const { nodeId, timerId } = s.activeProbe;
  cancelEvent(timerId);
  s.activeProbe = null;

  emitEvent(E.PROBE_SCAN_CANCELLED, {
    nodeId,
    label: s.nodes[nodeId]?.label ?? nodeId,
  });
  emit();
}

/**
 * Called by main.js when TIMER.PROBE_SCAN fires.
 * Clears probe state then resolves the probe normally.
 * @param {{ nodeId: string }} payload
 */
export function handleProbeScanTimer({ nodeId }) {
  const s = getState();
  s.activeProbe = null;
  // probeNode handles node.probed = true, alert raise, and all downstream events.
  probeNode(nodeId);
}
