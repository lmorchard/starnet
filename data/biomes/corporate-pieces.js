// @ts-check
/**
 * Corporate biome set-pieces — all puzzle, defense, treasure, and atomic
 * content for the corporate LAN biome. Each biome has its own pieces file.
 *
 * Infrastructure (instantiate, typedefs) lives in js/core/network/set-pieces.js.
 */

/** @typedef {import("../../js/core/network/set-pieces.js").SetPieceDef} SetPieceDef */

// Set-piece catalog
// ---------------------------------------------------------------------------

/**
 * IDS Relay Chain
 *
 * Pattern: IDS → security-monitor
 * The IDS node relays alert messages to the connected monitor. Subverting the
 * IDS (setting forwardingEnabled:false) severs the alert chain — monitor never
 * hears about exploits on that segment.
 *
 * External ports: ['ids', 'monitor']
 * Receives: alert messages at 'ids'
 * The player subverts 'ids' via the reconfigure action (requires owned).
 *
 * @type {SetPieceDef}
 */
export const idsRelayChain = {
  id: "ids-relay-chain",
  description: "IDS node relays alert messages to security monitor. Subverting IDS severs the chain.",
  nodes: [
    {
      id: "ids",
      type: "ids",
      traits: ["graded", "hackable", "rebootable", "detectable", "gate"],
      attributes: { accessLevel: "locked", forwardingEnabled: true },
      // relay(filter:alert) comes from the detectable trait — no inline duplicate
      // (a second relay would double-count alerts at the monitor → recordMonitorAlert).
      actions: [
        {
          id: "corrupt",
          label: "Corrupt IDS",
          requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }],
          effects: [{ effect: "set-attr", attr: "forwardingEnabled", value: false }],
        },
      ],
    },
    {
      id: "monitor",
      type: "security-monitor",
      traits: ["graded", "hackable", "rebootable", "security", "gate"],
      attributes: { accessLevel: "locked", alerted: false },
      operators: [{ name: "flag", on: "alert", attr: "alerted", value: true }],
      actions: [],
    },
  ],
  internalEdges: [["ids", "monitor"]],
  // Alert escalation + cancel-trace now handled by per-node triggers in the
  // security trait. No set-piece triggers needed.
  triggers: [],
  externalPorts: ["ids", "monitor"],
  tags: ["defense"],
  cost: "C",
  ports: [
    { nodeId: "ids", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "monitor", direction: "outbound", wantsTags: ["filler", "treasure"], required: false },
  ],
};

/**
 * N-th Access Alarm
 *
 * Pattern: counter(n, emits:alert) — probing N times starts trace regardless
 * of per-probe outcomes.
 *
 * External ports: ['sensor']
 * Receives: probe-noise at 'sensor'. After N probe-noise messages, emits alert
 * and fires the trace trigger.
 *
 * @type {SetPieceDef}
 */
export const nthAlarm = {
  id: "nth-alarm",
  description: "Counter node fires trace after N probe-noise messages, regardless of per-probe outcomes.",
  nodes: [
    {
      id: "sensor",
      type: "tripwire-sensor",
      traits: ["graded", "hackable", "rebootable"],
      attributes: { accessLevel: "locked", threshold: 3, counterEnabled: true },
      operators: [
        {
          name: "counter",
          n: 3,
          filter: "probe-noise",
          emits: { type: "set", payload: {} },
          enabledAttr: "counterEnabled",
        },
      ],
      actions: [
        {
          id: "spoof",
          label: "Spoof Sensor",
          requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }],
          effects: [{ effect: "set-attr", attr: "counterEnabled", value: false }],
        },
      ],
    },
    {
      id: "alarm-latch",
      type: "alarm-latch",
      traits: ["graded", "hackable", "rebootable"],
      attributes: { latched: false, latchEnabled: true },
      operators: [{ name: "latch", enabledAttr: "latchEnabled" }],
      actions: [
        {
          id: "disarm",
          label: "Disarm Latch",
          requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }],
          effects: [
            { effect: "set-attr", attr: "latchEnabled", value: false },
            { effect: "set-attr", attr: "latched", value: false },
          ],
        },
      ],
      triggers: [{
        id: "alarm-fire",
        when: { type: "node-attr", attr: "latched", eq: true },
        enabledAttr: "latchEnabled",
        then: [
          { effect: "ctx-call", method: "startTrace", args: [] },
          { effect: "ctx-call", method: "log", args: ["ALERT: Access threshold exceeded — trace initiated"] },
        ],
      }],
    },
  ],
  internalEdges: [["sensor", "alarm-latch"]],
  triggers: [],
  externalPorts: ["sensor"],
  tags: ["pressure", "trap"],
  cost: "C",
  ports: [
    { nodeId: "sensor", direction: "inbound", wantsTags: [], required: true },
  ],
};

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
 * Deadman Circuit
 *
 * Pattern: clock → set-converter → alarm-latch; heartbeat-relay → reset-converter → alarm-latch
 *
 * The clock periodically arms the alarm latch. An external heartbeat message,
 * forwarded through the heartbeat relay, continuously disarms it. If the relay
 * is subverted (forwardingEnabled:false), heartbeat stops reaching the latch,
 * and the next clock tick arms it permanently — firing the trace trigger.
 *
 * Counterintuitive to normal IDS play: subverting this relay INCREASES danger.
 *
 * External ports: ['heartbeat-relay']
 * Receives: heartbeat messages at 'heartbeat-relay'
 *
 * @type {SetPieceDef}
 */
