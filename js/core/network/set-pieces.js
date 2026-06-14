// @ts-check
/**
 * Set-piece library for the reactive node graph runtime.
 *
 * A set-piece is a self-contained, pre-wired subgraph: nodes with operators,
 * internal edges, triggers, actions, and named external ports. It is the
 * authoring unit for puzzle content. The generator picks set-pieces from a
 * biome palette, instantiates them with a unique prefix, and wires their
 * external ports into the broader network.
 *
 * Usage:
 *   import { instantiate, SET_PIECES } from './set-pieces.js';
 *   const { nodes, edges, triggers, externalPorts } = instantiate(SET_PIECES.combinationLock, 'v1');
 *   const graph = new NodeGraph({ nodes, edges, triggers });
 *
 * ## `destinations` override — appropriate use
 *
 * The `destinations` config on relay/debounce operators hard-wires outgoing message
 * targets, bypassing edge-based adjacency routing. This is only appropriate for
 * **internal set-piece routing** where all targeted nodes are part of the same
 * set-piece and will appear as nodes in the graph.
 *
 * Do NOT use `destinations` to create connections that are invisible to the player.
 * All node-to-node relationships the player needs to reason about must be reflected
 * in `internalEdges` (and thus visible in the rendered graph). Hidden channels make
 * the system illegible — they turn puzzles into gotchas.
 *
 * If you need directed routing the player can see: use graph edges, not destinations.
 */

/** @typedef {import('../node-graph/types.js').NodeDef} NodeDef */
/** @typedef {import('../node-graph/types.js').TriggerDef} TriggerDef */
/** @typedef {import('../node-graph/types.js').Condition} Condition */
/** @typedef {import('../node-graph/types.js').Effect} Effect */
/** @typedef {import('../node-graph/types.js').MessageDescriptor} MessageDescriptor */

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

/**
 * A typed connection point on a set-piece.
 * @typedef {Object} Port
 * @property {string} nodeId              -which internal node is the port
 * @property {"inbound"|"outbound"|"lateral"} direction
 * @property {string[]} wantsTags         -tag preferences for what should attach (empty = anything)
 * @property {boolean} required           -must the generator fill this port?
 */

/**
 * A set-piece definition — a self-contained, reusable subgraph.
 * @typedef {Object} SetPieceDef
 * @property {string} id
 * @property {string} description
 * @property {NodeDef[]} nodes
 * @property {[string, string][]} internalEdges
 * @property {TriggerDef[]} [triggers]
 * @property {string[]} externalPorts     -node IDs that connect to rest of network (legacy)
 * @property {string[]} [tags]            -role tags (entry, spine, filler, treasure, etc.)
 * @property {string} [cost]              -grade F through S
 * @property {Port[]} [ports]             -typed connection points (replaces externalPorts for procgen)
 * @property {number} [minDepth]          - minimum depth for placement (pieces with auto-start timers)
 */

/**
 * An instantiated set-piece, ready to pass to NodeGraph.
 * @typedef {Object} SetPieceInstance
 * @property {NodeDef[]} nodes
 * @property {[string, string][]} edges
 * @property {TriggerDef[]} triggers
 * @property {string[]} externalPorts     -prefixed port IDs
 */

/**
 * A sub-biome definition — a curated filter over the biome catalog with
 * bundled grade tendencies. Used to give wings distinct character.
 * @typedef {Object} SubBiomeDef
 * @property {string} id                  -e.g. "security-ops"
 * @property {string} name                -display name: "Security Operations"
 * @property {string} description         -flavor text
 * @property {string[]} pieceIds          -set-piece IDs from the biome catalog (filter)
 * @property {string[]} requiredPieceIds  -must-place piece IDs (always placed in this wing)
 * @property {GradeSpec} baseGrades       -before LAN offset
 */

/**
 * A recipe definition — a formula for composing a network from sub-biome wings.
 * @typedef {Object} RecipeDef
 * @property {string} id                  -e.g. "defense-contractor"
 * @property {string} name                -"Defense Contractor"
 * @property {string} description         -flavor text for mission briefing
 * @property {string[]} mandatoryWings    -sub-biome IDs, always placed
 * @property {Array<{subBiomeId: string, weight: number}>} optionalPool
 */

/**
 * Grade values for the 4 budget axes.
 * @typedef {Object} GradeSpec
 * @property {string} threat              -grade (S/A/B/C/D/F)
 * @property {string} wealth              -grade
 * @property {string} complexity          -grade
 * @property {string} depth               -grade
 */

/**
 * A biome definition — a catalog of set-pieces with default budget.
 * @typedef {Object} BiomeDef
 * @property {string} id
 * @property {NetworkSpec} defaultBudget
 * @property {SetPieceDef[]} catalog
 * @property {SubBiomeDef[]} [subBiomes]        -available sub-biomes
 * @property {RecipeDef[]} [recipes]             -available recipe variants
 * @property {string[]} [backbonePieceIds]       -piece IDs eligible for backbone slots
 */

