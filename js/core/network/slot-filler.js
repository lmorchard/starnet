// @ts-check
/**
 * Slot filler (Pass 2) — walks the skeleton tree and fills each slot with
 * a concrete set-piece from the biome catalog.
 *
 * For each slot: filter catalog by tags + budget + port compatibility,
 * pick a piece, instantiate it, wire to parent.
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
 * @property {NodeDef[]} nodes - nodes from the instantiated set-piece
 * @property {[string, string][]} edges - internal edges (prefixed)
 * @property {TriggerDef[]} triggers
 * @property {Port[]} ports - prefixed ports
 * @property {string|null} inboundNodeId - prefixed inbound port node ID
 * @property {string[]} outboundNodeIds - prefixed outbound port node IDs (unconsumed)
 */

/**
 * A deferred scatter placement — scattered nodes waiting for pass 2.
 * @typedef {Object} ScatterObligation
 * @property {string} prefix - parent piece prefix (shared with core)
 * @property {NodeDef[]} scatteredNodes - instantiated scattered nodes
 * @property {SetPieceDef} pieceDef - original piece definition
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
 * @param {Object} [opts]
 * @param {Set<string>|null} [opts.piecePalette] - restrict to these piece IDs (null = full catalog)
 * @param {string[]} [opts.requiredPieceIds] - piece IDs that must be placed
 * @param {number} [opts.budgetOverride] - override computed budget
 * @returns {{ pieces: PlacedPiece[], crossEdges: [string, string][], ok: boolean }}
 */