export const deadmanCircuit = {
  id: "deadman-circuit",
  description: "Heartbeat clock keeps watchdog alive via relay. Subverting the relay stops heartbeats and fires the trace.",
  nodes: [
    {
      id: "heartbeat-clock",
      type: "heartbeat-source",
      traits: ["graded", "hackable", "rebootable"],
      attributes: {},
      // Clock sends heartbeat — must be faster than watchdog period
      operators: [{ name: "clock", period: 30, periodTable: { S: 15, A: 20, B: 25, C: 30, D: 40, F: 50 } }],
      actions: [],
    },
    {
      id: "heartbeat-relay",
      type: "heartbeat-monitor",
      traits: ["graded", "hackable", "rebootable"],
      attributes: { accessLevel: "locked", forwardingEnabled: true },
      // Relay forwards heartbeat messages (clock signal arrives as "signal",
      // relay forwards all non-tick messages including signals)
      operators: [{ name: "relay" }],
      actions: [
        {
          id: "subvert",
          label: "Subvert Relay",
          desc: "Block heartbeat signals. WARNING: may trigger deadman alarm.",
          requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }],
          effects: [{ effect: "set-attr", attr: "forwardingEnabled", value: false }],
        },
      ],
    },
    {
      id: "watchdog",
      type: "watchdog-daemon",
      traits: ["graded", "hackable", "rebootable"],
      attributes: {},
      // Watchdog resets on any non-tick message. If no message arrives within
      // the period, it fires a "set" message to the alarm latch.
      operators: [{ name: "watchdog", period: 50, periodTable: { S: 25, A: 30, B: 40, C: 50, D: 60, F: 80 } }],
      actions: [],
    },
    {
      id: "alarm-latch",
      type: "alarm-latch",
      traits: ["graded", "hackable", "rebootable"],
      attributes: { latched: false },
      operators: [{ name: "latch" }],
      actions: [],
      triggers: [{
        id: "deadman-fired",
        when: { type: "node-attr", attr: "latched", eq: true },
        then: [
          { effect: "ctx-call", method: "startTrace", args: [] },
          { effect: "ctx-call", method: "log", args: ["DEADMAN: Heartbeat lost — trace initiated"] },
        ],
      }],
    },
  ],
  internalEdges: [
    ["heartbeat-clock", "heartbeat-relay"],
    ["heartbeat-relay", "watchdog"],
    ["watchdog", "alarm-latch"],
  ],
  triggers: [],
  externalPorts: ["heartbeat-relay"],
  tags: ["pressure", "trap"],
  cost: "B",
  minDepth: 3,  // watchdog starts immediately — don't place near entry
  ports: [
    { nodeId: "heartbeat-relay", direction: "inbound", wantsTags: [], required: true },
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
 * Honey Pot
 *
 * Pattern: flag(on:exploit) — the node looks like a target but any exploit
 * attempt fires a counter-trace trigger immediately.
 *
 * The "bait" design: the honey-pot node has fake reward attributes that look
 * attractive (accessLevel: owned, contents: "corp-secrets"), but exploiting it
 * immediately sets poisoned:true and fires the trace.
 *
 * External ports: ['honey-pot']
 * Player "owns" honey-pot by default (bait) — any exploit triggers the trap.
 *
 * @type {SetPieceDef}
 */
export const honeyPot = {
  id: "honey-pot",
  description: "Fake target that fires a counter-trace on first exploit attempt.",
  nodes: [
    {
      id: "honey-pot",
      type: "honey-pot",
      traits: ["graded", "hackable", "rebootable", "lootable"],
      attributes: { accessLevel: "owned", contents: "corp-secrets", poisoned: false, trap: true },
      operators: [{ name: "flag", on: "exploit", attr: "poisoned" }],
      actions: [],
      // Per-node trigger: fire trace when poisoned (exploit/fetch/mine received)
      triggers: [{
        id: "triggered",
        when: { type: "node-attr", attr: "poisoned", eq: true },
        then: [
          { effect: "ctx-call", method: "startTrace", args: [] },
          { effect: "ctx-call", method: "log", args: ["HONEYPOT: Counter-intrusion trace initiated"] },
        ],
      }],
    },
  ],
  internalEdges: [],
  triggers: [],
  externalPorts: ["honey-pot"],
  tags: ["trap"],
  cost: "A",
  ports: [
    { nodeId: "honey-pot", direction: "inbound", wantsTags: [], required: true },
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

/**
 * Cascade Shutdown
 *
 * Pattern: three relay nodes form a chain; subverting any one starts a
 * watchdog countdown. Player must subvert all three before the watchdog
 * fires — otherwise the alarm triggers and the nodes lock down.
 *
 * External ports: ['relay-a', 'relay-b', 'relay-c']
 *
 * @type {SetPieceDef}
 */
export const cascadeShutdown = {
  id: "cascade-shutdown",
  description: "Subvert all three relay nodes before the watchdog expires or the network locks down.",
  nodes: [
    {
      id: "relay-a",
      type: "data-relay",
      traits: ["graded", "hackable", "rebootable"],
      attributes: { accessLevel: "locked", forwardingEnabled: true, subverted: false },
      operators: [],
      actions: [
        {
          id: "subvert",
          label: "Subvert Relay A",
          requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }],
          effects: [
            { effect: "set-attr", attr: "subverted", value: true },
            { effect: "set-attr", attr: "forwardingEnabled", value: false },
            { effect: "quality-delta", name: "relays-subverted", delta: 1 },
            { effect: "emit-message", message: { type: "subvert-ping", payload: {} } },
          ],
        },
      ],
    },
    {
      id: "relay-b",
      type: "data-relay",
      traits: ["graded", "hackable", "rebootable"],
      attributes: { accessLevel: "locked", forwardingEnabled: true, subverted: false },
      operators: [],
      actions: [
        {
          id: "subvert",
          label: "Subvert Relay B",
          requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }],
          effects: [
            { effect: "set-attr", attr: "subverted", value: true },
            { effect: "set-attr", attr: "forwardingEnabled", value: false },
            { effect: "quality-delta", name: "relays-subverted", delta: 1 },
            { effect: "emit-message", message: { type: "subvert-ping", payload: {} } },
          ],
        },
      ],
    },
    {
      id: "relay-c",
      type: "data-relay",
      traits: ["graded", "hackable", "rebootable"],
      attributes: { accessLevel: "locked", forwardingEnabled: true, subverted: false },
      operators: [],
      actions: [
        {
          id: "subvert",
          label: "Subvert Relay C",
          requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }],
          effects: [
            { effect: "set-attr", attr: "subverted", value: true },
            { effect: "set-attr", attr: "forwardingEnabled", value: false },
            { effect: "quality-delta", name: "relays-subverted", delta: 1 },
            { effect: "emit-message", message: { type: "subvert-ping", payload: {} } },
          ],
        },
      ],
    },
    {
      id: "watchdog",
      type: "watchdog-daemon",
      traits: ["graded", "hackable", "rebootable"],
      attributes: {},
      operators: [{ name: "watchdog", period: 4, periodTable: { S: 2, A: 3, B: 3, C: 4, D: 5, F: 6 } }],
      actions: [],
    },
    {
      id: "alarm-latch",
      type: "alarm-latch",
      traits: ["graded", "hackable", "rebootable"],
      attributes: { latched: false },
      operators: [{ name: "latch" }],
      actions: [],
    },
  ],
  internalEdges: [
    ["relay-a", "watchdog"],
    ["relay-b", "watchdog"],
    ["relay-c", "watchdog"],
    ["watchdog", "alarm-latch"],
  ],
  triggers: [
    {
      id: "cascade-complete",
      when: { type: "quality-gte", name: "relays-subverted", value: 3 },
      then: [
        { effect: "ctx-call", method: "giveReward", args: [2000] },
        { effect: "ctx-call", method: "log", args: ["Cascade shutdown complete — network silenced"] },
      ],
    },
    {
      id: "cascade-failed",
      when: { type: "node-attr", nodeId: "alarm-latch", attr: "latched", eq: true },
      then: [
        { effect: "ctx-call", method: "startTrace", args: [] },
        { effect: "ctx-call", method: "log", args: ["ALARM: Cascade shutdown detected — trace initiated"] },
      ],
    },
  ],
  externalPorts: ["relay-a", "relay-b", "relay-c"],
  tags: ["pressure", "puzzle"],
  cost: "A",
  minDepth: 3,  // watchdog starts immediately — don't place near entry
  ports: [
    { nodeId: "relay-a", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "relay-b", direction: "lateral", wantsTags: [], required: true },
    { nodeId: "relay-c", direction: "lateral", wantsTags: [], required: true },
  ],
};

