#!/usr/bin/env node
// @ts-check
/**
 * Headless playtest harness for the reactive node graph runtime.
 *
 * Exercises the graph system in isolation — no browser, no game engine.
 * Builds example graphs and runs labelled scenarios, printing traces.
 *
 * Usage:
 *   node scripts/node-graph-playtest.js             # run all scenarios
 *   node scripts/node-graph-playtest.js ids-chain   # run one scenario by name
 */

import { NodeGraph } from "../js/core/node-graph/runtime.js";
import { createMessage } from "../js/core/node-graph/message.js";
import { mockCtx } from "../js/core/node-graph/ctx.js";
import { instantiate, probeBurstAlarm, noisySensor, tamperDetect } from "../js/core/node-graph/set-pieces.js";

const args = process.argv.slice(2);
const filter = args[0] ?? null;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

let _passed = 0;
let _failed = 0;
let _currentScenario = "";

function scenario(name, fn) {
  if (filter && name !== filter) return;
  _currentScenario = name;
  console.log(`\n${"=".repeat(60)}`);
  console.log(`SCENARIO: ${name}`);
  console.log("=".repeat(60));
  try {
    fn();
    console.log(`  RESULT: PASS`);
    _passed++;
  } catch (e) {
    console.log(`  RESULT: FAIL — ${e.message}`);
    _failed++;
  }
}

function check(label, value, expected) {
  const pass = JSON.stringify(value) === JSON.stringify(expected);
  const icon = pass ? "✔" : "✘";
  console.log(`  ${icon} ${label}: ${JSON.stringify(value)}${pass ? "" : ` (expected ${JSON.stringify(expected)})`}`);
  if (!pass) throw new Error(`Assertion failed: ${label}`);
}

function log(msg) {
  console.log(`  · ${msg}`);
}

// ---------------------------------------------------------------------------
// Scenario 1: IDS → Monitor relay chain
// ---------------------------------------------------------------------------
scenario("ids-chain", () => {
  log("Graph: ids --relay(alert)--> monitor");
  log("Monitor has flag atom: alert message sets alerted:true.");
  log("Trigger fires when monitor.alerted === true.");

  const ctx = mockCtx();

  const graph = new NodeGraph({
    nodes: [
      {
        id: "ids",
        type: "ids",
        attributes: { forwardingEnabled: true },
        atoms: [{ name: "relay", filter: "alert" }],
        actions: [{
          id: "disable-forwarding",
          label: "Disable IDS",
          requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }],
          effects: [{ effect: "set-attr", attr: "forwardingEnabled", value: false }],
        }],
      },
      {
        id: "monitor",
        type: "security-monitor",
        attributes: { alerted: false },
        atoms: [{ name: "flag", on: "alert", attr: "alerted", value: true }],
      },
    ],
    edges: [["ids", "monitor"]],
    triggers: [{
      id: "monitor-alerted",
      when: { type: "node-attr", nodeId: "monitor", attr: "alerted", eq: true },
      then: [{ effect: "ctx-call", method: "log", args: ["ALERT: security monitor raised intrusion alert"] }],
    }],
  }, ctx);

  log("Sending alert into IDS (forwardingEnabled:true)...");
  graph.sendMessage("ids", createMessage({ type: "alert", origin: "probe-node", payload: {} }));
  check("monitor.alerted after relay", graph.getNodeState("monitor").alerted, true);
  check("trigger fired (log called)", (ctx.calls.log ?? []).length > 0, true);

  log("\nDisabling IDS forwarding, resetting monitor...");
  graph._nodes.get("ids").attributes.forwardingEnabled = false;
  graph._nodes.get("monitor").attributes.alerted = false;

  log("Sending second alert — should be blocked by IDS relay...");
  graph.sendMessage("ids", createMessage({ type: "alert", origin: "probe-node", payload: {} }));
  check("monitor.alerted stays false", graph.getNodeState("monitor").alerted, false);
});

