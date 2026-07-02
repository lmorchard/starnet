// @ts-check
/**
 * Corporate biome set-pieces — scattered pieces (independently placed nodes).
 *
 * Part of the corporate-pieces/ catalog. The barrel at ../corporate-pieces.js
 * re-exports these and assembles SET_PIECES.
 */

/** @typedef {import("../../../js/core/network/set-pieces.js").SetPieceDef} SetPieceDef */

// ---------------------------------------------------------------------------
// Scattered set-pieces — nodes with scatter:true are placed independently
// by the generator elsewhere in the network. Quality-based communication.
// ---------------------------------------------------------------------------

/**
 * Build a scattered combination lock with N switches.
 * Switches are scatter:true, communicate with core via "locks-opened" quality.
 * @param {number} n - number of switches
 * @param {string} cost - grade
 * @returns {SetPieceDef}
 */
function makeScatteredLock(n, cost) {
  /** @type {import('../../../js/core/node-graph/types.js').NodeDef[]} */
  const switches = [];
  for (let i = 0; i < n; i++) {
    const letter = String.fromCharCode(97 + i); // a, b, c, ...
    switches.push({
      id: `switch-${letter}`,
      scatter: true,
      type: "routing-switch",
      traits: ["graded", "hackable", "rebootable"],
      attributes: { accessLevel: "locked", activated: false },
      operators: [],
      actions: [
        {
          id: "activate",
          label: "Activate",
          requires: [
            /** @type {const} */ ({ type: "node-attr", attr: "accessLevel", eq: "owned" }),
            /** @type {const} */ ({ type: "node-attr", attr: "activated", eq: false }),
          ],
          effects: [
            /** @type {const} */ ({ effect: "set-attr", attr: "activated", value: true }),
            /** @type {const} */ ({ effect: "quality-delta", name: "locks-opened", delta: 1 }),
            /** @type {const} */ ({ effect: "ctx-call", method: "log", args: ["Switch activated — routing signal sent"] }),
          ],
        },
      ],
    });
  }

  return {
    id: `scattered-lock-${n}`,
    description: `${n} scattered switches must be activated to reveal a hidden vault.`,
    nodes: [
      ...switches,
      {
        id: "gate",
        type: "logic-gate",
        traits: ["graded", "hackable", "rebootable"],
        attributes: {},
        operators: [],
        actions: [
          {
            id: "scan-lock",
            label: "Scan Lock",
            requires: [
              /** @type {const} */ ({ type: "node-attr", attr: "accessLevel", eq: "owned" }),
            ],
            effects: [
              /** @type {const} */ ({ effect: "log-template", template: `Combination lock: \${quality:locks-opened}/${n} switches activated` }),
            ],
          },
        ],
      },
      {
        id: "vault",
        type: "cryptovault",
        traits: ["graded", "hackable", "rebootable"],
        attributes: { accessLevel: "locked", concealed: true, cracked: false },
        operators: [],
        actions: [
          {
            id: "crack-vault",
            label: "Crack Vault",
            requires: [
              /** @type {const} */ ({ type: "node-attr", attr: "accessLevel", eq: "owned" }),
              /** @type {const} */ ({ type: "quality-gte", name: "locks-opened", value: n }),
              // One-shot guard: the vault pays out exactly once. The other requires
              // (owned + locks-opened>=n) are monotonic and never revert, so without
              // this the action stays available forever and farms cash on every click.
              /** @type {const} */ ({ type: "node-attr", attr: "cracked", eq: false }),
              // One-at-a-time gate (#187 Phase 5): structural check, same as the core
              // verbs' NOT_BUSY — blocks re-triggering while the crack is already in flight.
              /** @type {const} */ ({ type: "no-active-timed-action" }),
            ],
            // Timed (#187 default-flip): crack-vault is a script action, so it's
            // synthesized as timed by default (DEFAULT_SCRIPT_ACTION_DURATION, same 20-tick
            // feel-draft value this explicit block used to spell out) — turning the instant
            // payout into a legible crack rather than a silent dud, with no annotation needed.
            effects: [
              /** @type {const} */ ({ effect: "ctx-call", method: "giveReward", args: [1500] }),
              /** @type {const} */ ({ effect: "set-attr", attr: "cracked", value: true }),
              /** @type {const} */ ({ effect: "ctx-call", method: "log", args: ["Vault cracked — ¥1,500 extracted"] }),
            ],
          },
        ],
      },
    ],
    internalEdges: [["gate", "vault"]],
    triggers: [
      {
        id: "vault-reveal",
        when: /** @type {const} */ ({ type: "quality-gte", name: "locks-opened", value: n }),
        then: [
          /** @type {const} */ ({ effect: "set-node-attr", nodeId: "vault", attr: "concealed", value: false }),
          /** @type {const} */ ({ effect: "reveal-node", nodeId: "vault" }),
          /** @type {const} */ ({ effect: "ctx-call", method: "log", args: ["Combination lock disengaged — vault accessible"] }),
        ],
      },
    ],
    externalPorts: ["gate"],
    tags: ["puzzle", "treasure", "gate"],
    cost,
    ports: [
      { nodeId: "gate", direction: "inbound", wantsTags: [], required: true },
      { nodeId: "vault", direction: "outbound", wantsTags: ["treasure", "filler"], required: false },
    ],
  };
}

