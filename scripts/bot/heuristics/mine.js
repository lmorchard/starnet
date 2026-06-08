// @ts-check
// Mine heuristic — mine owned nodes for exploit cards when blocked on cards.

/** @typedef {import('../types.js').WorldModel} WorldModel */
/** @typedef {import('../types.js').ScoredAction} ScoredAction */

import { A } from "../../../js/core/action-ids.js";

const STRATEGY = "mine";
const MINE_SCORE = 30;

/**
 * @param {WorldModel} world
 * @returns {ScoredAction[]}
 */
export function mineStrategy(world) {
  /** @type {ScoredAction[]} */
  const proposals = [];
  if (world.needsExploit.length === 0) return proposals;
  if (!world.minable || world.minable.length === 0) return proposals;

  // Only when there is no usable matching card already (same gate as cards buy).
  const hasUsableMatch = world.needsExploit.some((nodeId) => {
    const ids = world.cardMatchesByNode.get(nodeId) ?? [];
    return ids.some((cardId) => !world.failedExploits.has(`${nodeId}:${cardId}`));
  });
  if (hasUsableMatch) return proposals;

  // Vuln types we still need (from blocked nodes).
  const needed = new Set();
  for (const nodeId of world.needsExploit) {
    for (const v of (world.nodes.get(nodeId)?.vulnerabilities ?? [])) needed.add(v.id);
  }
  // Prefer a minable node whose vulns overlap a needed vuln; else any minable node.
  const overlap = world.minable.find((m) => [...m.vulnTypes].some((t) => needed.has(t)));
  const pick = overlap ?? world.minable[0];

  proposals.push({
    action: A.MINE, nodeId: pick.nodeId, score: MINE_SCORE,
    reason: overlap ? `mine ${pick.nodeId} (vuln overlap)` : `mine ${pick.nodeId} (supply)`,
    strategy: STRATEGY,
  });
  return proposals;
}
