import test from "node:test";
import assert from "node:assert/strict";
import { initRng, _forceNext, RNG } from "../js/core/rng.js";
import { resetRoundIdCounter } from "../js/core/hoard.js";
import { mineYieldChance, isMineExhausted, rollMineRarity, generateMinedRound } from "../js/core/mining.js";

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
test("generateMinedRound targets the node's own vuln ids as types", () => {
  initRng("seed-A");
  const node = { id: "n", grade: "B", vulnerabilities: [{ id: "weak-auth" }, { id: "path-traversal" }] };
  const round = generateMinedRound(node);
  assert.ok(Array.isArray(round.types), "types must be an array");
  // All types in the round must come from the node's vuln ids
  for (const t of round.types) {
    assert.ok(["weak-auth", "path-traversal"].includes(t), `type ${t} must be from node's vulns`);
  }
});
test("generateMinedRound falls back to arbitrary types when node has no vulns", () => {
  initRng("seed-B");
  const round = generateMinedRound({ id: "n", grade: "D", vulnerabilities: [] });
  assert.ok(Array.isArray(round.types) && round.types.length >= 1, "must have at least 1 type via fallback");
});
test("generateMinedRound respects patched/hidden vuln filtering", () => {
  initRng("seed-C");
  const node = {
    id: "n", grade: "B",
    vulnerabilities: [
      { id: "weak-auth", patched: true },
      { id: "path-traversal", hidden: true },
      { id: "open-port" },
    ],
  };
  const round = generateMinedRound(node);
  // Only open-port is usable; types should come only from that
  for (const t of round.types) {
    assert.ok(t === "open-port", `patched/hidden vulns must be excluded; got: ${t}`);
  }
});
test("generateMinedRound returns an ExploitRound shape (id, rarity, types, disclosed)", () => {
  initRng("seed-shape");
  const node = { id: "n", grade: "C", vulnerabilities: [{ id: "kernel-exploit" }] };
  const round = generateMinedRound(node);
  assert.ok(typeof round.id === "string" && round.id.length === 8, "id must be 8-char hex");
  assert.ok(["common", "uncommon", "rare"].includes(round.rarity), "rarity must be valid");
  assert.ok(Array.isArray(round.types), "types must be array");
  assert.equal(round.disclosed, false, "round starts undisclosed");
});
test("generateMinedRound rarity distribution honors grade (S tilts richer than F)", () => {
  // Run 200 rolls for each grade and confirm S produces more uncommon/rare than F.
  function countNonCommon(grade, n) {
    let count = 0;
    for (let i = 0; i < n; i++) {
      initRng(`dist-${grade}-${i}`);
      if (rollMineRarity(grade) !== "common") count++;
    }
    return count;
  }
  const sNonCommon = countNonCommon("S", 200);
  const fNonCommon = countNonCommon("F", 200);
  assert.ok(sNonCommon > fNonCommon, `S grade (${sNonCommon} non-common) should beat F (${fNonCommon} non-common)`);
});
test("same seed → identical mined round (determinism)", () => {
  const make = () => {
    initRng("fixed");
    resetRoundIdCounter();
    return generateMinedRound({ id: "n", grade: "A", vulnerabilities: [{ id: "kernel-exploit" }] });
  };
  const r1 = make();
  const r2 = make();
  assert.deepEqual(r1, r2);
});
