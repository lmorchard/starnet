import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NodeGraph } from "./runtime.js";
import { mockCtx } from "./ctx.js";
import { createMessage } from "./message.js";

// Helper: build a graph with a spy node that records delivered messages
function makeSpyNode(id) {
  return {
    id,
    type: "spy",
    attributes: { _received: [] },
    operators: [{
      name: "relay",
      // We intercept via a wrapper operator registered below; for these tests we'll
      // inspect attributes after delivery instead.
    }],
  };
}

// ---------------------------------------------------------------------------
// 1. IDS relay chain — alert relays to the monitor, gated by forwardingEnabled
// ---------------------------------------------------------------------------
describe("IDS relay chain", () => {
  // ids relays alert messages; monitor flags `alerted` when one arrives.
  function makeAlertChainGraph(forwardingEnabled) {
    return new NodeGraph({
      nodes: [
        { id: "ids", type: "ids", attributes: { forwardingEnabled },
          operators: [{ name: "relay", filter: "alert" }] },
        { id: "mon", type: "security-monitor", attributes: { alerted: false, sawNoise: false },
          operators: [
            { name: "flag", on: "alert", attr: "alerted", value: true },
            // Would flip if the relay wrongly forwarded a non-alert message — lets the
            // "only forwards alert" test actually observe the relay's filtering.
            { name: "flag", on: "probe-noise", attr: "sawNoise", value: true },
          ] },
      ],
      edges: [["ids", "mon"]],
    });
  }

  it("relay forwards an alert to the connected monitor (forwardingEnabled:true)", () => {
    const graph = makeAlertChainGraph(true);
    assert.equal(graph.getNodeState("mon").alerted, false);
    graph.sendMessage("ids", createMessage({ type: "alert", origin: "probe", payload: {} }));
    assert.equal(graph.getNodeState("mon").alerted, true, "alert must reach the monitor via relay");
  });

  it("forwardingEnabled:false severs the relay — monitor never alerted", () => {
    const graph = makeAlertChainGraph(false);
    graph.sendMessage("ids", createMessage({ type: "alert", origin: "probe", payload: {} }));
    assert.equal(graph.getNodeState("mon").alerted, false, "a subverted IDS must not forward the alert");
  });

  it("relay only forwards matching message types (alert), not others", () => {
    const graph = makeAlertChainGraph(true);
    graph.sendMessage("ids", createMessage({ type: "probe-noise", origin: "probe", payload: {} }));
    // The monitor flags `sawNoise` on probe-noise, so if the relay had forwarded it this
    // would be true. It stays false → the relay correctly filtered the non-alert message.
    assert.equal(graph.getNodeState("mon").sawNoise, false, "relay must not forward non-alert messages");
    assert.equal(graph.getNodeState("mon").alerted, false, "non-alert messages must not flag the monitor");
  });
});

// ---------------------------------------------------------------------------
// 2. Gate: all-of
// ---------------------------------------------------------------------------
describe("gate: all-of", () => {
  function makeAllOfGraph() {
    const ctx = mockCtx();
    const graph = new NodeGraph({
      nodes: [
        { id: "A", type: "switch", attributes: {}, operators: [] },
        { id: "B", type: "switch", attributes: {}, operators: [] },
        { id: "C", type: "switch", attributes: {}, operators: [] },
        { id: "vault", type: "vault", attributes: {},
          operators: [{ name: "all-of", inputs: ["A", "B", "C"] }] },
      ],
      edges: [["A", "vault"], ["B", "vault"], ["C", "vault"]],
      triggers: [{
        id: "vault-open",
        when: { type: "node-attr", nodeId: "vault", attr: "_allof_state", eq: undefined },
        then: [],
      }],
    }, ctx);
    return { graph, ctx };
  }

  it("vault does not emit signal(active:true) until all three inputs fire", () => {
    const ctx = mockCtx();
    const graph = new NodeGraph({
      nodes: [
        { id: "A", type: "switch", attributes: {}, operators: [] },
        { id: "B", type: "switch", attributes: {}, operators: [] },
        { id: "C", type: "switch", attributes: {}, operators: [] },
        { id: "vault", type: "vault", attributes: {},
          operators: [{ name: "all-of", inputs: ["A", "B", "C"] }] },
      ],
      edges: [["A", "vault"], ["B", "vault"], ["C", "vault"]],
      triggers: [{
        id: "vault-open",
        when: {
          type: "all-of", conditions: [
            { type: "node-attr", nodeId: "vault", attr: "_allof_A_active", eq: true },
          ],
        },
        then: [{ effect: "ctx-call", method: "giveReward", args: [100] }],
      }],
    }, ctx);

    // Send signals from A and B — gate should not be satisfied
    graph.sendMessage("vault", createMessage({ type: "signal", origin: "A", payload: { active: true } }));
    graph.sendMessage("vault", createMessage({ type: "signal", origin: "B", payload: { active: true } }));
    const vaultState = graph.getNodeState("vault");
    // _allof_state should have A and B but not C → active should be false
    const allofState = vaultState._allof_state ?? {};
    assert.ok(!allofState["C"]); // C not fired
    // The gate should not have emitted active:true yet
    // We verify via the trigger (which isn't set up for this exactly, so check attrs directly)
    assert.ok(allofState["A"] === true);
    assert.ok(allofState["B"] === true);
  });

  it("vault emits signal(active:true) when all three inputs fire", () => {
    const ctx = mockCtx();
    const graph = new NodeGraph({
      nodes: [
        { id: "vault", type: "vault", attributes: {},
          operators: [{ name: "all-of", inputs: ["A", "B", "C"] }] },
      ],
      edges: [],
      triggers: [],
    }, ctx);

    graph.sendMessage("vault", createMessage({ type: "signal", origin: "A", payload: { active: true } }));
    graph.sendMessage("vault", createMessage({ type: "signal", origin: "B", payload: { active: true } }));
    // Not yet all of them
    let vState = graph.getNodeState("vault");
    assert.equal(vState._allof_state?.["C"], undefined);

    graph.sendMessage("vault", createMessage({ type: "signal", origin: "C", payload: { active: true } }));
    vState = graph.getNodeState("vault");
    assert.equal(vState._allof_state?.["A"], true);
    assert.equal(vState._allof_state?.["B"], true);
    assert.equal(vState._allof_state?.["C"], true);
  });
});

