// @ts-check
/**
 * Assembly (Pass 3) — collects filled pieces into a complete network output,
 * applies grade scaling, and produces the meta object.
 *
 * Vulnerability and macguffin assignment are left to initGame() (existing
 * pipeline). The assembly focuses on structural output + meta.
 */

/** @typedef {import('./set-pieces.js').NetworkSpec} NetworkSpec */
/** @typedef {import('./set-pieces.js').BiomeDef} BiomeDef */
/** @typedef {import('./slot-filler.js').PlacedPiece} PlacedPiece */
/** @typedef {import('../node-graph/types.js').NodeDef} NodeDef */
/** @typedef {import('../node-graph/types.js').TriggerDef} TriggerDef */

import { gradeModifier, startCash, gradeToNumber, shiftGrade, GRADE_INDEX } from "./budget.js";
import { NODE_GRADE_BASELINE, DEFAULT_NODE_GRADE } from "../balance.js";

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

/**
 * Assemble filled pieces into a complete network output.
 *
 * @param {PlacedPiece[]} pieces
 * @param {[string, string][]} crossEdges
 * @param {NetworkSpec} spec
 * @param {BiomeDef} biome
 * @param {string} seed
 * @returns {{ graphDef: { nodes: NodeDef[], edges: [string, string][], triggers: TriggerDef[] }, meta: object }}
 */
export function assembleNetwork(pieces, crossEdges, spec, biome, seed) {
  // 1. Collect all nodes, edges, triggers
  /** @type {NodeDef[]} */
  const allNodes = [];
  /** @type {[string, string][]} */
  const allEdges = [];
  /** @type {TriggerDef[]} */
  const allTriggers = [];

  // 1a. Grade assignment — baseline by node type, then the per-piece (wing) or global offset.
  //     A grade the piece declared always wins; the baseline only fills a missing one.
  //
  //     Runs BEFORE nodes are collected, and assigns a NEW attributes object rather than
  //     mutating: instantiate() shallow-spreads nodes, so an instance's `attributes` is the
  //     same object as the module-level piece def's. An in-place write leaks into the def and
  //     every later network built in this process inherits it (a census builds 50 in one).
  const globalModifier = gradeModifier(spec);
  for (const piece of pieces) {
    // Wing pieces have gradeOffset set; backbone/flat pieces use global modifier
    const rawOffset = piece.gradeOffset ?? globalModifier;
    piece.nodes = piece.nodes.map((node) => {
      if (!node.traits?.includes("graded")) return node;
      const declared = node.attributes?.grade;
      // Declared grades keep the historical full-strength offset (authored pieces rely on it).
      // A baseline-derived grade gets a COMPRESSED offset: the baseline already spans F..A, and
      // the raw offsets run -2..+3 (wing offsets come from sub-biome base grades, independent of
      // the LAN spec), so applying them at full strength clamps the whole range to F or S and
      // destroys the variety this baseline exists to create. Spec difficulty still scales
      // strongly through node *composition* — hard specs place cryptovaults and firewalls far
      // more often.
      const offset = declared ? rawOffset : Math.max(-1, Math.min(1, rawOffset));
      const base = declared ?? NODE_GRADE_BASELINE[node.type] ?? DEFAULT_NODE_GRADE;
      const grade = offset === 0 ? base : shiftGrade(base, offset);
      return { ...node, attributes: { ...node.attributes, grade } };
    });
  }

  for (const piece of pieces) {
    allNodes.push(...piece.nodes);
    allEdges.push(...piece.edges);
    allTriggers.push(...piece.triggers);
  }

  // Add cross-piece edges
  allEdges.push(...crossEdges);

  // 3. ICE placement — one roaming ICE per security-monitor (cap 3), threat >= B.
  /** @type {{ instances: { startNode: string, grade: import('../types.js').Grade }[] } | null} */
  let iceConfig = null;
  if (gradeToNumber(spec.threat) >= 4) { // B or better
    const monitors = allNodes.filter(n => n.type === "security-monitor").slice(0, 3); // cap 3 — TEMP swarm-guard (#136)
    if (monitors.length) {
      const grade = /** @type {import('../types.js').Grade} */ (spec.threat);
      iceConfig = { instances: monitors.map(m => ({ startNode: m.id, grade })) };
    }
  }

  // 4. Derive moneyCost for backward compat (avg of threat + complexity)
  const moneyCostNum = Math.round((gradeToNumber(spec.threat) + gradeToNumber(spec.complexity)) / 2);
  const moneyCost = ["F", "D", "C", "B", "A", "S"][Math.max(0, Math.min(5, moneyCostNum - 1))];

  // 5. Mission target — if spec requested one, find the matching node
  let missionTarget = null;
  if (spec.missionTarget) {
    // Find a piece matching the requested tags at the right depth
    const targetPiece = pieces.find(p => {
      if (!p.pieceDef.tags) return false;
      return spec.missionTarget.tags.every(t => p.pieceDef.tags.includes(t));
    });
    if (targetPiece) {
      // Pick the first lootable node in the piece
      const lootNode = targetPiece.nodes.find(n =>
        n.type === "fileserver" || n.type === "cryptovault" || n.type === "workstation"
      );
      if (lootNode) missionTarget = lootNode.id;
    }
  }

  return {
    graphDef: {
      nodes: allNodes,
      edges: allEdges,
      triggers: allTriggers,
    },
    meta: {
      name: `${biome.id}-gen-${seed}`,
      networkType: "generated",
      biome: biome.id,
      seed,
      spec,
      startNode: "entry/gateway",
      startCash: startCash(spec.wealth),
      moneyCost,
      ice: iceConfig,
      missionTarget,
    },
  };
}
