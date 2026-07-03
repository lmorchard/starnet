// @ts-check
// Single source of truth for node-graph overlay animations. Pure data — no DOM
// or Lit imports, so it can be unit-tested in node. The browser-only barrel
// (./index.js) maps these descriptors to mounted custom elements; the game's
// visual-renderer dispatch, the pan/zoom re-render, the RUN_STARTED reset, and
// the preview harness all iterate this list instead of hardcoded switches.
//
// `name` (#187 Phase 3) is the canonical overlay identifier used by the feedback-profile system
// (js/ui/feedback-profiles.js) — the central ACTION_FEEDBACK_PROFILES map and any inline
// ActionDef.feedback override name overlays by this id, not by action id. dispatch.js resolves
// action → resolveFeedback(action, inline).overlay → this name → the mounted element.
//
// `pooled` (#298): if true, this overlay is managed by OverlayManager (one element per node, pooled/
// reused) rather than a singleton element in byName. Pooled overlays must be centrally-profiled
// (in ACTION_FEEDBACK_PROFILES) — not inline-only — since progress/complete payloads carry no
// inline `feedback`, so dispatch re-resolves the name to detect pooling.

import { A } from "../../core/action-ids.js";
import { resolveFeedback } from "../feedback-profiles.js";

/**
 * @typedef {Object} OverlayDescriptor
 * @property {string} key - stable short key (also the preview demo node suffix)
 * @property {string} name - canonical overlay name resolved by feedback-profiles.js
 * @property {string|null} action - action id that triggers this overlay, or null for non-action drivers
 * @property {string} tag - custom element tag name (registered by ./index.js)
 * @property {string} label - human label (preview controls / demo node)
 * @property {"action-feedback"|"ice-timer"} driver - what drives the overlay
 * @property {{ type: string, grade: string }} demo - preview demo node config
 * @property {boolean} [pooled] - if true, managed by OverlayManager (multi-node, pooled); not a byName singleton
 */

/** @type {OverlayDescriptor[]} */
export const OVERLAY_DESCRIPTORS = [
  { key: "probe",   name: "probe-sweep",      action: A.PROBE,   tag: "probe-sweep-overlay",      label: "PROBE",   driver: "action-feedback", pooled: true,  demo: { type: "router",      grade: "C" } },
  { key: "mine",    name: "mine-scan",        action: A.MINE,    tag: "mine-scan-overlay",        label: "MINE",    driver: "action-feedback", demo: { type: "cryptovault", grade: "A" } },
  { key: "read",    name: "read-sectors",     action: A.DUMP,    tag: "read-sectors-overlay",     label: "DUMP",    driver: "action-feedback", demo: { type: "fileserver",  grade: "C" } },
  { key: "loot",    name: "loot-rings",       action: A.FETCH,   tag: "loot-rings-overlay",       label: "FETCH",   driver: "action-feedback", demo: { type: "fileserver",  grade: "B" } },
  { key: "exploit", name: "exploit-brackets", action: A.XPLOIT,  tag: "exploit-brackets-overlay", label: "XPLOIT",  driver: "action-feedback", demo: { type: "firewall",     grade: "B" } },
  { key: "ice",     name: "ice-detect",       action: null,      tag: "ice-detect-overlay",       label: "ICE DET", driver: "ice-timer",       demo: { type: "ids",          grade: "A" } },
  { key: "lielow",  name: "lie-low-clock",    action: A.LIE_LOW, tag: "lie-low-clock-overlay",    label: "LIE LOW", driver: "action-feedback", demo: { type: "wan",          grade: "F" } },
  // #187 Phase 4b: the DEFAULT_PROFILE.overlay fallback (feedback-profiles.js) — not keyed to a
  // single action id (action: null, like ice-detect's timer-driven action: null), used whenever
  // an action has no bespoke central/inline overlay.
  { key: "generic", name: "generic-process",  action: null,      tag: "generic-process-overlay",  label: "GENERIC", driver: "action-feedback", demo: { type: "workstation", grade: "C" } },
];

/**
 * Resolve a descriptor by its canonical overlay name (#187 Phase 3). Any truly unregistered name
 * resolves to null; as of Phase 4b, the DEFAULT_PROFILE fallback name ("generic-process") is a
 * real registered descriptor, so it no longer degrades to null here.
 * @param {string} name
 * @returns {OverlayDescriptor|null}
 */
export function descriptorForName(name) {
  return OVERLAY_DESCRIPTORS.find((d) => d.name === name) ?? null;
}

/**
 * Resolve the action-feedback overlay for an action id, via the action's resolved feedback
 * profile (central ACTION_FEEDBACK_PROFILES override, else DEFAULT_PROFILE — the "generic-process"
 * fallback, registered as of #187 Phase 4b).
 * @param {string} action
 * @returns {OverlayDescriptor|null}
 */
export function overlayDescriptorForAction(action) {
  return descriptorForName(resolveFeedback(action).overlay);
}