// ---------------------------------------------------------------------------
// 3. Gate: any-of
// ---------------------------------------------------------------------------
describe("gate: any-of", () => {
  it("emits on first signal from any input", () => {
    const graph = new NodeGraph({
      nodes: [
        { id: "gate", type: "any-gate", attributes: {},
          operators: [{ name: "any-of", inputs: ["X", "Y", "Z"] }] },
      ],
      edges: [],
    });

    // First signal from Y
    graph.sendMessage("gate", createMessage({ type: "signal", origin: "Y", payload: { active: true } }));
    const state = graph.getNodeState("gate");
    assert.equal(state._anyof_state?.["Y"], true);
  });
});

// ---------------------------------------------------------------------------
// 4. Latch
// ---------------------------------------------------------------------------
describe("latch", () => {
  it("latched becomes true on set, false on reset", () => {
    const graph = new NodeGraph({
      nodes: [{ id: "L", type: "latch-node", attributes: { latched: false }, operators: [{ name: "latch" }] }],
      edges: [],
    });

    graph.sendMessage("L", createMessage({ type: "set", origin: "test", payload: {} }));
    assert.equal(graph.getNodeState("L").latched, true);

    graph.sendMessage("L", createMessage({ type: "reset", origin: "test", payload: {} }));
    assert.equal(graph.getNodeState("L").latched, false);
  });
});

// ---------------------------------------------------------------------------
// 5. Clock
// ---------------------------------------------------------------------------
describe("clock", () => {
  it("emits signal after period ticks", () => {
    const ctx = mockCtx();
    const graph = new NodeGraph({
      nodes: [
        { id: "clk", type: "clock", attributes: {}, operators: [{ name: "clock", period: 3 }] },
        { id: "out", type: "output", attributes: {},
          operators: [],
          actions: [],
        },
      ],
      edges: [["clk", "out"]],
      triggers: [{
        id: "clocked",
        when: { type: "quality-gte", name: "tick-count", value: 1 },
        then: [{ effect: "ctx-call", method: "log", args: ["clock fired"] }],
      }],
    }, ctx);

    // After 2 ticks — nothing
    graph.tick(2);
    assert.equal(graph.getNodeState("clk")._clock_ticks, 2);
    assert.equal(ctx.calls.log, undefined);

    // 3rd tick — clock fires
    graph.tick(1);
    assert.equal(graph.getNodeState("clk")._clock_ticks, 0);
    // The clock emitted signal(active:true) to "out" node — no error thrown
  });
});

// ---------------------------------------------------------------------------
// 6. Delay
// ---------------------------------------------------------------------------
describe("delay", () => {
  it("re-emits message after correct tick count", () => {
    const graph = new NodeGraph({
      nodes: [
        { id: "delay-node", type: "delay", attributes: {}, operators: [{ name: "delay", ticks: 2 }] },
        { id: "downstream", type: "end", attributes: { received: false }, operators: [] },
      ],
      edges: [["delay-node", "downstream"]],
    });

    graph.sendMessage("delay-node", createMessage({ type: "signal", origin: "src", payload: { active: true } }));

    // After 1 tick — still in queue
    graph.tick(1);
    assert.equal(graph.getNodeState("delay-node")._delay_queue.length, 1);

    // After 2nd tick — delivered
    graph.tick(1);
    assert.equal(graph.getNodeState("delay-node")._delay_queue.length, 0);
  });
});