/**
 * Tripwire Gauntlet
 *
 * Pattern: probe arms sensor; alarm fires 6 ticks later. Gives the player
 * a narrow window to complete an objective before the alarm arrives.
 *
 * The sensor delays the probe-noise message by 6 ticks before forwarding
 * it to the alarm node. The sensor itself flags immediately (so the player
 * knows they're on the clock), but the alarm doesn't fire until tick 6.
 *
 * Note: chained delay nodes with undirected edges cause backwards
 * propagation — use a single delay node for reliable timing.
 *
 * External ports: ['sensor', 'alarm']
 *
 * @type {SetPieceDef}
 */
export const tripwireGauntlet = {
  id: "tripwire-gauntlet",
  description: "Probe arms sensor immediately; alarm fires 6 ticks later. Race to complete objective.",
  nodes: [
    {
      id: "sensor",
      type: "tripwire-sensor",
      traits: ["graded", "hackable", "rebootable"],
      attributes: { accessLevel: "locked", triggered: false, sensorEnabled: true },
      operators: [
        { name: "flag", on: "probe-noise", attr: "triggered", enabledAttr: "sensorEnabled" },
        { name: "delay", ticks: 6, ticksTable: { S: 3, A: 4, B: 5, C: 6, D: 8, F: 10 }, enabledAttr: "sensorEnabled" },
      ],
      actions: [
        {
          id: "bypass",
          label: "Bypass Tripwire",
          requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }],
          effects: [{ effect: "set-attr", attr: "sensorEnabled", value: false }],
        },
      ],
    },
    {
      id: "alarm",
      type: "alarm",
      traits: ["graded", "hackable", "rebootable"],
      attributes: { accessLevel: "locked", triggered: false },
      operators: [{ name: "flag", on: "probe-noise", attr: "triggered" }],
      actions: [],
    },
  ],
  internalEdges: [["sensor", "alarm"]],
  triggers: [
    {
      id: "gauntlet-alarm",
      when: { type: "node-attr", nodeId: "alarm", attr: "triggered", eq: true },
      then: [
        { effect: "ctx-call", method: "startTrace", args: [] },
        { effect: "ctx-call", method: "log", args: ["TRIPWIRE: Delayed alarm reached — trace initiated"] },
      ],
    },
  ],
  externalPorts: ["sensor", "alarm"],
  tags: ["pressure"],
  cost: "B",
  ports: [
    { nodeId: "sensor", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "alarm", direction: "outbound", wantsTags: ["filler", "treasure"], required: false },
  ],
};

