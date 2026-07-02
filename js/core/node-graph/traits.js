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
 * @property {import('./types.js').TriggerDef[]} [triggers]
 */

import { getTimedActionAttrNames } from "./timed-actions.js";
import { registerOperator } from "./operators.js";
import { HEAT_COST } from "../balance.js";

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

  /** @type {import('./types.js').TriggerDef[]} */
  let mergedTriggers = [];

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

    // Triggers: concatenate
    if (trait.triggers) {
      mergedTriggers = mergedTriggers.concat(trait.triggers);
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

  // NodeDef explicit triggers appended
  if (nodeDef.triggers && nodeDef.triggers.length > 0) {
    mergedTriggers = mergedTriggers.concat(nodeDef.triggers);
  }

  return {
    id: nodeDef.id,
    type: nodeDef.type,
    traits: nodeDef.traits,
    attributes: mergedAttrs,
    operators: mergedOps,
    actions: [...actionMap.values()],
    triggers: mergedTriggers.length > 0 ? mergedTriggers : undefined,
  };
}

/**
 * Clear all registered traits. For testing only.
 */
export function clearTraits() {
  _registry.clear();
}

// ── Built-in trait definitions ──────────────────────────────────

import { ACTION_TEMPLATES, LIE_LOW_ATTRS, LIE_LOW_OPERATOR } from "./action-templates.js";

// Register the sweep-cascade operator here so it is available whenever any
// hackable node is constructed — traits.js is always loaded by the NodeGraph
// runtime, making this the right anchor for node-graph-layer operator registrations
// that depend only on timed-action names and balance constants.
const _PROBE_PROGRESS = getTimedActionAttrNames("probe").progressAttr;
registerOperator("sweep-cascade", (_config, attrs, message, _ctx) => {
  if (!message || message.type !== "sweep-pulse") return {};
  if (typeof attrs.probing !== "boolean" || attrs.probed || attrs.probing) return {};
  const ttl = message.payload?.ttl ?? 0;
  if (ttl < 1) return {};
  return {
    attributes: { visibility: "accessible", probing: true, [_PROBE_PROGRESS]: 0, _cascade_ttl: ttl },
    events: [{ type: "operator-effect", payload: { effect: "ctx-call", method: "recordHeat", args: [HEAT_COST.sweep] } }],
  };
});

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
    activeExploitId: null,
    mining: false,
    mineAttempts: 0,
    mineExhausted: false,
  },
  operators: [
    { name: "sweep-cascade" },
    {
      name: "timed-action",
      action: "probe",
      activeAttr: "probing",
      durationTable: { S: 50, A: 40, B: 30, C: 20, D: 20, F: 10 },
      onComplete: [{ effect: "ctx-call", method: "resolveProbe", args: ["$nodeId"] }],
    },
    {
      name: "timed-action",
      action: "xploit",
      activeAttr: "exploiting",
      // No durationTable — ctx.startExploit sets duration from card quality
      onComplete: [{ effect: "ctx-call", method: "resolveExploit", args: ["$nodeId"] }],
      onProgressInterval: 0.1,
      onProgressEffects: [
        { effect: "emit-message", type: "exploit-noise", payload: {} },
      ],
    },
    {
      name: "timed-action",
      action: "mine",
      activeAttr: "mining",
      durationTable: { S: 70, A: 60, B: 50, C: 40, D: 35, F: 30 },
      onComplete: [{ effect: "ctx-call", method: "resolveMine", args: ["$nodeId"] }],
    },
  ],
  actions: [
    ACTION_TEMPLATES.PROBE,
    ACTION_TEMPLATES.ABORT,
    ACTION_TEMPLATES.EXPLOIT,
    ACTION_TEMPLATES.MINE,
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
  operators: [
    {
      name: "timed-action",
      action: "dump",
      activeAttr: "reading",
      durationTable: { S: 40, A: 35, B: 25, C: 15, D: 15, F: 8 },
      onComplete: [{ effect: "ctx-call", method: "resolveRead", args: ["$nodeId"] }],
    },
    {
      name: "timed-action",
      action: "fetch",
      activeAttr: "looting",
      durationTable: { S: 30, A: 25, B: 20, C: 12, D: 10, F: 6 },
      onComplete: [{ effect: "ctx-call", method: "resolveLoot", args: ["$nodeId"] }],
    },
  ],
  actions: [
    ACTION_TEMPLATES.DUMP,
    ACTION_TEMPLATES.FETCH,
  ],
});

