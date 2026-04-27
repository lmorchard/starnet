// @ts-check
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { disturbanceTracker } from "./disturbance-tracker.js";
import { initRng } from "../../rng.js";

describe("pattern: disturbance-tracker", () => {
  it("pathfinds toward state.lastDisturbedNodeId", () => {
    initRng("test-seed");
    // Linear graph a — b — c, ICE at a, disturbance at c
    const state = {
      adjacency: { a: ["b"], b: ["a", "c"], c: ["b"] },
      nodes: { a: { type: "router" }, b: { type: "router" }, c: { type: "router" } },
      lastDisturbedNodeId: "c",
    };
    const result = disturbanceTracker.onTick(
      { attentionNodeId: "a", detectedAtNode: null },
      state,
    );
    assert.equal(result.nextAttention, "b");
  });

  it("signals arrival at disturbance target", () => {
    initRng("test-seed");
    const state = {
      adjacency: { c: ["b"] },
      nodes: { c: { type: "router" }, b: { type: "router" } },
      lastDisturbedNodeId: "c",
    };
    const result = disturbanceTracker.onTick(
      { attentionNodeId: "c", detectedAtNode: null },
      state,
    );
    assert.equal(result.arrivedAtDisturbanceTarget, true);
  });

  it("falls back to random walk when no disturbance set", () => {
    initRng("test-seed");
    const state = {
      adjacency: { a: ["b"] },
      nodes: { a: { type: "router" }, b: { type: "router" } },
      lastDisturbedNodeId: null,
    };
    const result = disturbanceTracker.onTick(
      { attentionNodeId: "a", detectedAtNode: null },
      state,
    );
    assert.equal(result.nextAttention, "b");
  });

  it("falls back to random walk when already detected at the disturbance target", () => {
    initRng("test-seed");
    const state = {
      adjacency: { a: ["b"], b: ["a", "c"], c: ["b"] },
      nodes: { a: { type: "router" }, b: { type: "router" }, c: { type: "router" } },
      lastDisturbedNodeId: "c",
    };
    // detectedAtNode === target prevents oscillation
    const result = disturbanceTracker.onTick(
      { attentionNodeId: "a", detectedAtNode: "c" },
      state,
    );
    // Should random-walk among neighbors of "a" (just "b" here), not pathfind
    assert.equal(result.nextAttention, "b");
  });
});
