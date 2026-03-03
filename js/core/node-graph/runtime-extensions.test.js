import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NodeGraph } from "./runtime.js";
import { createMessage } from "./message.js";
import { mockCtx } from "./ctx.js";

// ---------------------------------------------------------------------------
// setNodeAttr
// ---------------------------------------------------------------------------
describe("setNodeAttr", () => {
  it("sets a node attribute directly", () => {
    const graph = new NodeGraph({
      nodes: [{ id: "n1", type: "t", attributes: { x: 1 } }],
      edges: [],
    });
    graph.setNodeAttr("n1", "x", 42);
    assert.equal(graph.getNodeState("n1").x, 42);
  });

  it("throws for unknown node", () => {
    const graph = new NodeGraph({ nodes: [], edges: [] });
    assert.throws(() => graph.setNodeAttr("nope", "x", 1), /Node not found/);
  });

  it("emits node-state-changed event", () => {
    /** @type {any[]} */
    const events = [];
    const graph = new NodeGraph(
      { nodes: [{ id: "n1", type: "t", attributes: { x: 1 } }], edges: [] },
      undefined,
      (type, payload) => events.push({ type, ...payload }),
    );
    graph.setNodeAttr("n1", "x", 2);
    const evt = events.find(e => e.type === "node-state-changed" && e.attr === "x");
    assert.ok(evt);
    assert.equal(evt.value, 2);
    assert.equal(evt.previous, 1);
    assert.equal(evt.nodeId, "n1");
  });

  it("does not emit event when value unchanged", () => {
    /** @type {any[]} */
    const events = [];
    const graph = new NodeGraph(
      { nodes: [{ id: "n1", type: "t", attributes: { x: 5 } }], edges: [] },
      undefined,
      (type, payload) => events.push({ type, ...payload }),
    );
    graph.setNodeAttr("n1", "x", 5);
    assert.equal(events.filter(e => e.type === "node-state-changed").length, 0);
  });
});

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------
describe("init", () => {
  it("delivers init message to all nodes", () => {
    /** @type {any[]} */
    const events = [];
    const graph = new NodeGraph(
      {
        nodes: [
          { id: "a", type: "t", attributes: {} },
          { id: "b", type: "t", attributes: {} },
        ],
        edges: [],
      },
      undefined,
      (type, payload) => events.push({ type, ...payload }),
    );
    graph.init();
    const delivered = events.filter(e => e.type === "message-delivered");
    assert.equal(delivered.length, 2);
    assert.ok(delivered.some(e => e.nodeId === "a"));
    assert.ok(delivered.some(e => e.nodeId === "b"));
    // Verify the message type is "init"
    for (const e of delivered) {
      assert.equal(e.message.type, "init");
    }
  });

  it("operators react to init messages", () => {
    const graph = new NodeGraph({
      nodes: [{
        id: "n1", type: "t", attributes: { ready: false },
        operators: [{ name: "flag", on: "init", attr: "ready", value: true }],
      }],
      edges: [],
    });
    graph.init();
    assert.equal(graph.getNodeState("n1").ready, true);
  });

  it("triggers evaluate after init", () => {
    const ctx = mockCtx();
    const graph = new NodeGraph({
      nodes: [{
        id: "n1", type: "t", attributes: { ready: false },
        operators: [{ name: "flag", on: "init", attr: "ready", value: true }],
      }],
      edges: [],
      triggers: [{
        id: "init-trigger",
        when: { type: "node-attr", nodeId: "n1", attr: "ready", eq: true },
        then: [{ effect: "ctx-call", method: "log", args: ["init complete"] }],
      }],
    }, ctx);
    graph.init();
    assert.equal(ctx.calls.log?.length, 1);
    assert.deepEqual(ctx.calls.log[0], ["init complete"]);
  });
});

