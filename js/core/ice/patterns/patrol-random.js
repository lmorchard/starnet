// @ts-check
// Random-walk pattern — chooses a non-WAN neighbor at random each tick.
// Matches pre-reinvention grade-D/F behavior.

import { RNG, randomPick } from "../../rng.js";

export const patrolRandom = {
  id: "patrol-random",
  /**
   * @param {import('../../types.js').IceInstance} instance
   * @param {import('../../types.js').GameState} state
   * @returns {{ nextAttention: string|null }}
   */
  onTick(instance, state) {
    const neighbors = (state.adjacency[instance.attentionNodeId] || [])
      .filter((n) => state.nodes[n]?.type !== "wan");
    if (neighbors.length === 0) return { nextAttention: null };
    return { nextAttention: randomPick(RNG.ICE, neighbors) };
  },
};
