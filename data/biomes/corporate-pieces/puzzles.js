// @ts-check
/**
 * Corporate biome set-pieces — puzzle pieces (locks, vaults, switch arrangements).
 *
 * Part of the corporate-pieces/ catalog. The barrel at ../corporate-pieces.js
 * re-exports these and assembles SET_PIECES.
 */

/** @typedef {import("../../../js/core/network/set-pieces.js").SetPieceDef} SetPieceDef */

/**
 * Combination Lock
 *
 * Pattern: all-of([switch-A, switch-B, switch-C]) — only the correct
 * simultaneous state produces the output signal. Each switch has an action
 * the player can execute when they own it. When all three fire, a quality
 * increments and the vault-reveal trigger fires.
 *
 * External ports: ['switch-a', 'switch-b', 'switch-c', 'gate']
 * Player executes 'activate' on each switch (requires accessLevel:owned).
 * When all three are activated, trigger reveals vault.
 *
 * @type {SetPieceDef}
 */
export const combinationLock = {
  id: "combination-lock",
  description: "Three switches must all be activated (all-of gate) to reveal a hidden vault.",
  nodes: [
    {
      id: "switch-a",
      type: "routing-switch",
      traits: ["graded", "hackable", "rebootable"],
      attributes: { accessLevel: "locked", activated: false },
      operators: [],
      actions: [
        {
          id: "activate",
          label: "Activate",
          requires: [
            { type: "node-attr", attr: "accessLevel", eq: "owned" },
            { type: "node-attr", attr: "activated", eq: false },
          ],
          effects: [
            { effect: "set-attr", attr: "activated", value: true },
            { effect: "emit-message", message: { type: "signal", payload: { active: true } } },
            { effect: "ctx-call", method: "log", args: ["Switch activated — routing signal sent"] },
          ],
        },
      ],
    },
    {
      id: "switch-b",
      type: "routing-switch",
      traits: ["graded", "hackable", "rebootable"],
      attributes: { accessLevel: "locked", activated: false },
      operators: [],
      actions: [
        {
          id: "activate",
          label: "Activate",
          requires: [
            { type: "node-attr", attr: "accessLevel", eq: "owned" },
            { type: "node-attr", attr: "activated", eq: false },
          ],
          effects: [
            { effect: "set-attr", attr: "activated", value: true },
            { effect: "emit-message", message: { type: "signal", payload: { active: true } } },
            { effect: "ctx-call", method: "log", args: ["Switch activated — routing signal sent"] },
          ],
        },
      ],
    },
    {
      id: "switch-c",
      type: "routing-switch",
      traits: ["graded", "hackable", "rebootable"],
      attributes: { accessLevel: "locked", activated: false },
      operators: [],
      actions: [
        {
          id: "activate",
          label: "Activate",
          requires: [
            { type: "node-attr", attr: "accessLevel", eq: "owned" },
            { type: "node-attr", attr: "activated", eq: false },
          ],
          effects: [
            { effect: "set-attr", attr: "activated", value: true },
            { effect: "emit-message", message: { type: "signal", payload: { active: true } } },
            { effect: "ctx-call", method: "log", args: ["Switch activated — routing signal sent"] },
          ],
        },
      ],
    },
    {
      id: "gate",
      type: "logic-gate",
      traits: ["graded", "hackable", "rebootable"],
      attributes: {},
      operators: [{ name: "all-of", inputs: ["switch-a", "switch-b", "switch-c"] }],
      actions: [],
    },
    {
      id: "vault",
      type: "cryptovault",
      traits: ["graded", "hackable", "rebootable"],
      attributes: { accessLevel: "locked", opened: false, concealed: true },
      operators: [{ name: "flag", on: "signal", when: { active: true }, attr: "opened" }],
      actions: [
        {
          id: "crack-vault",
          label: "Crack Vault",
          requires: [
            { type: "node-attr", attr: "accessLevel", eq: "owned" },
            { type: "node-attr", attr: "opened", eq: true },
          ],
          effects: [
            { effect: "ctx-call", method: "giveReward", args: [1500] },
            { effect: "set-attr", attr: "opened", value: false },
            { effect: "ctx-call", method: "log", args: ["Vault cracked — ¥1,500 extracted"] },
          ],
        },
      ],
    },
  ],
  internalEdges: [
    ["switch-a", "gate"],
    ["switch-b", "gate"],
    ["switch-c", "gate"],
    ["gate", "vault"],
  ],
  triggers: [
    {
      id: "vault-reveal",
      when: { type: "node-attr", nodeId: "vault", attr: "opened", eq: true },
      then: [
        { effect: "set-node-attr", nodeId: "vault", attr: "concealed", value: false },
        { effect: "reveal-node", nodeId: "vault" },
        { effect: "ctx-call", method: "log", args: ["Combination lock disengaged — vault accessible"] },
      ],
    },
  ],
  externalPorts: ["switch-a", "switch-b", "switch-c", "gate"],
  tags: ["puzzle", "treasure", "gate"],
  cost: "B",
  ports: [
    { nodeId: "switch-a", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "switch-b", direction: "lateral", wantsTags: [], required: true },
    { nodeId: "switch-c", direction: "lateral", wantsTags: [], required: true },
    { nodeId: "gate", direction: "outbound", wantsTags: ["treasure", "filler"], required: false },
  ],
};

