// @ts-check
/**
 * Set-piece library for the reactive node graph runtime.
 *
 * A set-piece is a self-contained, pre-wired subgraph: nodes with atoms,
 * internal edges, triggers, actions, and named external ports. It is the
 * authoring unit for puzzle content. The generator picks set-pieces from a
 * biome palette, instantiates them with a unique prefix, and wires their
 * external ports into the broader network.
 *
 * Usage:
 *   import { instantiate, SET_PIECES } from './set-pieces.js';
 *   const { nodes, edges, triggers, externalPorts } = instantiate(SET_PIECES.combinationLock, 'v1');
 *   const graph = new NodeGraph({ nodes, edges, triggers });
 */

/** @typedef {import('./types.js').NodeDef} NodeDef */
/** @typedef {import('./types.js').TriggerDef} TriggerDef */
/** @typedef {import('./types.js').Condition} Condition */
/** @typedef {import('./types.js').Effect} Effect */
/** @typedef {import('./types.js').MessageDescriptor} MessageDescriptor */

/**
 * A set-piece definition — a self-contained, reusable subgraph.
 * @typedef {Object} SetPieceDef
 * @property {string} id
 * @property {string} description
 * @property {NodeDef[]} nodes
 * @property {[string, string][]} internalEdges
 * @property {TriggerDef[]} [triggers]
 * @property {string[]} externalPorts   - node IDs that connect to rest of network
 */

/**
 * An instantiated set-piece, ready to pass to NodeGraph.
 * @typedef {Object} SetPieceInstance
 * @property {NodeDef[]} nodes
 * @property {[string, string][]} edges
 * @property {TriggerDef[]} triggers
 * @property {string[]} externalPorts   - prefixed port IDs
 */

// ---------------------------------------------------------------------------
// Instantiation
// ---------------------------------------------------------------------------

/**
 * Prefix a single node ID.
 * @param {string} id
 * @param {string} prefix
 * @returns {string}
 */
function pfx(id, prefix) {
  return `${prefix}/${id}`;
}

/**
 * Rewrite a Condition, prefixing any embedded nodeIds.
 * @param {Condition} cond
 * @param {string} prefix
 * @returns {Condition}
 */
function rewriteCondition(cond, prefix) {
  switch (cond.type) {
    case "node-attr":
      return cond.nodeId ? { ...cond, nodeId: pfx(cond.nodeId, prefix) } : cond;
    case "quality-gte":
    case "quality-eq":
      return { ...cond, name: pfx(cond.name, prefix) };
    case "all-of":
    case "any-of":
      return { ...cond, conditions: cond.conditions.map((c) => rewriteCondition(c, prefix)) };
    default:
      return cond;
  }
}

/**
 * Rewrite a MessageDescriptor, prefixing any destination nodeIds.
 * @param {MessageDescriptor} msg
 * @param {string} prefix
 * @returns {MessageDescriptor}
 */
function rewriteMessage(msg, prefix) {
  if (!msg.destinations) return msg;
  return { ...msg, destinations: msg.destinations.map((d) => pfx(d, prefix)) };
}

/**
 * Rewrite an Effect, prefixing any embedded nodeIds.
 * @param {Effect} effect
 * @param {string} prefix
 * @returns {Effect}
 */
function rewriteEffect(effect, prefix) {
  switch (effect.effect) {
    case "set-node-attr":
      return { ...effect, nodeId: pfx(effect.nodeId, prefix) };
    case "reveal-node":
    case "enable-node":
      return { ...effect, nodeId: pfx(effect.nodeId, prefix) };
    case "emit-message":
      return { ...effect, message: rewriteMessage(effect.message, prefix) };
    case "quality-delta":
    case "quality-set":
      return { ...effect, name: pfx(effect.name, prefix) };
    default:
      return effect;
  }
}

/**
 * Instantiate a set-piece with a unique prefix.
 * Rewrites all internal node ID references so multiple instances can coexist
 * in the same NodeGraph without ID collisions.
 *
 * @param {SetPieceDef} def
 * @param {string} prefix   - unique string, e.g. "v1", "ids-east", "lock-3"
 * @returns {SetPieceInstance}
 */