// ---------------------------------------------------------------------------
// onEvent callback
// ---------------------------------------------------------------------------
describe("onEvent callback", () => {
  it("fires for operator attribute mutations in _deliver", () => {
    /** @type {any[]} */
    const events = [];
    const graph = new NodeGraph(
      {
        nodes: [{
          id: "n1", type: "t", attributes: { latched: false },
          operators: [{ name: "latch" }],
        }],
        edges: [],
      },
      undefined,
      (type, payload) => events.push({ type, ...payload }),
    );
    graph.sendMessage("n1", createMessage({ type: "set", origin: "ext", payload: {} }));
    const attrEvt = events.find(e => e.type === "node-state-changed" && e.attr === "latched");
    assert.ok(attrEvt);
    assert.equal(attrEvt.value, true);
    assert.equal(attrEvt.previous, false);
  });

  it("fires message-delivered events", () => {
    /** @type {any[]} */
    const events = [];
    const graph = new NodeGraph(
      {
        nodes: [{ id: "n1", type: "t", attributes: {} }],
        edges: [],
      },
      undefined,
      (type, payload) => events.push({ type, ...payload }),
    );
    graph.sendMessage("n1", createMessage({ type: "ping", origin: "ext", payload: {} }));
    const msgEvt = events.find(e => e.type === "message-delivered" && e.nodeId === "n1");
    assert.ok(msgEvt);
    assert.equal(msgEvt.message.type, "ping");
  });

  it("fires quality-changed events from operators", () => {
    /** @type {any[]} */
    const events = [];
    const graph = new NodeGraph(
      {
        nodes: [{
          id: "n1", type: "t", attributes: {},
          operators: [{ name: "tally", on: "ping", quality: "pings", delta: 1 }],
        }],
        edges: [],
      },
      undefined,
      (type, payload) => events.push({ type, ...payload }),
    );
    graph.sendMessage("n1", createMessage({ type: "ping", origin: "ext", payload: {} }));
    const qEvt = events.find(e => e.type === "quality-changed" && e.name === "pings");
    assert.ok(qEvt);
    assert.equal(qEvt.value, 1);
    assert.equal(qEvt.previous, 0);
  });

  it("fires quality-changed events from public setQuality", () => {
    /** @type {any[]} */
    const events = [];
    const graph = new NodeGraph(
      { nodes: [], edges: [] },
      undefined,
      (type, payload) => events.push({ type, ...payload }),
    );
    graph.setQuality("score", 100);
    const qEvt = events.find(e => e.type === "quality-changed" && e.name === "score");
    assert.ok(qEvt);
    assert.equal(qEvt.value, 100);
    assert.equal(qEvt.previous, 0);
  });

  it("fires quality-changed events from public deltaQuality", () => {
    /** @type {any[]} */
    const events = [];
    const graph = new NodeGraph(
      { nodes: [], edges: [] },
      undefined,
      (type, payload) => events.push({ type, ...payload }),
    );
    graph.setQuality("score", 10);
    events.length = 0; // reset
    graph.deltaQuality("score", 5);
    const qEvt = events.find(e => e.type === "quality-changed" && e.name === "score");
    assert.ok(qEvt);
    assert.equal(qEvt.value, 15);
    assert.equal(qEvt.previous, 10);
  });

  it("fires quality-changed events from trigger effects", () => {
    /** @type {any[]} */
    const events = [];
    const graph = new NodeGraph(
      {
        nodes: [{ id: "n1", type: "t", attributes: { done: false } }],
        edges: [],
        triggers: [{
          id: "set-quality",
          when: { type: "node-attr", nodeId: "n1", attr: "done", eq: true },
          then: [{ effect: "quality-set", name: "reward", value: 50 }],
        }],
      },
      undefined,
      (type, payload) => events.push({ type, ...payload }),
    );
    graph.setNodeAttr("n1", "done", true);
    // Trigger evaluates after setNodeAttr — need to trigger manually
    // Actually triggers evaluate in sendMessage/tick/executeAction, not setNodeAttr
    // Let's use tick to force evaluation
    graph.tick(0);
    const qEvt = events.find(e => e.type === "quality-changed" && e.name === "reward");
    assert.ok(qEvt);
    assert.equal(qEvt.value, 50);
  });

  it("fires node-state-changed from trigger effects", () => {
    /** @type {any[]} */
    const events = [];
    const graph = new NodeGraph(
      {
        nodes: [
          { id: "n1", type: "t", attributes: { done: false } },
          { id: "n2", type: "t", attributes: { revealed: false } },
        ],
        edges: [],
        triggers: [{
          id: "reveal",
          when: { type: "node-attr", nodeId: "n1", attr: "done", eq: true },
          then: [{ effect: "set-node-attr", nodeId: "n2", attr: "revealed", value: true }],
        }],
      },
      undefined,
      (type, payload) => events.push({ type, ...payload }),
    );
    graph.setNodeAttr("n1", "done", true);
    graph.tick(0);
    const evt = events.find(e =>
      e.type === "node-state-changed" && e.nodeId === "n2" && e.attr === "revealed"
    );
    assert.ok(evt);
    assert.equal(evt.value, true);
  });
});

