// @ts-check
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { playerHunter } from "./player-hunter.js";
import { initRng } from "../../rng.js";

describe("pattern: player-hunter", () => {
  it("pathfinds toward state.selectedNodeId", () => {
    initRng("test-seed");
    const state = {
      adjacency: { a: ["b"], b: ["a", "c"], c: ["b"] },
      nodes: { a: { type: "router" }, b: { type: "router" }, c: { type: "router" } },
      selectedNodeId: "c",
    };
    const result = playerHunter.onTick({ attentionNodeId: "a" }, state);
    assert.equal(result.nextAttention, "b");
  });

  it("falls back to random walk when no node selected", () => {
    initRng("test-seed");
    const state = {
      adjacency: { a: ["b"] },
      nodes: { a: { type: "router" }, b: { type: "router" } },
      selectedNodeId: null,
    };
    const result = playerHunter.onTick({ attentionNodeId: "a" }, state);
    assert.equal(result.nextAttention, "b");
  });

  it("returns null when no eligible neighbors", () => {
    const state = {
      adjacency: { a: ["wan-1"] },
      nodes: { a: { type: "router" }, "wan-1": { type: "wan" } },
      selectedNodeId: "wan-1",
    };
    const result = playerHunter.onTick({ attentionNodeId: "a" }, state);
    assert.equal(result.nextAttention, null);
  });
});
