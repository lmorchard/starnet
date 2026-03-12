// @ts-check
/**
 * Skeleton generator (Pass 1) — produces a tree of tag-slots representing
 * the abstract shape of a network, before any concrete set-pieces are chosen.
 *
 * The skeleton decides branching structure, tag assignment per slot, and
 * long-range dependency placement — all without knowing which concrete
 * set-pieces will fill each slot.
 */

/** @typedef {import('./set-pieces.js').NetworkSpec} NetworkSpec */
/** @typedef {import('./set-pieces.js').BiomeDef} BiomeDef */
/** @typedef {import('./set-pieces.js').SetPieceDef} SetPieceDef */

import { gradeToNumber, maxDepth, TAG_WEIGHTS, costBudget } from "./budget.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A slot in the skeleton tree — an abstract placeholder for a set-piece.
 * @typedef {Object} SkeletonSlot
 * @property {string} id - unique slot identifier
 * @property {string[]} tags - required tags for this slot
 * @property {number} depth - hop distance from entry
 * @property {SkeletonSlot[]} children - child slots
 * @property {string|null} parentId - parent slot ID
 * @property {boolean} isLeaf - no children expected
 * @property {{ role: string, ownerSlotId: string }|null} [dependency]
 */

// ---------------------------------------------------------------------------
// Tag coverage map
// ---------------------------------------------------------------------------

/**
 * Build a set of tag combinations that exist in the catalog. Used to ensure
 * the skeleton only assigns fillable tag combos.
 * @param {SetPieceDef[]} catalog
 * @returns {{ hasTags: (tags: string[]) => boolean, singleTags: Set<string> }}
 */
function buildTagCoverage(catalog) {
  /** @type {Set<string>} */
  const singleTags = new Set();
  /** @type {Set<string>} */
  const tagPairs = new Set();

  for (const piece of catalog) {
    if (!piece.tags) continue;
    for (const t of piece.tags) singleTags.add(t);
    // Index pairs for two-tag combos
    for (let i = 0; i < piece.tags.length; i++) {
      for (let j = i + 1; j < piece.tags.length; j++) {
        const pair = [piece.tags[i], piece.tags[j]].sort().join("+");
        tagPairs.add(pair);
      }
    }
  }

  return {
    singleTags,
    hasTags: (tags) => {
      if (tags.length === 0) return true;
      if (tags.length === 1) return singleTags.has(tags[0]);
      // For multi-tag, check if any catalog piece has ALL tags
      return catalog.some(p => p.tags && tags.every(t => p.tags.includes(t)));
    },
  };
}

// ---------------------------------------------------------------------------
// Weighted tag selection
// ---------------------------------------------------------------------------

/**
 * Pick a tag based on budget weights and RNG. Returns a single tag string.
 * Considers which tags the catalog can actually fill.
 * @param {NetworkSpec} spec
 * @param {() => number} rng
 * @param {{ hasTags: (tags: string[]) => boolean, singleTags: Set<string> }} coverage
 * @param {{ excludeTags?: Set<string> }} [opts]
 * @returns {string}
 */
function pickWeightedTag(spec, rng, coverage, opts = {}) {
  const exclude = opts.excludeTags ?? new Set();

  // Build weighted pool from all budget axes
  /** @type {Array<{ tag: string, weight: number }>} */
  const pool = [];
  for (const [axis, tagMap] of Object.entries(TAG_WEIGHTS)) {
    const axisValue = gradeToNumber(spec[axis] ?? "C");
    for (const [tag, baseWeight] of Object.entries(tagMap)) {
      if (exclude.has(tag)) continue;
      if (!coverage.singleTags.has(tag)) continue;
      // Weight = base × axis value. Higher axis grade = more weight for its tags.
      pool.push({ tag, weight: baseWeight * axisValue });
    }
  }

  if (pool.length === 0) return "filler"; // fallback

  const totalWeight = pool.reduce((sum, p) => sum + p.weight, 0);
  let roll = rng() * totalWeight;
  for (const p of pool) {
    roll -= p.weight;
    if (roll <= 0) return p.tag;
  }
  return pool[pool.length - 1].tag;
}

// ---------------------------------------------------------------------------
// Branching heuristic
// ---------------------------------------------------------------------------

/**
 * Decide how many branches to spawn at a given depth.
 * @param {NetworkSpec} spec
 * @param {number} depth
 * @param {number} maxD
 * @param {() => number} rng
 * @returns {number}
 */
function branchCount(spec, depth, maxD, rng) {
  // At shallow depths, more branches. At max depth, just 1 (leaf).
  if (depth >= maxD) return 0;
  if (depth === 0) return 1; // entry always has 1 child (first spine)

  // Base: 1-3 depending on budget magnitude and remaining depth
  const budget = gradeToNumber(spec.wealth) + gradeToNumber(spec.complexity);
  const remainingDepth = maxD - depth;

  if (remainingDepth <= 1) {
    // Near leaf: 1-2 branches
    return rng() < 0.5 ? 1 : 2;
  }

  // More budget = more branches
  if (budget >= 8) return rng() < 0.3 ? 3 : 2;
  if (budget >= 5) return rng() < 0.5 ? 2 : 1;
  return 1;
}

