// @ts-check
// Pure ACTION_FEEDBACK state machine for the overlay animations. Extracted from
// visual-renderer so the start→progress→complete/cancel transitions and the
// active-node tracking can be unit-tested without a DOM. The visual-renderer
// passes its mounted `byAction` map and a persistent `activeNodeIds` map.

import { A } from "../../core/action-ids.js";

/**
 * @typedef {{ sync: (nodeId: string, progress: number) => void, clear: () => void }} OverlayLike
 */

/**
 * Drive the overlay for one ACTION_FEEDBACK event.
 * @param {Map<string, OverlayLike>} byAction - action id → mounted overlay
 * @param {Map<string, string>} activeNodeIds - action id → in-flight node id (mutated)
 * @param {{ nodeId?: string, action: string, phase: string, progress?: number }} payload
 * @param {{ onXploitProgress?: (progress: number) => void }} [hooks]
 */
export function dispatchActionFeedback(byAction, activeNodeIds, payload, hooks = {}) {
  const { nodeId, action, phase, progress } = payload;
  const ov = byAction.get(action);
  if (!ov) return;

  if (phase === "start") {
    if (nodeId) activeNodeIds.set(action, nodeId);
  } else if (phase === "progress" && activeNodeIds.get(action)) {
    ov.sync(/** @type {string} */ (activeNodeIds.get(action)), /** @type {number} */ (progress));
    if (action === A.XPLOIT) hooks.onXploitProgress?.(/** @type {number} */ (progress));
  } else if (phase === "complete" || phase === "cancel") {
    ov.clear();
    activeNodeIds.delete(action);
  }
}
