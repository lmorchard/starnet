// @ts-check
// Corporate biome score — INDUSTRIAL variant. Dark, gritty, brooding industrial + trip-hop.
// Key: E minor (E F# G A B C D); Phrygian ♭2 = F for menace. BPM 100, mid-tempo and heavy.

// 8th-note grid, 8 steps/bar, 4 bars = 32 steps.
const K = null; // rest alias for readability
const KICK = "C1", HAT = "hat", SNARE = "snare"; // perc tokens (engine maps to drum voices)

// Heavy, deliberate beat: strong kick on 1 & 3 (steps 0,4 per bar), hard snare on 2 & 4
// (steps 2,6), with mechanical syncopated accents — gritty industrial feel.
const basePerc = [
  KICK, K, SNARE, K, KICK, KICK, SNARE, K,          // bar 1 — kick 1&3, snare 2&4, syncopated kick accent
  KICK, K, SNARE, K, KICK, K, SNARE, K,             // bar 2 — clean heavy pulse
  KICK, K, SNARE, KICK, KICK, K, SNARE, K,          // bar 3 — syncopated accent on 2-and
  KICK, K, SNARE, K, KICK, KICK, SNARE, KICK,       // bar 4 — heavy drive into turnaround
];

// Industrial hats + extra metallic snare hits, machine-like relentless texture.
const doublePerc = [
  HAT, HAT, SNARE, HAT, HAT, HAT, SNARE, HAT,      // bar 1 — machine hats, metallic snares
  HAT, SNARE, HAT, HAT, HAT, SNARE, HAT, HAT,      // bar 2 — shifted snare accents
  HAT, HAT, SNARE, HAT, HAT, HAT, SNARE, HAT,      // bar 3
  HAT, SNARE, HAT, SNARE, HAT, HAT, SNARE, HAT,    // bar 4 — dense metallic clatter
];

// Heavy distorted-feel E pedal with menacing movement (E, then C and D), syncopated.
const bass = [
  "E2", K, "E2", K, "E2", K, "E2", K,
  "E2", K, "E2", "G2", "E2", K, "D2", K,
  "E2", K, "C2", K, "E2", K, "C2", K,
  "D2", K, "D2", K, "E2", K, "E2", K,
];

// Sparse, brooding, ominous E-minor motif (E G B D, with F♮ for unease); leaves space.
const lead = [
  "E5", K, K, K, "G4", K, K, K,
  "B4", K, "D5", K, K, K, K, K,
  "E5", K, K, K, "F4", K, "G4", K,
  "B4", K, K, K, "E5", K, "D5", K,
];

// Em [E3 G3 B3] / C [C3 E3 G3] dark sustained stabs.
const backup = [
  ["E3","G3","B3"], K, K, K, ["E3","G3","B3"], K, K, K,
  ["E3","G3","B3"], K, K, K, ["C3","E3","G3"], K, K, K,
  ["C3","E3","G3"], K, K, K, ["E3","G3","B3"], K, K, K,
  ["D3","F3","A3"], K, K, K, ["E3","G3","B3"], K, K, K,
];

// 16th-note grid, 16 steps/bar, 4 bars = 64 steps.
// G major (relative major: G B D) arp — colder, less bright "lift" than other scores.
const progArp = [
  "G5",K,"B5",K,"D6",K,"G6",K,"D6",K,"B5",K,"G5",K,"B5",K,
  "G5",K,"B5",K,"D6",K,"G6",K,"D6",K,"B5",K,"G5",K,"D6",K,
  "G5",K,"B5",K,"D6",K,"G6",K,"D6",K,"B5",K,"G5",K,"B5",K,
  "B5",K,"D6",K,"G6",K,"D6",K,"B5",K,"G5",K,"B5",K,"D6",K,
];

// 16th grid, 64 steps. Pounding E-minor 16th arp (E G B E) with F for menace.
const urgencyArp = [
  "E5","G5","B5","E6","B5","G5","E5","G5","B5","E6","B5","G5","E5","G5","B5","F6",
  "E5","G5","B5","E6","B5","G5","E5","G5","B5","E6","B5","G5","E5","G5","B5","F6",
  "E5","G5","B5","E6","B5","G5","E5","G5","B5","E6","B5","G5","E5","G5","B5","F6",
  "E5","G5","B5","E6","B5","G5","E5","G5","B5","E6","G5","E5","F5","F6","E6","B5",
];

export const CORPORATE_INDUSTRIAL = Object.freeze({
  biome: "corporate",
  name: "Corporate — Industrial",
  root: "E", mode: "phrygian",  // drone harmonic wander (#239)
  bars: 4,
  bpm: 140,
  masterFilter: { cutoffLo: 450, cutoffHi: 6500, qLo: 0.8, qHi: 4.0 },
  layers: [
    // base
    { key: "drone", axis: "base", baseGain: 0.5, progressBoost: 0.2, wander: true,
      sustain: ["E2", "B2"], synth: { type: "fatsawtooth", count: 3, spread: 18, attack: 2, release: 3, volume: -14 } },
    // progress (blossom — industrial, heavy)
    { key: "basePerc", axis: "progress", lo: 0.0, hi: 0.05, pattern: basePerc,
      synth: { kind: "drums", volume: -5 } },
    { key: "bass", axis: "progress", lo: 0.1, hi: 0.35, pattern: bass,
      synth: { type: "sawtooth", attack: 0.01, decay: 0.28, sustain: 0.35, release: 0.2, volume: -7 } },
    { key: "doublePerc", axis: "progress", lo: 0.25, hi: 0.55, pattern: doublePerc,
      synth: { kind: "drums", volume: -9 } },
    { key: "lead", axis: "progress", lo: 0.35, hi: 0.65, pattern: lead,
      synth: { type: "sawtooth", attack: 0.02, decay: 0.22, sustain: 0.18, release: 0.18, volume: -10 } },
    { key: "backup", axis: "progress", lo: 0.5, hi: 0.78, pattern: backup,
      synth: { kind: "poly", type: "sawtooth", attack: 0.04, decay: 0.4, sustain: 0.0, release: 0.3, volume: -15 } },
    { key: "progArp", axis: "progress", lo: 0.62, hi: 0.95, grid: "16n", pattern: progArp,
      synth: { type: "sawtooth", attack: 0.005, decay: 0.16, sustain: 0.0, release: 0.1, volume: -14 } },
    // threat (alarm)
    { key: "tensionDrone", axis: "threat", lo: 0.0, hi: 1.0,
      sustain: ["E2", "F2"], synth: { type: "fatsawtooth", count: 3, spread: 30, attack: 0.8, release: 1.5, volume: -13 } },
    { key: "urgencyArp", axis: "threat", lo: 0.55, hi: 1.0, grid: "16n", pattern: urgencyArp,
      synth: { type: "sawtooth", attack: 0.005, decay: 0.12, sustain: 0.0, release: 0.08, volume: -15 } },
  ],
  // Arrangement sections (progress layers audible per section); seeded-random, no repeat.
  sections: [
    ["basePerc", "doublePerc", "bass", "lead", "backup", "progArp"], // full
    ["basePerc", "bass", "lead"],                                     // gritty core
    ["basePerc", "doublePerc", "bass"],                               // industrial drive (no lead)
    ["bass", "lead", "backup"],                                       // synth breakdown (no drums)
    ["basePerc", "doublePerc", "lead", "progArp"],                   // perc + lead + arp lift
  ],
  sectionBars: 8,
  flavors: [
    { id: "default", processing: null },
  ],
});
