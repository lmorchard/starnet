// @ts-check
/**
 * Corporate biome set-pieces — scaled variants for larger budgets.
 *
 * Part of the corporate-pieces/ catalog. The barrel at ../corporate-pieces.js
 * re-exports these and assembles SET_PIECES.
 */

/** @typedef {import("../../../js/core/network/set-pieces.js").SetPieceDef} SetPieceDef */

// ---------------------------------------------------------------------------
// Scaled variants — larger versions of base set-pieces for higher budgets
// ---------------------------------------------------------------------------

/**
 * Large Server Bank — 5 fileservers + hub. More loot than the basic server bank.
 * @type {SetPieceDef}
 */
export const largeServerBank = {
  id: "large-server-bank",
  description: "Cluster of five lootable fileservers connected to a hub. Rich harvest.",
  nodes: [
    { id: "hub", type: "router", traits: ["graded", "hackable", "rebootable", "gate"], attributes: { accessLevel: "locked", gateAccess: "open" }, operators: [{ name: "relay" }], actions: [] },
    { id: "server-1", type: "fileserver", traits: ["graded", "hackable", "rebootable", "lootable", "gate"], attributes: { accessLevel: "locked" }, operators: [], actions: [] },
    { id: "server-2", type: "fileserver", traits: ["graded", "hackable", "rebootable", "lootable", "gate"], attributes: { accessLevel: "locked" }, operators: [], actions: [] },
    { id: "server-3", type: "fileserver", traits: ["graded", "hackable", "rebootable", "lootable", "gate"], attributes: { accessLevel: "locked" }, operators: [], actions: [] },
    { id: "server-4", type: "fileserver", traits: ["graded", "hackable", "rebootable", "lootable", "gate"], attributes: { accessLevel: "locked" }, operators: [], actions: [] },
    { id: "server-5", type: "fileserver", traits: ["graded", "hackable", "rebootable", "lootable", "gate"], attributes: { accessLevel: "locked" }, operators: [], actions: [] },
  ],
  internalEdges: [
    ["hub", "server-1"], ["hub", "server-2"], ["hub", "server-3"],
    ["hub", "server-4"], ["hub", "server-5"],
  ],
  triggers: [],
  externalPorts: ["hub"],
  tags: ["filler", "treasure"],
  cost: "C",
  ports: [
    { nodeId: "hub", direction: "inbound", wantsTags: [], required: true },
  ],
};

/**
 * Vault Cluster — 3 key-servers feeding 2 vaults. Bigger puzzle, bigger reward.
 * @type {SetPieceDef}
 */
