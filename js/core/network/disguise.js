// @ts-check
/**
 * Trap-node disguise. The honey-pot ships accessLevel:"owned" (bait) and, since
 * the "own it = know it" reveal rule, shows its identity from the start. To keep
 * the deception, trap nodes masquerade as a seeded loot-bearing node: only the
 * displayed `type` (drives the glyph) and `label` change — the internal id is
 * untouched because edges depend on it. Applied at network-generation time so the
 * disguise is present in graphDef before the renderer (toCytoscapeFormat) reads it.
 */

/** Loot-bearing types a trap node may masquerade as (plain loot boxes only). */
export const DISGUISE_TYPES = ["fileserver", "workstation"];

/**
 * Rewrite each trap node's `type` + `label` to a seeded disguise, in place.
 * @param {Array<{ id: string, type: string, attributes?: Record<string, any> }>} nodes
 * @param {() => number} rng — raw seeded RNG returning [0, 1)
 */
export function disguiseTrapNodes(nodes, rng) {
  for (const node of nodes) {
    if (!node.attributes?.trap) continue;
    const disguise = DISGUISE_TYPES[Math.floor(rng() * DISGUISE_TYPES.length)];
    const suffix = Math.floor(rng() * 90) + 10; // 10–99
    node.type = disguise;
    node.attributes.label = `${disguise}-${suffix}`;
  }
}
