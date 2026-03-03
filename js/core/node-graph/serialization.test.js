import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NodeGraph } from "./runtime.js";
import { mockCtx } from "./ctx.js";
import { createMessage } from "./message.js";

function clockNode(id = "clk") {
  return { id, type: "clock-source", attributes: {}, atoms: [{ name: "clock", period: 3 }] };
}

function relayNode(id = "relay") {
  return { id, type: "relay", attributes: {}, atoms: [{ name: "relay" }] };
}

describe("serialization: basic round-trip", () => {
  it("snapshot/restore preserves node attributes, qualities, and fired triggers", () => {
    const ctx = mockCtx();
    const graph = new NodeGraph({
      nodes: [
        { id: "A", type: "t", attributes: { accessLevel: "owned", score: 42 }, atoms: [] },
        { id: "B", type: "t", attributes: { active: true }, atoms: [] },
      ],
      edges: [["A", "B"]],
      triggers: [{
        id: "t1",
        when: { type: "node-attr", nodeId: "A", attr: "accessLevel", eq: "owned" },
        then: [],
      }],
    }, ctx);

    graph.setQuality("panels", 3);
    // Trigger t1 should fire on first evaluation (condition already true)
    // (it fires automatically on sendMessage or tick, but we can force it via a tick)
    graph.tick(0); // zero-tick forces trigger evaluation

    const snap = graph.snapshot();
    const restored = NodeGraph.fromSnapshot(snap, ctx);

    assert.deepEqual(restored.getNodeState("A"), { accessLevel: "owned", score: 42 });
    assert.deepEqual(restored.getNodeState("B"), { active: true });
    assert.equal(restored.getQuality("panels"), 3);
    // t1 was already fired; should not re-fire after restore
    const prevLogCount = (ctx.calls.log ?? []).length;
    restored.tick(0);
    assert.equal((ctx.calls.log ?? []).length, prevLogCount);
  });
});

describe("serialization: mid-clock-cycle", () => {
  it("clock ticks counter survives snapshot/restore", () => {
    const ctx = mockCtx();
    const graph = new NodeGraph({
      nodes: [clockNode("clk"), relayNode("out")],
      edges: [["clk", "out"]],
    }, ctx);

    // Advance 2 of 3 ticks — clock should not have fired yet
    graph.tick(2);
    assert.equal((ctx.calls.log ?? []).length, 0);

    const snap = graph.snapshot();
    const restored = NodeGraph.fromSnapshot(snap, ctx);

    // Restore sets _clock_ticks to 2; one more tick should fire
    const beforeSignals = countSignals(ctx);
    restored.tick(1);
    // clock emits signal(active:true) to adjacent "out" node; out relays it
    // We verify by checking the _clock_ticks reset to 0
    const clkState = restored.getNodeState("clk");
    assert.equal(clkState._clock_ticks, 0);
  });
});

describe("serialization: delay queue", () => {
  it("delay queue entries survive snapshot/restore", () => {
    const ctx = mockCtx();
    const graph = new NodeGraph({
      nodes: [
        { id: "src", type: "t", attributes: {}, atoms: [{ name: "delay", ticks: 2 }] },
        { id: "dst", type: "t", attributes: {}, atoms: [{ name: "relay" }] },
      ],
      edges: [["src", "dst"]],
    }, ctx);

    // Inject a message — it gets queued for 2 ticks
    graph.sendMessage("src", createMessage({ type: "signal", origin: "test", payload: { active: true } }));

    // Advance 1 tick — not yet delivered
    graph.tick(1);
    assert.equal(graph.getNodeState("src")._delay_queue.length, 1);

    const snap = graph.snapshot();
    const restored = NodeGraph.fromSnapshot(snap, ctx);

    // Queue should still have 1 entry with remaining: 1
    assert.equal(restored.getNodeState("src")._delay_queue.length, 1);
    assert.equal(restored.getNodeState("src")._delay_queue[0].remaining, 1);

    // One more tick should drain it
    restored.tick(1);
    assert.equal(restored.getNodeState("src")._delay_queue.length, 0);
  });
});

describe("serialization: JSON stringify round-trip", () => {
  it("snapshot survives JSON.stringify/parse with no loss", () => {
    const graph = new NodeGraph({
      nodes: [
        { id: "A", type: "t", attributes: { x: 1, arr: [1, 2] }, atoms: [{ name: "clock", period: 5 }] },
      ],
      edges: [],
      triggers: [{ id: "t1", when: { type: "quality-eq", name: "q", value: 0 }, then: [] }],
    });

    graph.setQuality("q", 7);
    graph.tick(3);

    const snap = graph.snapshot();
    const json = JSON.stringify(snap);
    const parsed = JSON.parse(json);
    const restored = NodeGraph.fromSnapshot(parsed);

    assert.equal(restored.getNodeState("A")._clock_ticks, 3);
    assert.equal(restored.getQuality("q"), 7);
  });
});

// Helper to count total log/signal-related ctx calls
function countSignals(ctx) {
  return Object.values(ctx.calls ?? {}).reduce((sum, arr) => sum + arr.length, 0);
}
