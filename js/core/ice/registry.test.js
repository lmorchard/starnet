// @ts-check
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { getType, pickIceTypeId } from "./registry.js";

describe("damaging presets", () => {
  it("sentinel carries a damage-health effect and no raise-alert", () => {
    const t = getType("sentinel");
    assert.ok(t);
    const atoms = t.effects.map((e) => e.atom);
    assert.ok(atoms.includes("damage-health"));
    assert.ok(!atoms.includes("raise-alert"));
    const dmg = t.effects.find((e) => e.atom === "damage-health");
    assert.equal(dmg.params.amount, 20);
  });

  it("spike carries a damage-deck effect and no raise-alert", () => {
    const t = getType("spike");
    assert.ok(t);
    const atoms = t.effects.map((e) => e.atom);
    assert.ok(atoms.includes("damage-deck"));
    assert.ok(!atoms.includes("raise-alert"));
    assert.equal(t.effects.find((e) => e.atom === "damage-deck").params.amount, 20);
  });

  it("damaging presets are grade-agnostic (no grade field — set at spawn)", () => {
    assert.equal(getType("sentinel").grade, undefined);
    assert.equal(getType("spike").grade, undefined);
  });
});

describe("pickIceTypeId", () => {
  it("below B: always classic, regardless of roll", () => {
    assert.equal(pickIceTypeId("C", 0.0), "patrol-classic-C");
    assert.equal(pickIceTypeId("D", 0.99), "patrol-classic-D");
    assert.equal(pickIceTypeId("F", 0.6), "patrol-classic-F");
  });

  it("B+: roll partitions classic / sentinel / spike", () => {
    assert.equal(pickIceTypeId("B", 0.10), "patrol-classic-B"); // < 0.5 -> classic
    assert.equal(pickIceTypeId("A", 0.60), "sentinel");          // [0.5, 0.75) -> sentinel
    assert.equal(pickIceTypeId("S", 0.90), "spike");             // >= 0.75 -> spike
  });

  it("B+: exact boundary values fall into the upper bucket", () => {
    assert.equal(pickIceTypeId("B", 0.5), "sentinel");  // 0.5 is first sentinel
    assert.equal(pickIceTypeId("B", 0.75), "spike");    // 0.75 is first spike
  });
});
