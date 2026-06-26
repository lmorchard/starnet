import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GRID_STEPS,
  stepsPerBar,
  expectedSteps,
  normalizeStep,
  ratchetOffsets,
  shouldFire,
} from "../js/audio/rhythm.js";

// Pure rhythm helpers behind the flexible-grid + step-modifier authoring. No Tone, no DOM —
// the testable layer the engine's playStep delegates to.

test("stepsPerBar covers the grids scores use (4/4)", () => {
  assert.equal(stepsPerBar("4n"), 4);
  assert.equal(stepsPerBar("8n"), 8);
  assert.equal(stepsPerBar("16n"), 16);
  assert.equal(stepsPerBar("32n"), 32);
  assert.equal(stepsPerBar("8t"), 12);
  assert.equal(stepsPerBar("16t"), 24);
  assert.ok("8n" in GRID_STEPS);
});

test("stepsPerBar throws on an unknown grid", () => {
  assert.throws(() => stepsPerBar("7x"), /grid/i);
});

test("expectedSteps = bars × stepsPerBar (reproduces the old magic numbers)", () => {
  assert.equal(expectedSteps(4, "8n"), 32);
  assert.equal(expectedSteps(4, "16n"), 64);
  assert.equal(expectedSteps(2, "16n"), 32);
  assert.equal(expectedSteps(4, "32n"), 128);
});

test("normalizeStep: rest", () => {
  assert.equal(normalizeStep(null), null);
});

test("normalizeStep: plain note / chord / perc token default to one full-velocity hit", () => {
  assert.deepEqual(normalizeStep("A4"), { value: "A4", ratchet: 1, prob: 1, vel: null });
  assert.deepEqual(normalizeStep(["A3", "C4"]), { value: ["A3", "C4"], ratchet: 1, prob: 1, vel: null });
  assert.deepEqual(normalizeStep("snare"), { value: "snare", ratchet: 1, prob: 1, vel: null });
});

test("normalizeStep: object form carries ratchet / prob / vel", () => {
  assert.deepEqual(normalizeStep({ note: "C2", ratchet: 4 }), { value: "C2", ratchet: 4, prob: 1, vel: null });
  assert.deepEqual(normalizeStep({ note: "snare", prob: 0.6, vel: 0.35 }), { value: "snare", ratchet: 1, prob: 0.6, vel: 0.35 });
  assert.deepEqual(normalizeStep({ note: ["A3", "E4"], vel: 0.8 }), { value: ["A3", "E4"], ratchet: 1, prob: 1, vel: 0.8 });
});

test("normalizeStep: object without a note throws (authoring typo guard)", () => {
  assert.throws(() => normalizeStep({ ratchet: 2 }), /note/i);
});

test("normalizeStep: bad modifier values fail fast (no Infinity/NaN durations downstream)", () => {
  assert.throws(() => normalizeStep({ note: "C2", ratchet: 0 }), /ratchet/i);
  assert.throws(() => normalizeStep({ note: "C2", ratchet: 2.5 }), /ratchet/i);
  assert.throws(() => normalizeStep({ note: "C2", prob: 1.5 }), /prob/i);
  assert.throws(() => normalizeStep({ note: "C2", prob: -0.1 }), /prob/i);
  assert.throws(() => normalizeStep({ note: "C2", vel: 2 }), /vel/i);
  assert.throws(() => normalizeStep({ note: "C2", vel: -1 }), /vel/i);
  // prob: 0 is a valid "explicit never" (in range), not an error
  assert.deepEqual(normalizeStep({ note: "C2", prob: 0 }), { value: "C2", ratchet: 1, prob: 0, vel: null });
});

test("ratchetOffsets: evenly spaced sub-hits within the cell", () => {
  assert.deepEqual(ratchetOffsets(0.5, 1), [0]);
  assert.deepEqual(ratchetOffsets(0.5, 4), [0, 0.125, 0.25, 0.375]); // binary-exact
  const approx = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  assert.ok(approx(ratchetOffsets(0.3, 3), [0, 0.1, 0.2]), "0.3/3 evenly spaced");
});

test("ratchetOffsets: rejects non-positive / non-integer counts (deterministic failure)", () => {
  assert.throws(() => ratchetOffsets(0.5, 0), /positive integer/i);
  assert.throws(() => ratchetOffsets(0.5, -2), /positive integer/i);
  assert.throws(() => ratchetOffsets(0.5, 1.5), /positive integer/i);
});

test("shouldFire: prob >= 1 always fires WITHOUT drawing the rng", () => {
  const boom = () => { throw new Error("rng should not be drawn at prob 1"); };
  assert.equal(shouldFire(1, boom), true);
});

test("shouldFire: prob <= 0 never fires WITHOUT drawing the rng", () => {
  const boom = () => { throw new Error("rng should not be drawn at prob 0"); };
  assert.equal(shouldFire(0, boom), false);
  assert.equal(shouldFire(-0.5, boom), false);
});

test("shouldFire: prob gates on the rng draw, deterministically", () => {
  assert.equal(shouldFire(0.6, () => 0.5), true);
  assert.equal(shouldFire(0.6, () => 0.7), false);
  assert.equal(shouldFire(0.6, () => 0.6), false); // strict <
});
