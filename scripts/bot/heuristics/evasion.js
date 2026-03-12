// @ts-check
// Evasion heuristic — avoid ICE, deselect to hide.

/** @typedef {import('../types.js').WorldModel} WorldModel */
/** @typedef {import('../types.js').ScoredAction} ScoredAction */

const STRATEGY = "evasion";
const ICE_ON_NODE_CANCEL = 800;
const TRACE_JACKOUT = 100;
const POST_ACTION_DESELECT = 15;

/**
 * @param {WorldModel} world
 * @returns {ScoredAction[]}
 */
export function evasionStrategy(world) {
  /** @type {ScoredAction[]} */
  const proposals = [];

  // If ICE is on the currently selected node, propose deselecting
  if (world.ice.isOnSelectedNode && world.player.selectedNodeId) {
    proposals.push({
      action: "deselect",
      nodeId: null,
      score: ICE_ON_NODE_CANCEL,
      reason: "ICE on current node — hide",
      strategy: STRATEGY,
    });
  }

  // If trace is active, propose jacking out (security heuristic may override
  // with cancel-trace if the bot owns a security monitor)
  if (world.player.traceActive) {
    proposals.push({
      action: "jackout",
      nodeId: null,
      score: TRACE_JACKOUT,
      reason: "trace active — jack out to save progress",
      strategy: STRATEGY,
    });
  }

  // If player is selected on a node but not doing anything, propose deselect
  // (reduces exposure time between actions)
  if (world.player.selectedNodeId) {
    const nodeId = world.player.selectedNodeId;
    const node = world.nodes.get(nodeId);
    if (node && !node.probing && !node.exploiting && !node.reading && !node.looting) {
      proposals.push({
        action: "deselect",
        nodeId: null,
        score: POST_ACTION_DESELECT,
        reason: "deselect to reduce ICE exposure",
        strategy: STRATEGY,
      });
    }
  }

  return proposals;
}
