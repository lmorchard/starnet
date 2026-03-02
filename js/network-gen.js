// @ts-check
// Procedural LAN generator — generic layer-processor engine.
// generateNetwork(seed, timeCost, moneyCost) → NETWORK-shaped object.
//
// Uses makeSeededRng() from js/rng.js — an independent instance that does NOT
// advance any named gameplay stream, so generation doesn't affect run randomness.
//
// Topology decisions (node types, grades, connectivity) live in biome bundles
// under js/biomes/. The engine iterates a biome's layer definitions and calls
// their behavior atoms; it contains no hardcoded node type strings.

import { parseGrade, shiftGrade, randomGrade } from "./grades.js";
import { applySetPiece } from "./set-pieces.js";
import { makeSeededRng, shuffleWith } from "./rng.js";
import { CORPORATE_BIOME } from "./biomes/corporate/index.js";

/** Pick a random element from an array. Only consumes rng when len > 1. */
function pick(rng, arr) {
  if (arr.length === 1) return arr[0];
  return arr[Math.floor(rng() * arr.length)];
}

// ── Budget tables ─────────────────────────────────────────────────────────────
// Difficulty parameters — these drive the behavior atoms in biome layers.
// They are engine concerns, not biome topology.

/** timeCost grade → ICE grade, network depth budget, gate count. */
const TIME_BUDGET = {
  F: { iceGrade: "F", depthBudget: 3, gateCount: 0 },
  D: { iceGrade: "D", depthBudget: 2, gateCount: 1 },
  C: { iceGrade: "C", depthBudget: 3, gateCount: 1 },
  B: { iceGrade: "B", depthBudget: 3, gateCount: 2 },
  A: { iceGrade: "A", depthBudget: 4, gateCount: 2 },
  S: { iceGrade: "S", depthBudget: 5, gateCount: 3 },
};

/**
 * moneyCost grade → starting hand composition (array of rarity strings).
 * Harder LANs have tougher node vulns, so the player needs more and better cards.
 */
const HAND_BUDGET = {
  F: ["common", "common", "uncommon", "uncommon", "uncommon", "rare"],
  D: ["common", "common", "uncommon", "uncommon", "uncommon", "rare"],
  C: ["common", "common", "uncommon", "uncommon", "uncommon", "rare", "rare"],
  B: ["common", "uncommon", "uncommon", "uncommon", "uncommon", "rare", "rare"],
  A: ["uncommon", "uncommon", "uncommon", "uncommon", "uncommon", "rare", "rare", "rare"],
  S: ["uncommon", "uncommon", "uncommon", "uncommon", "uncommon", "rare", "rare", "rare"],
};

/**
 * moneyCost grade → suggested starting cash.
 */
const CASH_BUDGET = {
  F: 1000,
  D: 1000,
  C: 1250,
  B: 1500,
  A: 2000,
  S: 2500,
};

/** moneyCost grade → grade range for critical path nodes, target depth. */
const MONEY_BUDGET = {
  F: { pathGradeMin: "F", pathGradeMax: "D", targetDepth: 1 },
  D: { pathGradeMin: "F", pathGradeMax: "C", targetDepth: 1 },
  C: { pathGradeMin: "D", pathGradeMax: "B", targetDepth: 2 },
  B: { pathGradeMin: "C", pathGradeMax: "A", targetDepth: 3 },
  A: { pathGradeMin: "B", pathGradeMax: "S", targetDepth: 3 },
  S: { pathGradeMin: "A", pathGradeMax: "S", targetDepth: 4 },
};

// ── Layout ────────────────────────────────────────────────────────────────────

const LAYOUT_CENTER_X = 400;
const LAYOUT_LAYER_HEIGHT = 140;
const LAYOUT_NODE_SPACING = 200;
const LAYOUT_DEPTH_OFFSET_Y = 50;