// ---------------------------------------------------------------------------
// Scenario 2: AND-gate combination vault
// ---------------------------------------------------------------------------
scenario("combination-vault", () => {
  log("Graph: A, B, C → gate (all-of) → unlock-node (flag active signal)");
  log("Gate emits signal(active:true) only when all three inputs are true.");
  log("unlock-node flags 'open' when it receives signal(active:true).");
  log("Trigger fires when unlock-node.open === true.");

  const ctx = mockCtx();

  const graph = new NodeGraph({
    nodes: [
      { id: "A", type: "switch", attributes: {}, atoms: [] },
      { id: "B", type: "switch", attributes: {}, atoms: [] },
      { id: "C", type: "switch", attributes: {}, atoms: [] },
      {
        id: "gate",
        type: "logic-gate",
        attributes: {},
        atoms: [{ name: "all-of", inputs: ["A", "B", "C"] }],
      },
      {
        id: "unlock-node",
        type: "vault",
        attributes: { open: false },
        atoms: [{ name: "flag", on: "signal", when: { active: true }, attr: "open" }],
      },
    ],
    edges: [
      ["A", "gate"],
      ["B", "gate"],
      ["C", "gate"],
      ["gate", "unlock-node"],
    ],
    triggers: [{
      id: "vault-open",
      when: { type: "node-attr", nodeId: "unlock-node", attr: "open", eq: true },
      then: [
        { effect: "ctx-call", method: "log", args: ["Vault open!"] },
        { effect: "ctx-call", method: "giveReward", args: [1000] },
      ],
    }],
  }, ctx);

  log("Sending signal from A (active:true) via graph message...");
  graph.sendMessage("gate", createMessage({ type: "signal", origin: "A", payload: { active: true } }));
  log(`gate._allof_state = ${JSON.stringify(graph.getNodeState("gate")._allof_state)}`);
  check("unlock-node.open after A only", graph.getNodeState("unlock-node").open, false);

  log("Sending signal from B (active:true)...");
  graph.sendMessage("gate", createMessage({ type: "signal", origin: "B", payload: { active: true } }));
  check("unlock-node.open after A+B", graph.getNodeState("unlock-node").open, false);

  log("Sending signal from C (active:true) — gate fires, unlock-node opens...");
  graph.sendMessage("gate", createMessage({ type: "signal", origin: "C", payload: { active: true } }));
  check("unlock-node.open after A+B+C", graph.getNodeState("unlock-node").open, true);
  check("giveReward called", (ctx.calls.giveReward ?? []).length, 1);
});

// ---------------------------------------------------------------------------
// Scenario 3: Quality-gated vault (cleaner trigger pattern)
// ---------------------------------------------------------------------------
scenario("quality-gate", () => {
  log("Graph: 3 switches increment a quality counter; trigger fires at threshold 3");

  const ctx = mockCtx();

  const graph = new NodeGraph({
    nodes: [
      {
        id: "switch-panel",
        type: "control-panel",
        attributes: { accessLevel: "owned" },
        atoms: [],
        actions: [
          {
            id: "align-A",
            label: "Align Panel A",
            requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }],
            effects: [{ effect: "quality-delta", name: "panels-aligned", delta: 1 }],
          },
          {
            id: "align-B",
            label: "Align Panel B",
            requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }],
            effects: [{ effect: "quality-delta", name: "panels-aligned", delta: 1 }],
          },
          {
            id: "align-C",
            label: "Align Panel C",
            requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }],
            effects: [{ effect: "quality-delta", name: "panels-aligned", delta: 1 }],
          },
        ],
      },
      {
        id: "vault-door",
        type: "vault",
        attributes: { open: false },
        atoms: [],
      },
    ],
    edges: [["switch-panel", "vault-door"]],
    triggers: [{
      id: "vault-open",
      when: { type: "quality-gte", name: "panels-aligned", value: 3 },
      then: [
        { effect: "set-node-attr", nodeId: "vault-door", attr: "open", value: true },
        { effect: "ctx-call", method: "log", args: ["VAULT OPEN — all panels aligned"] },
        { effect: "ctx-call", method: "giveReward", args: [2500] },
      ],
    }],
  }, ctx);

  log(`Available actions: ${graph.getAvailableActions("switch-panel").map((a) => a.id).join(", ")}`);

  log("Executing align-A...");
  graph.executeAction("switch-panel", "align-A");
  check("panels-aligned after A", graph.getQuality("panels-aligned"), 1);
  check("vault open?", graph.getNodeState("vault-door").open, false);

  log("Executing align-B...");
  graph.executeAction("switch-panel", "align-B");
  check("panels-aligned after B", graph.getQuality("panels-aligned"), 2);
  check("vault open?", graph.getNodeState("vault-door").open, false);

  log("Executing align-C...");
  graph.executeAction("switch-panel", "align-C");
  check("panels-aligned after C", graph.getQuality("panels-aligned"), 3);
  check("vault open?", graph.getNodeState("vault-door").open, true);
  check("giveReward called?", (ctx.calls.giveReward ?? []).length > 0, true);
  check("reward amount", ctx.calls.giveReward[0][0], 2500);
});

