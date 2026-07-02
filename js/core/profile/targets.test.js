import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateTargets } from "./targets.js";
import { createProfile } from "./index.js";
import { NAMED_NETWORKS } from "../../../data/networks/index.js";

describe("generateTargets", () => {
  it("returns the three procedural tiers, each well-formed", () => {
    const procgen = generateTargets(createProfile()).filter((t) => !t.network);
    assert.equal(procgen.length, 3);
    for (const t of procgen) {
      assert.ok(typeof t.id === "string" && t.id.length > 0);
      assert.ok(typeof t.label === "string" && t.label.length > 0);
      assert.ok(typeof t.seed === "string" && t.seed.length > 0);
      assert.ok(t.spec && t.spec.threat && t.spec.wealth && t.spec.complexity && t.spec.depth);
    }
  });

  it("surfaces every named network as an authored target (#261)", () => {
    const authored = generateTargets(createProfile()).filter((t) => t.network);
    // one authored target per registered named network, each resolvable in the registry
    assert.equal(authored.length, Object.keys(NAMED_NETWORKS).length);
    for (const t of authored) {
      assert.ok(typeof t.id === "string" && t.id.length > 0);
      assert.ok(typeof t.label === "string" && t.label.length > 0);
      assert.ok(t.network in NAMED_NETWORKS, `network "${t.network}" is registered`);
    }
    // every registered network is present exactly once
    assert.deepEqual(
      authored.map((t) => t.network).sort(),
      Object.keys(NAMED_NETWORKS).sort(),
    );
  });

  it("is deterministic for a given hub-visit count", () => {
    const a = generateTargets({ ...createProfile(), _hubVisits: 5 });
    const b = generateTargets({ ...createProfile(), _hubVisits: 5 });
    assert.deepEqual(a, b);
  });

  it("produces different procedural seeds as the hub-visit count changes", () => {
    const seeds = (v) => generateTargets({ ...createProfile(), _hubVisits: v })
      .filter((t) => !t.network).map((t) => t.seed);
    assert.notDeepEqual(seeds(0), seeds(1));
  });

  it("authored targets are stable across hub visits (not seed-rotated)", () => {
    const authored = (v) => generateTargets({ ...createProfile(), _hubVisits: v }).filter((t) => t.network);
    assert.deepEqual(authored(0), authored(3));
  });
});
