import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateTargets } from "./targets.js";
import { createProfile } from "./index.js";

describe("generateTargets", () => {
  it("returns three well-formed targets", () => {
    const targets = generateTargets(createProfile());
    assert.equal(targets.length, 3);
    for (const t of targets) {
      assert.ok(typeof t.id === "string" && t.id.length > 0);
      assert.ok(typeof t.label === "string" && t.label.length > 0);
      assert.ok(typeof t.seed === "string" && t.seed.length > 0);
      assert.ok(t.spec && t.spec.threat && t.spec.wealth && t.spec.complexity && t.spec.depth);
    }
  });

  it("is deterministic for a given hub-visit count", () => {
    const a = generateTargets({ ...createProfile(), _hubVisits: 5 });
    const b = generateTargets({ ...createProfile(), _hubVisits: 5 });
    assert.deepEqual(a, b);
  });

  it("produces different seeds as the hub-visit count changes", () => {
    const v0 = generateTargets({ ...createProfile(), _hubVisits: 0 });
    const v1 = generateTargets({ ...createProfile(), _hubVisits: 1 });
    assert.notDeepEqual(
      v0.map((t) => t.seed),
      v1.map((t) => t.seed),
    );
  });
});
