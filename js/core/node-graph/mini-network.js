// @ts-check
/**
 * Mini-network builder — wraps a set-piece or raw NodeGraphDef in a playable
 * micro-network with a gateway and WAN node. Used by both the browser playground
 * and playtest.js --piece/--graph modes.
 */

import { instantiate, SET_PIECES } from "./set-pieces.js";
import { createGateway, createWAN, createGameNode } from "./game-types.js";

/**
 * Wrap a raw NodeGraphDef in a mini-network with gateway + WAN.
 *
 * @param {{ nodes: any[], edges: [string,string][], triggers?: any[] }} graphDef
 * @param {{ name?: string, startCash?: number }} [opts]
 * @returns {{ graphDef: { nodes: any[], edges: [string,string][], triggers: any[] }, meta: object }}
 */
export function buildMiniNetwork(graphDef, opts = {}) {
  const gateway = createGateway("gateway", {
    attributes: { visibility: "accessible" },
  });
  const wan = createWAN("wan");

  // Wrap nodes that don't have traits yet
  const wrappedNodes = graphDef.nodes.map((n) =>
    n.traits && n.traits.length > 0 ? n : createGameNode(n)
  );

  // Connect gateway to the first node if there are any
  const entryEdges = wrappedNodes.length > 0
    ? [/** @type {[string,string]} */ (["gateway", wrappedNodes[0].id])]
    : [];

  return {
    graphDef: {
      nodes: [gateway, wan, ...wrappedNodes],
      edges: [
        ["gateway", "wan"],
        ...entryEdges,
        ...graphDef.edges,
      ],
      triggers: graphDef.triggers ?? [],
    },
    meta: {
      name: opts.name ?? "Mini Network",
      startNode: "gateway",
      startCash: opts.startCash ?? 500,
      moneyCost: "F",
      startHand: ["common", "common", "uncommon", "uncommon"],
      ice: null,
    },
  };
}

/**
 * Build a mini-network from a named set-piece.
 *
 * @param {string} pieceName — key in SET_PIECES (e.g. "idsRelayChain")
 * @returns {{ graphDef: { nodes: any[], edges: [string,string][], triggers: any[] }, meta: object }}
 */
export function buildSetPieceMiniNetwork(pieceName) {
  const def = SET_PIECES[pieceName];
  if (!def) {
    throw new Error(`Unknown set-piece: "${pieceName}". Available: ${Object.keys(SET_PIECES).join(", ")}`);
  }

  const instance = instantiate(def, "sp");
  const wrappedNodes = instance.nodes.map(createGameNode);

  const gateway = createGateway("gateway", {
    attributes: { visibility: "accessible" },
  });
  const wan = createWAN("wan");

  // Connect gateway to all external ports
  const portEdges = instance.externalPorts.map(
    (port) => /** @type {[string,string]} */ (["gateway", port])
  );

  return {
    graphDef: {
      nodes: [gateway, wan, ...wrappedNodes],
      edges: [
        ["gateway", "wan"],
        ...portEdges,
        ...instance.edges,
      ],
      triggers: instance.triggers,
    },
    meta: {
      name: `Set-piece: ${pieceName}`,
      startNode: "gateway",
      startCash: 500,
      moneyCost: "F",
      startHand: ["common", "common", "uncommon", "uncommon", "rare"],
      ice: null,
    },
  };
}

/**
 * List available set-piece names.
 * @returns {string[]}
 */
export function listSetPieces() {
  return Object.keys(SET_PIECES);
}
