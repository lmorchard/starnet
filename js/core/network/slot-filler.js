// @ts-check
/**
 * Slot filler (Pass 2) — walks the skeleton tree and fills each slot with
 * a concrete set-piece from the biome catalog.
 *
 * For each slot: filter catalog by tags + budget + port compatibility,
 * pick a piece, instantiate it, apply createGameNode, wire to parent.
 */

/** @typedef {import('./set-pieces.js').SetPieceDef} SetPieceDef */
/** @typedef {import('./set-pieces.js').SetPieceInstance} SetPieceInstance */
/** @typedef {import('./set-pieces.js').Port} Port */
/** @typedef {import('./set-pieces.js').NetworkSpec} NetworkSpec */
/** @typedef {import('./set-pieces.js').BiomeDef} BiomeDef */
/** @typedef {import('./skeleton.js').SkeletonSlot} SkeletonSlot */
/** @typedef {import('../node-graph/types.js').NodeDef} NodeDef */
/** @typedef {import('../node-graph/types.js').TriggerDef} TriggerDef */

import { instantiate } from "./set-pieces.js";
import { createGameNode } from "../node-graph/game-types.js";
import { gradeToNumber, costBudget } from "./budget.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A placed piece — a filled skeleton slot with its instantiated set-piece.
 * @typedef {Object} PlacedPiece
 * @property {SkeletonSlot} slot
 * @property {SetPieceDef} pieceDef
 * @property {string} prefix
 * @property {NodeDef[]} nodes - game-ready nodes (after createGameNode)
 * @property {[string, string][]} edges - internal edges (prefixed)
 * @property {TriggerDef[]} triggers
 * @property {Port[]} ports - prefixed ports
 * @property {string|null} inboundNodeId - prefixed inbound port node ID
 * @property {string[]} outboundNodeIds - prefixed outbound port node IDs (unconsumed)
 */

// ---------------------------------------------------------------------------
// Slot filler
// ---------------------------------------------------------------------------

/**
 * Fill a skeleton tree with concrete set-pieces from the biome catalog.
 *
 * @param {SkeletonSlot} skeleton
 * @param {BiomeDef} biome
 * @param {NetworkSpec} spec
 * @param {() => number} rng
 * @returns {{ pieces: PlacedPiece[], crossEdges: [string, string][], ok: boolean }}
 */
export function fillSkeleton(skeleton, biome, spec, rng) {
  let budgetRemaining = costBudget(spec);
  /** @type {PlacedPiece[]} */
  const pieces = [];
  /** @type {[string, string][]} */
  const crossEdges = [];
  /** @type {Map<string, PlacedPiece>} slotId → placed piece */
  const placed = new Map();

  const ok = fillSlot(skeleton, null, biome, spec, rng, pieces, crossEdges, placed, { budget: budgetRemaining });

  return { pieces, crossEdges, ok };
}

/**
 * Recursively fill a slot and its children.
 * @param {SkeletonSlot} slot
 * @param {PlacedPiece|null} parentPiece
 * @param {BiomeDef} biome
 * @param {NetworkSpec} spec
 * @param {() => number} rng
 * @param {PlacedPiece[]} pieces
 * @param {[string, string][]} crossEdges
 * @param {Map<string, PlacedPiece>} placed
 * @param {{ budget: number }} state
 * @returns {boolean}
 */