/** @type {SetPieceDef} */
export const scatteredLock1 = makeScatteredLock(1, "D");
/** @type {SetPieceDef} */
export const scatteredLock3 = makeScatteredLock(3, "B");
/** @type {SetPieceDef} */
export const scatteredLock5 = makeScatteredLock(5, "A");

/**
 * Build a scattered multi-key vault with N key-servers.
 * Key-servers are scatter:true, communicate with core via "keys-collected" quality.
 * @param {number} n - number of key-servers
 * @param {string} cost - grade
 * @returns {SetPieceDef}
 */
function makeScatteredKeyVault(n, cost) {
  /** @type {import('../../../js/core/node-graph/types.js').NodeDef[]} */
  const keys = [];
  for (let i = 0; i < n; i++) {
    keys.push({
      id: `key-server-${i + 1}`,
      scatter: true,
      type: "key-server",
      traits: ["graded", "hackable", "rebootable"],
      attributes: { accessLevel: "locked", tokenExtracted: false },
      operators: [],
      actions: [
        {
          id: "extract-token",
          label: "Extract Token",
          requires: [
            /** @type {const} */ ({ type: "node-attr", attr: "accessLevel", eq: "owned" }),
            /** @type {const} */ ({ type: "node-attr", attr: "tokenExtracted", eq: false }),
          ],
          effects: [
            /** @type {const} */ ({ effect: "set-attr", attr: "tokenExtracted", value: true }),
            /** @type {const} */ ({ effect: "quality-delta", name: "keys-collected", delta: 1 }),
            /** @type {const} */ ({ effect: "ctx-call", method: "log", args: ["Auth token extracted"] }),
          ],
        },
      ],
    });
  }

  return {
    id: `scattered-key-vault-${n}`,
    description: `${n} scattered key-servers must be owned to unlock a central vault.`,
    nodes: [
      ...keys,
      {
        id: "vault-node",
        type: "cryptovault",
        traits: ["graded", "hackable", "rebootable"],
        attributes: { accessLevel: "locked" },
        operators: [],
        actions: [
          {
            id: "scan-vault",
            label: "Scan Vault",
            requires: [
              /** @type {const} */ ({ type: "node-attr", attr: "accessLevel", eq: "owned" }),
            ],
            effects: [
              /** @type {const} */ ({ effect: "log-template", template: `Key vault: \${quality:keys-collected}/${n} tokens collected` }),
            ],
          },
          {
            id: "unlock-vault",
            label: "Unlock Vault",
            requires: [
              /** @type {const} */ ({ type: "node-attr", attr: "accessLevel", eq: "owned" }),
              /** @type {const} */ ({ type: "quality-gte", name: "keys-collected", value: n }),
            ],
            effects: [
              /** @type {const} */ ({ effect: "quality-set", name: "keys-collected", value: 0 }),
              /** @type {const} */ ({ effect: "ctx-call", method: "giveReward", args: [5000] }),
              /** @type {const} */ ({ effect: "ctx-call", method: "log", args: ["Vault unlocked — ¥5,000 extracted"] }),
            ],
          },
        ],
      },
    ],
    internalEdges: [],
    triggers: [],
    externalPorts: ["vault-node"],
    tags: ["puzzle", "treasure"],
    cost,
    ports: [
      { nodeId: "vault-node", direction: "inbound", wantsTags: [], required: true },
    ],
  };
}

