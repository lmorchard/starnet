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
// (e.g. "none" for reboot) is a safe no-op.
//
// Pooled overlays (#298): if hooks.manager is provided and handles the resolved overlay name,
// the manager drives the animation (multi-node, keyed by (name, nodeId)) rather than the byName
// singleton path. The resolved name from "start" is stored in activeByAction with pooled:true so
// that progress/complete/cancel use the SAME name — this is essential when an inline feedback
// override was used on "start", which could cause re-resolution to pick a different name and leak
// the started manager entry.

import { A } from "../../core/action-ids.js";
import { resolveFeedback } from "../feedback-profiles.js";

/**
 * @typedef {{ sync: (nodeId: string, progress: number) => void, clear: () => void }} OverlayLike
 */

/**
 * @typedef {{ handles(name: string): boolean, start(name: string, nodeId: string): void,
 *             progress(name: string, nodeId: string, progress: number): void,
 *             end(name: string, nodeId: string): void,
 *             activeCount(name: string): number }} ManagerLike
 */

/**
 * Drive the overlay for one ACTION_FEEDBACK event.
 * @param {Map<string, OverlayLike>} byName - overlay name → mounted overlay
 * @param {Map<string, { nodeId: string, overlayName: string, pooled?: boolean }>} activeByAction - action id → in-flight { nodeId, overlayName, pooled? } (mutated)
 * @param {{ nodeId?: string, action: string, phase: string, progress?: number, feedback?: { overlay?: string } }} payload
 * @param {{ onXploitProgress?: (progress: number) => void, manager?: ManagerLike }} [hooks]
 */
export function dispatchActionFeedback(byName, activeByAction, payload, hooks = {}) {
  const { nodeId, action, phase, progress, feedback } = payload;
  const manager = hooks.manager;

  if (phase === "start") {
    if (!nodeId) return;
    const overlayName = resolveFeedback(action, feedback).overlay;
    // Pooled path: manager drives multi-node animation. Store in activeByAction with pooled:true
    // so later phases can use the same resolved name without re-resolving (which would break if
    // an inline feedback.overlay override was used here).
    if (manager?.handles(overlayName)) {
      manager.start(overlayName, nodeId);
      activeByAction.set(action, { nodeId, overlayName, pooled: true });
      return;
    }
    // Singleton path: remember (nodeId, overlayName) for subsequent phases.
    activeByAction.set(action, { nodeId, overlayName });
    return;
  }

  // progress/complete/cancel: look up what was stored at "start".
  const active = activeByAction.get(action);
  if (!active) return;

  if (active.pooled && manager) {
    // Pooled path: use the nodeId from the event (multi-node), and the overlayName stored at start.
    if (!nodeId) return;
    if (phase === "progress") {
      manager.progress(active.overlayName, nodeId, progress ?? 0);
      // onXploitProgress hook: kept for completeness but xploit isn't pooled.
      if (action === A.XPLOIT) hooks.onXploitProgress?.(/** @type {number} */ (progress));
    } else if (phase === "complete" || phase === "cancel") {
      manager.end(active.overlayName, nodeId);
      if (manager.activeCount(active.overlayName) === 0) activeByAction.delete(action);
    }
    return;
  }

  // Singleton path.
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
