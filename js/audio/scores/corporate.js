// @ts-check
// Corporate biome score — authored patterns-as-data. null = rest.
// Static/modal A-minor with a Phrygian ♭2 (Bb) turn for menace. See docs/audio-direction.md.

export const LAYER_KEYS = Object.freeze([
  "drone", "basePerc", "doublePerc", "bass", "lead", "backup", "progArp", "tensionDrone", "urgencyArp",
]);

// 8th-note grid, 8 steps/bar, 4 bars = 32 steps.
const K = null; // rest alias for readability
const KICK = "C1", HAT = "hat", SNARE = "snare"; // perc tokens (engine maps to drum voices)

// Sparse kick pulse with a counterpoint snare answering on beat 4; bar 4 adds a small fill.
const basePerc = [
  KICK, K, K, KICK, HAT, K, SNARE, KICK,         // bar 1
  KICK, K, K, K, HAT, K, SNARE, K,         // bar 2
  KICK, K, K, KICK, HAT, K, SNARE, KICK,         // bar 3
  KICK, K, K, SNARE, HAT, K, SNARE, SNARE, // bar 4 (fill)
];
// Busier layer: snare pushed off the straight 2-&-4 onto syncopated off-eighths; bar 4 fills.
const doublePerc = [
  K, HAT, SNARE, HAT, K, SNARE, HAT, SNARE,      // bar 1
  K, HAT, SNARE, HAT, SNARE, HAT, K, SNARE,      // bar 2
  K, HAT, SNARE, HAT, K, SNARE, HAT, SNARE,      // bar 3
  SNARE, HAT, SNARE, HAT, SNARE, SNARE, HAT, SNARE, // bar 4 (fill)
];
// Mostly an A pedal (static dread); bar 4 leans to Bb (Phrygian ♭2).
const bass = [
  "A1", K, K, "A1", K, "A1", K, K,
  "A1", K, K, "A1", K, "A1", K, K,
  "A1", K, K, "A1", K, "A1", K, K,
  "Bb1", K, K, "Bb1", K, "A1", K, K,
];
// Sparse modal lead (A Aeolian / pentatonic), leaving space.
const lead = [
  "E4", K, K, "A4", K, K, "C5", K,
  K, "B4", K, "A4", K, K, K, K,
  "E4", K, "G4", K, "A4", K, K, K,
  "Bb4", K, K, "A4", "E4", K, K, K,
];
// Triad stabs: Am held three bars, Bb (♭2) on bar 4. Chords as arrays.
const backup = [
  ["A3","C4","E4"], K, K, K, ["A3","C4","E4"], K, K, K,
  ["A3","C4","E4"], K, K, K, ["A3","C4","E4"], K, K, K,
  ["A3","C4","E4"], K, K, K, ["A3","C4","E4"], K, K, K,
  ["Bb3","D4","F4"], K, K, K, ["Bb3","D4","F4"], K, K, K,
];
// 16th-note grid, 16 steps/bar, 4 bars = 64. Driving Am arp with ♭2 menace.
const urgencyArp = [
  "A4","C5","E5","A5","E5","C5","A4","C5","E5","A5","E5","C5","A4","C5","E5","Bb5",
  "A4","C5","E5","A5","E5","C5","A4","C5","E5","A5","E5","C5","A4","C5","E5","Bb5",
  "A4","C5","E5","A5","E5","C5","A4","C5","E5","A5","E5","C5","A4","C5","E5","Bb5",
  "A4","C5","E5","A5","E5","C5","A4","C5","E5","A5","E5","C5","Bb4","Bb5","A5","E5",
];
// 16th grid, 64 steps. Celebratory consonant lift (C major / Am-relative) — the progress
// counterpart to the menacing urgencyArp; syncopated with rests so the two interlock at the top.
const progArp = [
  "C5",K,"E5",K,"G5",K,"C6",K,"G5",K,"E5",K,"G5",K,"C6",K,
  "C5",K,"E5",K,"G5",K,"C6",K,"G5",K,"E5",K,"G5",K,"C6",K,
  "C5",K,"E5",K,"G5",K,"C6",K,"G5",K,"E5",K,"G5",K,"C6",K,
  "A5",K,"C6",K,"E6",K,"C6",K,"G5",K,"E5",K,"C5",K,"E5",K,
];

export const CORPORATE_SCORE = Object.freeze({
  biome: "corporate",
  name: "Corporate — Dread",
  root: "A", mode: "aeolian",  // drone harmonic wander (#239)
  bpm: 120,
  masterFilter: { cutoffLo: 600, cutoffHi: 8600, qLo: 0.7, qHi: 4.7 },
  layers: [
    // base
    { key: "drone", axis: "base", baseGain: 0.55, progressBoost: 0.2, wander: true,
      sustain: ["A2", "E3"], synth: { type: "fatsawtooth", count: 3, spread: 18, attack: 2, release: 3, volume: -16 } },
    // progress (blossom — bolder, earlier, opens up celebratory toward the top)
    { key: "basePerc", axis: "progress", lo: 0.0, hi: 0.05, pattern: basePerc,
      synth: { kind: "drums", volume: -5 } },
    { key: "bass", axis: "progress", lo: 0.1, hi: 0.35, pattern: bass,
      synth: { type: "square", attack: 0.01, decay: 0.25, sustain: 0.3, release: 0.2, volume: -6 } },
    { key: "doublePerc", axis: "progress", lo: 0.25, hi: 0.55, pattern: doublePerc,
      synth: { kind: "drums", volume: -8 } },
    { key: "lead", axis: "progress", lo: 0.35, hi: 0.65, pattern: lead,
      synth: { type: "sawtooth", attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.2, volume: -9 } },
    { key: "backup", axis: "progress", lo: 0.5, hi: 0.78, pattern: backup,
      synth: { kind: "poly", type: "triangle", attack: 0.02, decay: 0.4, sustain: 0.0, release: 0.3, volume: -13 } },
    { key: "progArp", axis: "progress", lo: 0.62, hi: 0.95, grid: "16n", pattern: progArp,
      synth: { type: "sawtooth", attack: 0.005, decay: 0.16, sustain: 0.0, release: 0.12, volume: -12 } },
    // threat (alarm)
    { key: "tensionDrone", axis: "threat", lo: 0.0, hi: 1.0,
      sustain: ["A2", "Bb2"], synth: { type: "fatsawtooth", count: 3, spread: 30, attack: 0.8, release: 1.5, volume: -14 } },
    { key: "urgencyArp", axis: "threat", lo: 0.55, hi: 1.0, grid: "16n", pattern: urgencyArp,
      synth: { type: "sawtooth", attack: 0.005, decay: 0.12, sustain: 0.0, release: 0.08, volume: -16 } },
  ],
  // Arrangement sections — each lists the progress layers audible; chosen seeded-random,
  // no immediate repeat, switching every `sectionBars`. Drone + threat layers are exempt.
  sections: [
    ["basePerc", "doublePerc", "bass", "lead", "backup", "progArp"], // full
    ["basePerc", "doublePerc", "progArp"],                            // perc + arp breakdown
    ["lead", "progArp", "bass"],                                      // lead + arp over bass
    ["basePerc", "bass"],                                             // stripped groove
    ["backup", "progArp"],                                            // pads + shimmer breath
  ],
  sectionBars: 8,
  flavors: [
    { id: "default", processing: null },
  ],
});
