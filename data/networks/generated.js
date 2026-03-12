// @ts-check
/**
 * Generated network entry point — wraps the procedural generator in the
 * same buildNetwork() shape as hand-crafted networks.
 */

import { generateNetwork } from "../../js/core/network/generate.js";
import { CORPORATE_BIOME } from "../biomes/corporate.js";

/** @typedef {import('../../js/core/network/set-pieces.js').NetworkSpec} NetworkSpec */

/**
 * Generate a procedural network using the corporate biome.
 *
 * @param {{ seed?: string, spec?: NetworkSpec }} [opts]
 * @returns {{ graphDef: any, meta: any }}
 */
export function buildNetwork(opts = {}) {
  const seed = opts.seed ?? `gen-${Date.now()}`;
  const spec = opts.spec ?? CORPORATE_BIOME.defaultBudget;
  return generateNetwork(seed, spec, CORPORATE_BIOME);
}
