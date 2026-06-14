// @ts-check
/**
 * Corporate biome set-pieces — detection & defense pieces (IDS, sensors, tamper).
 *
 * Part of the corporate-pieces/ catalog. The barrel at ../corporate-pieces.js
 * re-exports these and assembles SET_PIECES.
 */

/** @typedef {import("../../../js/core/network/set-pieces.js").SetPieceDef} SetPieceDef */

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

