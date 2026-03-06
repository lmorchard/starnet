// @ts-check
// Security heuristic — subvert IDS nodes, cancel trace when possible.

/** @typedef {import('../types.js').WorldModel} WorldModel */
/** @typedef {import('../types.js').ScoredAction} ScoredAction */

const STRATEGY = "security";
const BASE_RECONFIGURE = 70;
const CANCEL_TRACE_SCORE = 900;

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
        if (actions.some(a => a.id === "cancel-trace")) {
          proposals.push({
            action: "cancel-trace",
            nodeId,
            score: CANCEL_TRACE_SCORE,
            reason: "EMERGENCY: cancel active trace",
            strategy: STRATEGY,
          });
        }
      }
    }
  }

  // Prioritize subverting IDS nodes
  for (const nodeId of world.security) {
    const node = world.nodes.get(nodeId);
    if (!node || node.type !== "ids") continue;
    if (node.visibility !== "accessible") continue;

    // Already reconfigured?
    if (node.forwardingEnabled === false) continue;

    if (node.accessLevel === "owned") {
      // Own it — reconfigure
      const actions = world.availableActions.get(nodeId) ?? [];
      if (actions.some(a => a.id === "reconfigure")) {
        proposals.push({
          action: "reconfigure",
          nodeId,
          score: BASE_RECONFIGURE,
          reason: "reconfigure IDS to sever alert chain",
          strategy: STRATEGY,
        });
      }
    } else if (!node.probed) {
      // Need to probe first
      proposals.push({
        action: "probe",
        nodeId,
        score: BASE_RECONFIGURE + 2,
        reason: "probe IDS for subversion",
        strategy: STRATEGY,
      });
    } else {
      // Probed but not owned — exploit
      const card = pickBestCard(world, nodeId);
      if (card) {
        proposals.push({
          action: "exploit",
          nodeId,
          score: BASE_RECONFIGURE + 1,
          reason: "exploit IDS for subversion",
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
