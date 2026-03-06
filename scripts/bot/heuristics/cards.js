// @ts-check
// Cards heuristic — manage hand, visit store when needed.

/** @typedef {import('../types.js').WorldModel} WorldModel */
/** @typedef {import('../types.js').ScoredAction} ScoredAction */

const STRATEGY = "cards";
const STORE_VISIT_SCORE = 55;
const NO_CARDS_JACKOUT = 10;

/**
 * @param {WorldModel} world
 * @returns {ScoredAction[]}
 */
export function cardsStrategy(world) {
  /** @type {ScoredAction[]} */
  const proposals = [];

  // Check if we have any cards that match visible nodes' vulns
  const hasUsableMatch = world.needsExploit.some(nodeId =>
    (world.cardMatchesByNode.get(nodeId)?.length ?? 0) > 0
  );

  // If no cards match any exploitable node, visit the store
  if (!hasUsableMatch && world.needsExploit.length > 0 && world.hand.length > 0) {
    // Find the WAN node for store access
    const wanNodeId = findWanNode(world);
    if (wanNodeId && world.player.cash > 0) {
      proposals.push({
        action: "access-darknet",
        nodeId: wanNodeId,
        score: STORE_VISIT_SCORE,
        reason: "no matching cards — visit darknet store",
        strategy: STRATEGY,
      });
    }
  }

  // Hand is completely empty and can't buy
  if (world.hand.length === 0 && world.needsExploit.length > 0) {
    const wanNodeId = findWanNode(world);
    if (!wanNodeId || world.player.cash <= 0) {
      proposals.push({
        action: "jackout",
        nodeId: null,
        score: NO_CARDS_JACKOUT,
        reason: "no cards, can't buy — jack out",
        strategy: STRATEGY,
      });
    }
  }

  return proposals;
}

/**
 * Find the WAN node.
 * @param {WorldModel} world
 * @returns {string|null}
 */
function findWanNode(world) {
  for (const [id, node] of world.nodes) {
    if (node.type === "wan") return id;
  }
  return null;
}