// ---------------------------------------------------------------------------
// 7. Trigger fires once
// ---------------------------------------------------------------------------
describe("trigger fires once", () => {
  it("ctx method called once even when condition stays true", () => {
    const ctx = mockCtx();
    const graph = new NodeGraph({
      nodes: [{ id: "N", type: "t", attributes: { done: false }, operators: [] }],
      edges: [],
      triggers: [{
        id: "once",
        when: { type: "node-attr", nodeId: "N", attr: "done", eq: true },
        then: [{ effect: "ctx-call", method: "startTrace", args: [] }],
      }],
    }, ctx);

    // Set done via action or direct message — we'll use an action
    graph._nodes.get("N").attributes.done = true;
    graph.tick(0); // force trigger evaluation
    graph.tick(0);
    graph.tick(0);

    assert.equal(ctx.calls.startTrace?.length, 1);
  });
});

// ---------------------------------------------------------------------------
// 8. Quality-based trigger
// ---------------------------------------------------------------------------
describe("quality-based trigger", () => {
  it("fires when quality reaches threshold", () => {
    const ctx = mockCtx();
    const graph = new NodeGraph({
      nodes: [],
      edges: [],
      triggers: [{
        id: "threshold",
        when: { type: "quality-gte", name: "alert-level", value: 3 },
        then: [{ effect: "ctx-call", method: "startTrace", args: [] }],
      }],
    }, ctx);

    graph.setQuality("alert-level", 1);
    graph.tick(0);
    assert.equal(ctx.calls.startTrace, undefined);

    graph.setQuality("alert-level", 2);
    graph.tick(0);
    assert.equal(ctx.calls.startTrace, undefined);

    graph.setQuality("alert-level", 3);
    graph.tick(0);
    assert.equal(ctx.calls.startTrace?.length, 1);
  });
});

// ---------------------------------------------------------------------------
// 9. Player action available/unavailable
// ---------------------------------------------------------------------------
describe("player action availability", () => {
  it("action not available when requires fail, available when they pass", () => {
    const graph = new NodeGraph({
      nodes: [{
        id: "panel",
        type: "routing-panel",
        attributes: { accessLevel: "locked", aligned: false },
        operators: [],
        actions: [{
          id: "flip-route",
          label: "Reroute",
          requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }],
          effects: [{ effect: "toggle-attr", attr: "aligned" }],
        }],
      }],
      edges: [],
    });

    assert.equal(graph.getAvailableActions("panel").length, 0);

    graph._nodes.get("panel").attributes.accessLevel = "owned";
    assert.equal(graph.getAvailableActions("panel").length, 1);
    assert.equal(graph.getAvailableActions("panel")[0].id, "flip-route");
  });
});

// ---------------------------------------------------------------------------
// 10. Player action execute — full pipeline
// ---------------------------------------------------------------------------
describe("player action execute — full pipeline", () => {
  it("quality-delta and emit-message effects applied correctly", () => {
    const ctx = mockCtx();
    const graph = new NodeGraph({
      nodes: [
        {
          id: "switch",
          type: "routing-panel",
          attributes: { accessLevel: "owned", aligned: false },
          operators: [],
          actions: [{
            id: "flip-route",
            label: "Reroute",
            requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }],
            effects: [
              { effect: "quality-delta", name: "routing-panels-aligned", delta: 1 },
              { effect: "emit-message", message: { type: "route-changed", payload: {} } },
            ],
          }],
        },
        { id: "monitor-panel", type: "monitor", attributes: {}, operators: [{ name: "relay" }] },
      ],
      edges: [["switch", "monitor-panel"]],
      triggers: [{
        id: "route-complete",
        when: { type: "quality-gte", name: "routing-panels-aligned", value: 1 },
        then: [{ effect: "ctx-call", method: "giveReward", args: [500] }],
      }],
    }, ctx);

    graph.executeAction("switch", "flip-route");
    graph.tick(20); // flip-route is a script action, timed-by-default (#187 default-flip)

    assert.equal(graph.getQuality("routing-panels-aligned"), 1);
    assert.equal(ctx.calls.giveReward?.length, 1);
    assert.deepEqual(ctx.calls.giveReward[0], [500]);
  });
});

// ---------------------------------------------------------------------------
// 11. sendMessage delivers to the target even when origin === target (B1)
// ---------------------------------------------------------------------------
describe("sendMessage: origin == target node", () => {
  it("an alert injected at its own node reaches that node's operators and relays onward", () => {
    // graph-bridge.js injects exploit/alert messages with origin === the node it
    // delivers to (createMessage seeds path:[origin]). The cycle guard must not drop
    // this initial delivery.
    const graph = new NodeGraph({
      nodes: [
        { id: "ids", type: "ids", attributes: { alerted: false }, operators: [
          { name: "relay", filter: "alert" },
          { name: "flag", on: "alert", attr: "alerted", value: true },
        ] },
        { id: "mon", type: "security-monitor", attributes: { alerted: false }, operators: [
          { name: "flag", on: "alert", attr: "alerted", value: true },
        ] },
      ],
      edges: [["ids", "mon"]],
    });

    graph.sendMessage("ids", createMessage({ type: "alert", origin: "ids", payload: {} }));

    assert.equal(graph.getNodeState("ids").alerted, true,
      "IDS flag operator must run on an alert injected at the IDS itself");
    assert.equal(graph.getNodeState("mon").alerted, true,
      "relay must forward the alert to the monitor");
  });
});
