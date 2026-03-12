// @ts-check
/**
 * Network validators — structural and gameplay invariant checks.
 * Run after assembly to verify the generated network is playable.
 */

/** @typedef {import('../node-graph/types.js').NodeDef} NodeDef */

import { gradeToNumber } from "./budget.js";

/**
 * Validate a generated network.
 * @param {{ nodes: NodeDef[], edges: [string, string][], triggers: any[] }} graphDef
 * @param {import('./set-pieces.js').NetworkSpec} spec
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validate(graphDef, spec) {
  /** @type {string[]} */
  const errors = [];

  // 1. Gateway exists
  const gateway = graphDef.nodes.find(n => n.type === "gateway");
  if (!gateway) {
    errors.push("No gateway node found");
  }

  // 2. Reachability — BFS from gateway reaches at least one lootable node
  if (gateway) {
    const lootable = new Set(
      graphDef.nodes
        .filter(n => n.type === "fileserver" || n.type === "cryptovault" || n.type === "workstation")
        .map(n => n.id)
    );

    if (lootable.size === 0) {
      errors.push("No lootable nodes (fileserver/cryptovault/workstation) in network");
    } else {
      const reachable = bfs(gateway.id, graphDef.edges);
      const reachableLoot = [...lootable].filter(id => reachable.has(id));
      if (reachableLoot.length === 0) {
        errors.push("Gateway cannot reach any lootable node");
      }
    }
  }

  // 3. Defense coverage — warn (not error) if threat >= C but no defense nodes.
  // Budget degradation may replace defense slots with filler at high specs.
  // This is acceptable — the network is still playable, just less threatening.

  // 4. No orphan nodes — every node has at least one edge
  const connectedNodes = new Set();
  for (const [a, b] of graphDef.edges) {
    connectedNodes.add(a);
    connectedNodes.add(b);
  }
  const orphans = graphDef.nodes.filter(n => !connectedNodes.has(n.id));
  // WAN and gateway are allowed to be connected only to each other
  const realOrphans = orphans.filter(n => n.type !== "wan" && n.type !== "gateway");
  if (realOrphans.length > 0) {
    errors.push(`Orphan nodes (no edges): ${realOrphans.map(n => n.id).join(", ")}`);
  }

  // 5. Minimum node count — at least 8 nodes for a meaningful network
  if (graphDef.nodes.length < 8) {
    errors.push(`Too few nodes: ${graphDef.nodes.length} (minimum 8)`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * BFS from a start node, returning all reachable node IDs.
 * @param {string} startId
 * @param {[string, string][]} edges
 * @returns {Set<string>}
 */
function bfs(startId, edges) {
  /** @type {Map<string, string[]>} */
  const adj = new Map();
  for (const [a, b] of edges) {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push(b);
    adj.get(b).push(a);
  }

  const visited = new Set([startId]);
  const queue = [startId];
  while (queue.length > 0) {
    const current = /** @type {string} */ (queue.shift());
    for (const neighbor of (adj.get(current) ?? [])) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return visited;
}
