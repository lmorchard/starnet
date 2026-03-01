// @ts-check
// Read execution timing — schedules the scan timer, handles cancellation,
// and resolves reads on completion.
// Follows the same pattern as probe-exec.js.

/** @typedef {import('./types.js').GameState} GameState */

import { getState } from "./state.js";
import { setNodeRead } from "./state/node.js";
import { setActiveRead } from "./state/player.js";
import { emitEvent, on, E } from "./events.js";
import { scheduleEvent, cancelEvent, TIMER } from "./timers.js";

// Cancel any running read scan when the player navigates away.
on(E.PLAYER_NAVIGATED, () => cancelRead());

// Duration table: grade → milliseconds.
const READ_DURATIONS = { S: 4000, A: 3500, B: 2500, C: 1500, D: 1500, F: 800 };

/**
 * Returns read scan duration in ms for the given node grade.
 * @param {string} grade
 * @returns {number}
 */
export function readDuration(grade) {
  return READ_DURATIONS[grade] ?? 1000;
}

/**
 * Begin a read scan — schedules a timer; does not resolve immediately.
 * Returns true if the scan started, false if blocked by a guard.
 * @param {string} nodeId
 * @returns {boolean}
 */
export function startRead(nodeId) {
  const s = getState();

  if (s.activeRead) {
    emitEvent(E.LOG_ENTRY, {
      text: "[READ] Scan already in progress — wait or cancel-read.",
      type: "error",
    });
    return false;
  }

  const node = s.nodes[nodeId];
  if (!node || node.read || node.rebooting) return false;

  const durationMs = readDuration(node.grade);
  const timerId = scheduleEvent(
    TIMER.READ_SCAN,
    durationMs,
    { nodeId },
    { label: "READING" }
  );

  setActiveRead({ nodeId, timerId });
  emitEvent(E.READ_SCAN_STARTED, { nodeId, label: node.label, durationMs });
  return true;
}

/**
 * Cancel a running read scan. No-op if nothing is scanning.
 */
export function cancelRead() {
  const s = getState();
  if (!s.activeRead) return;

  const { nodeId, timerId } = s.activeRead;
  cancelEvent(timerId);
  setActiveRead(null);

  emitEvent(E.READ_SCAN_CANCELLED, {
    nodeId,
    label: s.nodes[nodeId]?.label ?? nodeId,
  });
}

/**
 * Called by main.js when TIMER.READ_SCAN fires.
 * Clears read state, marks the node read, emits NODE_READ.
 * @param {{ nodeId: string }} payload
 */
export function handleReadScanTimer({ nodeId }) {
  setActiveRead(null);

  const s = getState();
  const node = s.nodes[nodeId];
  if (!node) return;
  if (node.read) {
    emitEvent(E.LOG_ENTRY, { text: `${node.label}: Already scanned.`, type: "info" });
    return;
  }

  setNodeRead(nodeId);
  emitEvent(E.NODE_READ, { nodeId, label: node.label, macguffinCount: node.macguffins.length });
}
