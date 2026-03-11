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

  if (world.needsExploit.length === 0) return proposals;

  // Check if we have any non-failed cards that match exploitable nodes' vulns
  const hasUsableMatch = world.needsExploit.some(nodeId => {
    const matchingIds = world.cardMatchesByNode.get(nodeId) ?? [];
    // Filter out cards that already failed on this node
    return matchingIds.some(cardId =>
      !world.failedExploits.has(`${nodeId}:${cardId}`)
    );
  });

  // Check if any card in hand hasn't failed on at least one exploitable node
  const hasAnyUsableCard = world.hand.some(card =>
    world.needsExploit.some(nodeId =>
      !world.failedExploits.has(`${nodeId}:${card.id}`)
    )
  );

  // Visit store if no matching cards (or all matches exhausted)
  if (!hasUsableMatch && world.hand.length > 0) {
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

  // Jack out if we're truly stuck: no usable cards left and can't buy more
  if (!hasAnyUsableCard) {
    const wanNodeId = findWanNode(world);
    const canBuy = wanNodeId && world.player.cash > 0;
    if (!canBuy) {
      proposals.push({
        action: "jackout",
        nodeId: null,
        score: NO_CARDS_JACKOUT,
        reason: "no usable cards, can't buy — jack out",
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
