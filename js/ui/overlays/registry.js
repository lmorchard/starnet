// @ts-check
// Single source of truth for node-graph overlay animations. Pure data — no DOM
// or Lit imports, so it can be unit-tested in node. The browser-only barrel
// (./index.js) maps these descriptors to mounted custom elements; the game's
// visual-renderer dispatch, the pan/zoom re-render, the RUN_STARTED reset, and
// the preview harness all iterate this list instead of hardcoded switches.

import { A } from "../../core/action-ids.js";

/**
 * @typedef {Object} OverlayDescriptor
 * @property {string} key - stable short key (also the preview demo node suffix)
 * @property {string|null} action - action id that triggers this overlay, or null for non-action drivers
 * @property {string} tag - custom element tag name (registered by ./index.js)
 * @property {string} label - human label (preview controls / demo node)
 * @property {"action-feedback"|"ice-timer"} driver - what drives the overlay
 * @property {{ type: string, grade: string }} demo - preview demo node config
 */

/** @type {OverlayDescriptor[]} */
export const OVERLAY_DESCRIPTORS = [
  { key: "probe",   action: A.PROBE,  tag: "probe-sweep-overlay",      label: "PROBE",   driver: "action-feedback", demo: { type: "router",      grade: "C" } },
  { key: "mine",    action: A.MINE,   tag: "mine-scan-overlay",        label: "MINE",    driver: "action-feedback", demo: { type: "cryptovault", grade: "A" } },
  { key: "read",    action: A.DUMP,   tag: "read-sectors-overlay",     label: "DUMP",    driver: "action-feedback", demo: { type: "fileserver",  grade: "C" } },
  { key: "loot",    action: A.FETCH,  tag: "loot-rings-overlay",       label: "FETCH",   driver: "action-feedback", demo: { type: "fileserver",  grade: "B" } },
  { key: "exploit", action: A.XPLOIT, tag: "exploit-brackets-overlay", label: "XPLOIT",  driver: "action-feedback", demo: { type: "firewall",     grade: "B" } },
  { key: "ice",     action: null,     tag: "ice-detect-overlay",       label: "ICE DET", driver: "ice-timer",       demo: { type: "ids",          grade: "A" } },
];

/**
 * Resolve the action-feedback overlay for an action id.
 * @param {string} action
 * @returns {OverlayDescriptor|null}
 */
export function overlayDescriptorForAction(action) {
  return OVERLAY_DESCRIPTORS.find((d) => d.driver === "action-feedback" && d.action === action) ?? null;
}
