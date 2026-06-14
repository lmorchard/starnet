// @ts-check
/**
 * Node-type factories — produce trait-based NodeDef objects for each game node
 * type. Factories are optional sugar; the canonical authoring surface is raw
 * NodeDefs with traits lists (see `traits.js`, and `data/biomes/` for the
 * procedural set-piece content). The hand-crafted named levels in
 * `data/networks/` are the live consumers of these factories.
 *
 * A factory just selects the right trait list and applies config overrides.
 * The verbs the traits grant (probe, xploit, dump, …) are defined as action
 * templates in `action-templates.js`.
 */

/** @typedef {import('./types.js').NodeDef} NodeDef */

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
      gateAccess: "open",
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
 * WAN — darknet store access. Starts accessible, no hack required. The `darknet`
 * trait supplies the access-darknet / lie-low / disconnect actions, the lie-low
 * timed-action operator, and the lie-low attributes.
 * @param {string} id
 * @param {NodeConfig} [config]
 * @returns {NodeDef}
 */
export function createWAN(id, config = {}) {
  return {
    id,
    type: "wan",
    traits: ["darknet"],
    attributes: {
      label: config.label || id,
      grade: "F",
      visibility: "accessible",
      accessLevel: "owned",
      ...config.attributes,
    },
  };
}