// ---------------------------------------------------------------------------
// Scenario 4: Watchdog deadman switch
// ---------------------------------------------------------------------------
scenario("deadman-clock", () => {
  log("Graph: heartbeat-relay --relay(heartbeat)--> watchdog(period:5) --> alarm-latch");
  log("Watchdog resets on each heartbeat. After 5 ticks with no heartbeat, fires 'set'.");
  log("alarm-latch arms when 'set' arrives. Trigger fires when latched:true.");

  const ctx = mockCtx();

  const graph = new NodeGraph({
    nodes: [
      {
        id: "heartbeat-relay",
        type: "relay-node",
        attributes: { forwardingEnabled: true },
        atoms: [{ name: "relay", filter: "heartbeat" }],
      },
      {
        id: "watchdog",
        type: "watchdog-daemon",
        attributes: {},
        atoms: [{ name: "watchdog", period: 5 }],
      },
      {
        id: "alarm-latch",
        type: "alarm",
        attributes: { latched: false },
        atoms: [{ name: "latch" }],
      },
    ],
    edges: [
      ["heartbeat-relay", "watchdog"],
      ["watchdog", "alarm-latch"],
    ],
    triggers: [{
      id: "alarm-triggered",
      when: { type: "node-attr", nodeId: "alarm-latch", attr: "latched", eq: true },
      then: [
        { effect: "ctx-call", method: "log", args: ["ALARM: Deadman switch triggered!"] },
        { effect: "ctx-call", method: "startTrace", args: [] },
      ],
    }],
  }, ctx);

  log("Ticking with regular heartbeats (watchdog resets each time)...");
  for (let i = 0; i < 6; i++) {
    graph.sendMessage("heartbeat-relay", createMessage({ type: "heartbeat", origin: "system", payload: {} }));
    graph.tick(1);
  }
  check("alarm-latch.latched after 6 heartbeats", graph.getNodeState("alarm-latch").latched, false);
  check("startTrace not called", ctx.calls.startTrace, undefined);

  log("\nBlocking the relay, ticking 5 times (watchdog period)...");
  graph._nodes.get("heartbeat-relay").attributes.forwardingEnabled = false;
  graph.tick(5);
  check("alarm-latch.latched after 5 ticks with no heartbeat", graph.getNodeState("alarm-latch").latched, true);
  check("startTrace called", (ctx.calls.startTrace ?? []).length, 1);
});

// ---------------------------------------------------------------------------
// Scenario 5: Delay-based trap
// ---------------------------------------------------------------------------
scenario("delay-trap", () => {
  log("Graph: tripwire(delay:3) → alarm(flag on probe-noise)");
  log("Stepping on tripwire starts a 3-tick countdown before alarm fires.");
  log("alarm has flag atom: probe-noise sets triggered:true.");
  log("Trigger fires when alarm.triggered === true.");

  const ctx = mockCtx();

  const graph = new NodeGraph({
    nodes: [
      {
        id: "tripwire",
        type: "sensor",
        attributes: {},
        atoms: [{ name: "delay", ticks: 3 }],
      },
      {
        id: "alarm",
        type: "alarm",
        attributes: { triggered: false },
        atoms: [{ name: "flag", on: "probe-noise", attr: "triggered" }],
      },
    ],
    edges: [["tripwire", "alarm"]],
    triggers: [{
      id: "alarm-fire",
      when: { type: "node-attr", nodeId: "alarm", attr: "triggered", eq: true },
      then: [{ effect: "ctx-call", method: "log", args: ["TRAP: Delayed alarm triggered!"] }],
    }],
  }, ctx);

  log("Sending probe-noise to tripwire...");
  graph.sendMessage("tripwire", createMessage({ type: "probe-noise", origin: "player", payload: {} }));
  check("delay queue depth", graph.getNodeState("tripwire")._delay_queue.length, 1);
  check("alarm.triggered before delay", graph.getNodeState("alarm").triggered, false);

  log("Tick 1 — 2 ticks remaining...");
  graph.tick(1);
  check("delay remaining", graph.getNodeState("tripwire")._delay_queue[0]?.remaining, 2);
  check("alarm.triggered", graph.getNodeState("alarm").triggered, false);

  log("Tick 2 — 1 tick remaining...");
  graph.tick(1);
  check("delay remaining", graph.getNodeState("tripwire")._delay_queue[0]?.remaining, 1);

  log("Tick 3 — message delivered, alarm fires!");
  graph.tick(1);
  check("delay queue empty", graph.getNodeState("tripwire")._delay_queue.length, 0);
  check("alarm.triggered", graph.getNodeState("alarm").triggered, true);
  check("trap log called", (ctx.calls.log ?? []).length > 0, true);
});

