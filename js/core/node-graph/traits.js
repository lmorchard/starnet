// @ts-check
/**
 * Composable trait system for node definitions.
 *
 * Traits are named behavior bundles (attributes + operators + actions) registered
 * once in code and composed by name in data. NodeDefs list trait names; the runtime
 * resolves them at construction time via resolveTraits().
 *
 * Composition rules (from spec):
 *   1. Attributes: traits merged left-to-right (last-wins); explicit NodeDef
 *      attributes always override trait defaults.
 *   2. Operators: concatenated in trait-list order, then NodeDef extras appended.
 *   3. Actions: merged by ID (last-wins), then NodeDef extras override.
 */

/** @typedef {import('./types.js').NodeDef} NodeDef */
/** @typedef {import('./types.js').OperatorConfig} OperatorConfig */
/** @typedef {import('./types.js').ActionDef} ActionDef */

/**
 * @typedef {Object} TraitDef
 * @property {Record<string, any>} attributes
 * @property {OperatorConfig[]} operators
 * @property {ActionDef[]} actions
 */

/** @type {Map<string, TraitDef>} */
const _registry = new Map();

/**
 * Register a named trait definition.
 * @param {string} name
 * @param {TraitDef} traitDef
 */
export function registerTrait(name, traitDef) {
  _registry.set(name, traitDef);
}

/**
 * Look up a trait by name. Throws if not found.
 * @param {string} name
 * @returns {TraitDef}
 */
export function getTrait(name) {
  const t = _registry.get(name);
  if (!t) throw new Error(`Unknown trait: "${name}"`);
  return t;
}

/**
 * Resolve a NodeDef's traits into a fully-merged NodeDef.
 *
 * If the NodeDef has no `traits` array (or it's empty), returns it unchanged.
 * Otherwise merges trait attributes/operators/actions per the composition rules,
 * then applies NodeDef-level overrides on top.
 *
 * @param {NodeDef} nodeDef
 * @returns {NodeDef}
 */
export function resolveTraits(nodeDef) {
  if (!nodeDef.traits || nodeDef.traits.length === 0) {
    return nodeDef;
  }

  // Base intrinsic attributes
  const mergedAttrs = {
    label: nodeDef.id,
    visibility: "hidden",
  };

  /** @type {OperatorConfig[]} */
  let mergedOps = [];

  /** @type {Map<string, ActionDef>} */
  const actionMap = new Map();

  // Merge each trait left-to-right
  for (const traitName of nodeDef.traits) {
    const trait = getTrait(traitName);

    // Attributes: last-wins on overlap
    Object.assign(mergedAttrs, trait.attributes);

    // Operators: concatenate
    mergedOps = mergedOps.concat(trait.operators);

    // Actions: merge by ID, last-wins
    for (const action of trait.actions) {
      actionMap.set(action.id, action);
    }
  }

  // NodeDef explicit attributes override trait defaults
  if (nodeDef.attributes) {
    Object.assign(mergedAttrs, nodeDef.attributes);
  }

  // NodeDef explicit operators appended
  if (nodeDef.operators && nodeDef.operators.length > 0) {
    mergedOps = mergedOps.concat(nodeDef.operators);
  }

  // NodeDef explicit actions override by ID
  if (nodeDef.actions && nodeDef.actions.length > 0) {
    for (const action of nodeDef.actions) {
      actionMap.set(action.id, action);
    }
  }

  return {
    id: nodeDef.id,
    type: nodeDef.type,
    traits: nodeDef.traits,
    attributes: mergedAttrs,
    operators: mergedOps,
    actions: [...actionMap.values()],
  };
}

/**
 * Clear all registered traits. For testing only.
 */
export function clearTraits() {
  _registry.clear();
}

// ── Built-in trait definitions ──────────────────────────────────

import { ACTION_TEMPLATES } from "./game-types.js";

registerTrait("graded", {
  attributes: { grade: "D" },
  operators: [],
  actions: [],
});

registerTrait("hackable", {
  attributes: {
    accessLevel: "locked",
    probed: false,
    vulnerabilities: [],
    probing: false,
    exploiting: false,
    rebooting: false,
    alertState: "green",
  },
  operators: [], // timed-action operators added in Phase 5
  actions: [
    ACTION_TEMPLATES.PROBE,
    ACTION_TEMPLATES.CANCEL_PROBE,
    ACTION_TEMPLATES.EXPLOIT,
    ACTION_TEMPLATES.CANCEL_EXPLOIT,
  ],
});

registerTrait("lootable", {
  attributes: {
    read: false,
    looted: false,
    macguffins: [],
    lootCount: [1, 2],
    reading: false,
    looting: false,
  },
  operators: [], // timed-action operators added in Phase 5
  actions: [
    ACTION_TEMPLATES.READ,
    ACTION_TEMPLATES.CANCEL_READ,
    ACTION_TEMPLATES.LOOT,
    ACTION_TEMPLATES.CANCEL_LOOT,
  ],
});

registerTrait("rebootable", {
  attributes: { rebooting: false },
  operators: [], // timed-action operator added in Phase 5
  actions: [
    ACTION_TEMPLATES.EJECT,
    ACTION_TEMPLATES.REBOOT,
  ],
});

registerTrait("relay", {
  attributes: {},
  operators: [{ name: "relay" }],
  actions: [],
});

registerTrait("detectable", {
  attributes: {
    forwardingEnabled: true,
    alerted: false,
    alertState: "green",
  },
  operators: [
    { name: "relay", filter: "alert" },
    { name: "flag", on: "alert", attr: "alerted", value: true },
  ],
  actions: [ACTION_TEMPLATES.RECONFIGURE],
});

registerTrait("security", {
  attributes: {
    alerted: false,
    alertState: "green",
  },
  operators: [
    { name: "flag", on: "alert", attr: "alerted", value: true },
  ],
  actions: [ACTION_TEMPLATES.CANCEL_TRACE],
});

registerTrait("gate", {
  attributes: { gateAccess: "probed" },
  operators: [],
  actions: [],
});
