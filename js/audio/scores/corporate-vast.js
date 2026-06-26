// @ts-check
// Corporate biome score — Vast variant. Slow, cold, deep-space ambience; melancholic wonder.
// Key: A minor (Aeolian). bpm 72. Sparse, lush, wide. See docs/audio-direction.md.

// 8th-note grid, 8 steps/bar, 4 bars = 32 steps.
const K = null; // rest alias for readability
const KICK = "C1", HAT = "hat", SNARE = "snare"; // perc tokens (engine maps to drum voices)

// Very sparse: kick only on bar downbeats (step 0 of each bar). One soft snare in bar 4. Space.
const basePerc = [
  KICK, K, K, K, K, K, K, K,   // bar 1 — downbeat only
  KICK, K, K, K, K, K, K, K,   // bar 2 — downbeat only
  KICK, K, K, K, K, K, K, K,   // bar 3 — downbeat only
  KICK, K, K, K, K, K, SNARE, K, // bar 4 — downbeat + single late snare
];
// Still sparse when present: occasional hats, soft snare. Leave most steps as rests.
const doublePerc = [
  K, K, HAT, K, K, K, K, K,      // bar 1 — single hat
  K, K, HAT, K, SNARE, K, K, K,  // bar 2 — hat + snare
  K, K, HAT, K, K, K, HAT, K,    // bar 3 — two hats
  K, K, HAT, K, SNARE, K, HAT, K, // bar 4 — hat + snare + hat
];
// Slow, sustained roots. A pedal with a breath toward F and C. Mostly rests.
const bass = [
  "A1", K, K, K, K, K, K, K,
  "A1", K, K, K, "F1", K, K, K,
  "A1", K, K, K, K, K, K, K,
  "C2", K, K, K, "A1", K, K, K,
];
// Wide, melancholic melody. A Aeolian (A B C D E F G). Long held notes, big rests.
const lead = [
  "A4", K, K, K, K, K, "E4", K,
  K, K, K, "C5", K, K, K, K,
  "E4", K, K, K, "A4", K, K, K,
  K, K, "G4", K, K, K, "A4", K,
];
// Lush sustained pad chords: Am, F, C, Am. Long, washy, few hits.
const backup = [
  ["A3","C4","E4"], K, K, K, K, K, K, K,
  ["F3","A3","C4"], K, K, K, K, K, K, K,
  ["C4","E4","G4"], K, K, K, K, K, K, K,
  ["A3","C4","E4"], K, K, K, K, K, K, K,
];
// 16th-note grid, 16 steps/bar, 4 bars = 64. Shimmering consonant C major arp; gentle, spacious.
const progArp = [
  "C5",K,K,K,"E5",K,K,K,"G5",K,K,K,"C6",K,K,K,
  "C5",K,K,K,"E5",K,K,K,"G5",K,K,K,"C6",K,K,K,
  "G5",K,K,K,"E5",K,K,K,"C5",K,K,K,"E5",K,K,K,
  "A5",K,K,K,"C6",K,K,K,"E6",K,K,K,"C6",K,K,K,
];
// 16th grid, 64 steps. A-minor arp (A C E A) with Bb menace; the one driving element at high threat.
const urgencyArp = [
  "A4",K,"C5",K,"E5",K,"A5",K,"E5",K,"C5",K,"A4",K,"Bb4",K,
  "A4",K,"C5",K,"E5",K,"A5",K,"E5",K,"C5",K,"A4",K,"Bb4",K,
  "A4",K,"C5",K,"E5",K,"A5",K,"E5",K,"C5",K,"A4",K,"Bb4",K,
  "A4",K,"C5",K,"E5",K,"A5",K,"E5",K,"C5",K,"Bb4",K,"A4",K,
];

export const CORPORATE_VAST = Object.freeze({
  biome: "corporate",
  name: "Corporate — Vast",
  root: "A", mode: "aeolian",  // drone harmonic wander (#239)
  bars: 4,
  bpm: 72,
  masterFilter: { cutoffLo: 500, cutoffHi: 9000, qLo: 0.7, qHi: 3.5 },
  layers: [
    // base — always-on low pad
    { key: "drone", axis: "base", baseGain: 0.6, progressBoost: 0.2, wander: true,
      sustain: ["A2","E3","A3"], synth: { type: "fatsawtooth", count: 3, spread: 20, attack: 4.0, release: 5.0, volume: -16 } },
    // progress (blossom — sparse percussion first, then melody and pads layer in)
    { key: "basePerc", axis: "progress", lo: 0.0, hi: 0.05, pattern: basePerc,
      synth: { kind: "drums", volume: -9 } },
    { key: "bass", axis: "progress", lo: 0.1, hi: 0.35, pattern: bass,
      synth: { type: "sine", attack: 0.05, decay: 0.4, sustain: 0.5, release: 0.6, volume: -10 } },
    { key: "doublePerc", axis: "progress", lo: 0.25, hi: 0.55, pattern: doublePerc,
      synth: { kind: "drums", volume: -11 } },
    { key: "lead", axis: "progress", lo: 0.35, hi: 0.65, pattern: lead,
      synth: { type: "triangle", attack: 0.08, decay: 0.4, sustain: 0.4, release: 0.8, volume: -12 } },
    { key: "backup", axis: "progress", lo: 0.5, hi: 0.78, pattern: backup,
      synth: { kind: "poly", type: "fatsawtooth", attack: 0.3, decay: 0.6, sustain: 0.4, release: 1.2, volume: -15 } },
    { key: "progArp", axis: "progress", lo: 0.62, hi: 0.95, grid: "16n", pattern: progArp,
      synth: { type: "triangle", attack: 0.01, decay: 0.4, sustain: 0.0, release: 0.4, volume: -15 } },
    // threat (swell)
    { key: "tensionDrone", axis: "threat", lo: 0.0, hi: 1.0,
      sustain: ["A2","Bb2"], synth: { type: "fatsawtooth", count: 3, spread: 30, attack: 1.2, release: 2.0, volume: -17 } },
    { key: "urgencyArp", axis: "threat", lo: 0.55, hi: 1.0, grid: "16n", pattern: urgencyArp,
      synth: { type: "sawtooth", attack: 0.005, decay: 0.12, sustain: 0.0, release: 0.08, volume: -14 } },
  ],
  // Arrangement sections (progress layers audible per section); seeded-random, no repeat.
  // Long sections (16 bars) to let the ambience breathe.
  sections: [
    ["basePerc", "doublePerc", "bass", "lead", "backup", "progArp"], // full
    ["backup", "progArp"],                                           // pads + shimmer (no drums)
    ["lead", "backup"],                                              // melodic wash
    ["basePerc", "bass", "backup"],                                  // sparse pulse
  ],
  sectionBars: 16,
  flavors: [
    { id: "default", processing: null },
  ],
});
