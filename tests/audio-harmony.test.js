import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SCALES,
  consonantSteps,
  scaleNotes,
  transposeDiatonic,
  pickNextStep,
  noteToMidi,
  midiToNote,
} from "../js/audio/harmony.js";

// Pure music-theory module behind the drone wander. No Tone, no DOM — fully unit-testable,
// the one layer either collaborator can verify without hearing it.

test("SCALES includes the modes the scores use", () => {
  // The set actually assigned across the corporate scores + hub (see audio-score-harmony.test.js).
  for (const m of ["aeolian", "dorian", "phrygian", "ionian"]) {
    assert.ok(Array.isArray(SCALES[m]) && SCALES[m].length === 7, `mode ${m}`);
    assert.equal(SCALES[m][0], 0, `${m} starts on the root`);
  }
});

test("consonantSteps for an aeolian tonic power fifth excludes the ii offset (1)", () => {
  // A aeolian drone A+E: step 1 would plane to B+F (diminished) → excluded.
  assert.deepEqual(consonantSteps(["A2", "E3"], "A", "aeolian"), [0, 2, 3, 4, 5, 6]);
});

test("consonantSteps is mode-specific — phrygian excludes a different offset", () => {
  // E phrygian drone E+B: the diminished fifth lands on step 4 (B+F), and step 1 is fine.
  const steps = consonantSteps(["E2", "B2"], "E", "phrygian");
  assert.ok(!steps.includes(4), "step 4 (B+F diminished) excluded in phrygian");
  assert.ok(steps.includes(1), "step 1 is consonant in phrygian (unlike aeolian)");
  for (const s of steps) {
    const [lo, hi] = transposeDiatonic(["E2", "B2"], "E", "phrygian", s);
    assert.equal(noteToMidi(hi) - noteToMidi(lo), 7, `phrygian step ${s} perfect fifth`);
  }
});

test("noteToMidi / midiToNote round-trip standard pitches", () => {
  assert.equal(noteToMidi("A4"), 69);
  assert.equal(noteToMidi("C4"), 60);
  assert.equal(noteToMidi("A2"), 45);
  assert.equal(noteToMidi("Bb1"), 34);
  assert.equal(noteToMidi("F#2"), 42);
  assert.equal(midiToNote(69), "A4");
  assert.equal(midiToNote(60), "C4");
});

test("scaleNotes spells diatonic scales with correct accidentals", () => {
  assert.deepEqual(scaleNotes("A", "aeolian"), ["A", "B", "C", "D", "E", "F", "G"]);
  assert.deepEqual(scaleNotes("C", "dorian"), ["C", "D", "Eb", "F", "G", "A", "Bb"]);
  assert.deepEqual(scaleNotes("D", "dorian"), ["D", "E", "F", "G", "A", "B", "C"]);
  // sharp key spells with sharps, one letter per degree
  assert.deepEqual(scaleNotes("F#", "aeolian"), ["F#", "G#", "A", "B", "C#", "D", "E"]);
});

test("transposeDiatonic step 0 is the identity", () => {
  assert.deepEqual(transposeDiatonic(["A2", "E3"], "A", "aeolian", 0), ["A2", "E3"]);
  assert.deepEqual(transposeDiatonic(["C4", "E4", "G4"], "A", "aeolian", 0), ["C4", "E4", "G4"]);
});

test("transposeDiatonic planes a power fifth, keeping octave correctness", () => {
  assert.deepEqual(transposeDiatonic(["A2", "E3"], "A", "aeolian", 2), ["C3", "G3"]);
  assert.deepEqual(transposeDiatonic(["A2", "E3"], "A", "aeolian", 6), ["G3", "D4"]);
});

test("transposeDiatonic planes a triad diatonically", () => {
  assert.deepEqual(transposeDiatonic(["C4", "E4", "G4"], "A", "aeolian", 2), ["E4", "G4", "B4"]);
});

test("drone power fifth stays a perfect fifth (+7 semitones) for every consonant step", () => {
  const steps = consonantSteps(["A2", "E3"], "A", "aeolian");
  for (const step of steps) {
    const [lo, hi] = transposeDiatonic(["A2", "E3"], "A", "aeolian", step);
    assert.equal(noteToMidi(hi) - noteToMidi(lo), 7, `step ${step} stays a perfect fifth`);
  }
});

test("every transposed note stays in the scale", () => {
  const inScale = new Set(scaleNotes("C", "aeolian"));
  for (const step of consonantSteps(["C3", "G3"], "C", "aeolian")) {
    for (const n of transposeDiatonic(["C3", "G3"], "C", "aeolian", step)) {
      assert.ok(inScale.has(n.replace(/\d+$/, "")), `${n} in C aeolian`);
    }
  }
});

test("pickNextStep only emits allowed steps and never repeats immediately", () => {
  const steps = consonantSteps(["A2", "E3"], "A", "aeolian");
  // deterministic rng: cycle through a fixed value table
  let i = 0;
  const vals = [0.0, 0.16, 0.33, 0.5, 0.66, 0.83, 0.99, 0.4, 0.7, 0.1];
  const rng = () => vals[i++ % vals.length];
  let cur = 0;
  for (let n = 0; n < 50; n++) {
    const next = pickNextStep(rng, cur, steps);
    assert.ok(steps.includes(next), `emitted ${next}`);
    assert.notEqual(next, cur, "no immediate repeat");
    cur = next;
  }
});

test("pickNextStep is deterministic for a given rng sequence", () => {
  const make = () => {
    const seq = [0.1, 0.9, 0.5, 0.3, 0.7];
    let k = 0;
    return () => seq[k++ % seq.length];
  };
  const steps = consonantSteps(["A2", "E3"], "A", "aeolian");
  const a = [];
  const b = [];
  // run two identical rng streams in parallel — same picks
  const r1 = make(), r2 = make();
  let c1 = 0, c2 = 0;
  for (let n = 0; n < 10; n++) { a.push(c1 = pickNextStep(r1, c1, steps)); b.push(c2 = pickNextStep(r2, c2, steps)); }
  assert.deepEqual(a, b);
});