// ---------------------------------------------------------------------------
// Scenario 6: Serialization round-trip
// ---------------------------------------------------------------------------
scenario("snapshot-restore", () => {
  log("Build a graph, tick partway through clock cycle, snapshot, restore, continue.");

  const graph = new NodeGraph({
    nodes: [
      { id: "clk", type: "clock", attributes: {}, atoms: [{ name: "clock", period: 4 }] },
      { id: "latch-node", type: "latch", attributes: { latched: false }, atoms: [{ name: "latch" }] },
    ],
    edges: [["clk", "latch-node"]],
  });

  graph.tick(2);
  check("clock ticks after 2", graph.getNodeState("clk")._clock_ticks, 2);

  graph.sendMessage("latch-node", createMessage({ type: "set", origin: "player", payload: {} }));
  check("latch engaged", graph.getNodeState("latch-node").latched, true);

  log("Taking snapshot...");
  const snap = graph.snapshot();
  const json = JSON.stringify(snap);
  log(`Snapshot size: ${json.length} bytes`);

  log("Restoring from snapshot...");
  const restored = NodeGraph.fromSnapshot(JSON.parse(json));
  check("clock ticks preserved", restored.getNodeState("clk")._clock_ticks, 2);
  check("latch state preserved", restored.getNodeState("latch-node").latched, true);

  log("Continuing from restored state — 2 more ticks should fire clock...");
  restored.tick(2);
  check("clock fired and reset", restored.getNodeState("clk")._clock_ticks, 0);
  log("Snapshot/restore round-trip complete.");
});

// ---------------------------------------------------------------------------
// Scenario 7: Probe burst alarm (tally + repeating trigger)
// ---------------------------------------------------------------------------
scenario("probe-burst-alarm", () => {
  log("Graph: scanner with tally atom counting probe-noise into quality.");
  log("Repeating trigger fires spawnICE every 3rd probe and resets counter.");

  const ctx = mockCtx();
  const inst = instantiate(probeBurstAlarm, "pb1");
  const graph = new NodeGraph(inst, ctx);

  log("Sending 2 probe-noise — below threshold...");
  graph.sendMessage("pb1/scanner", createMessage({ type: "probe-noise", origin: "player", payload: {} }));
  graph.sendMessage("pb1/scanner", createMessage({ type: "probe-noise", origin: "player", payload: {} }));
  check("spawnICE not called yet", ctx.calls.spawnICE, undefined);
  check("probe-bursts quality", graph.getQuality("pb1/probe-bursts"), 2);

  log("Sending 3rd probe — threshold reached, ICE spawned, counter reset...");
  graph.sendMessage("pb1/scanner", createMessage({ type: "probe-noise", origin: "player", payload: {} }));
  check("spawnICE called once", (ctx.calls.spawnICE ?? []).length, 1);
  check("quality reset to 0", graph.getQuality("pb1/probe-bursts"), 0);

  log("Sending 3 more probes — second burst spawns another ICE...");
  for (let i = 0; i < 3; i++) {
    graph.sendMessage("pb1/scanner", createMessage({ type: "probe-noise", origin: "player", payload: {} }));
  }
  check("spawnICE called twice total", (ctx.calls.spawnICE ?? []).length, 2);
});