export const vaultCluster = {
  id: "vault-cluster",
  description: "Three key-servers feed two vaults. Extract 3 tokens to unlock both.",
  nodes: [
    {
      id: "key-server-1", type: "key-server",
      traits: ["graded", "hackable", "rebootable"],
      attributes: { accessLevel: "locked", tokenExtracted: false },
      operators: [], actions: [{
        id: "extract-token", label: "Extract Token",
        requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }, { type: "node-attr", attr: "tokenExtracted", eq: false }],
        effects: [{ effect: "set-attr", attr: "tokenExtracted", value: true }, { effect: "quality-delta", name: "vault-keys", delta: 1 }],
      }],
    },
    {
      id: "key-server-2", type: "key-server",
      traits: ["graded", "hackable", "rebootable"],
      attributes: { accessLevel: "locked", tokenExtracted: false },
      operators: [], actions: [{
        id: "extract-token", label: "Extract Token",
        requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }, { type: "node-attr", attr: "tokenExtracted", eq: false }],
        effects: [{ effect: "set-attr", attr: "tokenExtracted", value: true }, { effect: "quality-delta", name: "vault-keys", delta: 1 }],
      }],
    },
    {
      id: "key-server-3", type: "key-server",
      traits: ["graded", "hackable", "rebootable"],
      attributes: { accessLevel: "locked", tokenExtracted: false },
      operators: [], actions: [{
        id: "extract-token", label: "Extract Token",
        requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }, { type: "node-attr", attr: "tokenExtracted", eq: false }],
        effects: [{ effect: "set-attr", attr: "tokenExtracted", value: true }, { effect: "quality-delta", name: "vault-keys", delta: 1 }],
      }],
    },
    {
      id: "vault-1", type: "cryptovault",
      traits: ["graded", "hackable", "rebootable", "lootable"],
      attributes: { accessLevel: "locked", vaultUnlocked: false },
      operators: [], actions: [{
        id: "unlock-vault", label: "Unlock Vault",
        requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }, { type: "node-attr", attr: "vaultUnlocked", eq: false }, { type: "quality-gte", name: "vault-keys", value: 3 }],
        effects: [{ effect: "set-attr", attr: "vaultUnlocked", value: true }, { effect: "ctx-call", method: "giveReward", args: [8000] }],
      }],
    },
    {
      id: "vault-2", type: "cryptovault",
      traits: ["graded", "hackable", "rebootable", "lootable"],
      attributes: { accessLevel: "locked", vaultUnlocked: false },
      operators: [], actions: [{
        id: "unlock-vault", label: "Unlock Vault",
        requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }, { type: "node-attr", attr: "vaultUnlocked", eq: false }, { type: "quality-gte", name: "vault-keys", value: 3 }],
        effects: [{ effect: "set-attr", attr: "vaultUnlocked", value: true }, { effect: "ctx-call", method: "giveReward", args: [8000] }],
      }],
    },
  ],
  internalEdges: [
    ["key-server-1", "vault-1"], ["key-server-2", "vault-1"],
    ["key-server-3", "vault-2"], ["key-server-1", "vault-2"],
  ],
  triggers: [],
  externalPorts: ["key-server-1", "key-server-2", "key-server-3"],
  tags: ["puzzle", "treasure"],
  cost: "B",
  ports: [
    { nodeId: "key-server-1", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "key-server-2", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "key-server-3", direction: "inbound", wantsTags: [], required: true },
  ],
};

/**
 * Defense Plex — 2 IDS nodes + security monitor. Larger defense footprint.
 * Both IDS nodes relay to the same monitor. Player must subvert both to
 * fully sever the alert chain.
 * @type {SetPieceDef}
 */
export const defensePlex = {
  id: "defense-plex",
  description: "Two IDS nodes relay alerts to one security monitor. Subvert both to sever the chain.",
  nodes: [
    {
      id: "ids-1", type: "ids",
      traits: ["graded", "hackable", "rebootable", "detectable", "gate"],
      attributes: { accessLevel: "locked", forwardingEnabled: true },
      // relay(filter:alert) comes from the detectable trait — no inline duplicate
      // (a second relay would double-count alerts at the monitor → recordMonitorAlert).
      actions: [{
        id: "corrupt", label: "Corrupt IDS",
        requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }],
        effects: [{ effect: "set-attr", attr: "forwardingEnabled", value: false }],
      }],
    },
    {
      id: "ids-2", type: "ids",
      traits: ["graded", "hackable", "rebootable", "detectable", "gate"],
      attributes: { accessLevel: "locked", forwardingEnabled: true },
      // relay(filter:alert) comes from the detectable trait — no inline duplicate
      // (a second relay would double-count alerts at the monitor → recordMonitorAlert).
      actions: [{
        id: "corrupt", label: "Corrupt IDS",
        requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }],
        effects: [{ effect: "set-attr", attr: "forwardingEnabled", value: false }],
      }],
    },
    {
      id: "monitor", type: "security-monitor",
      traits: ["graded", "hackable", "rebootable", "security", "gate"],
      attributes: { accessLevel: "locked", alerted: false },
      operators: [{ name: "flag", on: "alert", attr: "alerted", value: true }],
      actions: [],
    },
  ],
  internalEdges: [["ids-1", "monitor"], ["ids-2", "monitor"]],
  triggers: [],
  externalPorts: ["ids-1", "ids-2", "monitor"],
  tags: ["defense"],
  cost: "B",
  ports: [
    { nodeId: "ids-1", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "ids-2", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "monitor", direction: "outbound", wantsTags: ["filler", "treasure"], required: false },
  ],
};

