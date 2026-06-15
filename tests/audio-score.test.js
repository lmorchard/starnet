import { test } from "node:test";
import assert from "node:assert/strict";
import { CORPORATE_SCORE, LAYER_KEYS } from "../js/audio/scores/corporate.js";
import { computeMix } from "../js/audio/mixer.js";

test("score defines exactly the canonical layer keys", () => {
  const keys = CORPORATE_SCORE.layers.map((l) => l.key).sort();
  assert.deepEqual(keys, [...LAYER_KEYS].sort());
});

test("every layer has a valid axis and a sound source", () => {
  for (const l of CORPORATE_SCORE.layers) {
    assert.ok(["base", "progress", "threat"].includes(l.axis), `bad axis for ${l.key}`);
    assert.ok(l.synth, `missing synth config for ${l.key}`);
    assert.ok(Array.isArray(l.pattern) || Array.isArray(l.sustain), `${l.key} needs pattern or sustain`);
  }
});

test("8th-grid patterns are 32 steps; 16th arps (progArp, urgencyArp) are 64", () => {
  const byKey = Object.fromEntries(CORPORATE_SCORE.layers.map((l) => [l.key, l]));
  for (const k of ["basePerc", "doublePerc", "bass", "lead", "backup"]) {
    assert.equal(byKey[k].pattern.length, 32, `${k} wrong length`);
  }
  for (const k of ["progArp", "urgencyArp"]) {
    assert.equal(byKey[k].pattern.length, 64, `${k} wrong length`);
  }
});

test("computeMix accepts the real score and covers every layer", () => {
  const mix = computeMix(CORPORATE_SCORE, 0.5, 0.5);
  for (const k of LAYER_KEYS) assert.ok(k in mix.gains, `missing gain for ${k}`);
});

test("at least one flavor exists", () => {
  assert.ok(CORPORATE_SCORE.flavors.length >= 1);
});
