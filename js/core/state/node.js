// @ts-check
// Pure node state mutations. No event emission, no orchestration.
// When a NodeGraph is registered, setters also sync changes to the graph.

import { getState, mutate } from "./index.js";

/** @type {import('../node-graph/runtime.js').NodeGraph | null} */
let _graph = null;
let _syncingToGraph = false;

/**
 * Register the NodeGraph for bidirectional sync.
 * Call once after graph construction in initGame().
 * @param {import('../node-graph/runtime.js').NodeGraph | null} graph
 */
export function setNodeGraph(graph) {
  _graph = graph;
}

/** @returns {boolean} True if we're currently syncing from a setter to graph. */
export function isSyncingToGraph() {
  return _syncingToGraph;
}

/**
 * Sync an attribute change to the graph (if registered).
 * Guards against circular updates.
 * @param {string} nodeId
 * @param {string} attr
 * @param {any} value
 */
function syncToGraph(nodeId, attr, value) {
  if (_graph) {
    _syncingToGraph = true;
    try { _graph.setNodeAttr(nodeId, attr, value); }
    catch (_) { /* node might not exist in graph (e.g. internal set-piece nodes) */ }
    finally { _syncingToGraph = false; }
  }
}

/** Sets node.visibility ('hidden' | 'revealed' | 'accessible'). */
export function setNodeVisible(nodeId, visibility) {
  mutate((s) => {
    const node = s.nodes[nodeId];
    if (node) node.visibility = visibility;
  });
  syncToGraph(nodeId, "visibility", visibility);
}

/** Sets node.accessLevel ('locked' | 'compromised' | 'owned'). */
export function setNodeAccessLevel(nodeId, level) {
  mutate((s) => {
    const node = s.nodes[nodeId];
    if (node) node.accessLevel = level;
  });
  syncToGraph(nodeId, "accessLevel", level);
}

/** Marks a node as probed. */
export function setNodeProbed(nodeId) {
  mutate((s) => {
    const node = s.nodes[nodeId];
    if (node) node.probed = true;
  });
  syncToGraph(nodeId, "probed", true);
}

/** Sets node.alertState ('green' | 'yellow' | 'red'). */
export function setNodeAlertState(nodeId, alertState) {
  mutate((s) => {
    const node = s.nodes[nodeId];
    if (node) node.alertState = alertState;
  });
  syncToGraph(nodeId, "alertState", alertState);
}

/** Marks a node as read. */
export function setNodeRead(nodeId) {
  mutate((s) => {
    const node = s.nodes[nodeId];
    if (node) node.read = true;
  });
  syncToGraph(nodeId, "read", true);
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
    if (!node || !node.macguffins) return;
    node.macguffins.forEach((m) => {
      if (!m.collected) {
        m.collected = true;
        items.push(m);
        total += m.cashValue;
      }
    });
  });
  // Sync the full macguffins array to the graph (collected flags changed)
  const s = getState();
  if (s.nodes[nodeId]) {
    syncToGraph(nodeId, "macguffins", s.nodes[nodeId].macguffins);
  }
  return { items, total };
}

/** Sets node.looted. */
export function setNodeLooted(nodeId) {
  mutate((s) => {
    const node = s.nodes[nodeId];
    if (node) node.looted = true;
  });
  syncToGraph(nodeId, "looted", true);
}

/** Sets node.rebooting. */
export function setNodeRebooting(nodeId, rebooting) {
  mutate((s) => {
    const node = s.nodes[nodeId];
    if (node) node.rebooting = rebooting;
  });
  syncToGraph(nodeId, "rebooting", rebooting);
}

/** Sets node.sigAlias (temporary console alias while the node is revealed). */
export function setNodeSigAlias(nodeId, alias) {
  mutate((s) => {
    const node = s.nodes[nodeId];
    if (node) node.sigAlias = alias;
  });
  syncToGraph(nodeId, "sigAlias", alias);
}

/** Sets node.eventForwardingDisabled. */
export function setNodeEventForwarding(nodeId, disabled) {
  mutate((s) => {
    const node = s.nodes[nodeId];
    if (node) node.eventForwardingDisabled = disabled;
  });
  syncToGraph(nodeId, "eventForwardingDisabled", disabled);
}

/** Sets hidden flag on a specific vulnerability by index. */
export function setNodeVulnHidden(nodeId, vulnIndex, hidden) {
  mutate((s) => {
    const node = s.nodes[nodeId];
    if (node && node.vulnerabilities[vulnIndex]) {
      node.vulnerabilities[vulnIndex].hidden = hidden;
    }
  });
  // Sync full vulns array
  const s = getState();
  if (s.nodes[nodeId]) {
    syncToGraph(nodeId, "vulnerabilities", s.nodes[nodeId].vulnerabilities);
  }
}
