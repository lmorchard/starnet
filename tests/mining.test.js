import test from "node:test";
import assert from "node:assert/strict";
import { initRng, _forceNext, RNG } from "../js/core/rng.js";
import { setExploitIdCounter } from "../js/core/exploits.js";
import { mineYieldChance, isMineExhausted, rollMineRarity, generateMinedCard } from "../js/core/mining.js";

test("yield chance decays per attempt", () => {
  assert.ok(mineYieldChance("B", 1) < mineYieldChance("B", 0));
  assert.ok(mineYieldChance("B", 5) < mineYieldChance("B", 1));
});
test("yield is grade-scaled — higher grade sustains longer", () => {
  assert.ok(mineYieldChance("S", 4) > mineYieldChance("F", 4));
});
test("low grade taps out sooner than high grade", () => {
  let fOut = 0; while (!isMineExhausted("F", fOut)) fOut++;
  let sOut = 0; while (!isMineExhausted("S", sOut)) sOut++;
  assert.ok(sOut > fOut);
});
test("rollMineRarity deterministic under forced RNG", () => {
  initRng("t"); _forceNext(RNG.MINE, 0.10);   // F: 0.10 < common 0.95 → common
  assert.equal(rollMineRarity("F"), "common");
});
test("generateMinedCard targets one of the node's own vulns", () => {
  initRng("seed-A");
  const node = { id: "n", grade: "B", vulnerabilities: [{ id: "weak-auth" }, { id: "path-traversal" }] };
  const card = generateMinedCard(node);
  assert.equal(card.targetVulnTypes.length, 1);
  assert.ok(["weak-auth", "path-traversal"].includes(card.targetVulnTypes[0]));
});
test("generateMinedCard falls back to random when node has no vulns", () => {
  initRng("seed-B");
  const card = generateMinedCard({ id: "n", grade: "D", vulnerabilities: [] });
  assert.ok(card.targetVulnTypes.length >= 1);
});
test("same seed → identical mined card (determinism)", () => {
  const make = () => { initRng("fixed"); setExploitIdCounter(1); return generateMinedCard({ id: "n", grade: "A", vulnerabilities: [{ id: "kernel-exploit" }] }); };
  assert.deepEqual(make(), make());
});
