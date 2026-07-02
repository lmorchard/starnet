// @ts-check
// Pure ACTION_FEEDBACK state machine for the overlay animations. Extracted from
// visual-renderer so the start→progress→complete/cancel transitions and the
// active-node tracking can be unit-tested without a DOM. The visual-renderer
// passes its mounted `byName` map and a persistent `activeByAction` map.
//
// Overlay resolution is name-keyed (#187 Phase 3): on "start", the action's feedback profile
// (inline payload.feedback → central ACTION_FEEDBACK_PROFILES → DEFAULT_PROFILE, see
// feedback-profiles.js) resolves an overlay NAME, remembered per in-flight action for the rest of
// its lifecycle — the "progress"/"complete"/"cancel" payloads don't carry `feedback`, only
// "start" does (operators.js), so re-resolving on every phase could pick a different overlay than
// the one actually driven at "start" if an inline override was used. An unregistered overlay name
// (e.g. the Phase-4-pending "generic-process" default) is a safe no-op — the same "no overlay"
// degrade an unmapped action (e.g. "reboot") already gets today.

import { A } from "../../core/action-ids.js";
import { resolveFeedback } from "../feedback-profiles.js";

/**
 * @typedef {{ sync: (nodeId: string, progress: number) => void, clear: () => void }} OverlayLike
 */

/**
 * Drive the overlay for one ACTION_FEEDBACK event.
 * @param {Map<string, OverlayLike>} byName - overlay name → mounted overlay
 * @param {Map<string, { nodeId: string, overlayName: string }>} activeByAction - action id → in-flight { nodeId, overlayName } (mutated)
 * @param {{ nodeId?: string, action: string, phase: string, progress?: number, feedback?: { overlay?: string } }} payload
 * @param {{ onXploitProgress?: (progress: number) => void }} [hooks]
 */
export function dispatchActionFeedback(byName, activeByAction, payload, hooks = {}) {
  const { nodeId, action, phase, progress, feedback } = payload;

  if (phase === "start") {
    if (nodeId) {
      const overlayName = resolveFeedback(action, feedback).overlay;
      activeByAction.set(action, { nodeId, overlayName });
    }
    return;
  }

  const active = activeByAction.get(action);
  if (!active) return;
  const ov = byName.get(active.overlayName);

  if (phase === "progress") {
    if (ov) {
      ov.sync(active.nodeId, /** @type {number} */ (progress));
      if (action === A.XPLOIT) hooks.onXploitProgress?.(/** @type {number} */ (progress));
    }
  } else if (phase === "complete" || phase === "cancel") {
    ov?.clear();
    activeByAction.delete(action);
  }
}
