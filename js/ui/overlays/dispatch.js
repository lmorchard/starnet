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
// singleton path. Pooled overlays re-resolve the name on progress/complete/cancel — they are always
// centrally-profiled (no inline feedback override), so re-resolution is safe and required since
// those payloads don't carry `feedback`.

import { A } from "../../core/action-ids.js";
import { resolveFeedback } from "../feedback-profiles.js";

/**
 * @typedef {{ sync: (nodeId: string, progress: number) => void, clear: () => void }} OverlayLike
 */

/**
 * @typedef {{ handles(name: string): boolean, start(name: string, nodeId: string): void,
 *             progress(name: string, nodeId: string, progress: number): void,
 *             end(name: string, nodeId: string): void }} ManagerLike
 */

/**
 * Drive the overlay for one ACTION_FEEDBACK event.
 * @param {Map<string, OverlayLike>} byName - overlay name → mounted overlay
 * @param {Map<string, { nodeId: string, overlayName: string }>} activeByAction - action id → in-flight { nodeId, overlayName } (mutated)
 * @param {{ nodeId?: string, action: string, phase: string, progress?: number, feedback?: { overlay?: string } }} payload
 * @param {{ onXploitProgress?: (progress: number) => void, manager?: ManagerLike }} [hooks]
 */
export function dispatchActionFeedback(byName, activeByAction, payload, hooks = {}) {
  const { nodeId, action, phase, progress, feedback } = payload;
  const manager = hooks.manager;

  if (phase === "start") {
    if (!nodeId) return;
    const overlayName = resolveFeedback(action, feedback).overlay;
    // Pooled path: manager drives multi-node animation, NOT stored in activeByAction.
    if (manager?.handles(overlayName)) {
      manager.start(overlayName, nodeId);
      return;
    }
    // Singleton path: remember (nodeId, overlayName) for subsequent phases.
    activeByAction.set(action, { nodeId, overlayName });
    return;
  }

  // progress/complete/cancel: first check if this action is pooled by re-resolving the name.
  // Pooled overlays are centrally-profiled (no inline feedback on these phases), so re-resolving
  // is correct — it will always match the name used at "start".
  if (manager) {
    const pooledName = resolveFeedback(action).overlay;
    if (manager.handles(pooledName)) {
      if (!nodeId) return;
      if (phase === "progress") {
        manager.progress(pooledName, nodeId, progress ?? 0);
        // onXploitProgress hook: kept for completeness but xploit isn't pooled.
        if (action === A.XPLOIT) hooks.onXploitProgress?.(/** @type {number} */ (progress));
      } else if (phase === "complete" || phase === "cancel") {
        manager.end(pooledName, nodeId);
      }
      return;
    }
  }

  // Singleton path.
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
