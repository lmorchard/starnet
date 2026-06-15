// @ts-check
// Corporate biome score — COLD variant. Cold, deadpan, motorik analog synthpop.
// Key: C minor (C D Eb F G Ab Bb); Phrygian ♭2 = Db for menace. BPM 138, mechanical.

// 8th-note grid, 8 steps/bar, 4 bars = 32 steps.
const K = null; // rest alias for readability
const KICK = "C1", HAT = "hat", SNARE = "snare"; // perc tokens (engine maps to drum voices)

// Motorik four-on-the-floor: kick on each quarter note (steps 0,2,4,6 of each 8-step bar).
// Minimal snare — only a cold bar-4 accent on beat 4.
const basePerc = [
  KICK, K, KICK, K, KICK, K, KICK, K,             // bar 1 — pure motorik, no snare
  KICK, K, KICK, K, KICK, K, KICK, K,             // bar 2
  KICK, K, KICK, K, KICK, K, KICK, K,             // bar 3
  KICK, K, KICK, K, KICK, K, SNARE, K,            // bar 4 — cold single snare accent
];

// Relentless straight hats with a cold offbeat snare on 2-and-4.
const doublePerc = [
  K, HAT, SNARE, HAT, K, HAT, SNARE, HAT,         // bar 1
  K, HAT, SNARE, HAT, K, HAT, SNARE, HAT,         // bar 2
  K, HAT, SNARE, HAT, K, HAT, SNARE, HAT,         // bar 3
  K, HAT, SNARE, HAT, K, HAT, SNARE, HAT,         // bar 4 — deadpan, no variation
];

// Insistent C pedal (eighth notes mostly); cold move to Ab/Bb in bar 4.
const bass = [
  "C2", K, "C2", K, "C2", K, "C2", K,
  "C2", K, "C2", K, "C2", K, "C2", K,
  "C2", K, "C2", K, "C2", K, "C2", K,
  "Ab1", K, "Ab1", K, "Bb1", K, "C2", K,
];

// Detached, repetitive two-/three-note square motif in C minor (C Eb G Bb).
const lead = [
  "C5", K, "Eb5", K, K, K, K, K,
  "G4", K, "Eb5", K, "C5", K, K, K,
  "C5", K, "Bb4", K, K, K, "Eb5", K,
  "G4", K, K, K, "C5", K, "Bb4", K,
];

// Cm [C Eb G] stabs moving to Ab major [Ab C Eb] (VI); deadpan, mechanical.
const backup = [
  ["C3","Eb3","G3"], K, K, K, ["C3","Eb3","G3"], K, K, K,
  ["C3","Eb3","G3"], K, K, K, ["C3","Eb3","G3"], K, K, K,
  ["C3","Eb3","G3"], K, K, K, ["Ab2","C3","Eb3"], K, K, K,
  ["Ab2","C3","Eb3"], K, K, K, ["C3","Eb3","G3"], K, K, K,
];

// 16th-note grid, 16 steps/bar, 4 bars = 64 steps.
// Eb major (relative major: Eb G Bb) ascending arp — the celebratory progress lift.
const progArp = [
  "Eb5",K,"G5",K,"Bb5",K,"Eb6",K,"Bb5",K,"G5",K,"Bb5",K,"Eb6",K,
  "Eb5",K,"G5",K,"Bb5",K,"Eb6",K,"Bb5",K,"G5",K,"Bb5",K,"Eb6",K,
  "Eb5",K,"G5",K,"Bb5",K,"Eb6",K,"Bb5",K,"G5",K,"Bb5",K,"Eb6",K,
  "G5",K,"Bb5",K,"Eb6",K,"Bb5",K,"G5",K,"Eb5",K,"G5",K,"Bb5",K,
];

// 16th grid, 64 steps. Driving C-minor 16th arp (C Eb G C) with Db for menace.
const urgencyArp = [
  "C5","Eb5","G5","C6","G5","Eb5","C5","Eb5","G5","C6","G5","Eb5","C5","Eb5","G5","Db6",
  "C5","Eb5","G5","C6","G5","Eb5","C5","Eb5","G5","C6","G5","Eb5","C5","Eb5","G5","Db6",
  "C5","Eb5","G5","C6","G5","Eb5","C5","Eb5","G5","C6","G5","Eb5","C5","Eb5","G5","Db6",
  "C5","Eb5","G5","C6","G5","Eb5","C5","Eb5","G5","C6","Eb5","C5","Db5","Db6","C6","G5",
];

export const CORPORATE_COLD = Object.freeze({
  biome: "corporate",
  name: "Corporate — Cold",
  bpm: 138,
  masterFilter: { cutoffLo: 600, cutoffHi: 8600, qLo: 0.7, qHi: 4.0 },
  layers: [
    // base
    { key: "drone", axis: "base", baseGain: 0.5, progressBoost: 0.2,
      sustain: ["C3", "G3"], synth: { type: "fatsawtooth", count: 3, spread: 16, attack: 2, release: 3, volume: -16 } },
    // progress (blossom — mechanical, cold)
    { key: "basePerc", axis: "progress", lo: 0.0, hi: 0.05, pattern: basePerc,
      synth: { kind: "drums", volume: -6 } },
    { key: "bass", axis: "progress", lo: 0.1, hi: 0.35, pattern: bass,
      synth: { type: "square", attack: 0.01, decay: 0.22, sustain: 0.3, release: 0.2, volume: -7 } },
    { key: "doublePerc", axis: "progress", lo: 0.25, hi: 0.55, pattern: doublePerc,
      synth: { kind: "drums", volume: -8 } },
    { key: "lead", axis: "progress", lo: 0.35, hi: 0.65, pattern: lead,
      synth: { type: "square", attack: 0.01, decay: 0.18, sustain: 0.15, release: 0.15, volume: -8 } },
    { key: "backup", axis: "progress", lo: 0.5, hi: 0.78, pattern: backup,
      synth: { kind: "poly", type: "triangle", attack: 0.02, decay: 0.35, sustain: 0.0, release: 0.25, volume: -14 } },
    { key: "progArp", axis: "progress", lo: 0.62, hi: 0.95, grid: "16n", pattern: progArp,
      synth: { type: "square", attack: 0.005, decay: 0.14, sustain: 0.0, release: 0.1, volume: -13 } },
    // threat (alarm)
    { key: "tensionDrone", axis: "threat", lo: 0.0, hi: 1.0,
      sustain: ["C3", "Db3"], synth: { type: "fatsawtooth", count: 3, spread: 30, attack: 0.8, release: 1.5, volume: -15 } },
    { key: "urgencyArp", axis: "threat", lo: 0.55, hi: 1.0, grid: "16n", pattern: urgencyArp,
      synth: { type: "sawtooth", attack: 0.005, decay: 0.12, sustain: 0.0, release: 0.08, volume: -14 } },
  ],
  // Arrangement sections (progress layers audible per section); seeded-random, no repeat.
  sections: [
    ["basePerc", "doublePerc", "bass", "lead", "backup", "progArp"], // full
    ["basePerc", "bass", "progArp"],                                 // motorik core
    ["basePerc", "doublePerc", "lead"],                              // perc + lead
    ["bass", "lead", "backup"],                                      // synth breakdown (no drums)
  ],
  sectionBars: 8,
  flavors: [
    { id: "default", processing: null },
  ],
});
