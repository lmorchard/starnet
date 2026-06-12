import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateCondition, fillConditionNodeId } from "./conditions.js";

const attrs = {
  "node-A": { accessLevel: "owned", grade: "B" },
  "node-B": { accessLevel: "locked" },
};
const qualities = { tokens: 5, panels: 2 };

const accessors = {
  getNodeAttr: (nodeId, attr) => attrs[nodeId]?.[attr],
  getQuality: (name) => qualities[name] ?? 0,
};

describe("evaluateCondition: node-attr", () => {
  it("returns true when attribute matches eq", () => {
    assert.equal(evaluateCondition({ type: "node-attr", nodeId: "node-A", attr: "accessLevel", eq: "owned" }, accessors), true);
  });

  it("returns false when attribute does not match", () => {
    assert.equal(evaluateCondition({ type: "node-attr", nodeId: "node-B", attr: "accessLevel", eq: "owned" }, accessors), false);
  });
});

describe("evaluateCondition: quality-gte", () => {
  it("returns true when quality >= value", () => {
    assert.equal(evaluateCondition({ type: "quality-gte", name: "tokens", value: 5 }, accessors), true);
    assert.equal(evaluateCondition({ type: "quality-gte", name: "tokens", value: 3 }, accessors), true);
  });

  it("returns false when quality < value", () => {
    assert.equal(evaluateCondition({ type: "quality-gte", name: "tokens", value: 6 }, accessors), false);
  });
});

describe("evaluateCondition: quality-eq", () => {
  it("returns true when quality === value", () => {
    assert.equal(evaluateCondition({ type: "quality-eq", name: "panels", value: 2 }, accessors), true);
  });

  it("returns false otherwise", () => {
    assert.equal(evaluateCondition({ type: "quality-eq", name: "panels", value: 3 }, accessors), false);
  });
});

describe("evaluateCondition: all-of", () => {
  it("returns true when all sub-conditions pass", () => {
    assert.equal(evaluateCondition({
      type: "all-of",
      conditions: [
        { type: "node-attr", nodeId: "node-A", attr: "accessLevel", eq: "owned" },
        { type: "quality-gte", name: "tokens", value: 1 },
      ],
    }, accessors), true);
  });

  it("returns false when any sub-condition fails", () => {
    assert.equal(evaluateCondition({
      type: "all-of",
      conditions: [
        { type: "node-attr", nodeId: "node-A", attr: "accessLevel", eq: "owned" },
        { type: "quality-gte", name: "tokens", value: 99 },
      ],
    }, accessors), false);
  });
});

describe("evaluateCondition: any-of", () => {
  it("returns true when any sub-condition passes", () => {
    assert.equal(evaluateCondition({
      type: "any-of",
      conditions: [
        { type: "node-attr", nodeId: "node-B", attr: "accessLevel", eq: "owned" },
        { type: "quality-gte", name: "tokens", value: 1 },
      ],
    }, accessors), true);
  });

  it("returns false when all sub-conditions fail", () => {
    assert.equal(evaluateCondition({
      type: "any-of",
      conditions: [
        { type: "node-attr", nodeId: "node-B", attr: "accessLevel", eq: "owned" },
        { type: "quality-gte", name: "tokens", value: 99 },
      ],
    }, accessors), false);
  });
});

describe("evaluateCondition: not", () => {
  it("returns true when the inner condition fails", () => {
    assert.equal(evaluateCondition({
      type: "not",
      condition: { type: "node-attr", nodeId: "node-B", attr: "accessLevel", eq: "owned" },
    }, accessors), true);
  });

  it("returns false when the inner condition passes", () => {
    assert.equal(evaluateCondition({
      type: "not",
      condition: { type: "node-attr", nodeId: "node-A", attr: "accessLevel", eq: "owned" },
    }, accessors), false);
  });
});

describe("evaluateCondition: unknown type", () => {
  it("throws for unknown condition type", () => {
    assert.throws(() => evaluateCondition(/** @type {any} */ ({ type: "bogus" }), accessors));
  });
});

describe("fillConditionNodeId", () => {
  it("fills a missing nodeId on a node-attr condition", () => {
    const filled = fillConditionNodeId({ type: "node-attr", attr: "accessLevel", eq: "owned" }, "self");
    assert.equal(filled.nodeId, "self");
  });

  it("fills a missing nodeId on a quality-from-attr condition", () => {
    const filled = fillConditionNodeId({ type: "quality-from-attr", attr: "tokenName", gte: 1 }, "self");
    assert.equal(filled.nodeId, "self");
  });

  it("leaves an existing nodeId untouched", () => {
    const filled = fillConditionNodeId({ type: "node-attr", nodeId: "other", attr: "x", eq: 1 }, "self");
    assert.equal(filled.nodeId, "other");
  });

  it("recurses into all-of and any-of compositions", () => {
    const filled = fillConditionNodeId({
      type: "all-of",
      conditions: [
        { type: "node-attr", attr: "a", eq: 1 },
        { type: "any-of", conditions: [{ type: "quality-from-attr", attr: "q", eq: 1 }] },
      ],
    }, "self");
    assert.equal(filled.conditions[0].nodeId, "self");
    assert.equal(filled.conditions[1].conditions[0].nodeId, "self");
  });

  it("recurses into not compositions", () => {
    const filled = fillConditionNodeId({
      type: "not",
      condition: { type: "node-attr", attr: "a", eq: 1 },
    }, "self");
    assert.equal(filled.condition.nodeId, "self");
  });

  it("does not mutate the input condition", () => {
    const input = { type: "node-attr", attr: "a", eq: 1 };
    fillConditionNodeId(input, "self");
    assert.equal(input.nodeId, undefined);
  });
});
