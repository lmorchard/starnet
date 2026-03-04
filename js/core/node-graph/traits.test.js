// @ts-check
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { registerTrait, getTrait, resolveTraits, clearTraits } from "./traits.js";

describe("Trait Registry", () => {
  beforeEach(() => {
    clearTraits();
  });

  it("registers and retrieves a trait", () => {
    const traitDef = { attributes: { grade: "D" }, operators: [], actions: [] };
    registerTrait("graded", traitDef);
    assert.deepStrictEqual(getTrait("graded"), traitDef);
  });

  it("throws on unknown trait name", () => {
    assert.throws(() => getTrait("nonexistent"), /Unknown trait: "nonexistent"/);
  });
});

describe("resolveTraits", () => {
  beforeEach(() => {
    clearTraits();
  });

  it("passes through NodeDef with no traits array", () => {
    const nodeDef = {
      id: "n1", type: "test",
      attributes: { grade: "B", visibility: "hidden" },
      operators: [{ name: "relay" }],
      actions: [{ id: "probe", label: "PROBE", requires: [], effects: [] }],
    };
    const result = resolveTraits(nodeDef);
    assert.deepStrictEqual(result, nodeDef);
  });

  it("passes through NodeDef with empty traits array", () => {
    const nodeDef = {
      id: "n1", type: "test", traits: [],
      attributes: { grade: "B" },
    };
    const result = resolveTraits(nodeDef);
    assert.deepStrictEqual(result, nodeDef);
  });

  it("merges single trait attributes", () => {
    registerTrait("graded", { attributes: { grade: "D" }, operators: [], actions: [] });
    const result = resolveTraits({
      id: "n1", type: "test", traits: ["graded"],
      attributes: {},
    });
    assert.equal(result.attributes.grade, "D");
    assert.equal(result.attributes.label, "n1"); // base intrinsic
    assert.equal(result.attributes.visibility, "hidden"); // base intrinsic
  });

  it("merges single trait operators and actions", () => {
    registerTrait("armed", {
      attributes: {},
      operators: [{ name: "relay" }],
      actions: [{ id: "fire", label: "FIRE", requires: [], effects: [] }],
    });
    const result = resolveTraits({
      id: "n1", type: "test", traits: ["armed"],
      attributes: {},
    });
    assert.equal(result.operators.length, 1);
    assert.equal(result.operators[0].name, "relay");
    assert.equal(result.actions.length, 1);
    assert.equal(result.actions[0].id, "fire");
  });

  it("multiple traits merge left-to-right, last-wins on attribute conflict", () => {
    registerTrait("alpha", { attributes: { color: "red", size: 1 }, operators: [], actions: [] });
    registerTrait("beta", { attributes: { color: "blue", weight: 5 }, operators: [], actions: [] });
    const result = resolveTraits({
      id: "n1", type: "test", traits: ["alpha", "beta"],
      attributes: {},
    });
    assert.equal(result.attributes.color, "blue"); // beta wins
    assert.equal(result.attributes.size, 1);
    assert.equal(result.attributes.weight, 5);
  });

  it("multiple traits concatenate operators", () => {
    registerTrait("a", { attributes: {}, operators: [{ name: "relay" }], actions: [] });
    registerTrait("b", { attributes: {}, operators: [{ name: "flag", on: "alert", attr: "alerted", value: true }], actions: [] });
    const result = resolveTraits({
      id: "n1", type: "test", traits: ["a", "b"],
      attributes: {},
    });
    assert.equal(result.operators.length, 2);
    assert.equal(result.operators[0].name, "relay");
    assert.equal(result.operators[1].name, "flag");
  });

  it("multiple traits merge actions by ID, last-wins", () => {
    registerTrait("a", {
      attributes: {},
      operators: [],
      actions: [{ id: "act", label: "A-VERSION", requires: [], effects: [] }],
    });
    registerTrait("b", {
      attributes: {},
      operators: [],
      actions: [{ id: "act", label: "B-VERSION", requires: [], effects: [] }],
    });
    const result = resolveTraits({
      id: "n1", type: "test", traits: ["a", "b"],
      attributes: {},
    });
    assert.equal(result.actions.length, 1);
    assert.equal(result.actions[0].label, "B-VERSION");
  });

  it("explicit NodeDef attributes override trait defaults", () => {
    registerTrait("graded", { attributes: { grade: "D" }, operators: [], actions: [] });
    const result = resolveTraits({
      id: "n1", type: "test", traits: ["graded"],
      attributes: { grade: "A" },
    });
    assert.equal(result.attributes.grade, "A");
  });

  it("explicit NodeDef operators are appended after trait operators", () => {
    registerTrait("a", { attributes: {}, operators: [{ name: "relay" }], actions: [] });
    const result = resolveTraits({
      id: "n1", type: "test", traits: ["a"],
      attributes: {},
      operators: [{ name: "clock", period: 10 }],
    });
    assert.equal(result.operators.length, 2);
    assert.equal(result.operators[0].name, "relay");
    assert.equal(result.operators[1].name, "clock");
  });

  it("explicit NodeDef actions override trait actions by ID", () => {
    registerTrait("a", {
      attributes: {},
      operators: [],
      actions: [{ id: "probe", label: "TRAIT-PROBE", requires: [], effects: [] }],
    });
    const result = resolveTraits({
      id: "n1", type: "test", traits: ["a"],
      attributes: {},
      actions: [{ id: "probe", label: "CUSTOM-PROBE", requires: [], effects: [] }],
    });
    assert.equal(result.actions.length, 1);
    assert.equal(result.actions[0].label, "CUSTOM-PROBE");
  });

  it("preserves traits array on resolved NodeDef", () => {
    registerTrait("graded", { attributes: { grade: "D" }, operators: [], actions: [] });
    const result = resolveTraits({
      id: "n1", type: "test", traits: ["graded"],
      attributes: {},
    });
    assert.deepStrictEqual(result.traits, ["graded"]);
  });

  it("preserves type field on resolved NodeDef", () => {
    registerTrait("graded", { attributes: { grade: "D" }, operators: [], actions: [] });
    const result = resolveTraits({
      id: "n1", type: "fileserver", traits: ["graded"],
      attributes: {},
    });
    assert.equal(result.type, "fileserver");
  });
});
