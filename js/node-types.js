// @ts-check
// Node type registry — behavior atoms, type definitions, query helpers.
// Only imports rng.js (no circular deps). No imports from alert.js, ice.js, loot.js, state.js.
// Behavior atom hooks receive a ctx object injected by their dispatcher (dependency injection).

/** @typedef {import('./types.js').NodeState} NodeState */
/** @typedef {import('./types.js').GameState} GameState */
/** @typedef {import('./types.js').Grade} Grade */
/** @typedef {import('./types.js').BehaviorAtom} BehaviorAtom */
/** @typedef {import('./types.js').ActionDef} ActionDef */
/** @typedef {import('./types.js').NodeTypeDef} NodeTypeDef */
/** @typedef {import('./types.js').CombatConfig} CombatConfig */
/** @typedef {import('./types.js').VulnConfig} VulnConfig */

import { randomInt } from "./rng.js";

// ── Behavior atoms ────────────────────────────────────────
// Each atom is a plain object with optional lifecycle hooks.
// Hooks signature: (node, state, ctx) => void
// ctx is provided by the dispatcher and contains any game functions the atom needs.

/** @type {Record<string, BehaviorAtom>} */
export const BEHAVIORS = {
  // IDS detection: propagates alert to adjacent security monitors.
  "detection": {
    id: "detection",
    stateFields: { eventForwardingDisabled: false },
    onAlertRaised: (node, state, ctx) => {
      ctx.propagateAlertEvent(node.id);
    },
    onReconfigured: (node, state, ctx) => {
      ctx.recomputeGlobalAlert();
    },
  },

  // Security monitor aggregation: cancels trace and resets alert when owned.
  "monitor": {
    id: "monitor",
    onOwned: (node, state, ctx) => {
      ctx.cancelTraceCountdown();
    },
  },

  // ICE home node: disables ICE when its resident node is owned.
  "iceResident": {
    id: "iceResident",
    onOwned: (node, state, ctx) => {
      if (state.ice?.active && state.ice.residentNodeId === node.id) {
        ctx.stopIce();
        ctx.disableIce();
      }
    },
  },

  // Lootable: node can hold macguffins. Reads lootConfig from ctx.typeDef.
  "lootable": {
    id: "lootable",
    onInit: (node, state, ctx) => {
      const lootConfig = ctx.typeDef?.lootConfig;
      if (!lootConfig) return;
      const [min, max] = lootConfig.count;
      const count = randomInt("loot", min, max);
      for (let i = 0; i < count; i++) {
        node.macguffins.push(ctx.generateMacguffin());
      }
    },
  },

  // High-grade detection variant: skips alert propagation, triggers trace directly.
  "direct-trace": {
    id: "direct-trace",
    onAlertRaised: (node, state, ctx) => {
      ctx.startTraceCountdown();
    },
  },
};

// ── Node type registry ────────────────────────────────────

/** @type {Record<string, NodeTypeDef>} */
export const NODE_TYPES = {
  "ids": {
    gateAccess: "owned",
    behaviors: ["detection"],
    actions: [
      {
        id: "reconfigure",
        label: "RECONFIGURE",
        available: (node, state) =>
          !node.eventForwardingDisabled &&
          (node.accessLevel === "compromised" || node.accessLevel === "owned"),
        desc: () => "Disable event forwarding to security monitor.",
        execute: (node, _state, ctx) => ctx.reconfigureNode(node.id),
      },
    ],
    // Grade S/A: skip propagation, start trace directly on detection
    gradeOverrides: {
      S: { extraBehaviors: ["direct-trace"] },
      A: { extraBehaviors: ["direct-trace"] },
    },
  },

  "security-monitor": {
    gateAccess: "owned",
    behaviors: ["monitor", "iceResident"],
    actions: [
      {
        id: "cancel-trace",
        label: "CANCEL TRACE",
        available: (node, state) =>
          node.accessLevel === "owned" && state.traceSecondsRemaining !== null,
        desc: (node, state) =>
          `Abort trace countdown (${state.traceSecondsRemaining}s remaining).`,
        execute: (_node, _state, ctx) => ctx.cancelTrace(),
      },
    ],
  },

  "fileserver": {
    behaviors: ["lootable"],
    lootConfig: { count: [1, 2] },
    actions: [],
  },

  // Cryptovaults are hardened: harder to crack, more aggressive disclosure at every grade.
  "cryptovault": {
    behaviors: ["lootable"],
    lootConfig: { count: [1, 3] },
    actions: [],
    combatConfig: {
      gradeModifier:    { S: 0.03, A: 0.10, B: 0.20, C: 0.40, D: 0.60, F: 0.80 },
      disclosureChance: { S: 0.95, A: 0.80, B: 0.65, C: 0.45, D: 0.25, F: 0.10 },
    },
    vulnConfig: {
      // Fewer but rarer vulnerabilities — harder to find an in
      count:    { S: [1, 1], A: [1, 1], B: [1, 2], C: [1, 2], D: [2, 2], F: [2, 3] },
      rarities: { S: ["rare"], A: ["rare"], B: ["uncommon", "rare"], C: ["uncommon", "rare"], D: ["common", "uncommon"], F: ["common", "uncommon"] },
    },
  },

  "workstation": {
    behaviors: ["lootable"],
    lootConfig: { count: [0, 1] },
    actions: [],
  },

  "wan": {
    behaviors: [],
    actions: [
      {
        id: "access-darknet",
        label: "ACCESS DARKNET",
        available: (_node, state) => state.phase === "playing",
        desc: () => "Access the darknet broker to purchase exploit cards.",
        execute: (_node, _state, ctx) => ctx.openDarknetsStore(),
      },
    ],
  },

  "gateway": {
    behaviors: [],
    actions: [],
  },

  "router": {
    gateAccess: "compromised",
    behaviors: [],
    actions: [],
  },

  "firewall": {
    gateAccess: "owned",
    behaviors: [],
    actions: [],
  },
};