// ---------------------------------------------------------------------------
// Skeleton generator
// ---------------------------------------------------------------------------

let _slotCounter = 0;

/**
 * Generate a skeleton tree from a network spec and biome catalog.
 * @param {NetworkSpec} spec
 * @param {BiomeDef} biome
 * @param {() => number} rng
 * @returns {SkeletonSlot}
 */
export function generateSkeleton(spec, biome, rng) {
  _slotCounter = 0;
  const coverage = buildTagCoverage(biome.catalog);
  const maxD = maxDepth(spec.depth);

  // Slot budget: limit skeleton size to what the cost budget can fill.
  // Each slot costs ~2 points on average (mix of F=1 and C/D=2-3 pieces).
  const slotBudget = { remaining: Math.floor(costBudget(spec) / 2) };

  // Root: entry point
  const root = makeSlot("entry", ["entry"], 0, null);
  slotBudget.remaining--;

  // Depth 1: always a spine node
  const spine = makeSlot("spine-0", ["spine"], 1, root.id);
  root.children.push(spine);
  slotBudget.remaining--;

  // Build remaining depth levels
  buildBranches(spine, 1, maxD, spec, coverage, rng, slotBudget);

  // Ensure at least one treasure at a leaf
  ensureTreasureLeaf(root, coverage);

  return root;
}

/**
 * Recursively build branches from a parent slot.
 * @param {SkeletonSlot} parent
 * @param {number} depth
 * @param {number} maxD
 * @param {NetworkSpec} spec
 * @param {ReturnType<typeof buildTagCoverage>} coverage
 * @param {() => number} rng
 * @param {{ remaining: number }} slotBudget
 */
function buildBranches(parent, depth, maxD, spec, coverage, rng, slotBudget) {
  if (slotBudget.remaining <= 0) return;

  const numBranches = Math.min(branchCount(spec, depth, maxD, rng), slotBudget.remaining);

  for (let i = 0; i < numBranches; i++) {
    if (slotBudget.remaining <= 0) break;
    const nextDepth = depth + 1;
    const isLeaf = nextDepth >= maxD || slotBudget.remaining <= 1;

    // Pick tag for this branch
    let tag;
    if (isLeaf) {
      // Leaves prefer treasure or filler
      tag = rng() < 0.7 ? "treasure" : "filler";
    } else if (nextDepth === 2 && gradeToNumber(spec.threat) >= 3) {
      // Early-mid depth with threat: consider defense
      tag = rng() < 0.5 ? "defense" : pickWeightedTag(spec, rng, coverage);
    } else {
      tag = pickWeightedTag(spec, rng, coverage);
    }

    // Validate tag exists in catalog
    if (!coverage.singleTags.has(tag)) tag = "filler";

    const slot = makeSlot(`d${nextDepth}-${i}`, [tag], nextDepth, parent.id);
    slot.isLeaf = isLeaf;
    parent.children.push(slot);
    slotBudget.remaining--;

    if (!isLeaf) {
      buildBranches(slot, nextDepth, maxD, spec, coverage, rng, slotBudget);
    }
  }
}

/**
 * Walk the tree and ensure at least one leaf has the "treasure" tag.
 * If none do, change the deepest leaf to treasure.
 * @param {SkeletonSlot} root
 * @param {ReturnType<typeof buildTagCoverage>} coverage
 */
function ensureTreasureLeaf(root, coverage) {
  const leaves = collectLeaves(root);
  if (leaves.some(l => l.tags.includes("treasure"))) return;
  if (leaves.length === 0) return;

  // Find deepest leaf and make it treasure
  const deepest = leaves.reduce((a, b) => a.depth > b.depth ? a : b);
  deepest.tags = ["treasure"];
}

/**
 * Collect all leaf slots from a skeleton tree.
 * @param {SkeletonSlot} slot
 * @returns {SkeletonSlot[]}
 */
function collectLeaves(slot) {
  if (slot.children.length === 0) return [slot];
  return slot.children.flatMap(c => collectLeaves(c));
}

/**
 * Create a new skeleton slot.
 * @param {string} label
 * @param {string[]} tags
 * @param {number} depth
 * @param {string|null} parentId
 * @returns {SkeletonSlot}
 */
function makeSlot(label, tags, depth, parentId) {
  return {
    id: `slot-${_slotCounter++}-${label}`,
    tags,
    depth,
    children: [],
    parentId,
    isLeaf: false,
    dependency: null,
  };
}

// ---------------------------------------------------------------------------
// Debug helpers
// ---------------------------------------------------------------------------

/**
 * Pretty-print a skeleton tree for debugging.
 * @param {SkeletonSlot} slot
 * @param {number} [indent]
 * @returns {string}
 */
export function printSkeleton(slot, indent = 0) {
  const prefix = "  ".repeat(indent);
  const leaf = slot.isLeaf ? " (leaf)" : "";
  const dep = slot.dependency ? ` [dep: ${slot.dependency.role} from ${slot.dependency.ownerSlotId}]` : "";
  let out = `${prefix}${slot.id} [${slot.tags.join(",")}] depth=${slot.depth}${leaf}${dep}\n`;
  for (const child of slot.children) {
    out += printSkeleton(child, indent + 1);
  }
  return out;
}
