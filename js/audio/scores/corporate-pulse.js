// @ts-check
// Corporate biome score — PULSE variant. Relentless, propulsive, bright synthpop.
// Key: A major (A B C# D E F# G#); ♭2 = Bb for menace in threat layers. BPM 120, energetic.

// 8th-note grid, 8 steps/bar, 4 bars = 32 steps.
const K = null; // rest alias for readability
const KICK = "C1", HAT = "hat", SNARE = "snare"; // perc tokens (engine maps to drum voices)

// Four-on-the-floor kick with handclap backbeat — SNARE on beats 2 & 4 (steps 2 & 6).
// Punchy and steady, reading as claps against the constant kick.
const basePerc = [
  KICK, K, SNARE, K, KICK, K, SNARE, K,             // bar 1 — four-on-the-floor + clap backbeat
  KICK, K, SNARE, K, KICK, K, SNARE, K,             // bar 2
  KICK, K, SNARE, K, KICK, K, SNARE, K,             // bar 3
  KICK, K, SNARE, K, KICK, K, SNARE, K,             // bar 4 — consistent, relentless
];

// Relentless straight hats with extra SNARE clap accents on the upbeats.
const doublePerc = [
  HAT, HAT, SNARE, HAT, HAT, HAT, SNARE, HAT,       // bar 1
  HAT, HAT, SNARE, HAT, HAT, HAT, SNARE, HAT,       // bar 2
  HAT, HAT, SNARE, HAT, HAT, HAT, SNARE, HAT,       // bar 3
  HAT, HAT, SNARE, HAT, HAT, HAT, SNARE, HAT,       // bar 4 — driving and relentless
];

// Relentless driving A pulse — straight eighth notes, root-and-fifth (A1/E2), very steady.
const bass = [
  "A1", K, "A1", K, "E2", K, "A1", K,
  "A1", K, "A1", K, "E2", K, "A1", K,
  "A1", K, "A1", K, "E2", K, "A1", K,
  "A1", K, "E2", K, "A1", K, "E2", K,
];

// Bright, hooky A-major lead (A C# E F#) — catchy and memorable.
const lead = [
  "A4", K, "C#5", K, K, K, "E5", K,
  "F#5", K, "E5", K, "C#5", K, K, K,
  "A4", K, "C#5", K, "E5", K, K, K,
  "F#5", K, K, K, "E5", K, "C#5", K,
];

// Choral-stab style — big sustained chord stabs A [A3 C#4 E4] / D [D3 F#3 A3] / E [E3 G#3 B3].
// Longer attack/release for a choir-like swell.
const backup = [
  ["A3","C#4","E4"], K, K, K, ["A3","C#4","E4"], K, K, K,
  ["D3","F#3","A3"], K, K, K, ["D3","F#3","A3"], K, K, K,
  ["A3","C#4","E4"], K, K, K, ["E3","G#3","B3"], K, K, K,
  ["E3","G#3","B3"], K, K, K, ["A3","C#4","E4"], K, K, K,
];

// 16th-note grid, 16 steps/bar, 4 bars = 64 steps.
// Sparkling A-major ascending arp (A C# E A) — celebratory.
const progArp = [
  "A4",K,"C#5",K,"E5",K,"A5",K,"E5",K,"C#5",K,"E5",K,"A5",K,
  "A4",K,"C#5",K,"E5",K,"A5",K,"E5",K,"C#5",K,"E5",K,"A5",K,
  "A4",K,"C#5",K,"E5",K,"A5",K,"E5",K,"C#5",K,"E5",K,"A5",K,
  "C#5",K,"E5",K,"A5",K,"E5",K,"C#5",K,"A4",K,"C#5",K,"E5",K,
];

// 16th grid, 64 steps. Driving A-minor-ish 16th arp with Bb menace (A C E A ... Bb) to darken.
const urgencyArp = [
  "A4","C5","E5","A5","E5","C5","A4","C5","E5","A5","E5","C5","A4","C5","E5","Bb5",
  "A4","C5","E5","A5","E5","C5","A4","C5","E5","A5","E5","C5","A4","C5","E5","Bb5",
  "A4","C5","E5","A5","E5","C5","A4","C5","E5","A5","E5","C5","A4","C5","E5","Bb5",
  "A4","C5","E5","A5","E5","C5","A4","C5","E5","A5","C5","A4","Bb4","Bb5","A5","E5",
];

export const CORPORATE_PULSE = Object.freeze({
  biome: "corporate",
  name: "Corporate — Pulse",
  root: "A", mode: "ionian",  // drone harmonic wander (#239)
  bpm: 120,
  masterFilter: { cutoffLo: 700, cutoffHi: 9500, qLo: 0.7, qHi: 4.0 },
  layers: [
    // base
    { key: "drone", axis: "base", baseGain: 0.5, progressBoost: 0.2, wander: true,
      sustain: ["A2", "E3"], synth: { type: "fatsawtooth", count: 3, spread: 16, attack: 2, release: 3, volume: -16 } },
    // progress (blossom — propulsive, bright)
    { key: "basePerc", axis: "progress", lo: 0.0, hi: 0.05, pattern: basePerc,
      synth: { kind: "drums", volume: -6 } },
    { key: "bass", axis: "progress", lo: 0.1, hi: 0.35, pattern: bass,
      synth: { type: "sawtooth", attack: 0.005, decay: 0.18, sustain: 0.4, release: 0.15, volume: -7 } },
    { key: "doublePerc", axis: "progress", lo: 0.25, hi: 0.55, pattern: doublePerc,
      synth: { kind: "drums", volume: -7 } },
    { key: "lead", axis: "progress", lo: 0.35, hi: 0.65, pattern: lead,
      synth: { type: "sawtooth", attack: 0.01, decay: 0.18, sustain: 0.2, release: 0.15, volume: -9 } },
    { key: "backup", axis: "progress", lo: 0.5, hi: 0.78, pattern: backup,
      synth: { kind: "poly", type: "fatsawtooth", attack: 0.12, decay: 0.5, sustain: 0.3, release: 0.6, volume: -13 } },
    { key: "progArp", axis: "progress", lo: 0.62, hi: 0.95, grid: "16n", pattern: progArp,
      synth: { type: "square", attack: 0.005, decay: 0.12, sustain: 0.0, release: 0.08, volume: -13 } },
    // threat (alarm)
    { key: "tensionDrone", axis: "threat", lo: 0.0, hi: 1.0,
      sustain: ["A2", "Bb2"], synth: { type: "fatsawtooth", count: 3, spread: 30, attack: 0.8, release: 1.5, volume: -15 } },
    { key: "urgencyArp", axis: "threat", lo: 0.55, hi: 1.0, grid: "16n", pattern: urgencyArp,
      synth: { type: "sawtooth", attack: 0.005, decay: 0.12, sustain: 0.0, release: 0.08, volume: -14 } },
  ],
  // Arrangement sections (progress layers audible per section); seeded-random, no repeat.
  sections: [
    ["basePerc", "doublePerc", "bass", "lead", "backup", "progArp"], // full
    ["basePerc", "bass", "progArp"],                                  // pulse core
    ["basePerc", "doublePerc", "lead"],                               // perc + lead
    ["bass", "lead", "backup"],                                       // synth breakdown (no drums)
    ["basePerc", "doublePerc", "bass", "lead"],                       // drive without pads/arp
  ],
  sectionBars: 8,
  flavors: [
    { id: "default", processing: null },
  ],
});
