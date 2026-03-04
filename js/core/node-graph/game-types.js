// @ts-check
/**
 * Game node type factories — produce NodeDef objects for each game node type.
 * Uses shared action templates for common player actions (probe, exploit, etc.).
 *
 * These NodeDefs are the bridge between the node-graph runtime and the game engine.
 * Operators express reactive behavior; actions are player-invocable via the dispatcher.
 * Global state checks (one timed action at a time, ICE position) are applied by the
 * dispatcher wrapper, not here.
 */

/** @typedef {import('./types.js').ActionDef} ActionDef */
/** @typedef {import('./types.js').NodeDef} NodeDef */

// ── Shared action templates ──────────────────────────────────

/** @type {ActionDef} */
const PROBE_ACTION = {
  id: "probe",
  label: "PROBE",
  desc: "Reveal vulnerabilities. Raises local alert.",
  requires: [
    { type: "node-attr", attr: "accessLevel", eq: "locked" },
    { type: "node-attr", attr: "probed", eq: false },
    { type: "node-attr", attr: "rebooting", eq: false },
    { type: "node-attr", attr: "probing", eq: false },
  ],
  effects: [
    { effect: "ctx-call", method: "startProbe", args: ["$nodeId"] },
  ],
};

/** @type {ActionDef} */
const CANCEL_PROBE_ACTION = {
  id: "cancel-probe",
  label: "CANCEL PROBE",
  desc: "Abort vulnerability scan.",
  requires: [
    { type: "node-attr", attr: "probing", eq: true },
  ],
  effects: [
    { effect: "ctx-call", method: "cancelProbe", args: [] },
  ],
};

/**
 * Exploit action template. NOTE: the exploitId (card selection) is passed via
 * event payload, not through the action system. The dispatcher handles exploit
 * specially — it extracts exploitId and calls ctx.startExploit(nodeId, exploitId)
 * directly. The graph.executeAction path is bypassed for exploit.
 * @type {ActionDef}
 */
const EXPLOIT_ACTION = {
  id: "exploit",
  label: "EXPLOIT",
  desc: "Attack with an exploit card.",
  noSidebar: true,
  requires: [
    { type: "node-attr", attr: "visibility", eq: "accessible" },
    { type: "node-attr", attr: "rebooting", eq: false },
    { type: "node-attr", attr: "exploiting", eq: false },
  ],
  effects: [
    { effect: "ctx-call", method: "startExploit", args: ["$nodeId"] },
  ],
};

/** @type {ActionDef} */
const CANCEL_EXPLOIT_ACTION = {
  id: "cancel-exploit",
  label: "CANCEL EXPLOIT",
  desc: "Abort exploit execution.",
  requires: [
    { type: "node-attr", attr: "exploiting", eq: true },
  ],
  effects: [
    { effect: "ctx-call", method: "cancelExploit", args: [] },
  ],
};

/** @type {ActionDef} */
const READ_ACTION = {
  id: "read",
  label: "READ",
  desc: "Scan node contents for loot or connections.",
  requires: [
    {
      type: "any-of", conditions: [
        { type: "node-attr", attr: "accessLevel", eq: "compromised" },
        { type: "node-attr", attr: "accessLevel", eq: "owned" },
      ],
    },
    { type: "node-attr", attr: "read", eq: false },
    { type: "node-attr", attr: "rebooting", eq: false },
    { type: "node-attr", attr: "reading", eq: false },
  ],
  effects: [
    { effect: "ctx-call", method: "startRead", args: ["$nodeId"] },
  ],
};

/** @type {ActionDef} */
const CANCEL_READ_ACTION = {
  id: "cancel-read",
  label: "CANCEL READ",
  desc: "Abort data extraction.",
  requires: [
    { type: "node-attr", attr: "reading", eq: true },
  ],
  effects: [
    { effect: "ctx-call", method: "cancelRead", args: [] },
  ],
};

/** @type {ActionDef} */
const LOOT_ACTION = {
  id: "loot",
  label: "LOOT",
  desc: "Extract macguffins for cash.",
  requires: [
    { type: "node-attr", attr: "accessLevel", eq: "owned" },
    { type: "node-attr", attr: "read", eq: true },
    { type: "node-attr", attr: "rebooting", eq: false },
    { type: "node-attr", attr: "looted", eq: false },
    { type: "node-attr", attr: "looting", eq: false },
  ],
  effects: [
    { effect: "ctx-call", method: "startLoot", args: ["$nodeId"] },
  ],
};

/** @type {ActionDef} */
const CANCEL_LOOT_ACTION = {
  id: "cancel-loot",
  label: "CANCEL LOOT",
  desc: "Abort extraction.",
  requires: [
    { type: "node-attr", attr: "looting", eq: true },
  ],
  effects: [
    { effect: "ctx-call", method: "cancelLoot", args: [] },
  ],
};

/** @type {ActionDef} */
const EJECT_ACTION = {
  id: "eject",
  label: "EJECT",
  desc: "Boot ICE attention to a random adjacent node.",
  requires: [
    { type: "node-attr", attr: "accessLevel", eq: "owned" },
  ],
  effects: [
    { effect: "ctx-call", method: "ejectIce", args: [] },
  ],
};