/**
 * Fortified Gate — firewall guarded by an IDS. Player must subvert the IDS
 * before owning the firewall, or alerts escalate.
 * @type {SetPieceDef}
 */
export const fortifiedGate = {
  id: "fortified-gate",
  description: "Firewall guarded by IDS. Subvert IDS before owning firewall to avoid alerts.",
  nodes: [
    {
      id: "ids", type: "ids",
      traits: ["graded", "hackable", "rebootable", "detectable", "gate"],
      attributes: { accessLevel: "locked", forwardingEnabled: true },
      // relay(filter:alert) comes from the detectable trait — no inline duplicate
      // (a second relay would double-count alerts at the monitor → recordMonitorAlert).
      actions: [{
        id: "corrupt", label: "Corrupt IDS",
        requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }],
        effects: [{ effect: "set-attr", attr: "forwardingEnabled", value: false }],
      }],
    },
    {
      id: "firewall", type: "firewall",
      traits: ["graded", "hackable", "rebootable", "gate"],
      attributes: { accessLevel: "locked", gateAccess: "owned" },
      operators: [],
      actions: [],
    },
  ],
  internalEdges: [["ids", "firewall"]],
  triggers: [],
  externalPorts: ["ids", "firewall"],
  tags: ["gate", "defense"],
  cost: "C",
  ports: [
    { nodeId: "ids", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "firewall", direction: "outbound", wantsTags: ["treasure", "puzzle"], required: true },
  ],
};

/**
 * Data Center — hub + 6 fileservers. Jackpot room for high-wealth networks.
 * @type {SetPieceDef}
 */
export const dataCenter = {
  id: "data-center",
  description: "Hub connected to six fileservers. Major loot haul for deep runs.",
  nodes: [
    { id: "hub", type: "router", traits: ["graded", "hackable", "rebootable", "gate"], attributes: { accessLevel: "locked", gateAccess: "open" }, operators: [{ name: "relay" }], actions: [] },
    { id: "server-1", type: "fileserver", traits: ["graded", "hackable", "rebootable", "lootable", "gate"], attributes: { accessLevel: "locked" }, operators: [], actions: [] },
    { id: "server-2", type: "fileserver", traits: ["graded", "hackable", "rebootable", "lootable", "gate"], attributes: { accessLevel: "locked" }, operators: [], actions: [] },
    { id: "server-3", type: "fileserver", traits: ["graded", "hackable", "rebootable", "lootable", "gate"], attributes: { accessLevel: "locked" }, operators: [], actions: [] },
    { id: "server-4", type: "fileserver", traits: ["graded", "hackable", "rebootable", "lootable", "gate"], attributes: { accessLevel: "locked" }, operators: [], actions: [] },
    { id: "server-5", type: "cryptovault", traits: ["graded", "hackable", "rebootable", "lootable", "gate"], attributes: { accessLevel: "locked" }, operators: [], actions: [] },
    { id: "server-6", type: "cryptovault", traits: ["graded", "hackable", "rebootable", "lootable", "gate"], attributes: { accessLevel: "locked" }, operators: [], actions: [] },
  ],
  internalEdges: [
    ["hub", "server-1"], ["hub", "server-2"], ["hub", "server-3"],
    ["hub", "server-4"], ["hub", "server-5"], ["hub", "server-6"],
  ],
  triggers: [],
  externalPorts: ["hub"],
  tags: ["treasure"],
  cost: "A",
  ports: [
    { nodeId: "hub", direction: "inbound", wantsTags: [], required: true },
  ],
};
