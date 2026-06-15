// @ts-check
// Pure music-theory helpers behind the drone harmonic wander. No Tone, no DOM — every
// musical decision lives here so it can be unit-tested without hearing a note. The engine
// consumes `transposeDiatonic` + `pickNextStep`; scores declare `root`/`mode`.
//
// The wander shifts each sustained chord by a shared diatonic-step offset δ ("planing"):
// a power fifth stays a perfect fifth and a triad stays a diatonic triad, so drone + pad
// move in parallel and stay consonant. See docs/audio-direction.md / issue #239.

/** Mode name → 7 semitone intervals from the root (one per scale degree). */
export const SCALES = Object.freeze({
  ionian: [0, 2, 4, 5, 7, 9, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  minor: [0, 2, 3, 5, 7, 8, 10],
});

// Candidate diatonic-step offsets (one octave of degrees). The usable subset is computed
// per score by consonantSteps() — which offsets keep the drone chord's shape — because the
// diminished diatonic fifth sits on a different degree in each mode (so a fixed list would be
// wrong outside aeolian).
const CANDIDATE_STEPS = Object.freeze([0, 1, 2, 3, 4, 5, 6]);

// Pitch class of each natural letter; index into LETTERS by order from any root.
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** @param {string} note scientific-pitch name (e.g. "A2", "Bb1", "F#3") @returns {number} MIDI */
export function noteToMidi(note) {
  const m = /^([A-G])(#{1,2}|b{1,2})?(-?\d+)$/.exec(note);
  if (!m) throw new Error(`bad note name: ${note}`);
  const [, letter, acc = "", oct] = m;
  let pc = LETTER_PC[letter];
  for (const ch of acc) pc += ch === "#" ? 1 : -1;
  return (Number(oct) + 1) * 12 + pc;
}

/** @param {number} midi @returns {string} note name spelled with naturals/sharps (flats need a key) */
export function midiToNote(midi) {
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  const SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return SHARP[pc] + oct;
}

/** Letter index (0..6, order C..B) of a root like "A", "F#", "Bb". */
function rootLetterIndex(root) {
  const letter = root[0];
  const i = LETTERS.indexOf(letter);
  if (i < 0) throw new Error(`bad root: ${root}`);
  return i;
}

/** Pitch class of a root like "A", "F#", "Bb". */
function rootPitchClass(root) {
  let pc = LETTER_PC[root[0]];
  for (const ch of root.slice(1)) pc += ch === "#" ? 1 : -1;
  return ((pc % 12) + 12) % 12;
}

/**
 * Spell the 7 scale degrees of `mode` rooted on `root`, using each letter once so accidentals
 * match the key's style (flats for C dorian, sharps for F# aeolian).
 * @param {string} root @param {string} mode @returns {string[]} 7 note letters+accidentals
 */
export function scaleNotes(root, mode) {
  const intervals = SCALES[mode];
  if (!intervals) throw new Error(`unknown mode: ${mode}`);
  const rootPc = rootPitchClass(root);
  const li = rootLetterIndex(root);
  return intervals.map((semi, deg) => {
    const letter = LETTERS[(li + deg) % 7];
    const targetPc = (rootPc + semi) % 12;
    let delta = targetPc - LETTER_PC[letter];
    if (delta > 6) delta -= 12;
    if (delta < -6) delta += 12;
    const acc = delta > 0 ? "#".repeat(delta) : "b".repeat(-delta);
    return letter + acc;
  });
}

/**
 * Transpose each note by `steps` diatonic scale degrees within `root`/`mode` ("planing").
 * Notes are matched to the scale by pitch class, so input spelling (Bb vs A#) doesn't matter;
 * output is spelled per `scaleNotes`. `steps = 0` is the identity.
 * @param {string[]} notes @param {string} root @param {string} mode @param {number} steps
 * @returns {string[]}
 */
export function transposeDiatonic(notes, root, mode, steps) {
  const intervals = SCALES[mode];
  if (!intervals) throw new Error(`unknown mode: ${mode}`);
  const names = scaleNotes(root, mode);
  const scalePcs = intervals.map((semi) => (rootPitchClass(root) + semi) % 12);
  return notes.map((note) => {
    const midi = noteToMidi(note);
    const pc = ((midi % 12) + 12) % 12;
    const deg = scalePcs.indexOf(pc);
    if (deg < 0) throw new Error(`note ${note} is not in ${root} ${mode}`);
    const rootBase = midi - intervals[deg]; // the root at this note's octave region
    const idx = deg + steps;
    const newDeg = ((idx % 7) + 7) % 7;
    const extraOct = Math.floor(idx / 7);
    const newMidi = rootBase + extraOct * 12 + intervals[newDeg];
    const oct = Math.floor(newMidi / 12) - 1;
    return names[newDeg] + oct;
  });
}

/**
 * The diatonic-step offsets that keep `droneNotes`' interval shape intact (its perfect fifth
 * stays perfect) when planed within `root`/`mode`. Computed per score because the diminished
 * diatonic fifth lands on a different degree in each mode. Step 0 (home) is always included.
 * @param {string[]} droneNotes @param {string} root @param {string} mode @returns {number[]}
 */
export function consonantSteps(droneNotes, root, mode) {
  if (!Array.isArray(droneNotes) || droneNotes.length < 2) return [...CANDIDATE_STEPS];
  const lo0 = noteToMidi(droneNotes[0]);
  const homeShape = droneNotes.map((n) => noteToMidi(n) - lo0);
  return CANDIDATE_STEPS.filter((step) => {
    const t = transposeDiatonic(droneNotes, root, mode, step);
    const lo = noteToMidi(t[0]);
    return t.every((n, i) => noteToMidi(n) - lo === homeShape[i]);
  });
}

/**
 * Pick the next diatonic-step offset from `steps`: equal weight, never the current one.
 * @param {() => number} rngFn 0..1 source @param {number} current the step in effect now
 * @param {number[]} steps allowed offsets (from consonantSteps) @returns {number}
 */
export function pickNextStep(rngFn, current, steps) {
  const pool = steps.filter((s) => s !== current);
  const choices = pool.length ? pool : steps;
  return choices[Math.floor(rngFn() * choices.length)];
}
