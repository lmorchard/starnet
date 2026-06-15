// @ts-check
// Corporate biome score — HAZE variant. Warm, hazy, detuned, nostalgic. Boards of Canada feel.
// Key: G major (G A B C D E F#) with E minor lean. BPM 84, slow and woozy.

// 8th-note grid, 8 steps/bar, 4 bars = 32 steps.
const K = null; // rest alias for readability
const KICK = "C1", HAT = "hat", SNARE = "snare"; // perc tokens (engine maps to drum voices)

// Soft, unhurried boom-bap: gentle kick on 1, light syncopation, sparse snare on 3.
// Human-feel irregularity — not punchy or mechanical.
const basePerc = [
  KICK, K, K, K, K, K, KICK, K,                     // bar 1 — soft kick on 1, syncopated late kick
  K, K, SNARE, K, K, K, K, K,                        // bar 2 — soft snare on 3, spacious
  KICK, K, K, K, KICK, K, K, K,                      // bar 3 — gentle kick feel
  K, K, SNARE, K, K, KICK, K, K,                     // bar 4 — snare on 3, late kick for woozy feel
];

// Lazy, relaxed hats with occasional soft snare — lots of rests, spacious.
const doublePerc = [
  K, HAT, K, K, K, HAT, K, K,                        // bar 1 — sparse, sleepy
  K, K, K, HAT, SNARE, K, K, HAT,                    // bar 2 — lazy snare placement
  K, HAT, K, K, K, K, HAT, K,                        // bar 3 — wide open space
  K, K, HAT, K, SNARE, K, K, HAT,                    // bar 4 — gentle close
];

// Warm, rounded G bassline — slow-moving, mostly held with lots of space.
// G root, then wandering to E and C for warmth.
const bass = [
  "G2", K, K, K, "G2", K, K, K,
  "G2", K, K, K, "E2", K, K, K,
  "C2", K, K, K, "C2", K, "D2", K,
  "G2", K, K, K, "G2", K, K, K,
];

// Wistful, nostalgic melody in G major / E minor — long notes, child-like and simple.
// G B D E with C and F# color notes; sparse and dreamy.
const lead = [
  "G4", K, K, K, "B4", K, K, K,
  "D5", K, K, K, K, K, "E5", K,
  "D5", K, "B4", K, K, K, "C5", K,
  "G4", K, K, K, K, K, "F#4", K,
];

// Warm sustained pads — G major [G3 B3 D4], E minor [E3 G3 B3], C major [C3 E3 G3].
// Long and washy, slow chord shifts.
const backup = [
  ["G3","B3","D4"], K, K, K, ["G3","B3","D4"], K, K, K,
  ["E3","G3","B3"], K, K, K, ["E3","G3","B3"], K, K, K,
  ["C3","E3","G3"], K, K, K, ["C3","E3","G3"], K, K, K,
  ["G3","B3","D4"], K, K, K, ["G3","B3","D4"], K, K, K,
];

// 16th-note grid, 16 steps/bar, 4 bars = 64 steps.
// Gentle shimmering G-major arp (G B D G) — dreamy, not bright or aggressive.
const progArp = [
  "G5",K,"B5",K,"D6",K,"G6",K,"D6",K,"B5",K,"G5",K,"B5",K,
  "G5",K,"B5",K,"D6",K,"G6",K,"D6",K,"B5",K,"D6",K,"G6",K,
  "B5",K,"D6",K,"G6",K,"D6",K,"B5",K,"G5",K,"B5",K,"D6",K,
  "G5",K,"D6",K,"B5",K,"G5",K,"B5",K,"D6",K,"G6",K,"D6",K,
];

// 16th grid, 64 steps. E-minor-ish arp (E G B E) with Ab/F for unease under threat.
const urgencyArp = [
  "E5","G5","B5","E6","B5","G5","E5","G5","B5","E6","G5","E5","Ab5","E6","B5","G5",
  "E5","G5","B5","E6","B5","G5","E5","G5","B5","E6","G5","E5","Ab5","E6","B5","G5",
  "E5","G5","B5","E6","B5","G5","F5","G5","B5","E6","G5","E5","Ab5","E6","B5","G5",
  "E5","G5","B5","E6","B5","Ab5","E5","G5","B5","E6","G5","F5","Ab5","E6","B5","E5",
];

export const CORPORATE_HAZE = Object.freeze({
  biome: "corporate",
  name: "Corporate — Haze",
  root: "G", mode: "ionian",  // drone harmonic wander (#239)
  bpm: 84,
  masterFilter: { cutoffLo: 500, cutoffHi: 8000, qLo: 0.7, qHi: 3.0 },
  layers: [
    // base
    { key: "drone", axis: "base", baseGain: 0.5, progressBoost: 0.15, wander: true,
      sustain: ["G2", "D3"], synth: { type: "fatsawtooth", count: 3, spread: 20, attack: 3, release: 4, volume: -17 } },
    // progress (blossom — warm, hazy, nostalgic)
    { key: "basePerc", axis: "progress", lo: 0.0, hi: 0.05, pattern: basePerc,
      synth: { kind: "drums", volume: -9 } },
    { key: "bass", axis: "progress", lo: 0.1, hi: 0.35, pattern: bass,
      synth: { type: "triangle", attack: 0.08, decay: 0.4, sustain: 0.5, release: 0.6, volume: -9 } },
    { key: "doublePerc", axis: "progress", lo: 0.25, hi: 0.55, pattern: doublePerc,
      synth: { kind: "drums", volume: -11 } },
    { key: "lead", axis: "progress", lo: 0.35, hi: 0.65, pattern: lead,
      synth: { type: "fatsawtooth", count: 2, spread: 10, attack: 0.12, decay: 0.5, sustain: 0.4, release: 0.8, volume: -11 } },
    { key: "backup", axis: "progress", lo: 0.5, hi: 0.78, pattern: backup,
      synth: { kind: "poly", type: "triangle", attack: 0.3, decay: 1.2, sustain: 0.6, release: 1.5, volume: -15 } },
    { key: "progArp", axis: "progress", lo: 0.62, hi: 0.95, grid: "16n", pattern: progArp,
      synth: { type: "triangle", attack: 0.04, decay: 0.3, sustain: 0.2, release: 0.4, volume: -14 } },
    // threat (alarm)
    { key: "tensionDrone", axis: "threat", lo: 0.0, hi: 1.0,
      sustain: ["G2", "Ab2"], synth: { type: "fatsawtooth", count: 3, spread: 25, attack: 1.2, release: 2.0, volume: -16 } },
    { key: "urgencyArp", axis: "threat", lo: 0.55, hi: 1.0, grid: "16n", pattern: urgencyArp,
      synth: { type: "fatsawtooth", count: 2, spread: 12, attack: 0.02, decay: 0.18, sustain: 0.1, release: 0.2, volume: -14 } },
  ],
  // Arrangement sections (progress layers audible per section); seeded-random, no repeat.
  sections: [
    ["basePerc", "doublePerc", "bass", "lead", "backup", "progArp"], // full
    ["basePerc", "bass", "backup"],                                   // warm foundation
    ["basePerc", "doublePerc", "lead"],                               // perc + melody
    ["bass", "lead", "backup"],                                       // pad breakdown (no drums)
    ["basePerc", "doublePerc", "bass", "lead"],                       // drums + core melody
  ],
  sectionBars: 16,
  flavors: [
    { id: "default", processing: null },
  ],
});
