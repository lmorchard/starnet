// @ts-check
// Disturbance-tracking pattern — uses BFS to step toward state.lastDisturbedNodeId
// when set, otherwise random walk. Matches pre-reinvention grade-C/B behavior.

import { RNG, randomPick } from "../../rng.js";

function nextHopToward(src, dst, adjacency) {
  if (src === dst) return null;
  const visited = new Set([src]);
  const queue = [[src, null]]; // [node, firstHop]
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

export const disturbanceTracker = {
  id: "disturbance-tracker",
  /**
   * @param {import('../../types.js').IceInstance} instance
   * @param {import('../../types.js').GameState} state
   * @returns {{ nextAttention: string|null, arrivedAtDisturbanceTarget?: boolean }}
   */
  onTick(instance, state) {
    const neighbors = (state.adjacency[instance.attentionNodeId] || [])
      .filter((n) => state.nodes[n]?.type !== "wan");
    if (neighbors.length === 0) return { nextAttention: null };
    const target = state.lastDisturbedNodeId;
    const alreadyDetectedTarget = instance.detectedAtNode === target;
    if (target && target !== instance.attentionNodeId && !alreadyDetectedTarget) {
      const hop = nextHopToward(instance.attentionNodeId, target, state.adjacency)
        ?? randomPick(RNG.ICE, neighbors);
      return { nextAttention: hop };
    }
    return {
      nextAttention: randomPick(RNG.ICE, neighbors),
      arrivedAtDisturbanceTarget: target === instance.attentionNodeId,
    };
  },
};
