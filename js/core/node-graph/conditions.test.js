import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateCondition } from "./conditions.js";

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

describe("evaluateCondition: unknown type", () => {
  it("throws for unknown condition type", () => {
    assert.throws(() => evaluateCondition(/** @type {any} */ ({ type: "bogus" }), accessors));
  });
});
