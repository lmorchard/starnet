// @ts-check
// Structural validators for the corporate biome.
// Each validator accepts (network, biome) and returns null on pass or a failure string.

/** Build an adjacency map from edge list. */
function buildAdjacency(network) {
  /** @type {Record<string, string[]>} */
  const adj = {};
  for (const { source, target } of network.edges) {
    (adj[source] ??= []).push(target);
    (adj[target] ??= []).push(source);
  }
  return adj;
}

export const VALIDATORS = [
  /** wan, gateway, and security anchor all present. */
  function hasAnchors(network, biome) {
    const types = new Set(network.nodes.map((n) => n.type));
    if (!types.has(biome.roles.wan))     return `missing ${biome.roles.wan} node`;
    if (!types.has(biome.roles.gateway)) return `missing ${biome.roles.gateway} node`;
    if (!types.has(biome.roles.monitor)) return `missing ${biome.roles.monitor} node`;
    return null;
  },

  /** At least one sensor node connects to the security anchor. */
  function sensorAdjacentToMonitor(network, biome) {
    const monitorIds = network.nodes
      .filter((n) => n.type === biome.roles.monitor)
      .map((n) => n.id);
    const hasLink = network.edges.some(
      ({ source, target }) =>
        (monitorIds.includes(target) && network.nodes.find((n) => n.id === source)?.type === biome.roles.sensor) ||
        (monitorIds.includes(source) && network.nodes.find((n) => n.id === target)?.type === biome.roles.sensor)
    );
    return hasLink ? null : `no ${biome.roles.sensor} node adjacent to ${biome.roles.monitor}`;
  },

  /** At least one lootable node type (target or premium role) exists. */
  function missionTargetExists(network, biome) {
    const lootable = [biome.roles.target, biome.roles.premium].filter(Boolean);
    const types = network.nodes.map((n) => n.type);
    return lootable.some((t) => types.includes(t))
      ? null
      : `no lootable node (${lootable.join(" or ")})`;
  },

  /** Every node has at least one edge. */
  function noOrphanNodes(network) {
    const adj = buildAdjacency(network);
    for (const node of network.nodes) {
      if (!adj[node.id] || adj[node.id].length === 0) {
        return `orphan node: ${node.id} (${node.type})`;
      }
    }
    return null;
  },

  /** BFS from startNode reaches at least one lootable node. */
  function gatewayReachesTarget(network, biome) {
    const lootable = new Set([biome.roles.target, biome.roles.premium].filter(Boolean));
    const adj = buildAdjacency(network);
    const visited = new Set([network.startNode]);
    const queue = [network.startNode];
    while (queue.length) {
      const cur = queue.shift();
      const node = network.nodes.find((n) => n.id === cur);
      if (node && lootable.has(node.type)) return null;
      for (const neighbor of (adj[cur] || [])) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    return "no lootable node reachable from startNode";
  },
];
