// @ts-check
// Corporate — Cipher. Showcase score for complex melodic rhythm: a clever lead on an 8t triplet
// grid playing 3-against-4 over straight (8n/16n) backing, with a couple of ratchet flourishes.
// D dorian (noir-jazz minor with a natural 6). See docs/audio-direction.md.

const K = null;
const KICK = "C1";

// basePerc — 8n (32). Restrained, leaves space for the triplet lead.
const basePerc = [
  KICK, K, K, K, "snare", K, K, K,
  KICK, K, K, KICK, "snare", K, K, K,
  KICK, K, K, K, "snare", K, K, K,
  KICK, K, K, KICK, "snare", K, "snare", K,
];
// doublePerc — 16n (64). Light brushed hats (straight 4 against the lead's 3).
const dpBar = ["hat", K, "hat", K, "hat", K, "hat", K, "hat", K, "hat", K, "hat", K, "hat", K];
const doublePerc = [...dpBar, ...dpBar, ...dpBar, ...dpBar];
// bass — 8n (32). Walking D dorian.
const bass = [
  "D2", K, "A1", K, "C2", K, "A1", K,
  "D2", K, "F2", K, "E2", K, "C2", K,
  "D2", K, "A1", K, "B1", K, "C2", K,
  "G1", K, "A1", K, "D2", K, "E2", K,
];
// lead — 8t (48 = 4 × 12). The clever triplet line: crosses the beat, rests for phrasing.
const lead = [
  "D4", K, K, "F4", K, "A4", K, K, "C5", K, "A4", K,            // bar 1
  "B4", K, "A4", K, K, "F4", K, "A4", K, K, K, K,               // bar 2
  "D4", K, "E4", "F4", K, "G4", K, "A4", K, { note: "A4", ratchet: 3 }, K, K, // bar 3
  "C5", K, "B4", K, "A4", K, "F4", K, "E4", K, "D4", K,         // bar 4
];
// backup — 8n (32). Dm / G / Am stabs (dorian).
const backup = [
  ["D3", "F3", "A3"], K, K, K, ["D3", "F3", "A3"], K, K, K,
  ["G3", "B3", "D4"], K, K, K, ["G3", "B3", "D4"], K, K, K,
  ["A3", "C4", "E4"], K, K, K, ["A3", "C4", "E4"], K, K, K,
  ["D3", "F3", "A3"], K, K, K, ["C4", "E4", "G4"], K, K, K,
];
// progArp — 16n (64). Straight shimmer under the triplet lead.
const arpBar = ["D4", "A4", "F4", "A4", "D5", "A4", "F4", "A4", "D4", "A4", "F4", "A4", "C5", "A4", "F4", "A4"];
const progArp = [...arpBar, ...arpBar, ...arpBar, ...arpBar];
// urgencyArp — 16n (64).
const uBar = ["D4", "A4", "D5", "A4", "D4", "A4", "D5", "A4", "D4", "A4", "D5", "A4", "Eb4", "Eb5", "D5", "A4"];
const urgencyArp = [...uBar, ...uBar, ...uBar, ...uBar];

export const CORPORATE_CIPHER = Object.freeze({
  biome: "corporate",
  name: "Corporate — Cipher",
  root: "D", mode: "dorian",  // drone harmonic wander (#239)
  bars: 4,
  bpm: 140,
  masterFilter: { cutoffLo: 500, cutoffHi: 8000, qLo: 0.7, qHi: 3.2 },
  layers: [
    { key: "drone", axis: "base", baseGain: 0.5, progressBoost: 0.2, wander: true,
      sustain: ["D3", "A3"], synth: { type: "fatsawtooth", count: 3, spread: 16, attack: 2.5, release: 4, volume: -16 } },
    { key: "basePerc", axis: "progress", lo: 0.0, hi: 0.05, pattern: basePerc,
      synth: { kind: "drums", volume: -6 } },
    { key: "bass", axis: "progress", lo: 0.1, hi: 0.35, pattern: bass,
      synth: { type: "square", attack: 0.01, decay: 0.22, sustain: 0.3, release: 0.18, volume: -7 } },
    { key: "doublePerc", axis: "progress", lo: 0.25, hi: 0.55, grid: "16n", pattern: doublePerc,
      synth: { kind: "drums", volume: -16 } },
    { key: "lead", axis: "progress", lo: 0.3, hi: 0.6, grid: "8t", pattern: lead,
      synth: { type: "triangle", attack: 0.01, decay: 0.2, sustain: 0.25, release: 0.2, volume: -10 } },
    { key: "backup", axis: "progress", lo: 0.5, hi: 0.78, pattern: backup,
      synth: { kind: "poly", type: "triangle", attack: 0.02, decay: 0.4, sustain: 0.0, release: 0.3, volume: -14 } },
    { key: "progArp", axis: "progress", lo: 0.62, hi: 0.95, grid: "16n", pattern: progArp,
      synth: { type: "sawtooth", attack: 0.005, decay: 0.16, sustain: 0.0, release: 0.12, volume: -14 } },
    { key: "tensionDrone", axis: "threat", lo: 0.0, hi: 1.0,
      sustain: ["D3", "Eb3"], synth: { type: "fatsawtooth", count: 3, spread: 30, attack: 0.8, release: 1.5, volume: -15 } },
    { key: "urgencyArp", axis: "threat", lo: 0.55, hi: 1.0, grid: "16n", pattern: urgencyArp,
      synth: { type: "sawtooth", attack: 0.005, decay: 0.12, sustain: 0.0, release: 0.08, volume: -16 } },
  ],
  sections: [
    ["basePerc", "doublePerc", "bass", "lead", "backup", "progArp"],
    ["basePerc", "bass", "lead"],
    ["basePerc", "doublePerc", "bass", "backup"],
    ["bass", "lead", "progArp"],
  ],
  sectionBars: 8,
  flavors: [{ id: "default", processing: null }],
});
