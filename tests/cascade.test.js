// @ts-check
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NodeGraph } from "../js/core/node-graph/runtime.js";

// Topology: origin — a — b — c, with a branch b — d
const EDGES = [["origin", "a"], ["a", "b"], ["b", "c"], ["b", "d"]];
const mkNodes = (extra = () => ({})) =>
  ["origin", "a", "b", "c", "d"].map((id) => ({
    id, type: "host",
    attributes: { forwardingEnabled: true, ...extra(id) },
    operators: [{ name: "cascade", kind: "pulse" }],
  }));

/** Count non-tick, non-init deliveries per node via the onEvent hook. */
function tracker() {
  const hits = {};
  return {
    onEvent: (type, p) => {
      const msgType = p.message?.type;
      if (type === "message-delivered" && msgType !== "tick" && msgType !== "init")
        hits[p.nodeId] = (hits[p.nodeId] ?? 0) + 1;
    },
    hits,
  };
}

describe("cascade operator — TTL-bounded propagation", () => {
  it("propagates to depth = ttl-1 and stops", () => {
    const t = tracker();
    const g = new NodeGraph({ nodes: mkNodes(), edges: EDGES }, undefined, t.onEvent);
    g.init();
    g.sendMessage("origin", { type: "pulse", payload: { ttl: 3, source: "player" } });
    // ttl:3 → origin(entry) forwards ttl2 to a, a forwards ttl1 to b, b stops (ttl-1 <= 1).
    assert.ok(t.hits["a"] >= 1, "a reached");
    assert.ok(t.hits["b"] >= 1, "b reached");
    assert.equal(t.hits["c"] ?? 0, 0, "c beyond depth is NOT reached");
    assert.equal(t.hits["d"] ?? 0, 0, "d beyond depth is NOT reached");
  });

  it("a shut gate (forwardingEnabled:false) blocks propagation past it", () => {
    const t = tracker();
    const nodes = mkNodes((id) => (id === "b" ? { forwardingEnabled: false } : {}));
    const g = new NodeGraph({ nodes, edges: EDGES }, undefined, t.onEvent);
    g.init();
    g.sendMessage("origin", { type: "pulse", payload: { ttl: 9, source: "player" } });
    assert.ok(t.hits["b"] >= 1, "b received the pulse");
    assert.equal(t.hits["c"] ?? 0, 0, "c behind the shut gate is untouched");
  });

  it("carries the source attribution forward", () => {
    let seenAtA = null;
    const g = new NodeGraph({ nodes: mkNodes(), edges: EDGES }, undefined, (type, p) => {
      if (type === "message-delivered" && p.nodeId === "a" && p.message?.type === "pulse")
        seenAtA = p.message.payload.source;
    });
    g.init();
    g.sendMessage("origin", { type: "pulse", payload: { ttl: 3, source: "ice:hunter-1" } });
    assert.equal(seenAtA, "ice:hunter-1", "source rides through the hop");
  });
});

describe("attachBehavior — runtime-equipped behaviors", () => {
  const EDGES2 = [["origin", "a"], ["a", "b"], ["b", "c"], ["b", "d"]];
  const plainNodes = () =>
    ["origin", "a", "b", "c", "d"].map((id) => ({
      id, type: "host", attributes: { forwardingEnabled: true }, operators: [],
    }));

  it("a behavior attached at runtime participates immediately", () => {
    const t = tracker();
    const g = new NodeGraph({ nodes: plainNodes(), edges: EDGES2 }, undefined, t.onEvent);
    g.init();
    g.sendMessage("origin", { type: "pulse", payload: { ttl: 3, source: "player" } });
    assert.equal(t.hits["a"] ?? 0, 0, "no behavior yet → nothing propagates");
    for (const id of g.getNodeIds()) g.attachBehavior(id, { name: "cascade", kind: "pulse" });
    const t2 = tracker();
    g._onEvent = t2.onEvent; // re-point instrumentation
    g.sendMessage("origin", { type: "pulse", payload: { ttl: 3, source: "player" } });
    assert.ok(t2.hits["a"] >= 1, "attached cascade now propagates");
  });

  it("an attached behavior survives snapshot → fromSnapshot", () => {
    const g = new NodeGraph({ nodes: plainNodes(), edges: EDGES2 }, undefined, () => {});
    g.init();
    for (const id of g.getNodeIds()) g.attachBehavior(id, { name: "cascade", kind: "pulse" });
    const snap = JSON.parse(JSON.stringify(g.snapshot()));
    const t = tracker();
    const g2 = NodeGraph.fromSnapshot(snap, undefined, t.onEvent);
    g2.sendMessage("origin", { type: "pulse", payload: { ttl: 3, source: "player" } });
    assert.ok(t.hits["a"] >= 1, "behavior persisted across reload");
  });

  it("detachBehavior stops participation", () => {
    const t = tracker();
    const g = new NodeGraph({ nodes: plainNodes(), edges: EDGES2 }, undefined, t.onEvent);
    g.init();
    for (const id of g.getNodeIds()) g.attachBehavior(id, { name: "cascade", kind: "pulse" });
    for (const id of g.getNodeIds()) g.detachBehavior(id, "cascade");
    const t2 = tracker();
    g._onEvent = t2.onEvent;
    g.sendMessage("origin", { type: "pulse", payload: { ttl: 3, source: "player" } });
    assert.equal(t2.hits["a"] ?? 0, 0, "detached → no propagation");
  });
});
