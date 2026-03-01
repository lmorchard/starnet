// @ts-check
// Probe execution timing — schedules the scan timer, handles cancellation,
// and resolves probes on completion.
// Imported by main.js; keeps timing logic out of state.js and main.js.

/** @typedef {import('./types.js').GameState} GameState */

import { getState, ALERT_ORDER, revealNeighbors } from "./state.js";
import { setNodeProbed, setNodeAlertState } from "./state/node.js";
import { setLastDisturbedNode } from "./state/ice.js";
import { setActiveProbe } from "./state/player.js";
import { emitEvent, on, E } from "./events.js";
import { scheduleEvent, cancelEvent, TIMER } from "./timers.js";
import { getGateAccess } from "./node-types.js";

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
    return false;
  }

  const node = s.nodes[nodeId];
  if (!node || node.probed || node.rebooting) return false;

  // Alert ICE immediately — disturbance happens when the scan starts.
  setLastDisturbedNode(nodeId);

  const durationMs = probeDuration(node.grade);
  const timerId = scheduleEvent(
    TIMER.PROBE_SCAN,
    durationMs,
    { nodeId },
    { label: "SCANNING" }
  );

  setActiveProbe({ nodeId, timerId });
  emitEvent(E.PROBE_SCAN_STARTED, { nodeId, label: node.label, durationMs });
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
  setActiveProbe(null);

  emitEvent(E.PROBE_SCAN_CANCELLED, {
    nodeId,
    label: s.nodes[nodeId]?.label ?? nodeId,
  });
}

/**
 * Called by main.js when TIMER.PROBE_SCAN fires.
 * Clears probe state, marks the node probed, raises local alert, emits events.
 * @param {{ nodeId: string }} payload
 */
export function handleProbeScanTimer({ nodeId }) {
  setActiveProbe(null);

  const s = getState();
  const node = s.nodes[nodeId];
  if (!node) return;
  if (node.probed) {
    emitEvent(E.LOG_ENTRY, { text: `${node.label}: Already probed.`, type: "info" });
    return;
  }

  setNodeProbed(nodeId);
  setLastDisturbedNode(nodeId);

  // Reveal neighbors for transparent (probed-gated) nodes
  if (getGateAccess(node) === "probed") {
    revealNeighbors(nodeId);
  }

  // Raise local alert (green → yellow)
  const prevAlert = node.alertState;
  const idx = ALERT_ORDER.indexOf(node.alertState);
  if (idx < ALERT_ORDER.length - 1) {
    setNodeAlertState(nodeId, ALERT_ORDER[idx + 1]);
  }

  emitEvent(E.NODE_PROBED, { nodeId, label: node.label });
  if (s.nodes[nodeId].alertState !== prevAlert) {
    // alert.js listener handles propagation to monitors / global recompute
    emitEvent(E.NODE_ALERT_RAISED, { nodeId, label: node.label, prev: prevAlert, next: s.nodes[nodeId].alertState });
  }
}