/** @type {SetPieceDef} */
export const scatteredKeyVault2 = makeScatteredKeyVault(2, "C");
/** @type {SetPieceDef} */
export const scatteredKeyVault3 = makeScatteredKeyVault(3, "B");

/**
 * Build a scattered encrypted vault with N key-gen nodes.
 * Key-gens are scatter:true, communicate with core via "decryption-keys" quality.
 * @param {number} n - number of key-gens
 * @param {string} cost - grade
 * @returns {SetPieceDef}
 */
function makeScatteredEncryptedVault(n, cost) {
  /** @type {import('../../../js/core/node-graph/types.js').NodeDef[]} */
  const keyGens = [];
  for (let i = 0; i < n; i++) {
    keyGens.push({
      id: `key-gen-${i + 1}`,
      scatter: true,
      type: "key-gen",
      traits: ["graded", "hackable", "rebootable"],
      attributes: { accessLevel: "locked", keyExtracted: false },
      operators: [],
      actions: [
        {
          id: "extract-key",
          label: "Extract Key",
          requires: [
            /** @type {const} */ ({ type: "node-attr", attr: "accessLevel", eq: "owned" }),
            /** @type {const} */ ({ type: "node-attr", attr: "keyExtracted", eq: false }),
            // One-at-a-time gate (#187 Phase 5): structural check, same as the core
            // verbs' NOT_BUSY — blocks re-triggering while the extraction is in flight.
            /** @type {const} */ ({ type: "no-active-timed-action" }),
          ],
          // Timed (#187 default-flip): extract-key is a script action, so it's synthesized
          // as timed by default (DEFAULT_SCRIPT_ACTION_DURATION, same 20-tick feel-draft
          // value this explicit block used to spell out) — turning the instant extraction
          // into a legible process rather than a silent dud, with no annotation needed.
          effects: [
            /** @type {const} */ ({ effect: "set-attr", attr: "keyExtracted", value: true }),
            /** @type {const} */ ({ effect: "quality-delta", name: "decryption-keys", delta: 1 }),
            /** @type {const} */ ({ effect: "ctx-call", method: "log", args: ["Decryption key extracted"] }),
          ],
        },
      ],
    });
  }

  return {
    id: `scattered-encrypted-vault-${n}`,
    description: `${n} scattered key-gen nodes must be owned to decrypt a central vault.`,
    nodes: [
      ...keyGens,
      {
        id: "vault",
        type: "cryptovault",
        traits: ["graded", "hackable", "rebootable", "lootable"],
        attributes: { accessLevel: "locked" },
        operators: [],
        actions: [
          {
            id: "scan-vault",
            label: "Scan Vault",
            requires: [
              /** @type {const} */ ({ type: "node-attr", attr: "accessLevel", eq: "owned" }),
            ],
            effects: [
              /** @type {const} */ ({ effect: "log-template", template: `Encrypted vault: \${quality:decryption-keys}/${n} keys collected` }),
            ],
          },
          {
            id: "decrypt-loot",
            label: "Decrypt & Loot",
            requires: [
              /** @type {const} */ ({ type: "node-attr", attr: "accessLevel", eq: "owned" }),
              /** @type {const} */ ({ type: "quality-gte", name: "decryption-keys", value: n }),
            ],
            effects: [
              /** @type {const} */ ({ effect: "quality-set", name: "decryption-keys", value: 0 }),
              /** @type {const} */ ({ effect: "ctx-call", method: "giveReward", args: [3000] }),
              /** @type {const} */ ({ effect: "ctx-call", method: "log", args: ["Encrypted vault decrypted — ¥3,000 extracted"] }),
            ],
          },
        ],
      },
    ],
    internalEdges: [],
    triggers: [],
    externalPorts: ["vault"],
    tags: ["puzzle", "treasure"],
    cost,
    ports: [
      { nodeId: "vault", direction: "inbound", wantsTags: [], required: true },
    ],
  };
}

/** @type {SetPieceDef} */
export const scatteredEncryptedVault2 = makeScatteredEncryptedVault(2, "C");
/** @type {SetPieceDef} */
export const scatteredEncryptedVault3 = makeScatteredEncryptedVault(3, "B");