// ── Registry query helpers ────────────────────────────────

/**
 * Returns the base type definition. Throws if the type is unknown.
 * @param {string} type
 * @returns {NodeTypeDef}
 */
export function getNodeType(type) {
  const def = NODE_TYPES[type];
  if (!def) throw new Error(`Unknown node type: "${type}"`);
  return def;
}

/**
 * Returns the fully resolved type definition for a node, merging any
 * grade override on top of the base. Accepts a partial node shape so it
 * can be called before a full NodeState exists (e.g. during init).
 * @param {{ type: string, grade: Grade }} node
 * @returns {NodeTypeDef}
 */
export function resolveNode(node) {
  const base = getNodeType(node.type);
  const override = base.gradeOverrides?.[node.grade];
  if (!override) return base;

  // Merge behaviors
  const behaviors = override.behaviors
    ? override.behaviors
    : [...base.behaviors, ...(override.extraBehaviors ?? [])];

  // Merge actions
  const actions = override.actions
    ? override.actions
    : [...base.actions, ...(override.extraActions ?? [])];

  // Shallow-merge combatConfig and vulnConfig
  const combatConfig = (override.combatConfig || base.combatConfig)
    ? { ...base.combatConfig, ...override.combatConfig }
    : undefined;
  const vulnConfig = (override.vulnConfig || base.vulnConfig)
    ? { ...base.vulnConfig, ...override.vulnConfig }
    : undefined;

  return { ...base, behaviors, actions, combatConfig, vulnConfig };
}

/**
 * Returns the gateAccess level for a node (grade-aware).
 * Defaults to "probed" if the type doesn't specify one.
 * @param {{ type: string, grade: Grade }} node
 * @returns {"probed"|"compromised"|"owned"}
 */
export function getGateAccess(node) {
  return resolveNode(node).gateAccess ?? "probed";
}

/**
 * Returns all resolved BehaviorAtom objects for a node (grade-aware).
 * @param {{ type: string, grade: Grade }} node
 * @returns {BehaviorAtom[]}
 */
export function getBehaviors(node) {
  const { behaviors } = resolveNode(node);
  return behaviors.map((id) => {
    const atom = BEHAVIORS[id];
    if (!atom) throw new Error(`Unknown behavior atom: "${id}"`);
    return atom;
  });
}

/**
 * Returns true if the node (at its grade) has the given behavior atom.
 * @param {{ type: string, grade: Grade }} node
 * @param {string} id
 * @returns {boolean}
 */
export function hasBehavior(node, id) {
  return resolveNode(node).behaviors.includes(id);
}

/**
 * Returns merged stateFields from all resolved behavior atoms.
 * @param {{ type: string, grade: Grade }} node
 * @returns {Object}
 */
export function getStateFields(node) {
  return getBehaviors(node).reduce((acc, atom) => {
    return atom.stateFields ? { ...acc, ...atom.stateFields } : acc;
  }, {});
}

/**
 * Returns all ActionDef objects whose available() predicate returns true
 * for the given node and state.
 * @param {NodeState} node
 * @param {GameState} state
 * @returns {ActionDef[]}
 */
export function getActions(node, state) {
  return resolveNode(node).actions.filter((a) => a.available(node, state));
}
