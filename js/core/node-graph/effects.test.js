import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyEffect } from "./effects.js";

/** Build a spy ctx where every method records calls */
function makeCtx() {
  const calls = {};
  const handler = {
    get(target, prop) {
      return (...args) => {
        calls[prop] = calls[prop] ?? [];
        calls[prop].push(args);
      };
    },
  };
  return { ctx: new Proxy({}, handler), calls };
}

/** Build a simple mutable node store for testing effects */
function makeStore(initial = {}) {
  const nodes = {};
  for (const [id, attrs] of Object.entries(initial)) {
    nodes[id] = { ...attrs };
  }
  const qualities = {};
  const messages = [];

  return {
    nodes, qualities, messages,
    setNodeAttr(nodeId, attr, value) { nodes[nodeId] = { ...(nodes[nodeId] ?? {}), [attr]: value }; },
    getNodeAttr(nodeId, attr) { return nodes[nodeId]?.[attr]; },
    getQuality(name) { return qualities[name] ?? 0; },
    setQuality(name, value) { qualities[name] = value; },
    deltaQuality(name, delta) { qualities[name] = (qualities[name] ?? 0) + delta; },
    sendMessage(nodeId, msg) { messages.push({ nodeId, msg }); },
    emitFrom(nodeId, msg) { messages.push({ nodeId, msg }); },
  };
}

describe("applyEffect: set-attr", () => {
  it("sets a node attribute on the target node", () => {
    const store = makeStore({ "N": { level: "locked" } });
    const { ctx } = makeCtx();
    applyEffect({ effect: "set-attr", attr: "level", value: "owned" }, { ...store, targetNodeId: "N", ctx });
    assert.equal(store.getNodeAttr("N", "level"), "owned");
  });

  it("throws when targetNodeId is missing", () => {
    const store = makeStore();
    const { ctx } = makeCtx();
    assert.throws(() => applyEffect({ effect: "set-attr", attr: "x", value: 1 }, { ...store, targetNodeId: null, ctx }));
  });
});

describe("applyEffect: toggle-attr", () => {
  it("flips a boolean attribute", () => {
    const store = makeStore({ "N": { active: false } });
    const { ctx } = makeCtx();
    applyEffect({ effect: "toggle-attr", attr: "active" }, { ...store, targetNodeId: "N", ctx });
    assert.equal(store.getNodeAttr("N", "active"), true);
  });
});

describe("applyEffect: set-node-attr", () => {
  it("sets attribute on the explicitly named node", () => {
    const store = makeStore({ "X": { val: 0 } });
    const { ctx } = makeCtx();
    applyEffect({ effect: "set-node-attr", nodeId: "X", attr: "val", value: 42 }, { ...store, targetNodeId: null, ctx });
    assert.equal(store.getNodeAttr("X", "val"), 42);
  });
});

describe("applyEffect: emit-message", () => {
  it("calls emitFrom with the target node and message descriptor", () => {
    const store = makeStore();
    const { ctx } = makeCtx();
    applyEffect({ effect: "emit-message", message: { type: "unlock", payload: {} } }, { ...store, targetNodeId: "N", ctx });
    assert.equal(store.messages.length, 1);
    assert.equal(store.messages[0].nodeId, "N");
    assert.equal(store.messages[0].msg.type, "unlock");
  });
});

describe("applyEffect: quality-set", () => {
  it("sets a quality value", () => {
    const store = makeStore();
    const { ctx } = makeCtx();
    applyEffect({ effect: "quality-set", name: "tokens", value: 10 }, { ...store, targetNodeId: null, ctx });
    assert.equal(store.getQuality("tokens"), 10);
  });
});

describe("applyEffect: quality-delta", () => {
  it("increments a quality", () => {
    const store = makeStore();
    const { ctx } = makeCtx();
    applyEffect({ effect: "quality-delta", name: "score", delta: 5 }, { ...store, targetNodeId: null, ctx });
    applyEffect({ effect: "quality-delta", name: "score", delta: 3 }, { ...store, targetNodeId: null, ctx });
    assert.equal(store.getQuality("score"), 8);
  });
});

describe("applyEffect: ctx-call", () => {
  it("calls the named ctx method with args", () => {
    const store = makeStore();
    const { ctx, calls } = makeCtx();
    applyEffect({ effect: "ctx-call", method: "startTrace", args: [] }, { ...store, targetNodeId: null, ctx });
    assert.ok(calls.startTrace?.length === 1);
  });

  it("passes args to the method", () => {
    const store = makeStore();
    const { ctx, calls } = makeCtx();
    applyEffect({ effect: "ctx-call", method: "setGlobalAlert", args: ["red"] }, { ...store, targetNodeId: null, ctx });
    assert.deepEqual(calls.setGlobalAlert?.[0], ["red"]);
  });
});

describe("applyEffect: log", () => {
  it("calls ctx.log with the message", () => {
    const store = makeStore();
    const { ctx, calls } = makeCtx();
    applyEffect({ effect: "log", message: "vault opened" }, { ...store, targetNodeId: null, ctx });
    assert.deepEqual(calls.log?.[0], ["vault opened"]);
  });
});

describe("applyEffect: reveal-node", () => {
  it("calls ctx.revealNode with the nodeId", () => {
    const store = makeStore();
    const { ctx, calls } = makeCtx();
    applyEffect({ effect: "reveal-node", nodeId: "hidden-vault" }, { ...store, targetNodeId: null, ctx });
    assert.deepEqual(calls.revealNode?.[0], ["hidden-vault"]);
  });
});

describe("applyEffect: enable-node", () => {
  it("calls ctx.enableNode with the nodeId", () => {
    const store = makeStore();
    const { ctx, calls } = makeCtx();
    applyEffect({ effect: "enable-node", nodeId: "door" }, { ...store, targetNodeId: null, ctx });
    assert.deepEqual(calls.enableNode?.[0], ["door"]);
  });
});

describe("applyEffect: unknown type", () => {
  it("throws for unknown effect type", () => {
    const store = makeStore();
    const { ctx } = makeCtx();
    assert.throws(() => applyEffect(/** @type {any} */ ({ effect: "bogus" }), { ...store, targetNodeId: null, ctx }));
  });
});