/** @type {ActionDef} */
const REBOOT_ACTION = {
  id: "reboot",
  label: "REBOOT",
  desc: "Force ICE home and take node offline 1-3s.",
  requires: [
    { type: "node-attr", attr: "accessLevel", eq: "owned" },
    { type: "node-attr", attr: "rebooting", eq: false },
  ],
  effects: [
    { effect: "ctx-call", method: "rebootNode", args: ["$nodeId"] },
  ],
};

// ── Action sets by role ──────────────────────────────────────

const BASIC_ACTIONS = [
  PROBE_ACTION, CANCEL_PROBE_ACTION,
  EXPLOIT_ACTION, CANCEL_EXPLOIT_ACTION,
  EJECT_ACTION, REBOOT_ACTION,
];

const LOOTABLE_ACTIONS = [
  ...BASIC_ACTIONS,
  READ_ACTION, CANCEL_READ_ACTION,
  LOOT_ACTION, CANCEL_LOOT_ACTION,
];

// ── Common default attributes ────────────────────────────────

/**
 * @param {string} id
 * @param {object} [overrides]
 * @returns {Record<string, any>}
 */
function defaultAttributes(id, overrides = {}) {
  return {
    label: id,
    grade: "D",
    visibility: "hidden",
    accessLevel: "locked",
    probed: false,
    read: false,
    looted: false,
    rebooting: false,
    alertState: "green",
    vulnerabilities: [],
    macguffins: [],
    gateAccess: "probed",
    // Timed action flags (set by ctx callbacks, read by cancel-* actions)
    probing: false,
    exploiting: false,
    reading: false,
    looting: false,
    // IDS-specific
    forwardingEnabled: true,
    ...overrides,
  };
}

// ── Node type factories ──────────────────────────────────────

/**
 * @typedef {Object} NodeConfig
 * @property {string} [label]
 * @property {string} [grade]
 * @property {Record<string, any>} [attributes]
 */

/**
 * Gateway — entry point, no operators.
 * @param {string} id
 * @param {NodeConfig} [config]
 * @returns {NodeDef}
 */
export function createGateway(id, config = {}) {
  return {
    id,
    type: "gateway",
    attributes: defaultAttributes(config.label || id, {
      grade: config.grade || "D",
      gateAccess: "compromised",
      ...config.attributes,
    }),
    operators: [],
    actions: [...BASIC_ACTIONS],
  };
}

/**
 * Router — relay operator (broadcasts non-tick messages).
 * @param {string} id
 * @param {NodeConfig} [config]
 * @returns {NodeDef}
 */
export function createRouter(id, config = {}) {
  return {
    id,
    type: "router",
    attributes: defaultAttributes(config.label || id, {
      grade: config.grade || "D",
      gateAccess: "compromised",
      ...config.attributes,
    }),
    operators: [{ name: "relay" }],
    actions: [...BASIC_ACTIONS],
  };
}

/**
 * IDS — relay(filter:"alert") + flag operator. Reconfigure action disables forwarding.
 * @param {string} id
 * @param {NodeConfig} [config]
 * @returns {NodeDef}
 */
export function createIDS(id, config = {}) {
  /** @type {ActionDef} */
  const reconfigureAction = {
    id: "reconfigure",
    label: "RECONFIGURE",
    desc: "Disable event forwarding to security monitor.",
    requires: [
      {
        type: "any-of", conditions: [
          { type: "node-attr", attr: "accessLevel", eq: "compromised" },
          { type: "node-attr", attr: "accessLevel", eq: "owned" },
        ],
      },
      { type: "node-attr", attr: "forwardingEnabled", eq: true },
    ],
    effects: [
      { effect: "set-attr", attr: "forwardingEnabled", value: false },
      { effect: "ctx-call", method: "reconfigureNode", args: ["$nodeId"] },
    ],
  };

  return {
    id,
    type: "ids",
    attributes: defaultAttributes(config.label || id, {
      grade: config.grade || "C",
      gateAccess: "owned",
      forwardingEnabled: true,
      alerted: false,
      ...config.attributes,
    }),
    operators: [
      { name: "relay", filter: "alert" },
      { name: "flag", on: "alert", attr: "alerted", value: true },
    ],
    actions: [...BASIC_ACTIONS, reconfigureAction],
  };
}

/**
 * Security Monitor — aggregates alerts, ctx alert callback.
 * @param {string} id
 * @param {NodeConfig} [config]
 * @returns {NodeDef}
 */
export function createSecurityMonitor(id, config = {}) {
  /** @type {ActionDef} */
  const cancelTraceAction = {
    id: "cancel-trace",
    label: "CANCEL TRACE",
    desc: "Abort trace countdown.",
    requires: [
      { type: "node-attr", attr: "accessLevel", eq: "owned" },
    ],
    effects: [
      { effect: "ctx-call", method: "cancelTrace", args: [] },
    ],
  };

  return {
    id,
    type: "security-monitor",
    attributes: defaultAttributes(config.label || id, {
      grade: config.grade || "B",
      gateAccess: "owned",
      alerted: false,
      ...config.attributes,
    }),
    operators: [
      { name: "flag", on: "alert", attr: "alerted", value: true },
    ],
    actions: [...BASIC_ACTIONS, cancelTraceAction],
  };
}