/**
 * Probe Burst Alarm
 *
 * Pattern: tally operator counts probe-noise messages into a quality; repeating
 * trigger fires spawnICE every N probes and resets the counter. Unlike
 * nthAlarm (one-shot counter), this escalates *indefinitely* — each burst
 * of N probes spawns another ICE.
 *
 * The repeating trigger fires, applies quality-set 0 to reset the counter,
 * then the next N probes trigger it again.
 *
 * External ports: ['scanner']
 * Receives: probe-noise at 'scanner'.
 *
 * @type {SetPieceDef}
 */
export const probeBurstAlarm = {
  id: "probe-burst-alarm",
  description: "Spawns ICE for every burst of 3 probe-noise events. Repeats indefinitely.",
  nodes: [
    {
      id: "scanner",
      type: "traffic-scanner",
      traits: ["graded", "hackable", "rebootable"],
      attributes: { accessLevel: "locked", tallyEnabled: true },
      operators: [{ name: "tally", on: "probe-noise", quality: "probe-bursts", delta: 1, enabledAttr: "tallyEnabled" }],
      actions: [
        {
          id: "blind",
          label: "Blind Scanner",
          requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }],
          effects: [{ effect: "set-attr", attr: "tallyEnabled", value: false }],
        },
      ],
    },
  ],
  internalEdges: [],
  triggers: [
    {
      id: "burst-detected",
      repeating: true,
      when: { type: "quality-gte", name: "probe-bursts", value: 3 },
      then: [
        { effect: "quality-set", name: "probe-bursts", value: 0 },
        { effect: "ctx-call", method: "spawnICE", args: [] },
        { effect: "ctx-call", method: "log", args: ["BURST: Probe cluster detected — ICE dispatched"] },
      ],
    },
  ],
  externalPorts: ["scanner"],
  tags: ["pressure", "defense"],
  cost: "A",
  ports: [
    { nodeId: "scanner", direction: "inbound", wantsTags: [], required: true },
  ],
};

/**
 * Noisy Sensor
 *
 * Pattern: debounce operator on the sensor ensures only the *first* probe-noise
 * per N ticks reaches the downstream alarm. The player can exploit the quiet
 * window after first contact to probe repeatedly without each probe chaining
 * an alarm — but the first touch in each window still costs them.
 *
 * External ports: ['sensor']
 * Receives: probe-noise at 'sensor'.
 *
 * @type {SetPieceDef}
 */
export const noisySensor = {
  id: "noisy-sensor",
  description: "Debounced sensor: only the first probe-noise per 4 ticks reaches the monitor.",
  nodes: [
    {
      id: "sensor",
      type: "traffic-sensor",
      traits: ["graded", "hackable", "rebootable"],
      attributes: { accessLevel: "locked", debounceEnabled: true },
      operators: [{ name: "debounce", on: "probe-noise", ticks: 4, ticksTable: { S: 2, A: 3, B: 3, C: 4, D: 5, F: 7 }, enabledAttr: "debounceEnabled" }],
      actions: [
        {
          id: "muffle",
          label: "Muffle Sensor",
          requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }],
          effects: [{ effect: "set-attr", attr: "debounceEnabled", value: false }],
        },
      ],
    },
    {
      id: "alarm-flag",
      type: "alarm-flag",
      traits: ["graded", "hackable", "rebootable"],
      attributes: { triggered: false },
      operators: [{ name: "flag", on: "probe-noise", attr: "triggered" }],
      actions: [],
    },
  ],
  internalEdges: [["sensor", "alarm-flag"]],
  triggers: [
    {
      id: "sensor-alarmed",
      repeating: true,
      when: { type: "node-attr", nodeId: "alarm-flag", attr: "triggered", eq: true },
      then: [
        { effect: "set-node-attr", nodeId: "alarm-flag", attr: "triggered", value: false },
        { effect: "ctx-call", method: "setGlobalAlert", args: ["yellow"] },
        { effect: "ctx-call", method: "log", args: ["SENSOR: First probe in window — alert raised"] },
      ],
    },
  ],
  externalPorts: ["sensor"],
  tags: ["defense", "pressure"],
  cost: "C",
  ports: [
    { nodeId: "sensor", direction: "inbound", wantsTags: [], required: true },
  ],
};

/**
 * Tamper Detect
 *
 * Pattern: reconfiguring the IDS emits a `tamper` message that propagates
 * through a visible tamper-relay to a tamper-flag node. If the tamper-flag
 * trips, a trace is initiated. The player must neutralize the tamper-relay
 * *before* reconfiguring the IDS, or the reconfigure itself starts a trace.
 *
 * All connections are in the graph (legible). The puzzle is sequencing:
 * neutralize the tamper circuit → *then* reconfigure the IDS.
 *
 * Counterintuitive in a fun way: doing the "right thing" (reconfigure) in the
 * wrong order triggers the alarm. The tamper chain is visible — it's a puzzle
 * to solve, not a gotcha.
 *
 * External ports: ['ids', 'security-monitor', 'tamper-relay', 'tamper-flag']
 * Receives: alert messages at 'ids'.
 *
 * @type {SetPieceDef}
 */