export function fillSkeleton(skeleton, biome, spec, rng, opts = {}) {
  const budgetRemaining = opts.budgetOverride ?? costBudget(spec);
  const piecePalette = opts.piecePalette ?? null;
  const requiredPieceIds = opts.requiredPieceIds ?? [];
  /** @type {PlacedPiece[]} */
  const pieces = [];
  /** @type {[string, string][]} */
  const crossEdges = [];
  /** @type {Map<string, PlacedPiece>} slotId → placed piece */
  const placed = new Map();
  /** @type {Set<string>} Track which piece IDs have been used for diversity */
  const usedPieceIds = new Set();
  /** @type {ScatterObligation[]} Deferred scattered nodes for pass 2 */
  const scatterObligations = [];

  // Pre-assign required pieces to compatible slots
  /** @type {Map<string, SetPieceDef>} slotId → required piece */
  const preAssigned = preAssignRequired(requiredPieceIds, skeleton, biome);

  // Pass 1: fill all skeleton slots
  const ok = fillSlot(skeleton, null, biome, spec, rng, pieces, crossEdges, placed, { budget: budgetRemaining }, usedPieceIds, scatterObligations, piecePalette, preAssigned);
  if (!ok) return { pieces, crossEdges, ok: false };

  // Pass 2: place scattered nodes in gate-free slots
  if (scatterObligations.length > 0) {
    const scatterOk = placeScatteredNodes(scatterObligations, pieces, skeleton, crossEdges, placed);
    if (!scatterOk) return { pieces, crossEdges, ok: false };
  }

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
 * @param {Set<string>} usedPieceIds
 * @param {ScatterObligation[]} scatterObligations
 * @param {Set<string>|null} piecePalette
 * @param {Map<string, SetPieceDef>} preAssigned
 * @returns {boolean}
 */
function fillSlot(slot, parentPiece, biome, spec, rng, pieces, crossEdges, placed, state, usedPieceIds, scatterObligations, piecePalette, preAssigned) {
  /** @type {SetPieceDef} */
  let chosen;

  // Check for pre-assigned required piece
  if (preAssigned.has(slot.id)) {
    chosen = /** @type {SetPieceDef} */ (preAssigned.get(slot.id));
  } else {
    // 1. Filter catalog candidates
    let candidates = findCandidates(slot, parentPiece, biome, state.budget, piecePalette);

    // Fallback: if no candidates match the slot's tags at current budget,
    // try any F-cost piece with an inbound port. Better to degrade the tag
    // requirement than fail entirely.
    if (candidates.length === 0 && parentPiece) {
      candidates = filterByPalette(biome.catalog, piecePalette).filter(p => {
        const cost = gradeToNumber(p.cost ?? "F");
        return cost <= 1 && p.ports?.some(port => port.direction === "inbound");
      });
    }
    if (candidates.length === 0) return false;

    // 2. Pick a piece (weighted random — prefer lower cost + diversity)
    chosen = pickCandidate(candidates, rng, usedPieceIds);
  }

  // 3. Instantiate
  const prefix = slot.id.replace(/^slot-\d+-/, ""); // clean prefix
  const instance = instantiate(chosen, prefix);

  // 4. Separate core nodes from scattered nodes
  const scatteredIds = new Set(
    chosen.nodes.filter(n => n.scatter).map(n => `${prefix}/${n.id}`)
  );
  let gameNodes = instance.nodes;
  let gameEdges = instance.edges;

  if (scatteredIds.size > 0) {
    const scatteredNodes = gameNodes.filter(n => scatteredIds.has(n.id));
    gameNodes = gameNodes.filter(n => !scatteredIds.has(n.id));
    // Filter edges — drop any edge referencing a scattered node
    gameEdges = gameEdges.filter(([a, b]) => !scatteredIds.has(a) && !scatteredIds.has(b));
    // Record scatter obligation for pass 2
    scatterObligations.push({ prefix, scatteredNodes, pieceDef: chosen });
  }

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
    edges: gameEdges,
    triggers: instance.triggers,
    ports: prefixedPorts,
    inboundNodeId: inboundPort?.nodeId ?? null,
    outboundNodeIds: outboundPorts.map(p => p.nodeId),
  };

  // 6. Spend budget, track diversity
  state.budget -= gradeToNumber(chosen.cost ?? "F");
  pieces.push(piece);
  placed.set(slot.id, piece);
  usedPieceIds.add(chosen.id);

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
      // Also remove any scatter obligation for this piece
      const oblIdx = scatterObligations.findIndex(o => o.prefix === prefix);
      if (oblIdx !== -1) scatterObligations.splice(oblIdx, 1);
      return true; // continue with siblings (they might not need this parent's ports)
    }
  }

  // 8. Fill children
  for (const child of slot.children) {
    if (!fillSlot(child, piece, biome, spec, rng, pieces, crossEdges, placed, state, usedPieceIds, scatterObligations, piecePalette, preAssigned)) {
      return false;
    }
  }

  // 9. Opportunistically fill extra outbound ports with filler/treasure.
  while (piece.outboundNodeIds.length > 0 && state.budget >= 1) {
    const fillerSlot = {
      id: `${slot.id}-extra-${piece.outboundNodeIds.length}`,
      tags: [rng() < 0.6 ? "filler" : "treasure"],
      depth: slot.depth + 1,
      children: [],
      parentId: slot.id,
      isLeaf: true,
      dependency: null,
    };
    let fillerCandidates = findCandidates(fillerSlot, piece, biome, state.budget, piecePalette);
    // Exclude scattered pieces from opportunistic filler — they need the
    // main fill path's scatter separation logic
    fillerCandidates = fillerCandidates.filter(p => !p.nodes.some(n => n.scatter));
    if (fillerCandidates.length === 0) break;

    const fillerChosen = pickCandidate(fillerCandidates, rng, usedPieceIds);
    const fillerPrefix = fillerSlot.id.replace(/^slot-\d+-/, "");
    const fillerInstance = instantiate(fillerChosen, fillerPrefix);
    const fillerNodes = fillerInstance.nodes;
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
  }

  return true;
}

// ---------------------------------------------------------------------------
// Candidate selection
// ---------------------------------------------------------------------------

/**
 * Filter a catalog by a piece palette (set of allowed IDs).
 * @param {SetPieceDef[]} catalog
 * @param {Set<string>|null} palette - null means use all
 * @returns {SetPieceDef[]}
 */
function filterByPalette(catalog, palette) {
  if (!palette) return catalog;
  return catalog.filter(p => palette.has(p.id));
}

/**
 * Find catalog pieces that match a slot's requirements.
 * @param {SkeletonSlot} slot
 * @param {PlacedPiece|null} parentPiece
 * @param {BiomeDef} biome
 * @param {number} budget
 * @param {Set<string>|null} [piecePalette] - restrict to these piece IDs
 * @returns {SetPieceDef[]}
 */
