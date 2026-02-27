// @ts-check
// Node navigation — centralizes the invariants that must hold whenever the
// player moves to a new node or deselects: any in-progress exploit or probe
// scan is cancelled before the selection changes.
//
// Imported by main.js and playtest.js instead of calling the individual
// functions directly, so the logic is testable without DOM coupling.

import { selectNode, deselectNode } from "./state.js";
import { cancelExploit } from "./exploit-exec.js";
import { cancelProbe } from "./probe-exec.js";

/**
 * Navigate to a new node — cancels any in-progress exploit or probe, then
 * selects the target node.
 * @param {string} nodeId
 */
export function navigateTo(nodeId) {
  cancelExploit();
  cancelProbe();
  selectNode(nodeId);
}

/**
 * Deselect the current node — cancels any in-progress exploit or probe, then
 * clears the selection.
 */
export function navigateAway() {
  cancelExploit();
  cancelProbe();
  deselectNode();
}