export function instantiate(def, prefix) {
  const nodes = def.nodes.map((node) => {
    // Rewrite atom configs that contain node IDs or quality names
    const atoms = (node.atoms ?? []).map((cfg) => {
      let updated = { ...cfg };
      // Prefix inputs for gate atoms
      if ((cfg.name === "any-of" || cfg.name === "all-of") && cfg.inputs) {
        updated = { ...updated, inputs: cfg.inputs.map((id) => pfx(id, prefix)) };
      }
      // Prefix quality name for tally atom
      if (cfg.name === "tally" && cfg.quality) {
        updated = { ...updated, quality: pfx(cfg.quality, prefix) };
      }
      // Prefix destinations override (any atom can have one)
      if (cfg.destinations) {
        updated = { ...updated, destinations: cfg.destinations.map((d) => pfx(d, prefix)) };
      }
      return updated;
    });

    // Rewrite actions: requires conditions + effects
    const actions = (node.actions ?? []).map((action) => ({
      ...action,
      requires: (action.requires ?? []).map((c) => rewriteCondition(c, prefix)),
      effects: (action.effects ?? []).map((e) => rewriteEffect(e, prefix)),
    }));

    return {
      ...node,
      id: pfx(node.id, prefix),
      atoms,
      actions,
    };
  });

  const edges = (def.internalEdges ?? []).map(
    ([a, b]) => /** @type {[string, string]} */ ([pfx(a, prefix), pfx(b, prefix)])
  );

  const triggers = (def.triggers ?? []).map((t) => ({
    ...t,
    id: pfx(t.id, prefix),
    when: rewriteCondition(t.when, prefix),
    then: t.then.map((e) => rewriteEffect(e, prefix)),
  }));

  const externalPorts = def.externalPorts.map((id) => pfx(id, prefix));

  return { nodes, edges, triggers, externalPorts };
}

