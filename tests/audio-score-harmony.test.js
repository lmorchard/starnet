import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_SCORES } from "../js/audio/scores/index.js";
import { HUB_AMBIENT } from "../js/audio/scores/hub.js";
import { transposeDiatonic, consonantSteps, SCALES } from "../js/audio/harmony.js";

// Every wandering score must declare a root/mode that actually matches its authored drone
// harmony, and have enough consonant offsets to be worth wandering. Catches a mislabelled
// mode or a typo that the ear-check might miss.

const WANDERING = [...ALL_SCORES, HUB_AMBIENT];

for (const score of WANDERING) {
  const label = score.name ?? score.biome;
  const drone = score.layers.find((l) => l.key === "drone");

  test(`[${label}] declares a valid root + mode`, () => {
    assert.ok(typeof score.root === "string" && score.root.length > 0, "root");
    assert.ok(score.mode in SCALES, `mode ${score.mode} is a known scale`);
  });

  test(`[${label}] drone home chord is in the declared key (step 0 = identity)`, () => {
    assert.ok(drone && Array.isArray(drone.sustain), "drone sustain");
    assert.deepEqual(
      transposeDiatonic(drone.sustain, score.root, score.mode, 0),
      drone.sustain,
    );
  });

  test(`[${label}] drone has ≥4 consonant wander offsets, all perfect-fifth-preserving`, () => {
    const steps = consonantSteps(drone.sustain, score.root, score.mode);
    assert.ok(steps.length >= 4, `only ${steps.length} consonant steps`);
    assert.ok(steps.includes(0), "home (step 0) always available");
  });

  test(`[${label}] the drone layer opts into wander`, () => {
    assert.equal(drone.wander, true);
  });
}

test("hub also wanders its pad layer (drone + pad), per Les's requirement", () => {
  const pad = HUB_AMBIENT.layers.find((l) => l.key === "pad");
  assert.ok(pad, "hub has a pad layer");
  assert.equal(pad.wander, true);
  // the pad triad must be in the hub's key so it planes diatonically
  assert.deepEqual(
    transposeDiatonic(pad.sustain, HUB_AMBIENT.root, HUB_AMBIENT.mode, 0),
    pad.sustain,
  );
});

test("run scores wander ONLY the drone (no stray wander flags)", () => {
  for (const score of ALL_SCORES) {
    const wanderers = score.layers.filter((l) => l.wander).map((l) => l.key);
    assert.deepEqual(wanderers, ["drone"], `${score.name} wanderers`);
  }
});
