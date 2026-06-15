// @ts-check
// Corporate biome score — NEON variant. Aggressive, driving darksynth menace.
// Key: F# minor (F# G# A B C# D E); Phrygian ♭2 = G for menace. BPM 128, propulsive.

// 8th-note grid, 8 steps/bar, 4 bars = 32 steps.
const K = null; // rest alias for readability
const KICK = "C1", HAT = "hat", SNARE = "snare"; // perc tokens (engine maps to drum voices)

// Four-on-the-floor kick with hard backbeat snare on beats 2 & 4 (steps 2 & 6 per bar).
const basePerc = [
  KICK, K, SNARE, K, KICK, K, SNARE, K,            // bar 1 — four-on-floor + hard backbeat
  KICK, K, SNARE, K, KICK, K, SNARE, K,            // bar 2
  KICK, K, SNARE, K, KICK, K, SNARE, K,            // bar 3
  KICK, K, SNARE, K, KICK, K, SNARE, KICK,         // bar 4 — extra kick at tail for drive
];

// Driving hats on every 8th with snare accents — energetic 16th-feel pattern.
const doublePerc = [
  HAT, HAT, SNARE, HAT, HAT, HAT, SNARE, HAT,      // bar 1
  HAT, HAT, SNARE, HAT, HAT, HAT, SNARE, HAT,      // bar 2
  HAT, HAT, SNARE, HAT, HAT, HAT, SNARE, HAT,      // bar 3
  HAT, HAT, SNARE, HAT, HAT, SNARE, HAT, HAT,      // bar 4 — double snare fill
];

// Relentless gated-style F# pulse with octave jumps (F#1/F#2), driving.
const bass = [
  "F#1", K, "F#2", K, "F#1", K, "F#2", K,
  "F#1", K, "F#2", K, "F#1", K, "F#2", K,
  "F#1", K, "F#2", K, "B1",  K, "C#2", K,
  "A1",  K, "F#1", K, "F#2", K, "F#1", K,
];

// Soaring anthemic saw lead in F# minor (F# A C# E), bold and memorable.
const lead = [
  "F#5", K, "A5",  K, "C#5", K, K,     K,
  "E5",  K, "C#5", K, "A4",  K, "F#5", K,
  "F#5", K, "A5",  K, "C#6", K, K,     K,
  "E5",  K, "C#5", K, "A5",  K, "F#5", K,
];

// F#m [F#3 A3 C#4] / D [D3 F#3 A3] big saw stabs.
const backup = [
  ["F#3","A3","C#4"], K, K, K, ["F#3","A3","C#4"], K, K, K,
  ["F#3","A3","C#4"], K, K, K, ["D3","F#3","A3"],  K, K, K,
  ["F#3","A3","C#4"], K, K, K, ["F#3","A3","C#4"], K, K, K,
  ["D3","F#3","A3"],  K, K, K, ["F#3","A3","C#4"], K, K, K,
];

// 16th-note grid, 16 steps/bar, 4 bars = 64 steps.
// A major (relative major: A C# E) ascending arp — celebratory lift.
const progArp = [
  "A5",K,"C#6",K,"E6",K,"A6",K,"E6",K,"C#6",K,"E6",K,"A6",K,
  "A5",K,"C#6",K,"E6",K,"A6",K,"E6",K,"C#6",K,"E6",K,"A6",K,
  "A5",K,"C#6",K,"E6",K,"A6",K,"E6",K,"C#6",K,"E6",K,"A6",K,
  "C#6",K,"E6",K,"A6",K,"E6",K,"C#6",K,"A5",K,"C#6",K,"E6",K,
];

// 16th grid, 64 steps. Driving F#-minor 16th arp (F# A C# F#) with G for menace.
const urgencyArp = [
  "F#5","A5","C#6","F#6","C#6","A5","F#5","A5","C#6","F#6","C#6","A5","F#5","A5","C#6","G6",
  "F#5","A5","C#6","F#6","C#6","A5","F#5","A5","C#6","F#6","C#6","A5","F#5","A5","C#6","G6",
  "F#5","A5","C#6","F#6","C#6","A5","F#5","A5","C#6","F#6","C#6","A5","F#5","A5","C#6","G6",
  "F#5","A5","C#6","F#6","C#6","A5","F#5","A5","C#6","G6","A5","F#5","G5","G6","F#6","C#6",
];

export const CORPORATE_NEON = Object.freeze({
  biome: "corporate",
  name: "Corporate — Neon",
  bpm: 128,
  masterFilter: { cutoffLo: 700, cutoffHi: 9000, qLo: 0.7, qHi: 4.5 },
  layers: [
    // base
    { key: "drone", axis: "base", baseGain: 0.5, progressBoost: 0.2,
      sustain: ["F#2", "C#3"], synth: { type: "fatsawtooth", count: 3, spread: 18, attack: 2, release: 3, volume: -15 } },
    // progress (blossom — aggressive, neon)
    { key: "basePerc", axis: "progress", lo: 0.0, hi: 0.05, pattern: basePerc,
      synth: { kind: "drums", volume: -5 } },
    { key: "bass", axis: "progress", lo: 0.1, hi: 0.35, pattern: bass,
      synth: { type: "fatsawtooth", count: 2, spread: 10, attack: 0.005, decay: 0.18, sustain: 0.4, release: 0.15, volume: -7 } },
    { key: "doublePerc", axis: "progress", lo: 0.25, hi: 0.55, pattern: doublePerc,
      synth: { kind: "drums", volume: -7 } },
    { key: "lead", axis: "progress", lo: 0.35, hi: 0.65, pattern: lead,
      synth: { type: "sawtooth", attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.2, volume: -9 } },
    { key: "backup", axis: "progress", lo: 0.5, hi: 0.78, pattern: backup,
      synth: { kind: "poly", type: "sawtooth", attack: 0.02, decay: 0.3, sustain: 0.0, release: 0.2, volume: -14 } },
    { key: "progArp", axis: "progress", lo: 0.62, hi: 0.95, grid: "16n", pattern: progArp,
      synth: { type: "sawtooth", attack: 0.005, decay: 0.12, sustain: 0.0, release: 0.08, volume: -13 } },
    // threat (alarm)
    { key: "tensionDrone", axis: "threat", lo: 0.0, hi: 1.0,
      sustain: ["F#2", "G2"], synth: { type: "fatsawtooth", count: 3, spread: 30, attack: 0.8, release: 1.5, volume: -16 } },
    { key: "urgencyArp", axis: "threat", lo: 0.55, hi: 1.0, grid: "16n", pattern: urgencyArp,
      synth: { type: "sawtooth", attack: 0.005, decay: 0.10, sustain: 0.0, release: 0.07, volume: -14 } },
  ],
  // Arrangement sections (progress layers audible per section); seeded-random, no repeat.
  sections: [
    ["basePerc", "doublePerc", "bass", "lead", "backup", "progArp"], // full
    ["basePerc", "bass", "progArp"],                                 // driving core
    ["basePerc", "doublePerc", "lead"],                              // perc + lead
    ["bass", "lead", "backup"],                                      // synth breakdown (no drums)
    ["basePerc", "doublePerc", "bass", "lead"],                      // propulsive verse
  ],
  sectionBars: 8,
  flavors: [
    { id: "default", processing: null },
  ],
});
