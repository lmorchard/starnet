// @ts-check
// Corporate — Chip. Showcase score for finer grids: old-school chiptune fast arpeggios on a
// 32n grid (the classic NES "play a chord by cycling its notes very fast"), square-wave voices.
// A aeolian. See docs/audio-direction.md.

const K = null;
const KICK = "C1";

// basePerc — 8n (32). Tight NES-ish beat.
const basePerc = [
  KICK, K, "hat", K, "snare", K, "hat", K,
  KICK, K, "hat", K, "snare", K, "hat", KICK,
  KICK, K, "hat", K, "snare", K, "hat", K,
  KICK, K, "snare", K, "snare", K, "hat", "hat",
];
// doublePerc — 16n (64). Faster hat ticks.
const dpBar = ["hat", "hat", "hat", "hat", "hat", "hat", "hat", "hat", "hat", "hat", "hat", "hat", "hat", "hat", "hat", "hat"];
const doublePerc = [...dpBar, ...dpBar, ...dpBar, ...dpBar];
// bass — 16n (64). Driving square pulse bass, A aeolian.
const bsBar = ["A1", "A1", K, "A1", "A1", K, "A1", "A1", "A1", "A1", K, "A1", "A1", K, "A1", "A1"];
const bsTurn = ["F1", "F1", K, "F1", "G1", "G1", K, "G1", "A1", "A1", K, "A1", "E2", K, "E2", "E2"];
const bass = [...bsBar, ...bsBar, ...bsTurn, ...bsBar]; // 64
// lead — 16n (64). Square chiptune melody with a couple of ratchet trills.
const lead = [
  "A4", K, "C5", K, "E5", K, "C5", K, "A4", K, "B4", K, "C5", K, K, K,
  "E5", K, "D5", K, "C5", K, "B4", K, "A4", K, { note: "A4", ratchet: 4 }, K, "E5", K, K, K,
  "F5", K, "E5", K, "D5", K, "C5", K, "B4", K, "C5", K, "D5", K, K, K,
  "E5", K, { note: "E5", ratchet: 6 }, K, "A5", K, "E5", K, "C5", K, "B4", K, "A4", K, K, K,
];
// backup — 8n (32). Square stabs outlining the changes (Am / F / G).
const backup = [
  ["A3", "C4", "E4"], K, K, K, ["A3", "C4", "E4"], K, K, K,
  ["F3", "A3", "C4"], K, K, K, ["F3", "A3", "C4"], K, K, K,
  ["G3", "B3", "D4"], K, K, K, ["G3", "B3", "D4"], K, K, K,
  ["A3", "C4", "E4"], K, K, K, ["E4", "G4", "B4"], K, K, K,
];
// progArp — 32n (128). THE chiptune arpeggio: cycle each bar's triad tones at 32nd notes.
const arp32 = (tones) => Array.from({ length: 32 }, (_, i) => tones[i % tones.length]);
const progArp = [
  ...arp32(["A4", "C5", "E5"]),  // Am
  ...arp32(["F4", "A4", "C5"]),  // F
  ...arp32(["G4", "B4", "D5"]),  // G
  ...arp32(["A4", "C5", "E5"]),  // Am
]; // 128
// urgencyArp — 16n (64). Aggressive square arp.
const uBar = ["A4", "E5", "C5", "E5", "A4", "E5", "C5", "E5", "A4", "E5", "C5", "E5", "A4", "E5", "C5", "Bb5"];
const urgencyArp = [...uBar, ...uBar, ...uBar, ...uBar];

export const CORPORATE_CHIP = Object.freeze({
  biome: "corporate",
  name: "Corporate — Chip",
  root: "A", mode: "aeolian",  // drone harmonic wander (#239)
  bars: 4,
  bpm: 170,
  masterFilter: { cutoffLo: 800, cutoffHi: 10000, qLo: 0.7, qHi: 3.5 },
  layers: [
    { key: "drone", axis: "base", baseGain: 0.45, progressBoost: 0.2, wander: true,
      sustain: ["A2", "E3"], synth: { type: "fatsawtooth", count: 3, spread: 16, attack: 2, release: 3, volume: -17 } },
    { key: "basePerc", axis: "progress", lo: 0.0, hi: 0.05, pattern: basePerc,
      synth: { kind: "drums", volume: -6 } },
    { key: "bass", axis: "progress", lo: 0.1, hi: 0.35, grid: "16n", pattern: bass,
      synth: { type: "square", attack: 0.005, decay: 0.1, sustain: 0.4, release: 0.08, volume: -8 } },
    { key: "doublePerc", axis: "progress", lo: 0.25, hi: 0.55, grid: "16n", pattern: doublePerc,
      synth: { kind: "drums", volume: -12 } },
    { key: "lead", axis: "progress", lo: 0.35, hi: 0.65, grid: "16n", pattern: lead,
      synth: { type: "square", attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.06, volume: -12 } },
    { key: "backup", axis: "progress", lo: 0.5, hi: 0.78, pattern: backup,
      synth: { kind: "poly", type: "square", attack: 0.005, decay: 0.2, sustain: 0.0, release: 0.1, volume: -16 } },
    { key: "progArp", axis: "progress", lo: 0.6, hi: 0.92, grid: "32n", pattern: progArp,
      synth: { type: "square", attack: 0.002, decay: 0.05, sustain: 0.0, release: 0.03, volume: -15 } },
    { key: "tensionDrone", axis: "threat", lo: 0.0, hi: 1.0,
      sustain: ["A2", "Bb2"], synth: { type: "fatsawtooth", count: 3, spread: 30, attack: 0.8, release: 1.5, volume: -15 } },
    { key: "urgencyArp", axis: "threat", lo: 0.55, hi: 1.0, grid: "16n", pattern: urgencyArp,
      synth: { type: "square", attack: 0.003, decay: 0.08, sustain: 0.0, release: 0.05, volume: -16 } },
  ],
  sections: [
    ["basePerc", "doublePerc", "bass", "lead", "backup", "progArp"],
    ["basePerc", "bass", "lead"],
    ["basePerc", "doublePerc", "bass", "progArp"],
    ["bass", "lead", "progArp"],
  ],
  sectionBars: 8,
  flavors: [{ id: "default", processing: null }],
});