/** Compute x,y positions for a set of nodes, grouped by depth layer. */
function assignPositions(nodes) {
  /** @type {Map<number, string[]>} depth → nodeIds */
  const layers = new Map();
  for (const node of nodes) {
    const d = node._depth ?? 0;
    if (!layers.has(d)) layers.set(d, []);
    layers.get(d).push(node.id);
  }

  /** @type {Map<string, {x:number, y:number}>} */
  const positions = new Map();
  for (const [depth, ids] of layers) {
    const y = LAYOUT_DEPTH_OFFSET_Y + depth * LAYOUT_LAYER_HEIGHT;
    const totalWidth = (ids.length - 1) * LAYOUT_NODE_SPACING;
    ids.forEach((id, i) => {
      positions.set(id, {
        x: LAYOUT_CENTER_X - totalWidth / 2 + i * LAYOUT_NODE_SPACING,
        y,
      });
    });
  }
  return positions;
}

// ── Grade resolver ────────────────────────────────────────────────────────────

/**
 * Resolve a grade for a node based on its gradeRole and the current budget context.
 * @param {string} gradeRole
 * @param {string} type
 * @param {{ pathGradeMin: string, pathGradeMax: string, rng: () => number, nodeRules: object }} ctx
 * @returns {string}
 */
function resolveGrade(gradeRole, type, ctx) {
  const { pathGradeMin, pathGradeMax, rng, nodeRules } = ctx;
  if (gradeRole === "fixed")                       return /** @type {any} */ (nodeRules[type])?.fixedGrade ?? "D";
  if (gradeRole === "entry" || gradeRole === "soft") return shiftGrade(pathGradeMin, -1);
  if (gradeRole === "path")                        return randomGrade(rng, pathGradeMin, pathGradeMax);
  if (gradeRole === "hard")                        return pathGradeMax;
  if (gradeRole === "above-min")                   return shiftGrade(pathGradeMin, 1);
  return randomGrade(rng, pathGradeMin, pathGradeMax);
}

// ── Generator ─────────────────────────────────────────────────────────────────

/**
 * Generate a NETWORK-shaped object from seed + difficulty parameters.
 *
 * @param {string} seed
 * @param {string} timeCost  - grade letter S/A/B/C/D/F
 * @param {string} moneyCost - grade letter S/A/B/C/D/F
 * @param {{ forcePieces?: string[], biome?: object }} [options]
 * @returns {object} NETWORK-compatible object
 */
export function generateNetwork(seed, timeCost, moneyCost, options = {}) {
  const tc = parseGrade(timeCost);
  const mc = parseGrade(moneyCost);
  if (!tc) throw new Error(`generateNetwork: invalid timeCost "${timeCost}"`);
  if (!mc) throw new Error(`generateNetwork: invalid moneyCost "${moneyCost}"`);

  const forcePieces = options.forcePieces ?? [];
  const biome = options.biome ?? CORPORATE_BIOME;

  const MAX_ATTEMPTS = 10;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = makeSeededRng(`${seed}-network-${attempt}`);
    const candidate = buildNetwork(rng, tc, mc, forcePieces, biome);
    const failure = validate(candidate, biome);
    if (!failure) return candidate;
    if (attempt === MAX_ATTEMPTS - 1) {
      throw new Error(`generateNetwork: failed after ${MAX_ATTEMPTS} attempts. Last failure: ${failure}`);
    }
  }
  throw new Error("generateNetwork: unexpected exit");
}