export const tamperDetect = {
  id: "tamper-detect",
  description: "Reconfiguring the IDS emits a tamper alert — unless the tamper relay is neutralized first.",
  nodes: [
    {
      id: "ids",
      type: "ids",
      traits: ["graded", "hackable", "rebootable", "detectable", "gate"],
      attributes: { accessLevel: "locked", forwardingEnabled: true },
      // relay(filter:alert) comes from the detectable trait — no inline duplicate
      // (a second relay would double-count alerts at the monitor → recordMonitorAlert).
      actions: [
        {
          id: "corrupt",
          label: "Corrupt IDS",
          requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }],
          effects: [
            { effect: "set-attr", attr: "forwardingEnabled", value: false },
            { effect: "emit-message", message: { type: "tamper", payload: {} } },
          ],
        },
      ],
    },
    {
      id: "security-monitor",
      type: "security-monitor",
      traits: ["graded", "hackable", "rebootable", "security", "gate"],
      attributes: { accessLevel: "locked", alerted: false },
      operators: [{ name: "flag", on: "alert", attr: "alerted" }],
      actions: [],
    },
    {
      id: "tamper-relay",
      type: "tamper-relay",
      traits: ["graded", "hackable", "rebootable"],
      attributes: { accessLevel: "locked", forwardingEnabled: true },
      operators: [{ name: "relay", filter: "tamper" }],
      actions: [
        {
          id: "neutralize",
          label: "Neutralize Tamper Relay",
          requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }],
          effects: [{ effect: "set-attr", attr: "forwardingEnabled", value: false }],
        },
      ],
    },
    {
      id: "tamper-flag",
      type: "tamper-detector",
      traits: ["graded", "hackable", "rebootable"],
      attributes: { triggered: false },
      operators: [{ name: "flag", on: "tamper", attr: "triggered" }],
      actions: [],
    },
  ],
  internalEdges: [
    ["ids", "security-monitor"],
    ["ids", "tamper-relay"],
    ["tamper-relay", "tamper-flag"],
  ],
  triggers: [
    {
      id: "tamper-detected",
      when: { type: "node-attr", nodeId: "tamper-flag", attr: "triggered", eq: true },
      then: [
        { effect: "ctx-call", method: "startTrace", args: [] },
        { effect: "ctx-call", method: "log", args: ["TAMPER: IDS reconfiguration detected — trace initiated"] },
      ],
    },
  ],
  externalPorts: ["ids", "security-monitor", "tamper-relay", "tamper-flag"],
  tags: ["defense", "puzzle"],
  cost: "B",
  ports: [
    { nodeId: "ids", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "security-monitor", direction: "outbound", wantsTags: ["filler", "treasure"], required: false },
    { nodeId: "tamper-relay", direction: "outbound", wantsTags: [], required: false },
    { nodeId: "tamper-flag", direction: "outbound", wantsTags: [], required: false },
  ],
};

/**
 * Server Bank
 *
 * Pattern: a cluster of plain fileserver nodes connected to a common hub.
 * No puzzles, no defenses — just straightforward loot. The hub routes
 * traffic between the servers and the rest of the network.
 *
 * External ports: ['hub', 'server-1', 'server-2', 'server-3']
 * The hub is the entry point; servers are lootable.
 *
 * @type {SetPieceDef}
 */
export const serverBank = {
  id: "server-bank",
  description: "Cluster of three lootable fileservers connected to a hub.",
  nodes: [
    {
      id: "hub",
      type: "router",
      traits: ["graded", "hackable", "rebootable", "gate"],
      attributes: { accessLevel: "locked", gateAccess: "compromised" },
      operators: [{ name: "relay" }],
      actions: [],
    },
    {
      id: "server-1",
      type: "fileserver",
      traits: ["graded", "hackable", "rebootable", "lootable", "gate"],
      attributes: { accessLevel: "locked" },
      operators: [],
      actions: [],
    },
    {
      id: "server-2",
      type: "fileserver",
      traits: ["graded", "hackable", "rebootable", "lootable", "gate"],
      attributes: { accessLevel: "locked" },
      operators: [],
      actions: [],
    },
    {
      id: "server-3",
      type: "fileserver",
      traits: ["graded", "hackable", "rebootable", "lootable", "gate"],
      attributes: { accessLevel: "locked" },
      operators: [],
      actions: [],
    },
  ],
  internalEdges: [
    ["hub", "server-1"],
    ["hub", "server-2"],
    ["hub", "server-3"],
  ],
  triggers: [],
  externalPorts: ["hub", "server-1", "server-2", "server-3"],
  tags: ["filler", "treasure"],
  cost: "D",
  ports: [
    { nodeId: "hub", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "server-1", direction: "outbound", wantsTags: [], required: false },
    { nodeId: "server-2", direction: "outbound", wantsTags: [], required: false },
    { nodeId: "server-3", direction: "outbound", wantsTags: [], required: false },
  ],
};

/**
 * Office Cluster
 *
 * Pattern: a few workstations connected to a fileserver. Exploration filler.
 * Workstations might hold small loot; the fileserver is the main prize.
 * No defenses, no puzzles — just territory to map and harvest.
 *
 * External ports: ['fileserver', 'workstation-1', 'workstation-2']
 *
 * @type {SetPieceDef}
 */
