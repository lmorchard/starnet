// @ts-check
// Pure node state mutations. No event emission, no orchestration.

import { getState, mutate } from "./index.js";

/** Sets node.visibility ('hidden' | 'revealed' | 'accessible'). */
export function setNodeVisible(nodeId, visibility) {
  mutate((s) => {
    const node = s.nodes[nodeId];
    if (node) node.visibility = visibility;
  });
}

/** Sets node.accessLevel ('locked' | 'compromised' | 'owned'). */
export function setNodeAccessLevel(nodeId, level) {
  mutate((s) => {
    const node = s.nodes[nodeId];
    if (node) node.accessLevel = level;
  });
}

/** Marks a node as probed. */
export function setNodeProbed(nodeId) {
  mutate((s) => {
    const node = s.nodes[nodeId];
    if (node) node.probed = true;
  });
}

/** Sets node.alertState ('green' | 'yellow' | 'red'). */
export function setNodeAlertState(nodeId, alertState) {
  mutate((s) => {
    const node = s.nodes[nodeId];
    if (node) node.alertState = alertState;
  });
}

/** Marks a node as read. */
export function setNodeRead(nodeId) {
  mutate((s) => {
    const node = s.nodes[nodeId];
    if (node) node.read = true;
  });
}

/**
 * Marks uncollected macguffins on a node as collected and returns the result.
 * Does NOT set node.looted or add cash to player — callers handle that.
 * @param {string} nodeId
 * @returns {{ items: Array<import('../types.js').Macguffin>, total: number }}
 */
export function collectMacguffins(nodeId) {
  const items = [];
  let total = 0;
  mutate((s) => {
    const node = s.nodes[nodeId];
    if (!node) return;
    node.macguffins.forEach((m) => {
      if (!m.collected) {
        m.collected = true;
        items.push(m);
        total += m.cashValue;
      }
    });
  });
  return { items, total };
}

/** Sets node.looted. */
export function setNodeLooted(nodeId) {
  mutate((s) => {
    const node = s.nodes[nodeId];
    if (node) node.looted = true;
  });
}

/** Sets node.rebooting. */
export function setNodeRebooting(nodeId, rebooting) {
  mutate((s) => {
    const node = s.nodes[nodeId];
    if (node) node.rebooting = rebooting;
  });
}

/** Sets node.eventForwardingDisabled. */
export function setNodeEventForwarding(nodeId, disabled) {
  mutate((s) => {
    const node = s.nodes[nodeId];
    if (node) node.eventForwardingDisabled = disabled;
  });
}

/** Sets hidden flag on a specific vulnerability by index. */
export function setNodeVulnHidden(nodeId, vulnIndex, hidden) {
  mutate((s) => {
    const node = s.nodes[nodeId];
    if (node && node.vulnerabilities[vulnIndex]) {
      node.vulnerabilities[vulnIndex].hidden = hidden;
    }
  });
}
