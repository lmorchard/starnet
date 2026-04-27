// @ts-check
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { patrolRandom } from "./patrol-random.js";
import { initRng } from "../../rng.js";

describe("pattern: patrol-random", () => {
  it("picks a non-WAN neighbor", () => {
    initRng("test-seed");
    const state = {
      adjacency: { a: ["b", "wan-1"] },
      nodes: { a: { type: "router" }, b: { type: "router" }, "wan-1": { type: "wan" } },
    };
    const result = patrolRandom.onTick({ attentionNodeId: "a" }, state);
    assert.equal(result.nextAttention, "b");
  });

  it("returns null nextAttention when no eligible neighbors", () => {
    const state = {
      adjacency: { a: ["wan-1"] },
      nodes: { a: { type: "router" }, "wan-1": { type: "wan" } },
    };
    const result = patrolRandom.onTick({ attentionNodeId: "a" }, state);
    assert.equal(result.nextAttention, null);
  });

  it("returns null when attentionNodeId has no entry in adjacency", () => {
    const state = { adjacency: {}, nodes: {} };
    const result = patrolRandom.onTick({ attentionNodeId: "a" }, state);
    assert.equal(result.nextAttention, null);
  });
});