export const officeCluster = {
  id: "office-cluster",
  description: "Workstations connected to a fileserver. Exploration filler with light loot.",
  nodes: [
    {
      id: "fileserver",
      type: "fileserver",
      traits: ["graded", "hackable", "rebootable", "lootable", "gate"],
      attributes: { accessLevel: "locked" },
      operators: [],
      actions: [],
    },
    {
      id: "workstation-1",
      type: "workstation",
      traits: ["graded", "hackable", "rebootable", "lootable", "gate"],
      attributes: { accessLevel: "locked" },
      operators: [],
      actions: [],
    },
    {
      id: "workstation-2",
      type: "workstation",
      traits: ["graded", "hackable", "rebootable", "lootable", "gate"],
      attributes: { accessLevel: "locked" },
      operators: [],
      actions: [],
    },
  ],
  internalEdges: [
    ["fileserver", "workstation-1"],
    ["fileserver", "workstation-2"],
  ],
  triggers: [],
  externalPorts: ["fileserver", "workstation-1", "workstation-2"],
  tags: ["filler", "treasure"],
  cost: "D",
  ports: [
    { nodeId: "fileserver", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "workstation-1", direction: "outbound", wantsTags: [], required: false },
    { nodeId: "workstation-2", direction: "outbound", wantsTags: [], required: false },
  ],
};

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
    { id: "hub", type: "router", traits: ["graded", "hackable", "rebootable", "gate"], attributes: { accessLevel: "locked", gateAccess: "compromised" }, operators: [{ name: "relay" }], actions: [] },
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
    { id: "hub", type: "router", traits: ["graded", "hackable", "rebootable", "gate"], attributes: { accessLevel: "locked", gateAccess: "compromised" }, operators: [{ name: "relay" }], actions: [] },
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
  /** @type {import('../../js/core/node-graph/types.js').NodeDef[]} */
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
            ],
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
  /** @type {import('../../js/core/node-graph/types.js').NodeDef[]} */
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
  /** @type {import('../../js/core/node-graph/types.js').NodeDef[]} */
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
          ],
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

/**
 * Convenience catalog of all set-pieces.
 */
export const SET_PIECES = {
  idsRelayChain,
  nthAlarm,
  combinationLock,
  deadmanCircuit,
  switchArrangement,
  multiKeyVault,
  honeyPot,
  encryptedVault,
  cascadeShutdown,
  tripwireGauntlet,
  probeBurstAlarm,
  noisySensor,
  tamperDetect,
  serverBank,
  officeCluster,
  // Scaled variants
  largeServerBank,
  vaultCluster,
  defensePlex,
  fortifiedGate,
  dataCenter,
  // Scattered variants
  scatteredLock1,
  scatteredLock3,
  scatteredLock5,
  scatteredKeyVault2,
  scatteredKeyVault3,
  scatteredEncryptedVault2,
  scatteredEncryptedVault3,
};

// ---------------------------------------------------------------------------
// Atomic set-pieces
// ---------------------------------------------------------------------------

/**
 * Entry point — gateway + WAN. Exactly one per network.
 * The gateway is the player's starting node; the WAN provides darknet access.
 * @type {SetPieceDef}
 */
export const entryPoint = {
  id: "entry-point",
  description: "Network entry: gateway (player start) + WAN (darknet access).",
  nodes: [
    {
      id: "gateway",
      type: "gateway",
      traits: ["graded", "hackable", "rebootable", "gate"],
      attributes: { accessLevel: "locked", visibility: "accessible" },
      operators: [],
      actions: [],
    },
    {
      id: "wan",
      type: "wan",
      traits: ["darknet"],
      attributes: { accessLevel: "owned", visibility: "accessible" },
      operators: [],
      actions: [],
    },
  ],
  internalEdges: [["gateway", "wan"]],
  triggers: [],
  externalPorts: ["gateway"],
  tags: ["entry"],
  cost: "F",
  ports: [
    { nodeId: "gateway", direction: "outbound", wantsTags: ["spine", "gate"], required: true },
  ],
};

/**
 * Single router — spine node with multiple outbound ports for branching.
 * Compromise to reveal the network beyond.
 * @type {SetPieceDef}
 */
export const singleRouter = {
  id: "single-router",
  description: "Router node: compromise to reveal connected segments.",
  nodes: [
    {
      id: "router",
      type: "router",
      traits: ["graded", "hackable", "rebootable", "gate"],
      attributes: { accessLevel: "locked", gateAccess: "compromised" },
      operators: [{ name: "relay" }],
      actions: [],
    },
  ],
  internalEdges: [],
  triggers: [],
  externalPorts: ["router"],
  tags: ["spine", "gate"],
  cost: "F",
  ports: [
    { nodeId: "router", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "router", direction: "outbound", wantsTags: [], required: false },
    { nodeId: "router", direction: "outbound", wantsTags: [], required: false },
    { nodeId: "router", direction: "outbound", wantsTags: [], required: false },
  ],
};

/**
 * Single firewall — gate node that blocks access to deeper content.
 * Own to reveal the network beyond. Higher base grade than a router.
 * @type {SetPieceDef}
 */
