// @ts-check
/**
 * Top-level network generator — the single entry point for procedural
 * network generation. Orchestrates skeleton → fill → assemble → validate
 * with retry on failure.
 */

/** @typedef {import('./set-pieces.js').NetworkSpec} NetworkSpec */
/** @typedef {import('./set-pieces.js').BiomeDef} BiomeDef */

import { generateSkeleton, generateHierarchicalSkeleton } from "./skeleton.js";
import { fillSkeleton } from "./slot-filler.js";
import { assembleNetwork } from "./assemble.js";
import { validate } from "./validate.js";
import { makeSeededRng } from "../rng.js";
import { wingCount, hierarchicalBudget } from "./budget.js";

/**
 * Generate a procedural network from a spec and biome catalog.
 *
 * Same seed + same spec + same biome = identical output (deterministic).
 * Retries up to maxAttempts times with different RNG seeds on validation failure.
 *
 * @param {string} seed
 * @param {NetworkSpec} spec
 * @param {BiomeDef} biome
 * @param {{ maxAttempts?: number, verbose?: boolean }} [opts]
 * @returns {{ graphDef: { nodes: any[], edges: [string, string][], triggers: any[] }, meta: object }}
 */
export function generateNetwork(seed, spec, biome, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? 10;
  const verbose = opts.verbose ?? false;

  /** @type {string[]} */
  const allErrors = [];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const attemptSeed = `${seed}-network-${attempt}`;
    const rng = makeSeededRng(attemptSeed);

    if (verbose) {
      console.log(`[GENERATE] Attempt ${attempt + 1}/${maxAttempts} (seed: ${attemptSeed})`);
    }

    // Decide: flat (F/D) vs hierarchical (C+)
    const numWings = wingCount(spec.complexity);
    const useHierarchical = numWings > 0 && biome.recipes?.length > 0;

    /** @type {import('./skeleton.js').SkeletonSlot} */
    let skeleton;
    /** @type {{ pieces: any[], crossEdges: [string, string][], ok: boolean }} */
    let fillResult;

    if (useHierarchical) {
      // Hierarchical path: backbone + wings
      const recipe = biome.recipes.find(r => r.id === spec.recipeId) ?? biome.recipes[0];
      const result = generateHierarchicalSkeleton(spec, biome, recipe, rng);
      skeleton = result.root;

      // Fill the hierarchical skeleton with expanded budget.
      // TODO: thread per-wing palettes (sub-biome pieceIds) and requiredPieceIds
      // through to fillSkeleton so wings get sub-biome-flavored content.
      // Currently all wings draw from the full catalog.
      const budgets = hierarchicalBudget(spec, result.wings.length);
      fillResult = fillSkeleton(skeleton, biome, spec, rng, {
        budgetOverride: budgets.total,
      });
    } else {
      // Flat path: existing behavior for F/D networks
      skeleton = generateSkeleton(spec, biome, rng);
      fillResult = fillSkeleton(skeleton, biome, spec, rng);
    }

    const { pieces, crossEdges, ok } = fillResult;
    if (!ok) {
      allErrors.push(`Attempt ${attempt + 1}: slot filling failed`);
      if (verbose) console.log("[GENERATE] Slot filling failed — retrying");
      continue;
    }

    // Pass 3: assemble
    const output = assembleNetwork(pieces, crossEdges, spec, biome, seed);

    // Pass 4: validate
    const { valid, errors } = validate(output.graphDef, spec);
    if (!valid) {
      allErrors.push(`Attempt ${attempt + 1}: ${errors.join("; ")}`);
      if (verbose) console.log(`[GENERATE] Validation failed: ${errors.join("; ")} — retrying`);
      continue;
    }

    if (verbose) {
      console.log(`[GENERATE] Success! ${output.graphDef.nodes.length} nodes, ${output.graphDef.edges.length} edges`);
    }

    return output;
  }

  throw new Error(
    `Network generation failed after ${maxAttempts} attempts:\n${allErrors.join("\n")}`
  );
}