registerTrait("rebootable", {
  attributes: { rebooting: false },
  operators: [
    {
      name: "timed-action",
      action: "reboot",
      activeAttr: "rebooting",
      // No durationTable — ctx.startReboot sets random duration (1-3s)
      onComplete: [{ effect: "ctx-call", method: "completeReboot", args: ["$nodeId"] }],
    },
  ],
  actions: [
    ACTION_TEMPLATES.KICK,
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
    alertCount: 0,
  },
  operators: [
    { name: "flag", on: "alert", attr: "alerted", value: true },
    // Each alert that reaches the monitor reports to the global alert layer, which
    // accumulates and climbs the ladder to trace (recordMonitorAlert). The monitor is
    // reached only via an un-corrupted IDS relay, so corrupting the IDS severs this sensor.
    { name: "report", on: "alert", call: "recordMonitorAlert" },
  ],
  actions: [ACTION_TEMPLATES.CANCEL_TRACE, ACTION_TEMPLATES.SCRUB_LOGS],
  // No triggers: cancelling a trace is explicit and player-driven via the CANCEL_TRACE
  // action. There is deliberately no owned-cancel-trace trigger — owning the monitor
  // reveals connections and aggregates alerts, but the player must run cancel-trace to
  // abort the countdown. (A prior repeating trigger auto-cancelled on own and re-emitted
  // ALERT_TRACE_CANCELLED every evaluation cycle, spamming the log.)
  // (alert-escalate also removed: escalation flows per-alert through the report operator
  //  → recordMonitorAlert, which climbs green→yellow→red→trace by accumulated count.)
});

registerTrait("gate", {
  attributes: { gateAccess: "probed" },
  operators: [],
  actions: [],
});

// WAN-boundary darknet broker: access-darknet opens the in-run store; lie-low is the
// time-costly, per-run-limited grid cooldown. The createWAN factory applies this trait.
registerTrait("darknet", {
  attributes: { ...LIE_LOW_ATTRS },
  operators: [LIE_LOW_OPERATOR],
  actions: [ACTION_TEMPLATES.ACCESS_DARKNET, ACTION_TEMPLATES.LIE_LOW, ACTION_TEMPLATES.DISCONNECT],
});

// Finesse access (Flow Subversion Session 1): a node that CANNOT be brute-forced —
// it only trusts a credential that flows in from elsewhere. `finesseLocked` suppresses
// XPLOIT (see EXPLOIT_ACTION.requires); `trustsCredential` names the token a captured
// credential must match. Owning it is the REPLAY program (injected in program-actions.js),
// not a trait action. Apply via createFirewall({ finesse: { key } }).
registerTrait("finesse-access", {
  attributes: { finesseLocked: true, trustsCredential: null },
  operators: [],
  actions: [],
});

// ── New traits (stress-test the system) ─────────────────────

registerTrait("hardened", {
  attributes: { durationMultiplier: 2.0 },
  operators: [],
  actions: [],
});

registerTrait("audited", {
  attributes: { noiseInterval: 0.1 },
  operators: [],
  actions: [],
});

registerTrait("trapped", {
  attributes: {},
  operators: [],
  actions: [],
  triggers: [{
    id: "trap-on-probe",
    when: { type: "node-attr", attr: "probed", eq: true },
    then: [{ effect: "ctx-call", method: "startTrace", args: [] }],
  }],
});

registerTrait("encrypted", {
  attributes: { encryptionKey: "default-key" },
  operators: [],
  actions: [{
    id: "dump",
    label: "DUMP",
    desc: "Scan encrypted node contents (requires decryption key).",
    requires: [
      { type: "any-of", conditions: [
        { type: "node-attr", attr: "accessLevel", eq: "open" },
        { type: "node-attr", attr: "accessLevel", eq: "owned" },
      ]},
      { type: "node-attr", attr: "read", eq: false },
      { type: "node-attr", attr: "rebooting", eq: false },
      { type: "node-attr", attr: "reading", eq: false },
      { type: "quality-from-attr", attr: "encryptionKey", gte: 1 },
    ],
    effects: [
      { effect: "set-attr", attr: "reading", value: true },
      // Derived from the registry so it always matches the dump operator's progress attr.
      { effect: "set-attr", attr: getTimedActionAttrNames("dump").progressAttr, value: 0 },
    ],
  }],
});

registerTrait("volatile", {
  attributes: {
    volatileDelay: 30,
    volatileEffect: "reset",
    _volatile_armed: false,
  },
  operators: [{
    name: "timed-action",
    action: "volatile",
    activeAttr: "_volatile_armed",
    durationAttrSource: "volatileDelay",
    onComplete: [{ effect: "ctx-call", method: "volatileDetonate", args: ["$nodeId"] }],
  }],
  actions: [],
  triggers: [{
    id: "volatile-arm",
    when: { type: "node-attr", attr: "accessLevel", eq: "owned" },
    then: [
      { effect: "set-attr", attr: "_volatile_armed", value: true },
    ],
  }],
});
