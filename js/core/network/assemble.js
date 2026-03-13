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

  for (const piece of pieces) {
    allNodes.push(...piece.nodes);
    allEdges.push(...piece.edges);
    allTriggers.push(...piece.triggers);
  }

  // Add cross-piece edges
  allEdges.push(...crossEdges);

  // 2. Grade scaling — shift all node grades based on network spec
  const modifier = gradeModifier(spec);
  if (modifier !== 0) {
    for (const node of allNodes) {
      if (node.attributes?.grade) {
        const gradeIdx = GRADE_INDEX[node.attributes.grade] ?? 0;
        node.attributes.grade = shiftGrade(node.attributes.grade, modifier);
      }
    }
  }

  // 3. ICE placement
  let iceConfig = null;
  if (gradeToNumber(spec.threat) >= 4) { // B or better
    const monitorNode = allNodes.find(n => n.type === "security-monitor");
    if (monitorNode) {
      iceConfig = {
        startNode: monitorNode.id,
        grade: spec.threat,
      };
    }
  }

  // 4. Recommended starting hand — collect vuln types from shallow nodes.
  // Since vulns aren't assigned yet (initGame does that), recommend common
  // vuln types that are likely to appear at the network's grade level.
  const recommendedHand = computeRecommendedHand(spec);

  // 5. Derive moneyCost for backward compat (avg of threat + complexity)
  const moneyCostNum = Math.round((gradeToNumber(spec.threat) + gradeToNumber(spec.complexity)) / 2);
  const moneyCost = ["F", "D", "C", "B", "A", "S"][Math.max(0, Math.min(5, moneyCostNum - 1))];

  // 6. Mission target — if spec requested one, find the matching node
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
      startHand: recommendedHand,
      moneyCost,
      ice: iceConfig,
      missionTarget,
    },
  };
}

// ---------------------------------------------------------------------------
// Recommended hand
// ---------------------------------------------------------------------------

/** Common vulnerability types that appear at each grade tier. */
const COMMON_VULNS_BY_GRADE = {
  F: ["weak-auth", "snmp-public", "open-telnet", "buffer-overflow"],
  D: ["weak-auth", "snmp-public", "open-telnet", "buffer-overflow", "unpatched-ssh"],
  C: ["unpatched-ssh", "buffer-overflow", "race-condition", "deserialization"],
  B: ["race-condition", "deserialization", "side-channel", "kernel-exploit"],
  A: ["side-channel", "kernel-exploit", "path-traversal", "stale-firmware"],
  S: ["kernel-exploit", "path-traversal", "side-channel"],
};

/**
 * Compute a recommended starting hand based on expected vulnerability types
 * for the network's grade range.
 * @param {NetworkSpec} spec
 * @returns {string[]} - rarity spec for generateStartingHand()
 */
function computeRecommendedHand(spec) {
  // Use the same rarity-based hand spec that hand-crafted networks use.
  // Higher budget = better starting cards.
  const grade = gradeToNumber(spec.wealth);
  if (grade >= 5) return ["uncommon", "uncommon", "uncommon", "rare", "rare"];
  if (grade >= 4) return ["common", "uncommon", "uncommon", "uncommon", "rare"];
  if (grade >= 3) return ["common", "common", "uncommon", "uncommon"];
  return ["common", "common", "common", "uncommon"];
}
