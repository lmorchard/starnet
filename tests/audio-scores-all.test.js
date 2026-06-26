import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_SCORES } from "../js/audio/scores/index.js";
import { LAYER_KEYS } from "../js/audio/scores/corporate.js";
import { computeMix } from "../js/audio/mixer.js";
import { stepsPerBar, normalizeStep } from "../js/audio/rhythm.js";

// Structural validation across EVERY score — the safety net for authored data
// (note-name typos, wrong pattern lengths, bad perc tokens) that can't be heard.

const NOTE_RE = /^[A-G][#b]?\d$/;
const PERC = new Set(["C1", "hat", "snare"]);
const validNote = (n) => typeof n === "string" && NOTE_RE.test(n);

// Flatten a pattern to its underlying note/token strings — normalizing object steps
// ({note,ratchet,prob,vel}) and chords, skipping rests — so validation works on any step form.
const stepValues = (pattern) => pattern.flatMap((step) => {
  const n = normalizeStep(step);
  if (!n) return [];
  return Array.isArray(n.value) ? n.value : [n.value];
});

test("there are 11 selectable scores", () => {
  assert.equal(ALL_SCORES.length, 11);
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

  test(`[${label}] has a positive bpm, integer bars, and a complete masterFilter`, () => {
    assert.ok(typeof score.bpm === "number" && score.bpm > 0, "bpm");
    assert.ok(Number.isInteger(score.bars) && score.bars > 0, "bars is a positive integer");
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
    // each pattern must be a whole number of bars (length is a positive multiple of
    // stepsPerBar(grid)). Layers may run LONGER loops than the score's nominal `bars` — e.g. an
    // 8-bar drum phrase over a 4-bar groove — looping independently (a constrained polymeter).
    for (const l of score.layers) {
      if (!Array.isArray(l.pattern)) continue;
      const per = stepsPerBar(l.grid || "8n");
      assert.ok(l.pattern.length > 0 && l.pattern.length % per === 0,
        `${l.key} length ${l.pattern.length} must be a whole number of bars (multiple of ${per})`);
    }
    // perc tokens (normalized — object steps and ratchet/prob/vel allowed)
    for (const k of ["basePerc", "doublePerc"]) {
      for (const v of stepValues(byKey[k].pattern)) assert.ok(PERC.has(v), `${k} bad token: ${v}`);
    }
    // pitched + chord layers resolve to valid note names
    for (const k of ["bass", "lead", "backup", "progArp", "urgencyArp"]) {
      for (const v of stepValues(byKey[k].pattern)) assert.ok(validNote(v), `${k} bad note: ${v}`);
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