export const singleFirewall = {
  id: "single-firewall",
  description: "Firewall node: own to access deeper network segments.",
  nodes: [
    {
      id: "firewall",
      type: "firewall",
      traits: ["graded", "hackable", "rebootable", "gate"],
      attributes: { accessLevel: "locked", gateAccess: "owned" },
      operators: [],
      actions: [],
    },
  ],
  internalEdges: [],
  triggers: [],
  externalPorts: ["firewall"],
  tags: ["gate"],
  cost: "D",
  ports: [
    { nodeId: "firewall", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "firewall", direction: "outbound", wantsTags: ["treasure", "puzzle"], required: true },
  ],
};

/**
 * Single workstation — leaf filler node. Cheap exploration target.
 * @type {SetPieceDef}
 */
export const singleWorkstation = {
  id: "single-workstation",
  description: "Workstation node: small loot target, exploration filler.",
  nodes: [
    {
      id: "workstation",
      type: "workstation",
      traits: ["graded", "hackable", "rebootable", "lootable", "gate"],
      attributes: { accessLevel: "locked" },
      operators: [],
      actions: [],
    },
  ],
  internalEdges: [],
  triggers: [],
  externalPorts: ["workstation"],
  tags: ["filler"],
  cost: "F",
  ports: [
    { nodeId: "workstation", direction: "inbound", wantsTags: [], required: true },
  ],
};

/**
 * Single fileserver — leaf treasure node. Lootable with macguffins.
 * @type {SetPieceDef}
 */
export const singleFileserver = {
  id: "single-fileserver",
  description: "Fileserver node: lootable target with data rewards.",
  nodes: [
    {
      id: "fileserver",
      type: "fileserver",
      traits: ["graded", "hackable", "rebootable", "lootable", "gate"],
      attributes: { accessLevel: "locked" },
      operators: [],
      actions: [],
    },
  ],
  internalEdges: [],
  triggers: [],
  externalPorts: ["fileserver"],
  tags: ["filler", "treasure"],
  cost: "F",
  ports: [
    { nodeId: "fileserver", direction: "inbound", wantsTags: [], required: true },
  ],
};

// ---------------------------------------------------------------------------
// Scenario set-pieces — narrative-flavored configurations that create
// interesting tactical situations through grade asymmetry or topology.
// ---------------------------------------------------------------------------

/**
 * Workstation Array — a router hub connected to 4 workstations.
 * Methodical looting: many small targets behind a single gate.
 * Each workstation has small loot; the volume adds up.
 *
 * @type {SetPieceDef}
 */
export const workstationArray = {
  id: "workstation-array",
  description: "Array of four workstations behind a hub router. Methodical looting territory.",
  nodes: [
    {
      id: "hub",
      type: "router",
      traits: ["graded", "hackable", "rebootable", "gate"],
      attributes: { accessLevel: "locked", gateAccess: "compromised" },
      operators: [{ name: "relay" }],
      actions: [],
    },
    {
      id: "ws-1",
      type: "workstation",
      traits: ["graded", "hackable", "rebootable", "lootable", "gate"],
      attributes: { accessLevel: "locked" },
      operators: [],
      actions: [],
    },
    {
      id: "ws-2",
      type: "workstation",
      traits: ["graded", "hackable", "rebootable", "lootable", "gate"],
      attributes: { accessLevel: "locked" },
      operators: [],
      actions: [],
    },
    {
      id: "ws-3",
      type: "workstation",
      traits: ["graded", "hackable", "rebootable", "lootable", "gate"],
      attributes: { accessLevel: "locked" },
      operators: [],
      actions: [],
    },
    {
      id: "ws-4",
      type: "workstation",
      traits: ["graded", "hackable", "rebootable", "lootable", "gate"],
      attributes: { accessLevel: "locked" },
      operators: [],
      actions: [],
    },
  ],
  internalEdges: [
    ["hub", "ws-1"],
    ["hub", "ws-2"],
    ["hub", "ws-3"],
    ["hub", "ws-4"],
  ],
  triggers: [],
  externalPorts: ["hub", "ws-1", "ws-2", "ws-3", "ws-4"],
  tags: ["filler", "treasure"],
  cost: "D",
  ports: [
    { nodeId: "hub", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "ws-1", direction: "outbound", wantsTags: [], required: false },
    { nodeId: "ws-2", direction: "outbound", wantsTags: [], required: false },
    { nodeId: "ws-3", direction: "outbound", wantsTags: [], required: false },
    { nodeId: "ws-4", direction: "outbound", wantsTags: [], required: false },
  ],
};

/**
 * Lucky Break — a low-grade firewall guarding a cryptovault.
 * The corp cut corners on perimeter hardening but the vault itself is standard.
 * Easy entry, normal prize. The player who spots this saves time.
 *
 * Grade asymmetry: firewall is 2 grades below default, vault is at default.
 * After network-level grade shift, the relative gap is preserved.
 *
 * @type {SetPieceDef}
 */
export const luckyBreak = {
  id: "lucky-break",
  description: "Weak firewall guarding a cryptovault. Someone cut corners on hardening.",
  nodes: [
    {
      id: "weak-gate",
      type: "firewall",
      traits: ["graded", "hackable", "rebootable", "gate"],
      attributes: { accessLevel: "locked", gateAccess: "owned", grade: "F" },
      operators: [],
      actions: [],
    },
    {
      id: "vault",
      type: "cryptovault",
      traits: ["graded", "hackable", "rebootable", "lootable", "gate"],
      attributes: { accessLevel: "locked", grade: "C" },
      operators: [],
      actions: [],
    },
  ],
  internalEdges: [["weak-gate", "vault"]],
  triggers: [],
  externalPorts: ["weak-gate", "vault"],
  tags: ["treasure"],
  cost: "C",
  ports: [
    { nodeId: "weak-gate", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "vault", direction: "outbound", wantsTags: [], required: false },
  ],
};

