// @ts-check
// Central per-action feedback profile registry (#187 Phase 3). A timed action's feedback —
// its overlay animation, sustained drone, and completion cue — resolves by field-level layered
// lookup: inline (ActionDef.feedback, threaded onto the ACTION_FEEDBACK "start" payload by
// timed-synthesis.js/operators.js) → ACTION_FEEDBACK_PROFILES[actionId] (this module's central
// map) → DEFAULT_PROFILE.
//
// This module is pure and only does the generic 3-layer lookup. Overlay dispatch
// (js/ui/overlays/dispatch.js) uses it directly. The Strudel audio module does NOT use
// resolveFeedback() for drone/completionCue — its resolution order is inline → central →
// resolveDrone(action) → DEFAULT.drone (js/audio/strudel/data/drones.js `resolveActionDrone`),
// inserting the legacy resolveDrone() fallback BETWEEN central and DEFAULT so every core verb
// keeps its bespoke drone with zero enumeration here. That's why ACTION_FEEDBACK_PROFILES below
// only lists `overlay` overrides for the core verbs — listing their drones here too would create
// a second, redundant source of truth ahead of the real fallback.
//
// DEFAULT_PROFILE's ids ("generic-process" overlay, "generic" drone, "process.done" cue) are
// real, registered assets as of #187 Phase 4b (js/ui/overlays/generic-process.js,
// js/audio/strudel/data/drones.js, js/audio/strudel/data/cues.js) — feel-DRAFT defaults (the
// Phase 4a session tuned the *visual* overlay with Les; the drone/cue are neutral placeholders,
// tunable later via preview/sfx.html) so every timed action without a bespoke profile still gets
// legible feedback.

import { A } from "../core/action-ids.js";

/**
 * @typedef {Object} FeedbackProfile
 * @property {string} [overlay]        - overlay element name (js/ui/overlays/registry.js)
 * @property {string} [drone]          - Strudel drone id (js/audio/strudel/data/drones.js)
 * @property {string} [completionCue]  - Strudel one-shot cue id fired on timed-action completion
 */

/** Fallback profile for any action with no inline or central override. */
export const DEFAULT_PROFILE = Object.freeze({
  overlay: "generic-process",
  drone: "generic",
  completionCue: "process.done",
});

/**
 * Central feedback overrides, keyed by action id. Only the core verbs' bespoke overlay names are
 * listed — their drone/completion cue are preserved by the audio module's own resolveDrone()
 * fallback (see the module doc comment above), not re-listed here.
 * @type {Record<string, FeedbackProfile>}
 */
export const ACTION_FEEDBACK_PROFILES = {
  [A.PROBE]: { overlay: "probe-sweep" },
  [A.XPLOIT]: { overlay: "exploit-brackets" },
  [A.DUMP]: { overlay: "read-sectors" },
  [A.FETCH]: { overlay: "loot-rings" },
  [A.MINE]: { overlay: "mine-scan" },
  [A.LIE_LOW]: { overlay: "lie-low-clock" },
};

/**
 * Resolve an action's feedback profile via field-level layered lookup: inline → central →
 * DEFAULT_PROFILE, independently per field.
 * @param {string} actionId
 * @param {FeedbackProfile} [inline] - e.g. ActionDef.feedback or an ACTION_FEEDBACK payload's `feedback`
 * @returns {{ overlay: string, drone: string, completionCue: string }}
 */
export function resolveFeedback(actionId, inline = {}) {
  const central = ACTION_FEEDBACK_PROFILES[actionId] ?? {};
  const pick = (/** @type {keyof FeedbackProfile} */ key) => inline[key] ?? central[key] ?? DEFAULT_PROFILE[key];
  return {
    overlay: /** @type {string} */ (pick("overlay")),
    drone: /** @type {string} */ (pick("drone")),
    completionCue: /** @type {string} */ (pick("completionCue")),
  };
}
