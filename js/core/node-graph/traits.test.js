// @ts-check
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { registerTrait, getTrait, resolveTraits, clearTraits } from "./traits.js";

// traits.js self-registers built-in traits at import time.
// Save them before tests clear the registry.
const BUILT_IN_TRAITS = [
  "graded", "hackable", "lootable", "rebootable", "relay", "detectable", "security", "gate",
  "hardened", "audited", "trapped", "encrypted", "volatile",
];
const _savedTraits = new Map();
for (const name of BUILT_IN_TRAITS) {
  _savedTraits.set(name, getTrait(name));
}
/** Restore built-in traits (for tests that clear the registry). */
function restoreBuiltIns() {
  for (const [name, def] of _savedTraits) {
    registerTrait(name, def);
  }
}

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

describe("Built-in traits", () => {
  beforeEach(() => {
    restoreBuiltIns();
  });

  it("all 8 built-in traits are registered", () => {
    for (const name of BUILT_IN_TRAITS) {
      assert.ok(getTrait(name), `trait "${name}" should be registered`);
    }
  });

  it("graded provides grade attribute", () => {
    const t = getTrait("graded");
    assert.equal(t.attributes.grade, "D");
  });

  it("hackable provides accessLevel, probed, vulnerabilities, actions", () => {
    const t = getTrait("hackable");
    assert.equal(t.attributes.accessLevel, "locked");
    assert.equal(t.attributes.probed, false);
    assert.deepStrictEqual(t.attributes.vulnerabilities, []);
    const actionIds = t.actions.map(a => a.id);
    assert.ok(actionIds.includes("probe"));
    assert.ok(actionIds.includes("cancel-probe"));
    assert.ok(actionIds.includes("exploit"));
    assert.ok(actionIds.includes("cancel-exploit"));
  });

  it("lootable provides read, looted, macguffins, actions", () => {
    const t = getTrait("lootable");
    assert.equal(t.attributes.read, false);
    assert.equal(t.attributes.looted, false);
    const actionIds = t.actions.map(a => a.id);
    assert.ok(actionIds.includes("read"));
    assert.ok(actionIds.includes("loot"));
  });

  it("rebootable provides rebooting and eject/reboot actions", () => {
    const t = getTrait("rebootable");
    assert.equal(t.attributes.rebooting, false);
    const actionIds = t.actions.map(a => a.id);
    assert.ok(actionIds.includes("eject"));
    assert.ok(actionIds.includes("reboot"));
  });

  it("relay provides relay operator", () => {
    const t = getTrait("relay");
    assert.equal(t.operators.length, 1);
    assert.equal(t.operators[0].name, "relay");
  });

  it("detectable provides forwardingEnabled, alert operators, reconfigure action", () => {
    const t = getTrait("detectable");
    assert.equal(t.attributes.forwardingEnabled, true);
    assert.equal(t.attributes.alerted, false);
    assert.ok(t.operators.some(o => o.name === "relay" && o.filter === "alert"));
    assert.ok(t.operators.some(o => o.name === "flag"));
    assert.ok(t.actions.some(a => a.id === "reconfigure"));
  });

  it("security provides alert flag operator and cancel-trace action", () => {
    const t = getTrait("security");
    assert.ok(t.operators.some(o => o.name === "flag"));
    assert.ok(t.actions.some(a => a.id === "cancel-trace"));
  });

  it("gate provides gateAccess attribute", () => {
    const t = getTrait("gate");
    assert.equal(t.attributes.gateAccess, "probed");
  });

  it("composing graded + hackable + gate resolves correctly", () => {
    const result = resolveTraits({
      id: "gw-1", type: "gateway",
      traits: ["graded", "hackable", "gate"],
      attributes: { grade: "C" },
    });
    assert.equal(result.attributes.grade, "C"); // explicit override
    assert.equal(result.attributes.accessLevel, "locked"); // from hackable
    assert.equal(result.attributes.gateAccess, "probed"); // from gate
    assert.equal(result.attributes.visibility, "hidden"); // base intrinsic
    assert.ok(result.actions.some(a => a.id === "probe"));
  });

  it("trait triggers are merged into resolved NodeDef", () => {
    clearTraits();
    registerTrait("test-trap", {
      attributes: {},
      operators: [],
      actions: [],
      triggers: [{
        id: "trap-fire",
        when: { type: "node-attr", attr: "probed", eq: true },
        then: [{ effect: "ctx-call", method: "startTrace", args: [] }],
      }],
    });
    const result = resolveTraits({
      id: "n1", type: "test", traits: ["test-trap"],
      attributes: {},
    });
    assert.ok(result.triggers);
    assert.equal(result.triggers.length, 1);
    assert.equal(result.triggers[0].id, "trap-fire");
    restoreBuiltIns();
  });

  it("composing hackable + lootable + rebootable gives all actions", () => {
    const result = resolveTraits({
      id: "fs-1", type: "fileserver",
      traits: ["graded", "hackable", "lootable", "rebootable", "gate"],
      attributes: {},
    });
    const actionIds = result.actions.map(a => a.id);
    assert.ok(actionIds.includes("probe"));
    assert.ok(actionIds.includes("exploit"));
    assert.ok(actionIds.includes("read"));
    assert.ok(actionIds.includes("loot"));
    assert.ok(actionIds.includes("eject"));
    assert.ok(actionIds.includes("reboot"));
  });

  // ── New traits ──

  it("hardened sets durationMultiplier", () => {
    const t = getTrait("hardened");
    assert.equal(t.attributes.durationMultiplier, 2.0);
  });

  it("audited sets noiseInterval", () => {
    const t = getTrait("audited");
    assert.equal(t.attributes.noiseInterval, 0.1);
  });

  it("trapped has a per-node trigger", () => {
    const t = getTrait("trapped");
    assert.ok(t.triggers);
    assert.equal(t.triggers.length, 1);
    assert.equal(t.triggers[0].id, "trap-on-probe");
  });

  it("encrypted overrides read action with quality-from-attr condition", () => {
    const t = getTrait("encrypted");
    assert.equal(t.actions.length, 1);
    assert.equal(t.actions[0].id, "read");
    const qualCond = t.actions[0].requires.find(r => r.type === "quality-from-attr");
    assert.ok(qualCond, "read action should have quality-from-attr condition");
  });

  it("encrypted read action is gated when composed with lootable", () => {
    const result = resolveTraits({
      id: "vault", type: "cryptovault",
      traits: ["graded", "hackable", "lootable", "encrypted", "gate"],
      attributes: { encryptionKey: "test-key" },
    });
    // encrypted's read should override lootable's read (last-wins by ID)
    const readAction = result.actions.find(a => a.id === "read");
    assert.ok(readAction);
    const qualCond = readAction.requires.find(r => r.type === "quality-from-attr");
    assert.ok(qualCond, "composed read should have quality gate");
  });

  it("volatile has trigger + timed-action operator", () => {
    const t = getTrait("volatile");
    assert.ok(t.triggers);
    assert.equal(t.triggers.length, 1);
    assert.equal(t.triggers[0].id, "volatile-arm");
    assert.equal(t.operators.length, 1);
    assert.equal(t.operators[0].action, "volatile");
  });
});
