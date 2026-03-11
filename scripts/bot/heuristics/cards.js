// @ts-check
// Cards heuristic — manage hand, visit store when needed.

/** @typedef {import('../types.js').WorldModel} WorldModel */
/** @typedef {import('../types.js').ScoredAction} ScoredAction */

import { getStoreCatalog } from "../../../js/core/exploits.js";

const STRATEGY = "cards";
const BUY_CARD_SCORE = 55;
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

  // Buy a matching card if we have cash and no matching cards
  if (!hasUsableMatch && world.player.cash > 0) {
    const vulnToBuy = pickVulnToBuy(world);
    if (vulnToBuy) {
      proposals.push({
        action: "buy-card",
        nodeId: null,
        score: BUY_CARD_SCORE,
        reason: `buy ${vulnToBuy.vulnId} card (¥${vulnToBuy.price})`,
        strategy: STRATEGY,
        payload: { vulnId: vulnToBuy.vulnId },
      });
    }
  }

  // Jack out if we're truly stuck: no usable cards left and can't buy more
  if (!hasAnyUsableCard && !pickVulnToBuy(world)) {
    proposals.push({
      action: "jackout",
      nodeId: null,
      score: NO_CARDS_JACKOUT,
      reason: "no usable cards, can't buy — jack out",
      strategy: STRATEGY,
    });
  }

  return proposals;
}

/**
 * Pick the best vulnerability type to buy from the store.
 * Finds vulns on needsExploit nodes and picks the cheapest affordable match.
 * @param {WorldModel} world
 * @returns {{ vulnId: string, price: number } | null}
 */
function pickVulnToBuy(world) {
  // Collect all vuln types needed across exploitable nodes
  /** @type {Set<string>} */
  const neededVulns = new Set();
  for (const nodeId of world.needsExploit) {
    const node = world.nodes.get(nodeId);
    if (!node?.vulnerabilities) continue;
    for (const v of node.vulnerabilities) {
      neededVulns.add(v.id);
    }
  }

  if (neededVulns.size === 0) return null;

  // Find affordable catalog entries matching needed vulns
  const catalog = getStoreCatalog();
  const affordable = catalog
    .filter(item => neededVulns.has(item.vulnId) && item.price <= world.player.cash)
    .sort((a, b) => a.price - b.price); // cheapest first

  return affordable[0] ?? null;
}
