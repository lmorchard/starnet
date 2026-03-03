import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getAvailableActions, executeAction } from "./actions.js";

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
  const sent = /** @type {any[]} */ ([]);
  return {
    nodes, qualities,
    sent,
    getNodeAttr(nodeId, attr) { return nodes[nodeId]?.[attr]; },
    setNodeAttr(nodeId, attr, value) { nodes[nodeId] = { ...(nodes[nodeId] ?? {}), [attr]: value }; },
    getQuality(name) { return qualities[name] ?? 0; },
    setQuality(name, value) { qualities[name] = value; },
    deltaQuality(name, delta) { qualities[name] = (qualities[name] ?? 0) + delta; },
    sendMessage(nodeId, msg) { sent.push({ nodeId, msg }); },
  };
}

/** @type {import('./types.js').ActionDef[]} */
const actionDefs = [
  {
    id: "flip",
    label: "Flip",
    requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }],
    effects: [{ effect: "set-attr", attr: "aligned", value: true }],
  },
  {
    id: "reward",
    label: "Collect",
    requires: [{ type: "quality-gte", name: "tokens", value: 1 }],
    effects: [{ effect: "quality-delta", name: "tokens", delta: -1 }],
  },
  {
    id: "free",
    label: "Free action",
    requires: [],
    effects: [],
  },
];

describe("getAvailableActions", () => {
  it("returns only actions whose requires pass", () => {
    const store = makeStore({ "N": { accessLevel: "owned" } }, { tokens: 0 });
    const available = getAvailableActions(actionDefs, "N", store);
    const ids = available.map((a) => a.id);
    assert.ok(ids.includes("flip"));
    assert.ok(!ids.includes("reward"));
    assert.ok(ids.includes("free"));
  });

  it("excludes actions with failing requires", () => {
    const store = makeStore({ "N": { accessLevel: "locked" } }, { tokens: 0 });
    const available = getAvailableActions(actionDefs, "N", store);
    assert.ok(!available.map((a) => a.id).includes("flip"));
  });

  it("includes quality-based actions when quality passes", () => {
    const store = makeStore({ "N": { accessLevel: "locked" } }, { tokens: 3 });
    const available = getAvailableActions(actionDefs, "N", store);
    assert.ok(available.map((a) => a.id).includes("reward"));
  });
});

describe("executeAction: set-attr effect", () => {
  it("applies set-attr to the node", () => {
    const store = makeStore({ "N": { accessLevel: "owned", aligned: false } });
    const { ctx } = makeCtx();
    executeAction(actionDefs, "flip", "N", { ...store, targetNodeId: null, ctx }, store);
    assert.equal(store.getNodeAttr("N", "aligned"), true);
  });
});

describe("executeAction: quality-delta effect", () => {
  it("decrements quality", () => {
    const store = makeStore({}, { tokens: 5 });
    const { ctx } = makeCtx();
    executeAction(actionDefs, "reward", "N", { ...store, targetNodeId: null, ctx }, store);
    assert.equal(store.getQuality("tokens"), 4);
  });
});

describe("executeAction: emit-message effect", () => {
  it("calls sendMessage via the mutators", () => {
    const store = makeStore({ "N": {} });
    const { ctx } = makeCtx();
    const emitDefs = [{
      id: "send",
      label: "Send",
      requires: [],
      effects: [{ effect: "emit-message", message: { type: "unlock", payload: {} } }],
    }];
    executeAction(/** @type {any} */ (emitDefs), "send", "N", { ...store, targetNodeId: null, ctx }, store);
    assert.equal(store.sent.length, 1);
    assert.equal(store.sent[0].msg.type, "unlock");
  });
});

describe("executeAction: error cases", () => {
  it("throws if actionId not found", () => {
    const store = makeStore();
    const { ctx } = makeCtx();
    assert.throws(() => executeAction(actionDefs, "bogus", "N", { ...store, targetNodeId: null, ctx }, store));
  });

  it("throws if requires fail", () => {
    const store = makeStore({ "N": { accessLevel: "locked" } });
    const { ctx } = makeCtx();
    assert.throws(() => executeAction(actionDefs, "flip", "N", { ...store, targetNodeId: null, ctx }, store));
  });
});
