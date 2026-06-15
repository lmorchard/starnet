import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveProgress, deriveThreat } from "../js/audio/signals.js";

function nodes(spec) {
  // spec: array of accessLevel strings
  const out = {};
  spec.forEach((accessLevel, i) => { out["n" + i] = { accessLevel, visibility: "revealed" }; });
  return out;
}

test("deriveProgress is 0 when nothing is owned", () => {
  const state = { nodes: nodes(["locked", "locked", "open"]) };
  assert.equal(deriveProgress(state), 0);
});

test("deriveProgress is ownedCount/total", () => {
  const state = { nodes: nodes(["owned", "owned", "locked", "locked"]) };
  assert.equal(deriveProgress(state), 0.5);
});

test("deriveProgress returns 0 for empty/missing nodes", () => {
  assert.equal(deriveProgress({ nodes: {} }), 0);
  assert.equal(deriveProgress({}), 0);
});

test("deriveThreat maps alert levels to the ladder", () => {
  assert.equal(deriveThreat({ globalAlert: "green" }), 0);
  assert.equal(deriveThreat({ globalAlert: "yellow" }), 1 / 3);
  assert.equal(deriveThreat({ globalAlert: "red" }), 2 / 3);
  assert.equal(deriveThreat({ globalAlert: "trace" }), 1);
});

test("deriveThreat adds an injury term as health drops", () => {
  const hurt = { globalAlert: "green", player: { health: { current: 0, max: 100 }, deckIntegrity: { current: 100, max: 100 } } };
  assert.equal(deriveThreat(hurt), 0.25);
});

test("deriveThreat never exceeds 1", () => {
  const maxed = { globalAlert: "trace", player: { health: { current: 0, max: 100 }, deckIntegrity: { current: 0, max: 100 } } };
  assert.equal(deriveThreat(maxed), 1);
});