/** Build one candidate network by iterating biome layers. May produce an invalid result. */
function buildNetwork(rng, tc, mc, forcePieces = [], biome) {
  const time  = TIME_BUDGET[tc];
  const money = MONEY_BUDGET[mc];
  const { pathGradeMin, pathGradeMax } = money;
  const gradeCtx = { pathGradeMin, pathGradeMax, rng, nodeRules: biome.nodeRules };

  // Label pools — one shuffled copy per type, preserving NODE_RULES key order
  // (order matches original LABEL_POOLS to keep snapshot-stable rng sequence)
  /** @type {Record<string, string[]>} */
  const labelPools = {};
  for (const [type, rule] of Object.entries(biome.nodeRules)) {
    if (/** @type {any} */ (rule).labels?.length) {
      labelPools[type] = [.../** @type {any} */ (rule).labels];
      shuffleWith(rng, labelPools[type]);
    }
  }
  function nextLabel(type) {
    return labelPools[type]?.length ? labelPools[type].pop() : `${type.toUpperCase()}-X`;
  }

  /** @type {Array<{id:string, type:string, label:string, grade:string, _depth:number}>} */
  const nodes = [];
  /** @type {Array<{source:string, target:string}>} */
  const edges = [];
  let nodeSeq = 0;
  function makeId(type) { return `${type}-${++nodeSeq}`; }
  function addNode(type, grade, depth) {
    const id = makeId(type);
    nodes.push({ id, type, label: nextLabel(type), grade, _depth: depth });
    return id;
  }
  function addEdge(source, target) { edges.push({ source, target }); }

  // spawnedByRole tracks node IDs by role name for cross-layer references
  /** @type {Record<string, string[]>} */
  const spawnedByRole = {};

  for (const layer of biome.layers) {
    const count = typeof layer.count === "function"
      ? layer.count({ tc: time, mc: money, state: spawnedByRole })
      : (layer.count ?? 1);
    if (count <= 0) continue;

    const type  = biome.roles[layer.role];
    const depth = typeof layer.depth === "function"
      ? layer.depth({ tc: time, mc: money })
      : layer.depth;

    for (let i = 0; i < count; i++) {
      const grade = resolveGrade(layer.gradeRole, type, gradeCtx);
      const id    = addNode(type, grade, depth);
      (spawnedByRole[layer.role] ??= []).push(id);

      // Reverse chain: first node of alsoConnectFrom role → this node (no rng)
      if (layer.alsoConnectFrom) {
        const src = spawnedByRole[layer.alsoConnectFrom]?.[0];
        if (src) addEdge(src, id);
      }

      // Forward connection from parent: parent role → this node
      // pick() only consumes rng when there are multiple candidates
      if (layer.connectTo) {
        const targetRole = typeof layer.connectTo === "function"
          ? layer.connectTo({ tc: time, mc: money, state: spawnedByRole })
          : layer.connectTo;
        const targets = spawnedByRole[targetRole] ?? [];
        if (targets.length) addEdge(pick(rng, targets), id);
      }

      // Outgoing connection: this node → a node in the target role (no rng)
      if (layer.connectsTo) {
        const targets = spawnedByRole[layer.connectsTo] ?? [];
        if (targets.length) addEdge(id, pick(rng, targets));
      }
    }

    // Forward chain: first node of this layer → first node of alsoConnectTo role (no rng)
    // Fires after all nodes in the layer spawn so the edge appears after layer's connectTo edges
    if (layer.alsoConnectTo) {
      const src  = (spawnedByRole[layer.role] ?? [])[0];
      const dest = (spawnedByRole[layer.alsoConnectTo] ?? [])[0];
      if (src && dest) addEdge(src, dest);
    }
  }

  // Set pieces — engine iterates biome's registry, calls eligible() and probability
  for (const [pieceId, piece] of Object.entries(biome.setPieces ?? {})) {
    const forced  = forcePieces.includes(pieceId);
    const eligible = forced || (typeof /** @type {any} */ (piece).eligible === "function"
      ? /** @type {any} */ (piece).eligible({ mc, state: spawnedByRole })
      : true);
    if (eligible && (forced || rng() < (/** @type {any} */ (piece).probability ?? 1))) {
      const baseGrade = resolveGrade("path", biome.roles.routing, gradeCtx);
      applySetPiece(piece, { nodes, edges }, rng, baseGrade, nextLabel, makeId);
    }
  }

  // Assign x,y positions
  const positions = assignPositions(nodes);
  const finalNodes = nodes.map(({ id, type, label, grade, _depth }) => {
    const pos = positions.get(id) ?? { x: 400, y: 400 };
    void _depth;
    return { id, type, label, grade, x: pos.x, y: pos.y };
  });

  return {
    nodes: finalNodes,
    edges,
    startNode:     spawnedByRole.gateway[0],
    startCash:     CASH_BUDGET[mc],
    startHandSpec: HAND_BUDGET[mc],
    ice: {
      grade:     time.iceGrade,
      startNode: spawnedByRole.monitor[0],
    },
  };
}

// ── Validators ────────────────────────────────────────────────────────────────

/** Run all biome validators. Returns null on pass, or a failure description. */
function validate(network, biome) {
  for (const predicate of biome.validators) {
    const result = predicate(network, biome);
    if (result) return result;
  }
  return null;
}