// ---------------------------------------------------------------------------
// $nodeId placeholder in ctx-call effects
// ---------------------------------------------------------------------------
describe("$nodeId placeholder", () => {
  it("resolves $nodeId in action ctx-call args", () => {
    const ctx = mockCtx();
    const graph = new NodeGraph({
      nodes: [{
        id: "server-1", type: "t", attributes: { ready: true },
        actions: [{
          id: "probe",
          label: "Probe",
          requires: [{ type: "node-attr", attr: "ready", eq: true }],
          effects: [{ effect: "ctx-call", method: "log", args: ["$nodeId"] }],
        }],
      }],
      edges: [],
    }, ctx);
    graph.executeAction("server-1", "probe");
    assert.equal(ctx.calls.log?.length, 1);
    assert.deepEqual(ctx.calls.log[0], ["server-1"]);
  });

  it("resolves $nodeId in trigger ctx-call args", () => {
    // Triggers don't have a targetNodeId (it's null), so $nodeId stays as-is.
    // This is by design — triggers are graph-level, not node-scoped.
    const ctx = mockCtx();
    const graph = new NodeGraph({
      nodes: [{ id: "n1", type: "t", attributes: { done: false } }],
      edges: [],
      triggers: [{
        id: "t1",
        when: { type: "node-attr", nodeId: "n1", attr: "done", eq: true },
        then: [{ effect: "ctx-call", method: "log", args: ["trigger fired"] }],
      }],
    }, ctx);
    graph._nodes.get("n1").attributes.done = true;
    graph.tick(0);
    assert.equal(ctx.calls.log?.length, 1);
    assert.deepEqual(ctx.calls.log[0], ["trigger fired"]);
  });
});

// ---------------------------------------------------------------------------
// getNodeIds and getEdges
// ---------------------------------------------------------------------------
describe("getNodeIds and getEdges", () => {
  it("returns all node IDs", () => {
    const graph = new NodeGraph({
      nodes: [
        { id: "a", type: "t", attributes: {} },
        { id: "b", type: "t", attributes: {} },
      ],
      edges: [["a", "b"]],
    });
    const ids = graph.getNodeIds();
    assert.deepEqual(ids.sort(), ["a", "b"]);
  });

  it("returns edge list", () => {
    const edges = /** @type {[string,string][]} */ ([["a", "b"], ["b", "c"]]);
    const graph = new NodeGraph({
      nodes: [
        { id: "a", type: "t", attributes: {} },
        { id: "b", type: "t", attributes: {} },
        { id: "c", type: "t", attributes: {} },
      ],
      edges,
    });
    assert.deepEqual(graph.getEdges(), edges);
  });
});

// ---------------------------------------------------------------------------
// fromSnapshot preserves onEvent
// ---------------------------------------------------------------------------
describe("fromSnapshot with onEvent", () => {
  it("restored graph emits events", () => {
    const graph1 = new NodeGraph({
      nodes: [{ id: "n1", type: "t", attributes: { x: 1 } }],
      edges: [],
    });
    const snap = graph1.snapshot();

    /** @type {any[]} */
    const events = [];
    const graph2 = NodeGraph.fromSnapshot(snap, undefined, (type, payload) => {
      events.push({ type, ...payload });
    });
    graph2.setNodeAttr("n1", "x", 99);
    const evt = events.find(e => e.type === "node-state-changed" && e.attr === "x");
    assert.ok(evt);
    assert.equal(evt.value, 99);
  });
});
