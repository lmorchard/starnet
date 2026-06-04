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

import { A } from "../action-ids.js";
import { getExploitChoices, getExploitEmptyReason } from "../exploits.js";

// ── Shared action templates ──────────────────────────────────

/** @type {ActionDef} */
const PROBE_ACTION = {
  id: A.PROBE,
  label: "PROBE",
  desc: "Reveal vulnerabilities. Raises local alert.",
  requires: [
    { type: "node-attr", attr: "accessLevel", eq: "locked" },
    { type: "node-attr", attr: "probed", eq: false },
    { type: "node-attr", attr: "rebooting", eq: false },
    { type: "node-attr", attr: "probing", eq: false },
  ],
  effects: [
    { effect: "set-attr", attr: "probing", value: true },
    { effect: "set-attr", attr: "_ta_probe_progress", value: 0 },
  ],
};

// Abort: unified cancel for any timed action. The execution is generic
// (queries timed-action operators at runtime), but the requires list must
// enumerate activeAttr flags so the action system knows when to show it.
// When adding a new timed action, add its activeAttr here.
/** @type {ActionDef} */
const ABORT_ACTION = {
  id: A.ABORT,
  label: "ABORT",
  desc: "Cancel the current timed action.",
  requires: [
    {
      type: "any-of", conditions: [
        { type: "node-attr", attr: "probing", eq: true },
        { type: "node-attr", attr: "exploiting", eq: true },
        { type: "node-attr", attr: "reading", eq: true },
        { type: "node-attr", attr: "looting", eq: true },
      ],
    },
  ],
  effects: [
    { effect: "ctx-call", method: "abortTimedAction", args: ["$nodeId"] },
  ],
};

/**
 * Exploit action template. NOTE: the exploitId (card selection) is passed via
 * event payload, not through the action system. The dispatcher handles exploit
 * specially — it extracts exploitId and calls ctx.startExploit(nodeId, exploitId)
 * directly. The graph.executeAction path is bypassed for exploit.
 *
 * Multi-step action: choosing XPLOIT opens a node-anchored card picker (the UI reads
 * this followup). Picking a card re-dispatches starnet:action with { exploitId }, which
 * the dispatcher routes to ctx.startExploit. The hand + console supply exploitId directly
 * and skip the picker entirely.
 * @type {ActionDef}
 */
const EXPLOIT_ACTION = {
  id: A.XPLOIT,
  label: "XPLOIT",
  desc: "Attack with an exploit card.",
  requires: [
    { type: "node-attr", attr: "visibility", eq: "accessible" },
    { type: "node-attr", attr: "rebooting", eq: false },
    { type: "node-attr", attr: "exploiting", eq: false },
  ],
  followup: {
    title: (node) => `XPLOIT ${node.id}`,
    choices: getExploitChoices,
    empty: getExploitEmptyReason,
  },
  effects: [
    { effect: "ctx-call", method: "startExploit", args: ["$nodeId"] },
  ],
};

// cancel-xploit removed — absorbed into unified ABORT_ACTION

/** @type {ActionDef} */
const DUMP_ACTION = {
  id: A.DUMP,
  label: "DUMP",
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
    { effect: "set-attr", attr: "reading", value: true },
    { effect: "set-attr", attr: "_ta_read_progress", value: 0 },
  ],
};

// cancel-dump removed — absorbed into unified ABORT_ACTION

/** @type {ActionDef} */
const FETCH_ACTION = {
  id: A.FETCH,
  label: "FETCH",
  desc: "Extract macguffins for cash.",
  requires: [
    { type: "node-attr", attr: "accessLevel", eq: "owned" },
    { type: "node-attr", attr: "read", eq: true },
    { type: "node-attr", attr: "rebooting", eq: false },
    { type: "node-attr", attr: "looted", eq: false },
    { type: "node-attr", attr: "looting", eq: false },
  ],
  effects: [
    { effect: "set-attr", attr: "looting", value: true },
    { effect: "set-attr", attr: "_ta_loot_progress", value: 0 },
  ],
};

// cancel-fetch removed — absorbed into unified ABORT_ACTION

/** @type {ActionDef} */
const EJECT_ACTION = {
  id: A.EJECT,
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
  id: A.REBOOT,
  label: "REBOOT",
  desc: "Force ICE home and take node offline 1-3s.",
  requires: [
    { type: "node-attr", attr: "accessLevel", eq: "owned" },
    { type: "node-attr", attr: "rebooting", eq: false },
  ],
  effects: [
    // startReboot handles ICE eviction + deselect + setting rebooting + duration
    { effect: "ctx-call", method: "startReboot", args: ["$nodeId"] },
  ],
};

/** @type {ActionDef} */
const RECONFIGURE_ACTION = {
  id: A.CORRUPT,
  label: "CORRUPT",
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
  id: A.CANCEL_TRACE,
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
  id: A.ACCESS_DARKNET,
  label: "ACCESS DARKNET",
  desc: "Access the darknet broker to purchase exploit cards.",
  requires: [],
  effects: [
    { effect: "ctx-call", method: "openDarknetsStore", args: [] },
  ],
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


// ── Export action templates for testing ───────────────────────

export const ACTION_TEMPLATES = {
  PROBE: PROBE_ACTION,
  ABORT: ABORT_ACTION,
  EXPLOIT: EXPLOIT_ACTION,
  DUMP: DUMP_ACTION,
  FETCH: FETCH_ACTION,
  EJECT: EJECT_ACTION,
  REBOOT: REBOOT_ACTION,
  RECONFIGURE: RECONFIGURE_ACTION,
  CANCEL_TRACE: CANCEL_TRACE_ACTION,
  ACCESS_DARKNET: ACCESS_DARKNET_ACTION,
};