/**
 * Switch Arrangement
 *
 * Pattern: switch actions write a quality; trigger reveals hidden subnet when
 * quality reaches target value. Unlike combination-lock (uses all-of gate),
 * this uses cumulative quality-delta — order doesn't matter, and multiple
 * switches of the same type can be added without circuit changes.
 *
 * External ports: ['panel-alpha', 'panel-beta', 'panel-gamma', 'hidden-subnet']
 * Player executes 'align' on each panel (requires owned). At target quality,
 * the hidden subnet node is revealed.
 *
 * @type {SetPieceDef}
 */
export const switchArrangement = {
  id: "switch-arrangement",
  description: "Aligning routing panels increments a quality counter; reaching target reveals hidden subnet.",
  nodes: [
    {
      id: "panel-alpha",
      type: "routing-panel",
      traits: ["graded", "hackable", "rebootable"],
      attributes: { accessLevel: "locked", aligned: false },
      operators: [],
      actions: [
        {
          id: "align",
          label: "Align Panel",
          requires: [
            { type: "node-attr", attr: "accessLevel", eq: "owned" },
            { type: "node-attr", attr: "aligned", eq: false },
          ],
          effects: [
            { effect: "set-attr", attr: "aligned", value: true },
            { effect: "quality-delta", name: "panels-aligned", delta: 1 },
            { effect: "ctx-call", method: "log", args: ["Panel aligned — routing path adjusted"] },
          ],
        },
      ],
    },
    {
      id: "panel-beta",
      type: "routing-panel",
      traits: ["graded", "hackable", "rebootable"],
      attributes: { accessLevel: "locked", aligned: false },
      operators: [],
      actions: [
        {
          id: "align",
          label: "Align Panel",
          requires: [
            { type: "node-attr", attr: "accessLevel", eq: "owned" },
            { type: "node-attr", attr: "aligned", eq: false },
          ],
          effects: [
            { effect: "set-attr", attr: "aligned", value: true },
            { effect: "quality-delta", name: "panels-aligned", delta: 1 },
            { effect: "ctx-call", method: "log", args: ["Panel aligned — routing path adjusted"] },
          ],
        },
      ],
    },
    {
      id: "panel-gamma",
      type: "routing-panel",
      traits: ["graded", "hackable", "rebootable"],
      attributes: { accessLevel: "locked", aligned: false },
      operators: [],
      actions: [
        {
          id: "align",
          label: "Align Panel",
          requires: [
            { type: "node-attr", attr: "accessLevel", eq: "owned" },
            { type: "node-attr", attr: "aligned", eq: false },
          ],
          effects: [
            { effect: "set-attr", attr: "aligned", value: true },
            { effect: "quality-delta", name: "panels-aligned", delta: 1 },
            { effect: "ctx-call", method: "log", args: ["Panel aligned — routing path adjusted"] },
          ],
        },
      ],
    },
    {
      id: "hidden-subnet",
      type: "hidden-server",
      traits: ["graded", "hackable", "rebootable", "gate"],
      attributes: { accessLevel: "locked", concealed: true },
      operators: [],
      actions: [],
    },
  ],
  internalEdges: [
    ["panel-alpha", "hidden-subnet"],
    ["panel-beta", "hidden-subnet"],
    ["panel-gamma", "hidden-subnet"],
  ],
  triggers: [
    {
      id: "subnet-reveal",
      when: { type: "quality-gte", name: "panels-aligned", value: 3 },
      then: [
        { effect: "set-node-attr", nodeId: "hidden-subnet", attr: "concealed", value: false },
        { effect: "reveal-node", nodeId: "hidden-subnet" },
        { effect: "ctx-call", method: "log", args: ["Routing aligned — hidden subnet accessible"] },
      ],
    },
  ],
  externalPorts: ["panel-alpha", "panel-beta", "panel-gamma", "hidden-subnet"],
  tags: ["filler", "puzzle"],
  cost: "D",
  ports: [
    { nodeId: "panel-alpha", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "panel-beta", direction: "lateral", wantsTags: [], required: true },
    { nodeId: "panel-gamma", direction: "lateral", wantsTags: [], required: true },
    { nodeId: "hidden-subnet", direction: "outbound", wantsTags: ["treasure", "filler"], required: false },
  ],
};

