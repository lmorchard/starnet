// @ts-check
/**
 * Top-level network generator — the single entry point for procedural
 * network generation. Orchestrates skeleton → fill → assemble → validate
 * with retry on failure.
 */

/** @typedef {import('./set-pieces.js').NetworkSpec} NetworkSpec */
/** @typedef {import('./set-pieces.js').BiomeDef} BiomeDef */

import { generateSkeleton, generateHierarchicalSkeleton } from "./skeleton.js";
import { fillSkeleton, consumeOutboundPort, placeScatteredNodes } from "./slot-filler.js";
import { assembleNetwork } from "./assemble.js";
import { validate } from "./validate.js";
import { makeSeededRng } from "../rng.js";
import { wingCount, hierarchicalBudget, gradeModifier } from "./budget.js";

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
      // Hierarchical path: backbone + per-wing filling
      const recipe = biome.recipes.find(r => r.id === spec.recipeId) ?? biome.recipes[0];
      const result = generateHierarchicalSkeleton(spec, biome, recipe, rng);
      skeleton = result.root;
      const budgets = hierarchicalBudget(spec, result.wings.length);

      // Step 1: Fill backbone (entry + spine + backbone slots) — skip wing entry slots
      const backbonePalette = new Set(biome.backbonePieceIds ?? []);
      backbonePalette.add("entry-point");
      backbonePalette.add("single-router"); // spine piece
      const bbFill = fillSkeleton(skeleton, biome, spec, rng, {
        piecePalette: backbonePalette,
        budgetOverride: budgets.backboneBudget,
        skipSubBiomeSlots: true,
        skipScatterPlacement: true,
      });
      if (!bbFill.ok) { fillResult = bbFill; }
      else {
        // Step 2: Fill each wing with its sub-biome palette
        /** @type {import('./slot-filler.js').PlacedPiece[]} */
        const allPieces = [...bbFill.pieces];
        /** @type {[string, string][]} */
        const allCrossEdges = [...bbFill.crossEdges];
        /** @type {import('./slot-filler.js').ScatterObligation[]} */
        const allScatter = [...(bbFill.scatterObligations ?? [])];
        let allOk = true;

        for (const wing of result.wings) {
          const sb = wing.wingSpec.subBiome;
          const wingPalette = new Set(sb.pieceIds);
          // Compute per-wing grade offset for piece tagging
          const wingGradeOffset = gradeModifier(wing.wingSpec.spec);

          const wingFill = fillSkeleton(wing.slot, biome, wing.wingSpec.spec, rng, {
            piecePalette: wingPalette,
            requiredPieceIds: sb.requiredPieceIds,
            budgetOverride: budgets.perWingBudget,
            skipScatterPlacement: true,
          });

          if (!wingFill.ok) { allOk = false; break; }

          // Tag wing pieces with grade offset for assembly
          for (const p of wingFill.pieces) {
            p.gradeOffset = wingGradeOffset;
          }

          allPieces.push(...wingFill.pieces);
          allCrossEdges.push(...wingFill.crossEdges);
          allScatter.push(...(wingFill.scatterObligations ?? []));

          // Wire backbone → wing: find the backbone piece that parents this wing
          // entry slot and connect its outbound port to the wing's inbound port
          const parentSlotId = wing.slot.parentId;
          const bbPiece = bbFill.pieces.find(p => p.slot.id === parentSlotId);
          const wingEntryPiece = wingFill.pieces[0]; // first piece fills the wing entry slot
          if (bbPiece && wingEntryPiece?.inboundNodeId) {
            const outPort = consumeOutboundPort(bbPiece);
            if (outPort) {
              allCrossEdges.push([outPort, wingEntryPiece.inboundNodeId]);
            }
          }
        }

        // Step 3: Place scattered nodes across ALL pieces (cross-wing scattering)
        if (allOk && allScatter.length > 0) {
          /** @type {Map<string, import('./slot-filler.js').PlacedPiece>} */
          const placedMap = new Map();
          for (const p of allPieces) placedMap.set(p.slot.id, p);
          const scatterOk = placeScatteredNodes(allScatter, allPieces, skeleton, allCrossEdges, placedMap);
          if (!scatterOk) allOk = false;
        }

        fillResult = { pieces: allPieces, crossEdges: allCrossEdges, ok: allOk };
      }
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

