// Pure breadth-first pathfinding over a Cytoscape graph's edges.
//
// Extracted from graph.js's two near-identical BFS walks (flashIcePath /
// drawIceTrace) per issue #165. Returns the ordered node-id list; each caller
// keeps its own styling. Kept dependency-free (only the `cy.edges()` +
// `edge.data()` surface) so it's unit-testable with a tiny mock.

/**
 * Find the shortest path between two nodes, treating edges as undirected.
 *
 * @param {{ edges: () => Iterable<{ data: (key: string) => string }> }} cy
 * @param {string} fromId
 * @param {string} toId
 * @returns {string[] | null} ordered node ids from `fromId` to `toId`
 *   (inclusive), or `null` if `toId` is unreachable from `fromId`. A
 *   degenerate `fromId === toId` returns `null` (no traversable path),
 *   matching the original walks.
 */
export function findPath(cy, fromId, toId) {
  const prev = new Map([[fromId, null]]); // node id → predecessor id (null at root)
  const queue = [fromId];
  let found = false;

  while (queue.length && !found) {
    const cur = queue.shift();
    for (const edge of cy.edges()) {
      const s = edge.data("source");
      const t = edge.data("target");
      let neighbor = null;
      if (s === cur && !prev.has(t)) neighbor = t;
      else if (t === cur && !prev.has(s)) neighbor = s;
      if (neighbor !== null) {
        prev.set(neighbor, cur);
        if (neighbor === toId) { found = true; break; }
        queue.push(neighbor);
      }
    }
  }

  if (!found) return null;

  const path = [];
  let cur = toId;
  while (cur !== null) {
    path.unshift(cur);
    cur = prev.get(cur);
  }
  return path;
}
