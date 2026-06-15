import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_SCORES } from "../js/audio/scores/index.js";
import { LAYER_KEYS } from "../js/audio/scores/corporate.js";
import { computeMix } from "../js/audio/mixer.js";

// Structural validation across EVERY score — the safety net for authored data
// (note-name typos, wrong pattern lengths, bad perc tokens) that can't be heard.

const NOTE_RE = /^[A-G][#b]?\d$/;
const PERC = new Set(["C1", "hat", "snare"]);
const validNote = (n) => typeof n === "string" && NOTE_RE.test(n);

test("there are 8 selectable scores", () => {
  assert.equal(ALL_SCORES.length, 8);
});

test("every score has a unique display name", () => {
  const names = ALL_SCORES.map((s) => s.name);
  assert.ok(names.every((n) => typeof n === "string" && n.length > 0), "all named");
  assert.equal(new Set(names).size, names.length, "names unique");
});

for (const score of ALL_SCORES) {
  const label = score.name ?? score.biome;

  test(`[${label}] defines exactly the canonical layer keys`, () => {
    assert.deepEqual(score.layers.map((l) => l.key).sort(), [...LAYER_KEYS].sort());
  });

  test(`[${label}] has a positive bpm and a complete masterFilter`, () => {
    assert.ok(typeof score.bpm === "number" && score.bpm > 0, "bpm");
    for (const k of ["cutoffLo", "cutoffHi", "qLo", "qHi"]) {
      assert.ok(typeof score.masterFilter[k] === "number", `masterFilter.${k}`);
    }
  });

  test(`[${label}] layers are well-formed (axis, source, lengths, tokens, notes)`, () => {
    const byKey = Object.fromEntries(score.layers.map((l) => [l.key, l]));
    for (const l of score.layers) {
      assert.ok(["base", "progress", "threat"].includes(l.axis), `${l.key} axis`);
      assert.ok(l.synth, `${l.key} synth`);
      assert.ok(Array.isArray(l.pattern) || Array.isArray(l.sustain), `${l.key} source`);
    }
    // grid lengths
    for (const k of ["basePerc", "doublePerc", "bass", "lead", "backup"]) {
      assert.equal(byKey[k].pattern.length, 32, `${k} length`);
    }
    for (const k of ["progArp", "urgencyArp"]) {
      assert.equal(byKey[k].pattern.length, 64, `${k} length`);
    }
    // perc tokens
    for (const k of ["basePerc", "doublePerc"]) {
      for (const t of byKey[k].pattern) assert.ok(t === null || PERC.has(t), `${k} bad token: ${t}`);
    }
    // pitched single-note patterns
    for (const k of ["bass", "lead", "progArp", "urgencyArp"]) {
      for (const n of byKey[k].pattern) assert.ok(n === null || validNote(n), `${k} bad note: ${n}`);
    }
    // backup: notes or chord arrays
    for (const c of byKey.backup.pattern) {
      if (c === null) continue;
      if (Array.isArray(c)) c.forEach((n) => assert.ok(validNote(n), `backup chord note: ${n}`));
      else assert.ok(validNote(c), `backup note: ${c}`);
    }
    // sustained layers
    for (const k of ["drone", "tensionDrone"]) {
      assert.ok(byKey[k].sustain.length >= 1, `${k} sustain`);
      for (const n of byKey[k].sustain) assert.ok(validNote(n), `${k} sustain note: ${n}`);
    }
  });

  test(`[${label}] computeMix produces a gain for every layer`, () => {
    const mix = computeMix(score, 0.5, 0.5);
    for (const k of LAYER_KEYS) assert.ok(k in mix.gains, `missing gain for ${k}`);
  });

  test(`[${label}] sections (if any) reference only maskable progress layers`, () => {
    if (!score.sections) return;
    assert.ok(Array.isArray(score.sections) && score.sections.length >= 1, "sections array");
    assert.ok(typeof score.sectionBars === "number" && score.sectionBars > 0, "sectionBars > 0");
    const maskable = new Set(score.layers.filter((l) => l.axis === "progress").map((l) => l.key));
    for (const sec of score.sections) {
      assert.ok(Array.isArray(sec) && sec.length >= 1, "each section is a non-empty array");
      for (const k of sec) assert.ok(maskable.has(k), `section references non-maskable layer: ${k}`);
    }
  });
}
