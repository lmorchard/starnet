// @ts-check
// Census metrics — pure analysis functions for generated network objects.
// No game state dependencies. Operates on the { nodes, edges, startNode, ice }
// shape returned by generateNetwork().

// ── Topology Analysis ────────────────────────────────────────────────────────

/**
 * Build an undirected adjacency map from edge list.
 * @param {Array<{source: string, target: string}>} edges
 * @returns {Map<string, string[]>}
 */
function buildAdjacency(edges) {
  /** @type {Map<string, string[]>} */
  const adj = new Map();
  for (const { source, target } of edges) {
    if (!adj.has(source)) adj.set(source, []);
    if (!adj.has(target)) adj.set(target, []);
    adj.get(source).push(target);
    adj.get(target).push(source);
  }
  return adj;
}

/** Node types that are lootable targets. */
const LOOTABLE_TYPES = new Set(["fileserver", "cryptovault"]);

/** Node types to exclude from critical path cost (pre-accessible or trivial). */
const SKIP_TYPES = new Set(["wan", "gateway"]);

/**
 * BFS from startNode to nearest lootable target. Returns the path as an ordered
 * array of node IDs (start to target inclusive), or empty array if unreachable.
 * @param {string} startNode
 * @param {Array<{id: string, type: string}>} nodes
 * @param {Map<string, string[]>} adj
 * @returns {string[]}
 */
function bfsShortestPath(startNode, nodes, adj) {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  /** @type {Map<string, string|null>} nodeId → parent nodeId */
  const parent = new Map();
  parent.set(startNode, null);
  const queue = [startNode];

  while (queue.length > 0) {
    const current = /** @type {string} */ (queue.shift());
    const node = nodeMap.get(current);
    if (node && LOOTABLE_TYPES.has(node.type) && current !== startNode) {
      // Reconstruct path
      const path = [];
      let cur = current;
      while (cur !== null) {
        path.unshift(cur);
        cur = /** @type {string} */ (parent.get(cur));
      }
      return path;
    }
    for (const neighbor of (adj.get(current) ?? [])) {
      if (!parent.has(neighbor)) {
        parent.set(neighbor, current);
        queue.push(neighbor);
      }
    }
  }
  return [];
}

/**
 * Analyze topology of a generated network.
 * @param {object} network - return value of generateNetwork()
 * @param {Array<{id: string, type: string, grade: string}>} network.nodes
 * @param {Array<{source: string, target: string}>} network.edges
 * @param {string} network.startNode
 * @param {{grade: string}} network.ice
 * @returns {{
 *   nodeCount: number,
 *   nodesByType: Record<string, number>,
 *   criticalPath: string[],
 *   critPathLength: number,
 *   critPathGrades: string[],
 *   critPathGates: number,
 *   iceGrade: string,
 *   setPieceFired: boolean,
 * }}
 */
export function analyzeTopology(network) {
  const { nodes, edges, startNode, ice } = network;
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Node counts by type
  /** @type {Record<string, number>} */
  const nodesByType = {};
  for (const n of nodes) {
    nodesByType[n.type] = (nodesByType[n.type] ?? 0) + 1;
  }

  // BFS critical path
  const adj = buildAdjacency(edges);
  const criticalPath = bfsShortestPath(startNode, nodes, adj);

  // Grades along critical path, excluding wan/gateway
  const critPathGrades = criticalPath
    .map(id => nodeMap.get(id))
    .filter(n => n && !SKIP_TYPES.has(n.type))
    .map(n => /** @type {{grade: string}} */ (n).grade);

  // Gate count on critical path
  const critPathGates = criticalPath
    .filter(id => nodeMap.get(id)?.type === "firewall")
    .length;

  // Set piece heuristic: careless-user adds a firewall. If there are more
  // firewalls than the network would normally have, a set piece likely fired.
  // Normal firewall count = gateCount from TIME_BUDGET (0, 1, 2, or 3).
  // We don't have tc here, so use a simpler heuristic: if total firewall
  // count > 1 and there's also >1 fileserver, likely a set piece fired.
  // This works because careless-user adds 1 firewall + 1 fileserver + 1 workstation.
  const fwCount = nodesByType["firewall"] ?? 0;
  const fsCount = nodesByType["fileserver"] ?? 0;
  const setPieceFired = fwCount >= 2 && fsCount >= 2;

  return {
    nodeCount: nodes.length,
    nodesByType,
    criticalPath,
    critPathLength: criticalPath.length,
    critPathGrades,
    critPathGates,
    iceGrade: ice.grade,
    setPieceFired,
  };
}