/**
 * Multi-Key Vault
 *
 * Pattern: loot requires quality("auth-tokens") >= 2; tokens collected from
 * two separate key-server nodes. Player must own both key servers and execute
 * the extract-token action before the vault becomes lootable.
 *
 * External ports: ['key-server-1', 'key-server-2', 'vault-node']
 *
 * @type {SetPieceDef}
 */
export const multiKeyVault = {
  id: "multi-key-vault",
  description: "Vault requires two auth tokens extracted from separate key servers.",
  nodes: [
    {
      id: "key-server-1",
      type: "key-server",
      traits: ["graded", "hackable", "rebootable"],
      attributes: { accessLevel: "locked", tokenExtracted: false },
      operators: [],
      actions: [
        {
          id: "extract-token",
          label: "Extract Token",
          requires: [
            { type: "node-attr", attr: "accessLevel", eq: "owned" },
            { type: "node-attr", attr: "tokenExtracted", eq: false },
          ],
          effects: [
            { effect: "set-attr", attr: "tokenExtracted", value: true },
            { effect: "quality-delta", name: "auth-tokens", delta: 1 },
            { effect: "ctx-call", method: "log", args: ["Auth token extracted from key-server-1"] },
          ],
        },
      ],
    },
    {
      id: "key-server-2",
      type: "key-server",
      traits: ["graded", "hackable", "rebootable"],
      attributes: { accessLevel: "locked", tokenExtracted: false },
      operators: [],
      actions: [
        {
          id: "extract-token",
          label: "Extract Token",
          requires: [
            { type: "node-attr", attr: "accessLevel", eq: "owned" },
            { type: "node-attr", attr: "tokenExtracted", eq: false },
          ],
          effects: [
            { effect: "set-attr", attr: "tokenExtracted", value: true },
            { effect: "quality-delta", name: "auth-tokens", delta: 1 },
            { effect: "ctx-call", method: "log", args: ["Auth token extracted from key-server-2"] },
          ],
        },
      ],
    },
    {
      id: "vault-node",
      type: "cryptovault",
      traits: ["graded", "hackable", "rebootable", "lootable"],
      attributes: { accessLevel: "locked", contents: "corp-secrets", vaultUnlocked: false },
      operators: [],
      actions: [
        {
          id: "unlock-vault",
          label: "Unlock Vault",
          desc: "Use auth tokens to decrypt the vault contents.",
          requires: [
            { type: "node-attr", attr: "accessLevel", eq: "owned" },
            { type: "node-attr", attr: "vaultUnlocked", eq: false },
            { type: "quality-gte", name: "auth-tokens", value: 2 },
          ],
          effects: [
            { effect: "set-attr", attr: "vaultUnlocked", value: true },
            { effect: "quality-set", name: "auth-tokens", value: 0 },
            { effect: "ctx-call", method: "giveReward", args: [5000] },
            { effect: "ctx-call", method: "log", args: ["Vault decrypted — 5000cr bonus transferred"] },
          ],
        },
      ],
    },
  ],
  internalEdges: [
    ["key-server-1", "vault-node"],
    ["key-server-2", "vault-node"],
  ],
  triggers: [],
  externalPorts: ["key-server-1", "key-server-2", "vault-node"],
  tags: ["puzzle", "treasure"],
  cost: "D",
  ports: [
    { nodeId: "key-server-1", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "key-server-2", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "vault-node", direction: "outbound", wantsTags: ["filler"], required: false },
  ],
};

