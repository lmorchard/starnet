// @ts-check
// Browser-only barrel for node-graph overlay animations. Importing this file
// registers all six overlay custom elements. mountOverlays() creates one
// element per registry descriptor, appends them into a container, and returns
// lookup maps for the game's dispatch (by action) and shared iteration (by key).

import "./probe-sweep.js";
import "./mine-scan.js";
import "./read-sectors.js";
import "./loot-rings.js";
import "./exploit-brackets.js";
import "./ice-detect.js";
import { OVERLAY_DESCRIPTORS } from "./registry.js";

/**
 * @param {HTMLElement} container
 * @returns {{ byKey: Map<string, any>, byAction: Map<string, any> }}
 */
export function mountOverlays(container) {
  const byKey = new Map();
  const byAction = new Map();
  for (const d of OVERLAY_DESCRIPTORS) {
    const el = document.createElement(d.tag);
    container.appendChild(el);
    byKey.set(d.key, el);
    if (d.driver === "action-feedback" && d.action) byAction.set(d.action, el);
  }
  return { byKey, byAction };
}