// ---------------------------------------------------------------------------
// Scenario 8: Noisy sensor (debounce atom)
// ---------------------------------------------------------------------------
scenario("noisy-sensor", () => {
  log("Graph: sensor with debounce(ticks:4) → alarm-flag.");
  log("First probe raises alert. Subsequent probes within window are suppressed.");
  log("After 4 ticks, sensor becomes sensitive again.");

  const ctx = mockCtx();
  const inst = instantiate(noisySensor, "ns1");
  const graph = new NodeGraph(inst, ctx);

  log("First probe-noise — should trigger alarm-flag...");
  graph.sendMessage("ns1/sensor", createMessage({ type: "probe-noise", origin: "player", payload: {} }));
  check("alarm-flag triggered", graph.getNodeState("ns1/alarm-flag").triggered, true);
  check("setGlobalAlert called", (ctx.calls.setGlobalAlert ?? []).length, 1);

  log("Resetting alarm-flag manually, sending second probe within cooldown...");
  graph._nodes.get("ns1/alarm-flag").attributes.triggered = false;
  graph.sendMessage("ns1/sensor", createMessage({ type: "probe-noise", origin: "player", payload: {} }));
  check("alarm-flag still false (suppressed)", graph.getNodeState("ns1/alarm-flag").triggered, false);

  log("Ticking 4 times to expire cooldown, then probing again...");
  graph.tick(4);
  graph.sendMessage("ns1/sensor", createMessage({ type: "probe-noise", origin: "player", payload: {} }));
  check("alarm-flag triggered again after cooldown", graph.getNodeState("ns1/alarm-flag").triggered, true);
});

// ---------------------------------------------------------------------------
// Scenario 9: Tamper detect — sequencing puzzle
// ---------------------------------------------------------------------------
scenario("tamper-detect", () => {
  log("Graph: IDS → security-monitor + IDS → tamper-relay → tamper-flag.");
  log("Reconfiguring IDS emits tamper message → trace unless relay is neutralized first.");

  const ctx = mockCtx();
  const inst = instantiate(tamperDetect, "td1");
  log(`Graph edges: ${JSON.stringify(inst.edges.map(([a,b]) => `${a}→${b}`))}`);
  const graph = new NodeGraph(inst, ctx);

  log("\n--- Wrong order: reconfigure IDS without neutralizing tamper relay ---");
  graph._nodes.get("td1/ids").attributes.accessLevel = "owned";
  graph.executeAction("td1/ids", "reconfigure");
  check("tamper-flag triggered (trace!)", graph.getNodeState("td1/tamper-flag").triggered, true);
  check("startTrace called", (ctx.calls.startTrace ?? []).length, 1);

  log("\n--- Correct order: neutralize tamper relay first, then reconfigure ---");
  const ctx2 = mockCtx();
  const inst2 = instantiate(tamperDetect, "td2");
  const graph2 = new NodeGraph(inst2, ctx2);

  log("Step 1: neutralize tamper relay...");
  graph2._nodes.get("td2/tamper-relay").attributes.accessLevel = "owned";
  graph2.executeAction("td2/tamper-relay", "neutralize");
  check("tamper-relay neutralized", graph2.getNodeState("td2/tamper-relay").forwardingEnabled, false);

  log("Step 2: reconfigure IDS safely...");
  graph2._nodes.get("td2/ids").attributes.accessLevel = "owned";
  graph2.executeAction("td2/ids", "reconfigure");
  check("tamper-flag NOT triggered", graph2.getNodeState("td2/tamper-flag").triggered, false);
  check("startTrace NOT called", ctx2.calls.startTrace, undefined);
  check("IDS forwarding disabled", graph2.getNodeState("td2/ids").forwardingEnabled, false);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${"=".repeat(60)}`);
const total = _passed + _failed;
if (total === 0) {
  console.log(`No scenarios matched filter: "${filter}"`);
} else {
  console.log(`RESULTS: ${_passed}/${total} passed${_failed > 0 ? `, ${_failed} FAILED` : ""}`);
}
if (_failed > 0) process.exit(1);