/**
 * Security Theater — a high-grade firewall protecting low-grade fileservers.
 * The corp invested in a flashy perimeter but the interior is soft.
 * Hard entry, easy loot. Rewards the player who commits to cracking the gate.
 *
 * Grade asymmetry: firewall is 2 grades above default, fileservers are 2 below.
 *
 * @type {SetPieceDef}
 */
export const securityTheater = {
  id: "security-theater",
  description: "Imposing firewall, unprotected fileservers behind it. All bark, no bite inside.",
  nodes: [
    {
      id: "hard-gate",
      type: "firewall",
      traits: ["graded", "hackable", "rebootable", "gate"],
      attributes: { accessLevel: "locked", gateAccess: "owned", grade: "B" },
      operators: [],
      actions: [],
    },
    {
      id: "soft-server-1",
      type: "fileserver",
      traits: ["graded", "hackable", "rebootable", "lootable", "gate"],
      attributes: { accessLevel: "locked", grade: "F" },
      operators: [],
      actions: [],
    },
    {
      id: "soft-server-2",
      type: "fileserver",
      traits: ["graded", "hackable", "rebootable", "lootable", "gate"],
      attributes: { accessLevel: "locked", grade: "F" },
      operators: [],
      actions: [],
    },
  ],
  internalEdges: [
    ["hard-gate", "soft-server-1"],
    ["hard-gate", "soft-server-2"],
  ],
  triggers: [],
  externalPorts: ["hard-gate", "soft-server-1", "soft-server-2"],
  tags: ["gate", "treasure"],
  cost: "C",
  ports: [
    { nodeId: "hard-gate", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "soft-server-1", direction: "outbound", wantsTags: [], required: false },
    { nodeId: "soft-server-2", direction: "outbound", wantsTags: [], required: false },
  ],
};

// ---------------------------------------------------------------------------
// Backbone set-pieces — spine nodes connecting wings in hierarchical networks.
// All backbone pieces include relay operators for alert message propagation.
// ---------------------------------------------------------------------------

/**
 * Backbone router — the standard backbone spine node. 1 inbound, 2 outbound.
 * Relays alert messages so security signals propagate across wings.
 * @type {SetPieceDef}
 */
export const backboneRouter = {
  id: "backbone-router",
  description: "Backbone router: connects network wings, relays alert signals.",
  nodes: [
    {
      id: "router",
      type: "router",
      traits: ["graded", "hackable", "rebootable", "gate"],
      attributes: { accessLevel: "locked", gateAccess: "compromised" },
      operators: [{ name: "relay" }],
      actions: [],
    },
  ],
  internalEdges: [],
  triggers: [],
  externalPorts: ["router"],
  tags: ["backbone"],
  cost: "F",
  ports: [
    { nodeId: "router", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "router", direction: "outbound", wantsTags: [], required: true },
    { nodeId: "router", direction: "outbound", wantsTags: [], required: false },
  ],
};

/**
 * Backbone firewall — higher-grade chokepoint on the backbone. 1 inbound, 1 outbound.
 * Harder to crack than a router; relays alert messages.
 * @type {SetPieceDef}
 */
export const backboneFirewall = {
  id: "backbone-firewall",
  description: "Backbone firewall: high-grade chokepoint between network wings.",
  nodes: [
    {
      id: "firewall",
      type: "firewall",
      traits: ["graded", "hackable", "rebootable", "gate"],
      attributes: { accessLevel: "locked", gateAccess: "owned" },
      operators: [{ name: "relay", filter: "alert" }],
      actions: [],
    },
  ],
  internalEdges: [],
  triggers: [],
  externalPorts: ["firewall"],
  tags: ["backbone"],
  cost: "C",
  ports: [
    { nodeId: "firewall", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "firewall", direction: "outbound", wantsTags: [], required: true },
  ],
};

/**
 * Backbone hub — wide backbone node with extra outbound ports. 1 inbound, 3 outbound.
 * Creates branching points on the backbone itself.
 * @type {SetPieceDef}
 */
export const backboneHub = {
  id: "backbone-hub",
  description: "Backbone hub: wide router with multiple outbound connections.",
  nodes: [
    {
      id: "hub",
      type: "router",
      traits: ["graded", "hackable", "rebootable", "gate"],
      attributes: { accessLevel: "locked", gateAccess: "compromised" },
      operators: [{ name: "relay" }],
      actions: [],
    },
  ],
  internalEdges: [],
  triggers: [],
  externalPorts: ["hub"],
  tags: ["backbone"],
  cost: "D",
  ports: [
    { nodeId: "hub", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "hub", direction: "outbound", wantsTags: [], required: true },
    { nodeId: "hub", direction: "outbound", wantsTags: [], required: false },
    { nodeId: "hub", direction: "outbound", wantsTags: [], required: false },
  ],
};

/**
 * All atomic set-pieces.
 */
export const ATOMICS = {
  entryPoint,
  singleRouter,
  singleFirewall,
  singleWorkstation,
  singleFileserver,
};

/**
 * Backbone set-pieces.
 */
export const BACKBONE_PIECES = {
  backboneRouter,
  backboneFirewall,
  backboneHub,
};
