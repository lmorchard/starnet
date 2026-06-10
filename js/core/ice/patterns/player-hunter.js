// @ts-check
// Player-hunter pattern — pathfinds toward state.selectedNodeId when set.
// Matches pre-reinvention grade-A/S behavior.

import { RNG, randomPick } from "../../rng.js";

function nextHopToward(src, dst, adjacency) {
  if (src === dst) return null;
  const visited = new Set([src]);
  const queue = [[src, null]];
  while (queue.length) {
    const [node, firstHop] = queue.shift();
    for (const neighbor of (adjacency[node] || [])) {
      const hop = firstHop ?? neighbor;
      if (neighbor === dst) return hop;
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([neighbor, hop]);
      }
    }
  }
  return null;
}

export const playerHunter = {
  id: "player-hunter",
  /**
   * @param {import('../../types.js').IceInstance} instance
   * @param {import('../../types.js').GameState} state
   * @returns {{ nextAttention: string|null }}
   */
  onTick(instance, state) {
    const neighbors = (state.adjacency[instance.attentionNodeId] || [])
      .filter((n) => state.nodes[n]?.type !== "wan");
    if (neighbors.length === 0) return { nextAttention: null };
    const target = state.selectedNodeId;
    if (target && target !== instance.attentionNodeId) {
      const hop = nextHopToward(instance.attentionNodeId, target, state.adjacency)
        ?? randomPick(RNG.ICE, neighbors);
      return { nextAttention: hop };
    }
    return { nextAttention: randomPick(RNG.ICE, neighbors) };
  },
};
