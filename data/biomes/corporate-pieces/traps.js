// @ts-check
/**
 * Corporate biome set-pieces — pressure & trap pieces (alarms, deadman, honeypot).
 *
 * Part of the corporate-pieces/ catalog. The barrel at ../corporate-pieces.js
 * re-exports these and assembles SET_PIECES.
 */

/** @typedef {import("../../../js/core/network/set-pieces.js").SetPieceDef} SetPieceDef */

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
      // armable: dormant until the first subvert-ping arrives (see watchdog
      // operator). The countdown starts when the player commits to the heist,
      // not at network init — otherwise it traces before they can reach a relay.
      operators: [{ name: "watchdog", period: 4, periodTable: { S: 2, A: 3, B: 3, C: 4, D: 5, F: 6 }, armable: true }],
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
      // Fire only if the alarm latches BEFORE all three relays are subverted.
      // Once the puzzle is solved the network is silenced, so a late watchdog
      // expiry (the final subvert reset it) must not still trace the player.
      when: {
        type: "all-of",
        conditions: [
          { type: "node-attr", nodeId: "alarm-latch", attr: "latched", eq: true },
          { type: "not", condition: { type: "quality-gte", name: "relays-subverted", value: 3 } },
        ],
      },
      then: [
        { effect: "ctx-call", method: "startTrace", args: [] },
        { effect: "ctx-call", method: "log", args: ["ALARM: Cascade shutdown detected — trace initiated"] },
      ],
    },
  ],
  externalPorts: ["relay-a", "relay-b", "relay-c"],
  tags: ["pressure", "puzzle"],
  cost: "A",
  minDepth: 3,  // keep the timed puzzle off the doorstep; the watchdog now arms on first subvert
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