/**
 * Fileserver — lootable node with macguffins.
 * @param {string} id
 * @param {NodeConfig & { lootCount?: [number, number] }} [config]
 * @returns {NodeDef}
 */
export function createFileserver(id, config = {}) {
  return {
    id,
    type: "fileserver",
    attributes: defaultAttributes(config.label || id, {
      grade: config.grade || "D",
      lootCount: config.lootCount || [1, 2],
      ...config.attributes,
    }),
    operators: [],
    actions: [...LOOTABLE_ACTIONS],
  };
}

/**
 * Cryptovault — hardened lootable, quality-gated access possible.
 * @param {string} id
 * @param {NodeConfig & { lootCount?: [number, number] }} [config]
 * @returns {NodeDef}
 */
export function createCryptovault(id, config = {}) {
  return {
    id,
    type: "cryptovault",
    attributes: defaultAttributes(config.label || id, {
      grade: config.grade || "B",
      lootCount: config.lootCount || [1, 3],
      ...config.attributes,
    }),
    operators: [],
    actions: [...LOOTABLE_ACTIONS],
  };
}

/**
 * Firewall — high-grade barrier, no relay behavior.
 * @param {string} id
 * @param {NodeConfig} [config]
 * @returns {NodeDef}
 */
export function createFirewall(id, config = {}) {
  return {
    id,
    type: "firewall",
    attributes: defaultAttributes(config.label || id, {
      grade: config.grade || "A",
      gateAccess: "owned",
      ...config.attributes,
    }),
    operators: [],
    actions: [...BASIC_ACTIONS],
  };
}

/**
 * WAN — darknet store access. Starts accessible, no hack required.
 * @param {string} id
 * @param {NodeConfig} [config]
 * @returns {NodeDef}
 */
export function createWAN(id, config = {}) {
  /** @type {ActionDef} */
  const accessDarknetAction = {
    id: "access-darknet",
    label: "ACCESS DARKNET",
    desc: "Access the darknet broker to purchase exploit cards.",
    requires: [],
    effects: [
      { effect: "ctx-call", method: "openDarknetsStore", args: [] },
    ],
  };

  return {
    id,
    type: "wan",
    attributes: defaultAttributes(config.label || id, {
      grade: "F",
      visibility: "accessible",
      accessLevel: "owned",
      ...config.attributes,
    }),
    operators: [],
    actions: [accessDarknetAction],
  };
}

// ── Set-piece enrichment ─────────────────────────────────────

/**
 * Enrich a set-piece node with standard game attributes and actions.
 * Adds missing defaults (probed, read, etc.) and standard actions
 * (probe, exploit, cancel-*, eject, reboot) on top of any set-piece-specific actions.
 *
 * @param {NodeDef} node
 * @param {{ lootable?: boolean }} [opts]
 * @returns {NodeDef}
 */
export function enrichWithGameActions(node, { lootable = false } = {}) {
  /** @type {Record<string, [number, number]>} */
  const LOOT_COUNTS = {
    "fileserver": [1, 2],
    "workstation": [0, 1],
    "cryptovault": [1, 3],
    "key-server": [0, 1],
  };
  const defaults = {
    label: node.id,
    grade: "D",
    visibility: "hidden",
    accessLevel: "locked",
    probed: false,
    read: false,
    looted: false,
    rebooting: false,
    alertState: "green",
    vulnerabilities: [],
    macguffins: [],
    gateAccess: "probed",
    probing: false,
    exploiting: false,
    reading: false,
    looting: false,
    forwardingEnabled: true,
    ...(lootable && LOOT_COUNTS[node.type] ? { lootCount: LOOT_COUNTS[node.type] } : {}),
  };
  const baseActions = lootable ? LOOTABLE_ACTIONS : BASIC_ACTIONS;
  // Merge: defaults first, then node's own attrs override, then ensure label
  const mergedAttrs = { ...defaults, ...node.attributes };
  if (!node.attributes.label) mergedAttrs.label = node.id;
  return {
    ...node,
    attributes: mergedAttrs,
    // Standard game actions first, then set-piece-specific actions
    actions: [...baseActions, ...(node.actions || [])],
  };
}

// ── Export action templates for testing ───────────────────────

export const ACTION_TEMPLATES = {
  PROBE: PROBE_ACTION,
  CANCEL_PROBE: CANCEL_PROBE_ACTION,
  EXPLOIT: EXPLOIT_ACTION,
  CANCEL_EXPLOIT: CANCEL_EXPLOIT_ACTION,
  READ: READ_ACTION,
  CANCEL_READ: CANCEL_READ_ACTION,
  LOOT: LOOT_ACTION,
  CANCEL_LOOT: CANCEL_LOOT_ACTION,
  EJECT: EJECT_ACTION,
  REBOOT: REBOOT_ACTION,
};
