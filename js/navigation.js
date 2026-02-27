// @ts-check
// Node navigation — centralizes the invariants that must hold whenever the
// player moves to a new node or deselects.
//
// Emits E.PLAYER_NAVIGATED after every genuine selection change. Subsystems
// (exploit-exec, probe-exec, ice) subscribe to that event to perform their
// own cleanup — navigation.js does not need to know about them.

import { selectNode, deselectNode, getState } from "./state.js";
import { emitEvent, E } from "./events.js";

/**
 * Navigate to a new node — selects the target and notifies subscribers.
 * No-op (no event) when re-selecting the already-selected node.
 * @param {string} nodeId
 */
export function navigateTo(nodeId) {
  const isNewNode = getState().selectedNodeId !== nodeId;
  selectNode(nodeId);
  if (isNewNode) emitEvent(E.PLAYER_NAVIGATED, { nodeId });
}

/**
 * Deselect the current node — clears the selection and notifies subscribers.
 */
export function navigateAway() {
  deselectNode();
  emitEvent(E.PLAYER_NAVIGATED, { nodeId: null });
}
