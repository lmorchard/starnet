// @ts-check
// Security heuristic — subvert IDS nodes, cancel trace when possible.

/** @typedef {import('../types.js').WorldModel} WorldModel */
/** @typedef {import('../types.js').ScoredAction} ScoredAction */

import { A } from "../../../js/core/action-ids.js";

const STRATEGY = "security";
const BASE_RECONFIGURE = 70;
const CANCEL_TRACE_SCORE = 900;
// When alert is green, deprioritize security work — explore data nodes first
const GREEN_ALERT_PENALTY = 35;

/**
 * @param {WorldModel} world
 * @returns {ScoredAction[]}
 */
export function securityStrategy(world) {
  /** @type {ScoredAction[]} */
  const proposals = [];

  // Emergency: cancel trace if we own a security monitor
  if (world.player.traceActive) {
    for (const nodeId of world.security) {
      const node = world.nodes.get(nodeId);
      if (!node) continue;
      if (node.type === "security-monitor" && node.accessLevel === "owned") {
        const actions = world.availableActions.get(nodeId) ?? [];
        if (actions.some(a => a.id === A.CANCEL_TRACE)) {
          proposals.push({
            action: A.CANCEL_TRACE,
            nodeId,
            score: CANCEL_TRACE_SCORE,
            reason: "EMERGENCY: cancel active trace",
            strategy: STRATEGY,
          });
        }
      }
    }
  }

  // Prioritize subverting IDS nodes (but not when alert is still green —
  // probing IDS can trigger alert escalation, so explore data nodes first)
  const alertPenalty = world.player.alertLevel === "green" ? GREEN_ALERT_PENALTY : 0;

  for (const nodeId of world.security) {
    const node = world.nodes.get(nodeId);
    if (!node || node.type !== "ids") continue;
    if (node.visibility !== "accessible") continue;

    // Already reconfigured?
    if (node.forwardingEnabled === false) continue;

    if (node.accessLevel === "owned") {
      // Own it — reconfigure
      const actions = world.availableActions.get(nodeId) ?? [];
      if (actions.some(a => a.id === A.CORRUPT)) {
        proposals.push({
          action: A.CORRUPT,
          nodeId,
          score: BASE_RECONFIGURE,
          reason: "corrupt IDS to sever alert chain",
          strategy: STRATEGY,
        });
      }
    } else if (!node.probed) {
      // Need to probe first
      proposals.push({
        action: A.PROBE,
        nodeId,
        score: BASE_RECONFIGURE + 2 - alertPenalty,
        reason: "probe IDS for subversion",
        strategy: STRATEGY,
      });
    } else {
      // Probed but not owned — exploit (only if we have a matching card)
      const card = pickBestCard(world, nodeId);
      if (card) {
        // Only propose at high priority if card actually matches a vuln
        const matchingIds = world.cardMatchesByNode.get(nodeId) ?? [];
        const isMatch = matchingIds.includes(card.id);
        proposals.push({
          action: A.XPLOIT,
          nodeId,
          score: (isMatch ? BASE_RECONFIGURE + 1 : BASE_RECONFIGURE - 30) - alertPenalty,
          reason: isMatch ? "exploit IDS for subversion" : "hail-mary exploit on IDS",
          strategy: STRATEGY,
          payload: { exploitId: card.id },
        });
      }
    }
  }

  return proposals;
}

/**
 * @param {WorldModel} world
 * @param {string} nodeId
 * @returns {import('../types.js').WorldCard|null}
 */
function pickBestCard(world, nodeId) {
  const available = world.hand.filter(c =>
    !world.failedExploits.has(`${nodeId}:${c.id}`)
  );
  if (available.length === 0) return null;

  const matchingIds = world.cardMatchesByNode.get(nodeId);
  const matching = matchingIds
    ? available.filter(c => matchingIds.includes(c.id))
    : [];

  if (matching.length > 0) {
    matching.sort((a, b) => b.quality - a.quality || b.usesLeft - a.usesLeft);
    return matching[0];
  }

  const sorted = [...available].sort((a, b) => b.quality - a.quality);
  return sorted[0];
}
