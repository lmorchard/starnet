// @ts-check
/**
 * Top-level network generator — the single entry point for procedural
 * network generation. Orchestrates skeleton → fill → assemble → validate
 * with retry on failure.
 */

/** @typedef {import('./set-pieces.js').NetworkSpec} NetworkSpec */
/** @typedef {import('./set-pieces.js').BiomeDef} BiomeDef */

import { generateSkeleton } from "./skeleton.js";
import { fillSkeleton } from "./slot-filler.js";
import { assembleNetwork } from "./assemble.js";
import { validate } from "./validate.js";
import { makeSeededRng } from "../rng.js";

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

    // Pass 1: skeleton
    const skeleton = generateSkeleton(spec, biome, rng);

    // Pass 2: fill slots
    const { pieces, crossEdges, ok } = fillSkeleton(skeleton, biome, spec, rng);
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

