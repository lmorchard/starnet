import test from "node:test";
import assert from "node:assert/strict";
import { perceive } from "../scripts/bot/perception.js";

// Minimal GameState stub sufficient for perceive() to build a world.
function stubState(hoard) {
  return {
    nodes: {},
    adjacency: {},
    selectedNodeId: null,
    globalAlert: "green",
    traceSecondsRemaining: null,
    phase: "playing",
    player: { cash: 500, hoard },
    mission: null,
    ice: {},
  };
}

test("perception counts usable (non-disclosed) rounds in hoardUsable", () => {
  const hoard = [
    { id: "r1", rarity: "common", types: [], disclosed: false },
    { id: "r2", rarity: "common", types: [], disclosed: true },
    { id: "r3", rarity: "uncommon", types: [], disclosed: false },
  ];
  const world = perceive(stubState(hoard));
  assert.equal(world.hoardUsable, 2);
});

test("perception hoardUsable is 0 for an empty hoard", () => {
  assert.equal(perceive(stubState([])).hoardUsable, 0);
});

test("perception exposes failedNodes from context", () => {
  const failedNodes = new Set(["node-a"]);
  const world = perceive(stubState([]), { failedNodes });
  assert.equal(world.failedNodes, failedNodes);
});
