// @ts-check
/**
 * Game node type factories — produce trait-based NodeDef objects for each game
 * node type. Factories are optional sugar; the canonical authoring surface is
 * raw NodeDefs with traits lists.
 *
 * Traits provide operators, actions, and default attributes. Factories just
 * select the right trait list and apply config overrides.
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

/** @type {ActionDef} */
const RECONFIGURE_ACTION = {
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

/** @type {ActionDef} */
const CANCEL_TRACE_ACTION = {
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

/** @type {ActionDef} */
const ACCESS_DARKNET_ACTION = {
  id: "access-darknet",
  label: "ACCESS DARKNET",
  desc: "Access the darknet broker to purchase exploit cards.",
  requires: [],
  effects: [
    { effect: "ctx-call", method: "openDarknetsStore", args: [] },
  ],
};

// ── Default trait lists per node type ────────────────────────────

/** @type {Record<string, string[]>} */
const TRAITS_BY_TYPE = {
  "gateway":          ["graded", "hackable", "rebootable", "gate"],
  "router":           ["graded", "hackable", "rebootable", "relay", "gate"],
  "ids":              ["graded", "hackable", "rebootable", "detectable", "gate"],
  "security-monitor": ["graded", "hackable", "rebootable", "security", "gate"],
  "fileserver":       ["graded", "hackable", "rebootable", "lootable", "gate"],
  "cryptovault":      ["graded", "hackable", "rebootable", "lootable", "gate"],
  "firewall":         ["graded", "hackable", "rebootable", "gate"],
  "workstation":      ["graded", "hackable", "rebootable", "lootable", "gate"],
};

// ── Node type factories (optional sugar) ─────────────────────

/**
 * @typedef {Object} NodeConfig
 * @property {string} [label]
 * @property {string} [grade]
 * @property {Record<string, any>} [attributes]
 */

/**
 * Gateway — entry point.
 * @param {string} id
 * @param {NodeConfig} [config]
 * @returns {NodeDef}
 */
export function createGateway(id, config = {}) {
  return {
    id,
    type: "gateway",
    traits: ["graded", "hackable", "rebootable", "gate"],
    attributes: {
      label: config.label || id,
      grade: config.grade || "D",
      gateAccess: "probed",
      ...config.attributes,
    },
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
    traits: ["graded", "hackable", "rebootable", "relay", "gate"],
    attributes: {
      label: config.label || id,
      grade: config.grade || "D",
      gateAccess: "compromised",
      ...config.attributes,
    },
  };
}

/**
 * IDS — alert relay + reconfigure action.
 * @param {string} id
 * @param {NodeConfig} [config]
 * @returns {NodeDef}
 */
export function createIDS(id, config = {}) {
  return {
    id,
    type: "ids",
    traits: ["graded", "hackable", "rebootable", "detectable", "gate"],
    attributes: {
      label: config.label || id,
      grade: config.grade || "C",
      gateAccess: "owned",
      ...config.attributes,
    },
  };
}

/**
 * Security Monitor — aggregates alerts, cancel-trace action.
 * @param {string} id
 * @param {NodeConfig} [config]
 * @returns {NodeDef}
 */
export function createSecurityMonitor(id, config = {}) {
  return {
    id,
    type: "security-monitor",
    traits: ["graded", "hackable", "rebootable", "security", "gate"],
    attributes: {
      label: config.label || id,
      grade: config.grade || "B",
      gateAccess: "owned",
      ...config.attributes,
    },
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
    traits: ["graded", "hackable", "rebootable", "lootable", "gate"],
    attributes: {
      label: config.label || id,
      grade: config.grade || "D",
      lootCount: config.lootCount || [1, 2],
      ...config.attributes,
    },
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
    traits: ["graded", "hackable", "rebootable", "lootable", "gate"],
    attributes: {
      label: config.label || id,
      grade: config.grade || "B",
      lootCount: config.lootCount || [1, 3],
      ...config.attributes,
    },
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
    traits: ["graded", "hackable", "rebootable", "gate"],
    attributes: {
      label: config.label || id,
      grade: config.grade || "A",
      gateAccess: "owned",
      ...config.attributes,
    },
  };
}

/**
 * WAN — darknet store access. Starts accessible, no hack required.
 * @param {string} id
 * @param {NodeConfig} [config]
 * @returns {NodeDef}
 */
export function createWAN(id, config = {}) {
  return {
    id,
    type: "wan",
    attributes: {
      label: config.label || id,
      grade: "F",
      visibility: "accessible",
      accessLevel: "owned",
      ...config.attributes,
    },
    operators: [],
    actions: [ACCESS_DARKNET_ACTION],
  };
}

// ── Set-piece node composition ───────────────────────────────

/**
 * Create a game-ready node from a set-piece node definition.
 *
 * If the set-piece node already has traits, pass through (trait resolution
 * happens in the NodeGraph constructor).
 *
 * If the set-piece node's type matches a known game type, attach the default
 * trait list for that type. Set-piece operators and actions are preserved as
 * NodeDef-level extras (appended/merged during trait resolution).
 *
 * If the type is unknown (internal set-piece nodes like "alarm-latch"),
 * apply a minimal default trait list.
 *
 * @param {NodeDef} setPieceNode - node from instantiate()
 * @returns {NodeDef}
 */
export function createGameNode(setPieceNode) {
  // Already has traits — pass through
  if (setPieceNode.traits && setPieceNode.traits.length > 0) {
    return setPieceNode;
  }

  const defaultTraits = TRAITS_BY_TYPE[setPieceNode.type]
    || ["graded", "hackable", "gate"]; // fallback for unknown types

  return {
    ...setPieceNode,
    traits: defaultTraits,
  };
}

// Legacy alias — network builders that haven't migrated yet
export const enrichWithGameActions = createGameNode;

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
  RECONFIGURE: RECONFIGURE_ACTION,
  CANCEL_TRACE: CANCEL_TRACE_ACTION,
  ACCESS_DARKNET: ACCESS_DARKNET_ACTION,
};

export { TRAITS_BY_TYPE };