/**
 * Encrypted Vault
 *
 * Pattern: key-gen generates a timed key (clock(period:5)); player must
 * extract the key and loot the vault before the clock resets the key.
 *
 * The key-gen node uses a clock operator and a flag operator: each time the clock
 * fires, the key attribute is refreshed to a new value. A watchdog on the
 * vault checks whether the key is still valid when loot is attempted.
 *
 * Circuit: clock(period:5) → key-ready-latch (flag). Repeating trigger watches
 * the latch: on each clock cycle it resets the latch, sets keyReady:true, and
 * expires any previously extracted but unspent key (quality-set 0). Player must
 * extract the key and loot the vault within the same clock window, or the key
 * expires and they must wait for the next cycle.
 *
 * External ports: ['key-gen', 'vault']
 *
 * @type {SetPieceDef}
 */
export const encryptedVault = {
  id: "encrypted-vault",
  description: "Decryption key expires every clock period; player must loot before key resets.",
  nodes: [
    {
      id: "key-gen",
      type: "key-gen",
      traits: ["graded", "hackable", "rebootable"],
      attributes: { accessLevel: "locked", keyReady: false },
      operators: [{ name: "clock", period: 100, periodTable: { S: 50, A: 60, B: 80, C: 100, D: 120, F: 150 } }],
      actions: [
        {
          id: "extract-key",
          label: "Extract Decryption Key",
          requires: [
            { type: "node-attr", attr: "accessLevel", eq: "owned" },
            { type: "node-attr", attr: "keyReady", eq: true },
          ],
          effects: [
            { effect: "set-attr", attr: "keyReady", value: false },
            { effect: "quality-delta", name: "decryption-key", delta: 1 },
            { effect: "ctx-call", method: "log", args: ["Decryption key extracted"] },
          ],
        },
      ],
    },
    {
      id: "key-ready-latch",
      type: "signal-latch",
      traits: ["graded", "hackable", "rebootable"],
      attributes: { latched: false },
      operators: [{ name: "flag", on: "signal", when: { active: true }, attr: "latched" }],
      actions: [],
    },
    {
      id: "vault",
      type: "cryptovault",
      traits: ["graded", "hackable", "rebootable", "lootable"],
      attributes: { accessLevel: "locked", contents: "classified-data" },
      operators: [],
      actions: [
        {
          // NOT "fetch": that core verb id is owned by the lootable trait's
          // macguffin FETCH. Reusing it shadows real loot (uncollectable
          // mission targets) and forces this action top-level instead of under
          // EXEC ▸. A distinct id keeps both: standard FETCH + this key bonus.
          id: "fetch-vault",
          label: "Fetch Vault",
          requires: [
            { type: "node-attr", attr: "accessLevel", eq: "owned" },
            { type: "quality-gte", name: "decryption-key", value: 1 },
          ],
          effects: [
            { effect: "quality-set", name: "decryption-key", value: 0 },
            { effect: "ctx-call", method: "giveReward", args: [3000] },
            { effect: "ctx-call", method: "log", args: ["Vault decrypted and looted — 3000cr"] },
          ],
        },
      ],
    },
  ],
  internalEdges: [
    ["key-gen", "key-ready-latch"],
    ["key-gen", "vault"],  // vault must be reachable from key-gen in the graph
  ],
  triggers: [
    {
      id: "key-ready",
      repeating: true,
      when: { type: "node-attr", nodeId: "key-ready-latch", attr: "latched", eq: true },
      then: [
        { effect: "set-node-attr", nodeId: "key-ready-latch", attr: "latched", value: false },
        { effect: "set-node-attr", nodeId: "key-gen", attr: "keyReady", value: true },
        { effect: "quality-set", name: "decryption-key", value: 0 },
      ],
    },
  ],
  externalPorts: ["key-gen", "vault"],
  tags: ["puzzle", "treasure"],
  cost: "B",
  ports: [
    { nodeId: "key-gen", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "vault", direction: "outbound", wantsTags: ["filler"], required: false },
  ],
};