function fillSlot(slot, parentPiece, biome, spec, rng, pieces, crossEdges, placed, state) {
  // 1. Filter catalog candidates
  let candidates = findCandidates(slot, parentPiece, biome, state.budget);

  // Fallback: if no candidates match the slot's tags at current budget,
  // try any F-cost piece with an inbound port. Better to degrade the tag
  // requirement than fail entirely.
  if (candidates.length === 0 && parentPiece) {
    candidates = biome.catalog.filter(p => {
      const cost = gradeToNumber(p.cost ?? "F");
      return cost <= 1 && p.ports?.some(port => port.direction === "inbound");
    });
  }
  if (candidates.length === 0) return false;

  // 2. Pick a piece (weighted random — prefer lower cost to conserve budget)
  const chosen = pickCandidate(candidates, rng);

  // 3. Instantiate
  const prefix = slot.id.replace(/^slot-\d+-/, ""); // clean prefix
  const instance = instantiate(chosen, prefix);

  // 4. Apply createGameNode to each node
  const gameNodes = instance.nodes.map(n => createGameNode(n));

  // 5. Build prefixed ports
  const prefixedPorts = (chosen.ports ?? []).map(p => ({
    ...p,
    nodeId: `${prefix}/${p.nodeId}`,
  }));

  const inboundPort = prefixedPorts.find(p => p.direction === "inbound");
  const outboundPorts = prefixedPorts.filter(p => p.direction === "outbound");

  const piece = {
    slot,
    pieceDef: chosen,
    prefix,
    nodes: gameNodes,
    edges: instance.edges,
    triggers: instance.triggers,
    ports: prefixedPorts,
    inboundNodeId: inboundPort?.nodeId ?? null,
    outboundNodeIds: outboundPorts.map(p => p.nodeId),
  };

  // 6. Spend budget
  state.budget -= gradeToNumber(chosen.cost ?? "F");
  pieces.push(piece);
  placed.set(slot.id, piece);

  // 7. Wire to parent — if parent has no outbound port left, skip this piece
  // entirely to prevent orphan nodes.
  if (parentPiece && piece.inboundNodeId) {
    const parentOutPort = consumeOutboundPort(parentPiece);
    if (parentOutPort) {
      crossEdges.push([parentOutPort, piece.inboundNodeId]);
    } else {
      // Can't wire — remove piece to prevent orphan. Refund budget.
      pieces.pop();
      state.budget += gradeToNumber(chosen.cost ?? "F");
      return true; // continue with siblings (they might not need this parent's ports)
    }
  }

  // 8. Fill children
  let outPortIdx = 0;
  for (const child of slot.children) {
    if (!fillSlot(child, piece, biome, spec, rng, pieces, crossEdges, placed, state)) {
      return false;
    }
  }

  // 9. Opportunistically fill up to 1 extra outbound port with filler/treasure.
  // Capped to avoid network bloat from multi-node filler pieces.
  let extrasAdded = 0;
  while (piece.outboundNodeIds.length > 0 && state.budget >= 1 && extrasAdded < 1) {
    const fillerSlot = {
      id: `${slot.id}-extra-${piece.outboundNodeIds.length}`,
      tags: [rng() < 0.6 ? "filler" : "treasure"],
      depth: slot.depth + 1,
      children: [],
      parentId: slot.id,
      isLeaf: true,
      dependency: null,
    };
    const fillerCandidates = findCandidates(fillerSlot, piece, biome, state.budget);
    if (fillerCandidates.length === 0) break;

    const fillerChosen = pickCandidate(fillerCandidates, rng);
    const fillerPrefix = fillerSlot.id.replace(/^slot-\d+-/, "");
    const fillerInstance = instantiate(fillerChosen, fillerPrefix);
    const fillerNodes = fillerInstance.nodes.map(n => createGameNode(n));
    const fillerPorts = (fillerChosen.ports ?? []).map(p => ({
      ...p,
      nodeId: `${fillerPrefix}/${p.nodeId}`,
    }));
    const fillerInbound = fillerPorts.find(p => p.direction === "inbound");

    const fillerPiece = {
      slot: fillerSlot,
      pieceDef: fillerChosen,
      prefix: fillerPrefix,
      nodes: fillerNodes,
      edges: fillerInstance.edges,
      triggers: fillerInstance.triggers,
      ports: fillerPorts,
      inboundNodeId: fillerInbound?.nodeId ?? null,
      outboundNodeIds: fillerPorts.filter(p => p.direction === "outbound").map(p => p.nodeId),
    };

    // Only add the filler piece if we can actually wire it to the parent
    const parentOut = consumeOutboundPort(piece);
    if (!parentOut || !fillerPiece.inboundNodeId) break;

    state.budget -= gradeToNumber(fillerChosen.cost ?? "F");
    pieces.push(fillerPiece);
    crossEdges.push([parentOut, fillerPiece.inboundNodeId]);
    extrasAdded++;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Candidate selection
// ---------------------------------------------------------------------------

/**
 * Find catalog pieces that match a slot's requirements.
 * @param {SkeletonSlot} slot
 * @param {PlacedPiece|null} parentPiece
 * @param {BiomeDef} biome
 * @param {number} budget
 * @returns {SetPieceDef[]}
 */
function findCandidates(slot, parentPiece, biome, budget) {
  // Primary: piece must have ALL slot tags
  let candidates = biome.catalog.filter(p =>
    p.tags && slot.tags.every(t => p.tags.includes(t))
  );

  // Must have at least one inbound port (except entry which has no parent)
  if (parentPiece) {
    candidates = candidates.filter(p =>
      p.ports?.some(port => port.direction === "inbound")
    );
  }

  // Cost must fit remaining budget — but F-cost atomics are always allowed
  // as fallback (they're essentially free structural filler)
  candidates = candidates.filter(p => {
    const cost = gradeToNumber(p.cost ?? "F");
    return cost <= budget || cost <= 1; // F-cost (1) always allowed
  });

  // Compatibility: parent's outbound port wantsTags
  if (parentPiece) {
    const nextOut = parentPiece.outboundNodeIds[0];
    if (nextOut) {
      const parentPort = parentPiece.ports.find(
        p => p.nodeId === nextOut && p.direction === "outbound"
      );
      if (parentPort && parentPort.wantsTags.length > 0) {
        const compatible = candidates.filter(p =>
          p.tags?.some(t => parentPort.wantsTags.includes(t))
        );
        // Use compatible if non-empty, otherwise fall back to all candidates
        if (compatible.length > 0) candidates = compatible;
      }
    }
  }

  return candidates;
}

/**
 * Pick a candidate, weighted toward lower cost (conserve budget).
 * @param {SetPieceDef[]} candidates
 * @param {() => number} rng
 * @returns {SetPieceDef}
 */
function pickCandidate(candidates, rng) {
  if (candidates.length === 1) return candidates[0];

  // Weight: inverse of cost (cheaper = higher weight). This conserves budget
  // for more variety rather than spending it all on one expensive piece.
  const weights = candidates.map(c => 7 - gradeToNumber(c.cost ?? "F"));
  const total = weights.reduce((s, w) => s + w, 0);
  let roll = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

// ---------------------------------------------------------------------------
// Port management
// ---------------------------------------------------------------------------

/**
 * Consume (remove and return) the first outbound port node ID from a piece.
 * @param {PlacedPiece} piece
 * @returns {string|null}
 */
function consumeOutboundPort(piece) {
  if (piece.outboundNodeIds.length === 0) return null;
  return piece.outboundNodeIds.shift() ?? null;
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

// Use shared costBudget from budget.js (no local copy to get out of sync)
