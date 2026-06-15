import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMix, smoothstep } from "../js/audio/mixer.js";

const SCORE = {
  layers: [
    { key: "drone", axis: "base", baseGain: 0.6, progressBoost: 0.2 },
    { key: "bass", axis: "progress", lo: 0.2, hi: 0.5 },
    { key: "tensionDrone", axis: "threat", lo: 0.0, hi: 1.0 },
  ],
  masterFilter: { cutoffLo: 600, cutoffHi: 8600, qLo: 0.7, qHi: 4.7 },
};

test("smoothstep clamps and is monotone", () => {
  assert.equal(smoothstep(0.2, 0.5, 0.1), 0);
  assert.equal(smoothstep(0.2, 0.5, 0.6), 1);
  assert.ok(smoothstep(0.2, 0.5, 0.35) > 0 && smoothstep(0.2, 0.5, 0.35) < 1);
});

test("base layer gain = baseGain + progressBoost*progress", () => {
  assert.equal(computeMix(SCORE, 0, 0).gains.drone, 0.6);
  assert.ok(Math.abs(computeMix(SCORE, 1, 0).gains.drone - 0.8) < 1e-9);
});

test("progress layer fades across its lo..hi range", () => {
  assert.equal(computeMix(SCORE, 0.1, 0).gains.bass, 0);
  assert.equal(computeMix(SCORE, 0.6, 0).gains.bass, 1);
  // progress layer must ignore the threat axis
  assert.equal(computeMix(SCORE, 0.1, 1).gains.bass, 0);
  assert.equal(computeMix(SCORE, 0.6, 1).gains.bass, 1);
});

test("threat layer is driven by threat only", () => {
  assert.equal(computeMix(SCORE, 1, 0).gains.tensionDrone, 0);
  assert.equal(computeMix(SCORE, 0, 1).gains.tensionDrone, 1);
});

test("master cutoff opens with EITHER axis; Q is threat-only", () => {
  // both axes at 0 → closed, low resonance
  const m0 = computeMix(SCORE, 0, 0);
  assert.equal(m0.masterCutoff, 600);
  assert.equal(m0.masterQ, 0.7);
  // progress alone opens the cutoff (celebratory brightness) but not Q
  const mProg = computeMix(SCORE, 1, 0);
  assert.equal(mProg.masterCutoff, 8600);
  assert.equal(mProg.masterQ, 0.7);
  // threat alone opens the cutoff AND raises Q (menacing resonance)
  const mThreat = computeMix(SCORE, 0, 1);
  assert.equal(mThreat.masterCutoff, 8600);
  assert.ok(Math.abs(mThreat.masterQ - 4.7) < 1e-9);
  // cutoff follows max(progress, threat)
  assert.equal(computeMix(SCORE, 0.5, 0).masterCutoff, computeMix(SCORE, 0, 0.5).masterCutoff);
});