/**
 * A network generation request — 4 budget axes as grades.
 * @typedef {Object} NetworkSpec
 * @property {string} threat              -grade (S/A/B/C/D/F)
 * @property {string} wealth              -grade
 * @property {string} complexity          -grade
 * @property {string} depth               -grade
 * @property {{ tags: string[], placement: string }|null} [missionTarget]
 * @property {string} [recipeId]          -selected recipe variant (for C+ hierarchical)
 * @property {string} [lanGrade]          -overall LAN grade for offset
 */

// ---------------------------------------------------------------------------
// Instantiation
// ---------------------------------------------------------------------------

/**
 * Prefix a single node ID.
 * @param {string} id
 * @param {string} prefix
 * @returns {string}
 */
function pfx(id, prefix) {
  return `${prefix}/${id}`;
}

/**
 * Rewrite a Condition, prefixing any embedded nodeIds.
 * @param {Condition} cond
 * @param {string} prefix
 * @returns {Condition}
 */
function rewriteCondition(cond, prefix) {
  switch (cond.type) {
    case "node-attr":
      return cond.nodeId ? { ...cond, nodeId: pfx(cond.nodeId, prefix) } : cond;
    case "quality-gte":
    case "quality-eq":
      return { ...cond, name: pfx(cond.name, prefix) };
    case "all-of":
    case "any-of":
      return { ...cond, conditions: cond.conditions.map((c) => rewriteCondition(c, prefix)) };
    case "not":
      return { ...cond, condition: rewriteCondition(cond.condition, prefix) };
    default:
      return cond;
  }
}

/**
 * Rewrite a MessageDescriptor, prefixing any destination nodeIds.
 * @param {MessageDescriptor} msg
 * @param {string} prefix
 * @returns {MessageDescriptor}
 */
function rewriteMessage(msg, prefix) {
  if (!msg.destinations) return msg;
  return { ...msg, destinations: msg.destinations.map((d) => pfx(d, prefix)) };
}

/**
 * Rewrite an Effect, prefixing any embedded nodeIds.
 * @param {Effect} effect
 * @param {string} prefix
 * @returns {Effect}
 */
function rewriteEffect(effect, prefix) {
  switch (effect.effect) {
    case "set-node-attr":
      return { ...effect, nodeId: pfx(effect.nodeId, prefix) };
    case "reveal-node":
    case "enable-node":
      return { ...effect, nodeId: pfx(effect.nodeId, prefix) };
    case "emit-message":
      return { ...effect, message: rewriteMessage(effect.message, prefix) };
    case "quality-delta":
    case "quality-set":
      return { ...effect, name: pfx(effect.name, prefix) };
    case "log-template": {
      const rewritten = effect.template.replace(
        /\$\{quality:([^}]+)\}/g,
        (_, name) => `\${quality:${pfx(name, prefix)}}`
      );
      return { ...effect, template: rewritten };
    }
    default:
      return effect;
  }
}

/**
 * Instantiate a set-piece with a unique prefix.
 * Rewrites all internal node ID references so multiple instances can coexist
 * in the same NodeGraph without ID collisions.
 *
 * @param {SetPieceDef} def
 * @param {string} prefix   - unique string, e.g. "v1", "ids-east", "lock-3"
 * @returns {SetPieceInstance}
 */
export function instantiate(def, prefix) {
  const nodes = def.nodes.map((node) => {
    // Rewrite operator configs that contain node IDs or quality names
    const operators = (node.operators ?? []).map((cfg) => {
      let updated = { ...cfg };
      // Prefix inputs for gate operators
      if ((cfg.name === "any-of" || cfg.name === "all-of") && cfg.inputs) {
        updated = { ...updated, inputs: cfg.inputs.map((id) => pfx(id, prefix)) };
      }
      // Prefix quality name for tally operator
      if (cfg.name === "tally" && cfg.quality) {
        updated = { ...updated, quality: pfx(cfg.quality, prefix) };
      }
      // Prefix destinations override (any operator can have one)
      if (cfg.destinations) {
        updated = { ...updated, destinations: cfg.destinations.map((d) => pfx(d, prefix)) };
      }
      return updated;
    });

    // Rewrite actions: requires conditions + effects
    const actions = (node.actions ?? []).map((action) => ({
      ...action,
      requires: (action.requires ?? []).map((c) => rewriteCondition(c, prefix)),
      effects: (action.effects ?? []).map((e) => rewriteEffect(e, prefix)),
    }));

    return {
      ...node,
      id: pfx(node.id, prefix),
      operators,
      actions,
    };
  });

  const edges = (def.internalEdges ?? []).map(
    ([a, b]) => /** @type {[string, string]} */ ([pfx(a, prefix), pfx(b, prefix)])
  );

  const triggers = (def.triggers ?? []).map((t) => ({
    ...t,
    id: pfx(t.id, prefix),
    when: rewriteCondition(t.when, prefix),
    then: t.then.map((e) => rewriteEffect(e, prefix)),
  }));

  const externalPorts = def.externalPorts.map((id) => pfx(id, prefix));

  return { nodes, edges, triggers, externalPorts };
}

// Set-piece definitions live in biome-specific files:
// - data/biomes/corporate-pieces.js (corporate biome)
// Future biomes will have their own pieces files.
