// @ts-check
// Loot extraction timing — schedules the extract timer, handles cancellation,
// and resolves loot on completion.
// Follows the same pattern as read-exec.js.

/** @typedef {import('./types.js').GameState} GameState */

import { getState } from "./state.js";
import { collectMacguffins, setNodeLooted } from "./state/node.js";
import { addCash, setActiveLoot, setMissionComplete } from "./state/player.js";
import { emitEvent, on, E } from "./events.js";
import { scheduleEvent, cancelEvent, TIMER } from "./timers.js";

// Cancel any running loot extraction when the player navigates away.
on(E.PLAYER_NAVIGATED, () => cancelLoot());

// Duration table: grade → milliseconds.
// Slightly faster than read — the hard work is already done.
const LOOT_DURATIONS = { S: 3000, A: 2500, B: 2000, C: 1200, D: 1000, F: 600 };

/**
 * Returns loot extraction duration in ms for the given node grade.
 * @param {string} grade
 * @returns {number}
 */
export function lootDuration(grade) {
  return LOOT_DURATIONS[grade] ?? 800;
}

/**
 * Begin a loot extraction — schedules a timer; does not resolve immediately.
 * Returns true if the extraction started, false if blocked by a guard.
 * @param {string} nodeId
 * @returns {boolean}
 */
export function startLoot(nodeId) {
  const s = getState();

  if (s.activeLoot) {
    emitEvent(E.LOG_ENTRY, {
      text: "[LOOT] Extraction already in progress — wait or cancel-loot.",
      type: "error",
    });
    return false;
  }

  const node = s.nodes[nodeId];
  if (!node || node.looted || node.rebooting) return false;

  const durationMs = lootDuration(node.grade);
  const timerId = scheduleEvent(
    TIMER.LOOT_EXTRACT,
    durationMs,
    { nodeId },
    { label: "EXTRACTING" }
  );

  setActiveLoot({ nodeId, timerId });
  emitEvent(E.LOOT_EXTRACT_STARTED, { nodeId, label: node.label, durationMs });
  return true;
}

/**
 * Cancel a running loot extraction. No-op if nothing is extracting.
 */
export function cancelLoot() {
  const s = getState();
  if (!s.activeLoot) return;

  const { nodeId, timerId } = s.activeLoot;
  cancelEvent(timerId);
  setActiveLoot(null);

  emitEvent(E.LOOT_EXTRACT_CANCELLED, {
    nodeId,
    label: s.nodes[nodeId]?.label ?? nodeId,
  });
}

/**
 * Called by main.js when TIMER.LOOT_EXTRACT fires.
 * Clears loot state, collects macguffins, adds cash, emits NODE_LOOTED.
 * @param {{ nodeId: string }} payload
 */
export function handleLootExtractTimer({ nodeId }) {
  setActiveLoot(null);

  const s = getState();
  const node = s.nodes[nodeId];
  if (!node) return;
  if (node.looted) {
    emitEvent(E.LOG_ENTRY, { text: `${node.label}: Already looted.`, type: "info" });
    return;
  }

  const { items, total } = collectMacguffins(nodeId);
  if (items.length === 0) {
    setNodeLooted(nodeId);
    emitEvent(E.LOG_ENTRY, { text: `${node.label}: Nothing to loot.`, type: "info" });
    return;
  }

  setNodeLooted(nodeId);
  addCash(total);
  emitEvent(E.NODE_LOOTED, { nodeId, label: node.label, items: items.length, total });

  if (s.mission && !s.mission.complete) {
    const gotMission = items.some((m) => m.id === s.mission.targetMacguffinId);
    if (gotMission) {
      setMissionComplete();
      emitEvent(E.MISSION_COMPLETE, { targetName: s.mission.targetName });
    }
  }
}