// ---------------------------------------------------------------------------
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
      attributes: { accessLevel: "locked", forwardingEnabled: true },
      atoms: [{ name: "relay", filter: "alert" }],
      actions: [
        {
          id: "reconfigure",
          label: "Reconfigure IDS",
          requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }],
          effects: [{ effect: "set-attr", attr: "forwardingEnabled", value: false }],
        },
      ],
    },
    {
      id: "monitor",
      type: "security-monitor",
      attributes: { accessLevel: "locked", alerted: false },
      atoms: [{ name: "flag", on: "alert", attr: "alerted", value: true }],
      actions: [],
    },
  ],
  internalEdges: [["ids", "monitor"]],
  triggers: [
    {
      id: "alert-reached-monitor",
      when: { type: "node-attr", nodeId: "monitor", attr: "alerted", eq: true },
      then: [
        { effect: "ctx-call", method: "setGlobalAlert", args: ["yellow"] },
        { effect: "ctx-call", method: "log", args: ["Security monitor: intrusion alert raised"] },
      ],
    },
  ],
  externalPorts: ["ids", "monitor"],
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
      attributes: { accessLevel: "locked", threshold: 3 },
      atoms: [
        {
          name: "counter",
          n: 3,
          filter: "probe-noise",
          emits: { type: "set", payload: {} },
        },
      ],
      actions: [],
    },
    {
      id: "alarm-latch",
      type: "alarm-latch",
      attributes: { latched: false },
      atoms: [{ name: "latch" }],
      actions: [],
    },
  ],
  internalEdges: [["sensor", "alarm-latch"]],
  triggers: [
    {
      id: "nth-alarm-fire",
      when: { type: "node-attr", nodeId: "alarm-latch", attr: "latched", eq: true },
      then: [
        { effect: "ctx-call", method: "startTrace", args: [] },
        { effect: "ctx-call", method: "log", args: ["ALERT: Access threshold exceeded — trace initiated"] },
      ],
    },
  ],
  externalPorts: ["sensor"],
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
      attributes: { accessLevel: "locked", activated: false },
      atoms: [],
      actions: [
        {
          id: "activate",
          label: "Activate",
          requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }],
          effects: [
            { effect: "set-attr", attr: "activated", value: true },
            { effect: "quality-delta", name: "combination-switches-set", delta: 1 },
            { effect: "emit-message", message: { type: "signal", payload: { active: true } } },
          ],
        },
      ],
    },
    {
      id: "switch-b",
      type: "routing-switch",
      attributes: { accessLevel: "locked", activated: false },
      atoms: [],
      actions: [
        {
          id: "activate",
          label: "Activate",
          requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }],
          effects: [
            { effect: "set-attr", attr: "activated", value: true },
            { effect: "quality-delta", name: "combination-switches-set", delta: 1 },
            { effect: "emit-message", message: { type: "signal", payload: { active: true } } },
          ],
        },
      ],
    },
    {
      id: "switch-c",
      type: "routing-switch",
      attributes: { accessLevel: "locked", activated: false },
      atoms: [],
      actions: [
        {
          id: "activate",
          label: "Activate",
          requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }],
          effects: [
            { effect: "set-attr", attr: "activated", value: true },
            { effect: "quality-delta", name: "combination-switches-set", delta: 1 },
            { effect: "emit-message", message: { type: "signal", payload: { active: true } } },
          ],
        },
      ],
    },
    {
      id: "gate",
      type: "logic-gate",
      attributes: {},
      atoms: [{ name: "all-of", inputs: ["switch-a", "switch-b", "switch-c"] }],
      actions: [],
    },
    {
      id: "vault",
      type: "cryptovault",
      attributes: { visible: false, accessLevel: "locked" },
      atoms: [],
      actions: [],
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
      when: { type: "quality-gte", name: "combination-switches-set", value: 3 },
      then: [
        { effect: "set-node-attr", nodeId: "vault", attr: "visible", value: true },
        { effect: "set-node-attr", nodeId: "vault", attr: "accessLevel", value: "locked" },
        { effect: "ctx-call", method: "revealNode", args: [] },
        { effect: "ctx-call", method: "log", args: ["Combination lock disengaged — vault accessible"] },
        { effect: "ctx-call", method: "giveReward", args: [1500] },
      ],
    },
  ],
  externalPorts: ["switch-a", "switch-b", "switch-c", "gate"],
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
  description: "Watchdog arms alarm if no heartbeat arrives within the period. Blocking the relay fires the trace.",
  nodes: [
    {
      id: "heartbeat-relay",
      type: "heartbeat-monitor",
      attributes: { accessLevel: "locked", forwardingEnabled: true },
      atoms: [{ name: "relay", filter: "heartbeat" }],
      actions: [
        {
          id: "subvert",
          label: "Subvert Relay",
          requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }],
          effects: [{ effect: "set-attr", attr: "forwardingEnabled", value: false }],
        },
      ],
    },
    {
      id: "watchdog",
      type: "watchdog-daemon",
      attributes: {},
      atoms: [{ name: "watchdog", period: 5 }],
      actions: [],
    },
    {
      id: "alarm-latch",
      type: "alarm-latch",
      attributes: { latched: false },
      atoms: [{ name: "latch" }],
      actions: [],
    },
  ],
  internalEdges: [
    ["heartbeat-relay", "watchdog"],
    ["watchdog", "alarm-latch"],
  ],
  triggers: [
    {
      id: "deadman-fired",
      when: { type: "node-attr", nodeId: "alarm-latch", attr: "latched", eq: true },
      then: [
        { effect: "ctx-call", method: "startTrace", args: [] },
        { effect: "ctx-call", method: "log", args: ["DEADMAN: Heartbeat lost — trace initiated"] },
      ],
    },
  ],
  externalPorts: ["heartbeat-relay"],
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
      attributes: { accessLevel: "locked", aligned: false },
      atoms: [],
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
          ],
        },
      ],
    },
    {
      id: "panel-beta",
      type: "routing-panel",
      attributes: { accessLevel: "locked", aligned: false },
      atoms: [],
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
          ],
        },
      ],
    },
    {
      id: "panel-gamma",
      type: "routing-panel",
      attributes: { accessLevel: "locked", aligned: false },
      atoms: [],
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
          ],
        },
      ],
    },
    {
      id: "hidden-subnet",
      type: "hidden-server",
      attributes: { visible: false, accessLevel: "locked" },
      atoms: [],
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
        { effect: "set-node-attr", nodeId: "hidden-subnet", attr: "visible", value: true },
        { effect: "ctx-call", method: "revealNode", args: [] },
        { effect: "ctx-call", method: "log", args: ["Routing aligned — hidden subnet accessible"] },
      ],
    },
  ],
  externalPorts: ["panel-alpha", "panel-beta", "panel-gamma", "hidden-subnet"],
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
      attributes: { accessLevel: "locked", tokenExtracted: false },
      atoms: [],
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
      attributes: { accessLevel: "locked", tokenExtracted: false },
      atoms: [],
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
      attributes: { accessLevel: "owned", contents: "corp-secrets" },
      atoms: [],
      actions: [
        {
          id: "loot",
          label: "Loot Vault",
          requires: [
            { type: "node-attr", attr: "accessLevel", eq: "owned" },
            { type: "quality-gte", name: "auth-tokens", value: 2 },
          ],
          effects: [
            { effect: "quality-set", name: "auth-tokens", value: 0 },
            { effect: "ctx-call", method: "giveReward", args: [5000] },
            { effect: "ctx-call", method: "log", args: ["Vault looted — 5000cr transferred"] },
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
};

/**
 * Honey Pot
 *
 * Pattern: flag(on:exploit) → alarm-latch — the node looks like a target
 * but any exploit attempt arms the latch and fires a counter-trace trigger.
 *
 * The "bait" design: the honey-pot node has fake reward attributes that look
 * attractive (accessLevel: owned, contents: "corp-secrets"), but probing or
 * exploiting it immediately arms the alarm. The player has no way to safely
 * interact with it once the latch fires.
 *
 * External ports: ['honey-pot', 'alarm-latch']
 * Player "owns" honey-pot by default (bait) — any action triggers the trap.
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
      attributes: { accessLevel: "owned", contents: "corp-secrets", poisoned: false },
      atoms: [{ name: "flag", on: "exploit", attr: "poisoned" }],
      actions: [],
    },
    {
      id: "alarm-latch",
      type: "alarm-latch",
      attributes: { latched: false },
      atoms: [{ name: "latch" }],
      actions: [],
    },
  ],
  internalEdges: [],
  triggers: [
    {
      id: "honey-pot-triggered",
      when: { type: "node-attr", nodeId: "honey-pot", attr: "poisoned", eq: true },
      then: [
        { effect: "ctx-call", method: "startTrace", args: [] },
        { effect: "ctx-call", method: "log", args: ["HONEYPOT: Counter-intrusion trace initiated"] },
      ],
    },
  ],
  externalPorts: ["honey-pot"],
};

/**
 * Encrypted Vault
 *
 * Pattern: key-gen generates a timed key (clock(period:5)); player must
 * extract the key and loot the vault before the clock resets the key.
 *
 * The key-gen node uses a clock atom and a flag atom: each time the clock
 * fires, the key attribute is refreshed to a new value. A watchdog on the
 * vault checks whether the key is still valid when loot is attempted.
 *
 * Simplified circuit: key-gen produces key; every clock period it resets.
 * Loot action on vault requires quality("decryption-key") >= 1. Player
 * must extract key (quality-delta +1) and loot before clock fires
 * (quality-set 0 on clock signal via the alarm-latch reset path).
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
      attributes: { accessLevel: "locked", keyReady: false },
      atoms: [{ name: "clock", period: 5 }],
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
      attributes: { latched: false },
      atoms: [{ name: "flag", on: "signal", when: { active: true }, attr: "latched" }],
      actions: [],
    },
    {
      id: "vault",
      type: "cryptovault",
      attributes: { accessLevel: "locked", contents: "classified-data" },
      atoms: [],
      actions: [
        {
          id: "loot",
          label: "Loot Vault",
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
  ],
  triggers: [
    {
      id: "key-ready",
      when: { type: "node-attr", nodeId: "key-ready-latch", attr: "latched", eq: true },
      then: [
        { effect: "set-node-attr", nodeId: "key-gen", attr: "keyReady", value: true },
        { effect: "ctx-call", method: "log", args: ["Key-gen cycle: decryption key available"] },
      ],
    },
  ],
  externalPorts: ["key-gen", "vault"],
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
      attributes: { accessLevel: "locked", forwardingEnabled: true, subverted: false },
      atoms: [{ name: "relay", filter: "subvert-ping" }],
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
      attributes: { accessLevel: "locked", forwardingEnabled: true, subverted: false },
      atoms: [{ name: "relay", filter: "subvert-ping" }],
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
      attributes: { accessLevel: "locked", forwardingEnabled: true, subverted: false },
      atoms: [{ name: "relay", filter: "subvert-ping" }],
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
      attributes: {},
      atoms: [{ name: "watchdog", period: 4 }],
      actions: [],
    },
    {
      id: "alarm-latch",
      type: "alarm-latch",
      attributes: { latched: false },
      atoms: [{ name: "latch" }],
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
      attributes: { triggered: false },
      atoms: [
        { name: "flag", on: "probe-noise", attr: "triggered" },
        { name: "delay", ticks: 6 },
      ],
      actions: [],
    },
    {
      id: "alarm",
      type: "alarm",
      attributes: { triggered: false },
      atoms: [{ name: "flag", on: "probe-noise", attr: "triggered" }],
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
};

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
};
