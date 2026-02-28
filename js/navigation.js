// @ts-check
// Node navigation — centralizes the invariants that must hold whenever the
// player moves to a new node or deselects.
//
// Emits E.PLAYER_NAVIGATED after every genuine selection change. Subsystems
// (exploit-exec, probe-exec, ice) subscribe to that event to perform their
// own cleanup — navigation.js does not need to know about them.

import { getState } from "./state.js";
import { setSelectedNode } from "./state/game.js";
import { setNodeVisible } from "./state/node.js";
import { emitEvent, E } from "./events.js";

/**
 * Navigate to a new node — selects the target and notifies subscribers.
 * No-op (no event) when re-selecting the already-selected node.
 * @param {string} nodeId
 */
export function navigateTo(nodeId) {
  const s = getState();
  const isNewNode = s.selectedNodeId !== nodeId;

  const node = s.nodes[nodeId];
  if (node?.rebooting) {
    emitEvent(E.LOG_ENTRY, { text: `${node.label}: node is rebooting.`, type: "error" });
    return;
  }
  setSelectedNode(nodeId);

  // Traversal: selecting a revealed ("???") node adjacent to any accessible node makes it
  // accessible. This is how the player explores deeper into the network.
  if (node && node.visibility === "revealed") {
    const hasAccessibleNeighbor = (s.adjacency[nodeId] || []).some(
      (nid) => s.nodes[nid]?.visibility === "accessible"
    );
    if (hasAccessibleNeighbor) {
      setNodeVisible(nodeId, "accessible");
      emitEvent(E.NODE_REVEALED, { nodeId, label: node.label });
      emitEvent(E.LOG_ENTRY, { text: `[NODE] ${node.label}: signal traced. Node accessible.`, type: "info" });
    }
  }

  if (isNewNode) emitEvent(E.PLAYER_NAVIGATED, { nodeId });
}

/**
 * Deselect the current node — clears the selection and notifies subscribers.
 */
export function navigateAway() {
  setSelectedNode(null);
  emitEvent(E.PLAYER_NAVIGATED, { nodeId: null });
}