function findCandidates(slot, parentPiece, biome, budget, piecePalette = null) {
  const pool = filterByPalette(biome.catalog, piecePalette);
  // Primary: piece must have ALL slot tags
  let candidates = pool.filter(p =>
    p.tags && slot.tags.every(t => p.tags.includes(t))
  );

  // Must have at least one inbound port (except entry which has no parent)
  if (parentPiece) {
    candidates = candidates.filter(p =>
      p.ports?.some(port => port.direction === "inbound")
    );
  }

  // Respect minDepth — don't place pieces with auto-start timers near entry
  candidates = candidates.filter(p =>
    !p.minDepth || slot.depth >= p.minDepth
  );

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
 * Pick a candidate, weighted toward lower cost and diversity.
 * @param {SetPieceDef[]} candidates
 * @param {() => number} rng
 * @param {Set<string>} [usedPieceIds] - IDs of already-placed pieces (penalized)
 * @returns {SetPieceDef}
 */
function pickCandidate(candidates, rng, usedPieceIds) {
  if (candidates.length === 1) return candidates[0];

  // Weight: inverse of cost × diversity bonus. Already-used pieces get 1/3 weight.
  const weights = candidates.map(c => {
    const costWeight = 7 - gradeToNumber(c.cost ?? "F");
    const diversityMult = (usedPieceIds && usedPieceIds.has(c.id)) ? 0.33 : 1;
    return Math.max(0.1, costWeight * diversityMult);
  });
  const total = weights.reduce((s, w) => s + w, 0);
  let roll = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

// ---------------------------------------------------------------------------
// Required piece pre-assignment
// ---------------------------------------------------------------------------

/**
 * Pre-assign required pieces to compatible skeleton slots.
 * Finds the best-fit slot for each required piece based on tag overlap.
 * @param {string[]} requiredPieceIds
 * @param {SkeletonSlot} skeleton
 * @param {BiomeDef} biome
 * @returns {Map<string, SetPieceDef>} slotId → piece
 */
function preAssignRequired(requiredPieceIds, skeleton, biome) {
  /** @type {Map<string, SetPieceDef>} */
  const assignments = new Map();
  if (requiredPieceIds.length === 0) return assignments;

  const catalogMap = new Map(biome.catalog.map(p => [p.id, p]));
  const allSlots = collectSlots(skeleton);
  const usedSlots = new Set();

  for (const pieceId of requiredPieceIds) {
    const piece = catalogMap.get(pieceId);
    if (!piece) continue;

    // Find best slot: prefer slots where tags overlap, skip entry/spine
    let bestSlot = null;
    let bestScore = -1;
    for (const slot of allSlots) {
      if (usedSlots.has(slot.id)) continue;
      if (slot.tags.includes("entry") || slot.tags.includes("spine")) continue;
      // Score by tag overlap
      const overlap = slot.tags.filter(t => piece.tags?.includes(t)).length;
      if (overlap > bestScore) {
        bestScore = overlap;
        bestSlot = slot;
      }
    }
    if (bestSlot) {
      assignments.set(bestSlot.id, piece);
      usedSlots.add(bestSlot.id);
    }
  }
  return assignments;
}

/**
 * Collect all slots from a skeleton tree into a flat array.
 * @param {SkeletonSlot} root
 * @returns {SkeletonSlot[]}
 */
function collectSlots(root) {
  /** @type {SkeletonSlot[]} */
  const result = [];
  /** @param {SkeletonSlot} slot */
  function walk(slot) {
    result.push(slot);
    for (const child of slot.children) walk(child);
  }
  walk(root);
  return result;
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
// Scatter placement (pass 2)
// ---------------------------------------------------------------------------

/**
 * Compute which skeleton slots are reachable from the entry without passing
 * through any placed piece that contains a puzzle gate (concealed nodes or
 * scattered nodes that create unsolvable dependencies).
 *
 * Regular gate-tagged pieces (routers, firewalls) are NOT blocking — the
 * player can always hack through them. Only puzzle gates that require solving
 * a distributed puzzle (concealed vaults, scattered lock cores) block scatter
 * placement.
 *
 * @param {Map<string, PlacedPiece>} placed - slotId → piece
 * @param {SkeletonSlot} skeleton - root of skeleton tree
 * @returns {Set<string>} gate-free slot IDs
 */
export function computeGateFreeSlots(placed, skeleton) {
  /** @type {Set<string>} */
  const gateFree = new Set();

  /**
   * @param {SkeletonSlot} slot
   * @param {boolean} blocked - whether an ancestor was a puzzle gate
   */
  function walk(slot, blocked) {
    const piece = placed.get(slot.id);
    // A piece is a puzzle gate if it has concealed nodes (vault behind a lock)
    // or if it has scattered nodes (it IS a distributed puzzle core)
    const isPuzzleGate = piece?.pieceDef?.nodes?.some(
      n => n.attributes?.concealed || n.scatter
    ) ?? false;
    const nowBlocked = blocked || isPuzzleGate;

    if (!nowBlocked) {
      gateFree.add(slot.id);
    }

    for (const child of slot.children) {
      walk(child, nowBlocked);
    }
  }

  walk(skeleton, false);
  return gateFree;
}

/**
 * Place all deferred scattered nodes into gate-free slots.
 *
 * Strategy: first try unused outbound ports, then replace leaf filler nodes
 * (single workstation/fileserver pieces) with scattered nodes. Replacement
 * is safe because the scattered node's cost is already included in its parent
 * piece's budget.
 *
 * @param {ScatterObligation[]} obligations
 * @param {PlacedPiece[]} pieces
 * @param {SkeletonSlot} skeleton
 * @param {[string, string][]} crossEdges
 * @param {Map<string, PlacedPiece>} placed
 * @returns {boolean} true if all scattered nodes were placed
 */
function placeScatteredNodes(obligations, pieces, skeleton, crossEdges, placed) {
  const gateFreeSlots = computeGateFreeSlots(placed, skeleton);
  scatterPlaced.clear();

  for (const obligation of obligations) {
    for (const scatteredNode of obligation.scatteredNodes) {
      if (attachToFreePort(scatteredNode, pieces, gateFreeSlots, crossEdges)) continue;
      if (replaceLeafNode(scatteredNode, pieces, gateFreeSlots, crossEdges)) continue;
      return false; // couldn't place — generation should retry
    }
  }

  return true;
}

/** Try to attach a scattered node to an unused outbound port in a gate-free slot. */
function attachToFreePort(scatteredNode, pieces, gateFreeSlots, crossEdges) {
  for (const piece of pieces) {
    if (piece.outboundNodeIds.length === 0) continue;
    if (!gateFreeSlots.has(piece.slot.id)) continue;

    const outPort = consumeOutboundPort(piece);
    if (!outPort) continue;

    piece.nodes.push(scatteredNode);
    crossEdges.push([outPort, scatteredNode.id]);
    scatterPlaced.add(scatteredNode.id);
    return true;
  }
  return false;
}

/** Replaceable leaf types — cheap filler nodes that can be swapped for scattered nodes. */
const REPLACEABLE_TYPES = new Set(["workstation", "fileserver"]);

/** Track node IDs that were placed via scatter — can't replace these. */
const scatterPlaced = new Set();

/**
 * Replace a leaf filler node with a scattered node. The filler node is removed
 * and the scattered node takes its place in the edge graph.
 */
function replaceLeafNode(scatteredNode, pieces, gateFreeSlots, crossEdges) {
  for (const piece of pieces) {
    if (!gateFreeSlots.has(piece.slot.id)) continue;
    // Only replace single-node leaf pieces (atomics)
    if (piece.nodes.length !== 1) continue;
    const candidate = piece.nodes[0];
    if (!REPLACEABLE_TYPES.has(candidate.type)) continue;
    // Don't replace a node that was already placed via scatter
    if (scatterPlaced.has(candidate.id)) continue;
    // Don't replace pieces that are the scatter node's own parent
    if (piece.prefix === scatteredNode.id.split("/")[0]) continue;

    // Find the cross-edge that wires this piece into the network
    const inboundId = piece.inboundNodeId;
    const edgeIdx = crossEdges.findIndex(([, dst]) => dst === inboundId);
    if (edgeIdx === -1) continue;

    const [parentPort] = crossEdges[edgeIdx];

    // Replace: swap the filler node for the scattered node, rewire edge
    piece.nodes[0] = scatteredNode;
    crossEdges[edgeIdx] = [parentPort, scatteredNode.id];
    scatterPlaced.add(scatteredNode.id);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

// Use shared costBudget from budget.js (no local copy to get out of sync)
