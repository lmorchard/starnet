import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TriggerStore } from "./triggers.js";

/** Build a spy ctx */
function makeCtx() {
  const calls = {};
  const handler = {
    get(_target, prop) {
      return (...args) => {
        calls[prop] = calls[prop] ?? [];
        calls[prop].push(args);
      };
    },
  };
  return { ctx: new Proxy({}, handler), calls };
}

function makeStore(nodeAttrs = {}, qualityValues = {}) {
  const nodes = Object.fromEntries(Object.entries(nodeAttrs).map(([id, a]) => [id, { ...a }]));
  const qualities = { ...qualityValues };
  return {
    nodes, qualities,
    getNodeAttr(nodeId, attr) { return nodes[nodeId]?.[attr]; },
    setNodeAttr(nodeId, attr, value) { nodes[nodeId] = { ...(nodes[nodeId] ?? {}), [attr]: value }; },
    getQuality(name) { return qualities[name] ?? 0; },
    setQuality(name, value) { qualities[name] = value; },
    deltaQuality(name, delta) { qualities[name] = (qualities[name] ?? 0) + delta; },
    sendMessage(_nodeId, _msg) {},
  };
}

describe("TriggerStore", () => {
  it("fires a trigger when node-attr condition is true", () => {
    const { ctx, calls } = makeCtx();
    const store = makeStore({ "vault": { accessLevel: "locked" } });
    const ts = new TriggerStore([{
      id: "unlock",
      when: { type: "node-attr", nodeId: "vault", attr: "accessLevel", eq: "owned" },
      then: [{ effect: "ctx-call", method: "log", args: ["Vault open!"] }],
    }]);

    ts.evaluate({ getNodeAttr: store.getNodeAttr, getQuality: store.getQuality },
      { ...store, targetNodeId: null, ctx });
    assert.equal(calls.log, undefined); // not yet

    store.setNodeAttr("vault", "accessLevel", "owned");
    ts.evaluate({ getNodeAttr: store.getNodeAttr, getQuality: store.getQuality },
      { ...store, targetNodeId: null, ctx });
    assert.equal(calls.log?.length, 1);
    assert.deepEqual(calls.log[0], ["Vault open!"]);
  });

  it("fires a trigger only once even if condition stays true", () => {
    const { ctx, calls } = makeCtx();
    const store = makeStore({ "A": { done: true } });
    const ts = new TriggerStore([{
      id: "once",
      when: { type: "node-attr", nodeId: "A", attr: "done", eq: true },
      then: [{ effect: "ctx-call", method: "startTrace", args: [] }],
    }]);

    const accessors = { getNodeAttr: store.getNodeAttr, getQuality: store.getQuality };
    const mutators = { ...store, targetNodeId: null, ctx };
    ts.evaluate(accessors, mutators);
    ts.evaluate(accessors, mutators);
    ts.evaluate(accessors, mutators);
    assert.equal(calls.startTrace?.length, 1);
  });

  it("fires an all-of trigger only when all sub-conditions are true", () => {
    const { ctx, calls } = makeCtx();
    const store = makeStore({ "A": { done: false }, "B": { done: false } });
    const ts = new TriggerStore([{
      id: "both",
      when: {
        type: "all-of", conditions: [
          { type: "node-attr", nodeId: "A", attr: "done", eq: true },
          { type: "node-attr", nodeId: "B", attr: "done", eq: true },
        ],
      },
      then: [{ effect: "ctx-call", method: "giveReward", args: [100] }],
    }]);

    const accessors = { getNodeAttr: store.getNodeAttr, getQuality: store.getQuality };
    const mutators = { ...store, targetNodeId: null, ctx };

    store.setNodeAttr("A", "done", true);
    ts.evaluate(accessors, mutators);
    assert.equal(calls.giveReward, undefined);

    store.setNodeAttr("B", "done", true);
    ts.evaluate(accessors, mutators);
    assert.equal(calls.giveReward?.length, 1);
    assert.deepEqual(calls.giveReward[0], [100]);
  });

  it("quality-delta effect updates the quality store", () => {
    const { ctx } = makeCtx();
    const store = makeStore({}, { bonus: 0 });
    const ts = new TriggerStore([{
      id: "bonus",
      when: { type: "quality-gte", name: "bonus", value: 0 },
      then: [{ effect: "quality-delta", name: "bonus", delta: 10 }],
    }]);
    ts.evaluate({ getNodeAttr: store.getNodeAttr, getQuality: store.getQuality },
      { ...store, targetNodeId: null, ctx });
    assert.equal(store.getQuality("bonus"), 10);
  });

  it("getFired returns the set of fired trigger ids", () => {
    const { ctx } = makeCtx();
    const store = makeStore({ "X": { ok: true } });
    const ts = new TriggerStore([{
      id: "t1",
      when: { type: "node-attr", nodeId: "X", attr: "ok", eq: true },
      then: [],
    }]);
    ts.evaluate({ getNodeAttr: store.getNodeAttr, getQuality: store.getQuality },
      { ...store, targetNodeId: null, ctx });
    assert.ok(ts.getFired().has("t1"));
  });

  it("reset clears the fired set", () => {
    const { ctx } = makeCtx();
    const store = makeStore({ "X": { ok: true } });
    const ts = new TriggerStore([{
      id: "t1",
      when: { type: "node-attr", nodeId: "X", attr: "ok", eq: true },
      then: [],
    }]);
    ts.evaluate({ getNodeAttr: store.getNodeAttr, getQuality: store.getQuality },
      { ...store, targetNodeId: null, ctx });
    ts.reset();
    assert.equal(ts.getFired().size, 0);
  });

  it("repeating trigger fires every evaluation cycle while condition is true", () => {
    const { ctx, calls } = makeCtx();
    const store = makeStore({ "A": { active: true } });
    const ts = new TriggerStore([{
      id: "repeater",
      repeating: true,
      when: { type: "node-attr", nodeId: "A", attr: "active", eq: true },
      then: [{ effect: "ctx-call", method: "log", args: ["fired"] }],
    }]);

    const accessors = { getNodeAttr: store.getNodeAttr, getQuality: store.getQuality };
    const mutators = { ...store, targetNodeId: null, ctx };
    ts.evaluate(accessors, mutators);
    ts.evaluate(accessors, mutators);
    ts.evaluate(accessors, mutators);
    assert.equal(calls.log?.length, 3);
  });

  it("repeating trigger is not added to fired set", () => {
    const { ctx } = makeCtx();
    const store = makeStore({ "A": { active: true } });
    const ts = new TriggerStore([{
      id: "repeater",
      repeating: true,
      when: { type: "node-attr", nodeId: "A", attr: "active", eq: true },
      then: [],
    }]);
    ts.evaluate({ getNodeAttr: store.getNodeAttr, getQuality: store.getQuality },
      { ...store, targetNodeId: null, ctx });
    assert.equal(ts.getFired().has("repeater"), false);
  });

  it("one-shot trigger still fires only once even when condition stays true", () => {
    const { ctx, calls } = makeCtx();
    const store = makeStore({ "A": { active: true } });
    const ts = new TriggerStore([{
      id: "once",
      when: { type: "node-attr", nodeId: "A", attr: "active", eq: true },
      then: [{ effect: "ctx-call", method: "startTrace", args: [] }],
    }]);

    const accessors = { getNodeAttr: store.getNodeAttr, getQuality: store.getQuality };
    const mutators = { ...store, targetNodeId: null, ctx };
    ts.evaluate(accessors, mutators);
    ts.evaluate(accessors, mutators);
    ts.evaluate(accessors, mutators);
    assert.equal(calls.startTrace?.length, 1);
  });
});
