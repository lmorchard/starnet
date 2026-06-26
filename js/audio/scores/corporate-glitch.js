// @ts-check
// Corporate — Glitch. Showcase score for the step-modifier features: glitchy funky drums built
// from ratchet rolls, prob ghost-note stutter, and velocity dynamics over a 16n perc grid.
// A dorian (funky minor with a natural 6). See docs/audio-direction.md.

const K = null;
const KICK = "C1";
// ghost / accent helpers keep the perc arrays readable
const g = (note, vel) => ({ note, vel });            // ghost / accented hit
const roll = (note, ratchet, vel) => ({ note, ratchet, vel }); // ratchet burst
const maybe = (note, prob, vel) => ({ note, prob, vel });      // probabilistic glitch hit

// basePerc — 8n (32). Syncopated funk: kick pushes, backbeat snare, ghost snares between.
const basePerc = [
  KICK, K, g("snare", 0.25), KICK, "snare", K, g("snare", 0.2), KICK,
  KICK, K, g("snare", 0.25), K, "snare", KICK, g("snare", 0.2), K,
  KICK, K, g("snare", 0.25), KICK, "snare", K, KICK, g("snare", 0.2),
  KICK, g("snare", 0.2), g("snare", 0.3), KICK, "snare", K, roll("snare", 5, 0.4), K, // bar-4 fill
  KICK, K, g("snare", 0.25), KICK, "snare", K, g("snare", 0.2), KICK,
  KICK, K, g("snare", 0.25), K, "snare", KICK, g("snare", 0.2), K,
  KICK, K, g("snare", 0.25), KICK, "snare", K, KICK, g("snare", 0.2),
  KICK, g("snare", 0.2), g("snare", 0.3), KICK, "snare", roll("snare", 5, 0.4), K, roll("snare", 8, 0.4), // bar-4 fill
];
// doublePerc — 16n (64). Glitchy hats: steady ticks, ratchet stutters, probabilistic drops.
const hb = [ // one bar of 16 hats with motion
  g("hat", 0.5), maybe("hat", 0.5, 0.3), "hat", roll("hat", 3, 0.5), g("hat", 0.4), "hat", maybe("hat", 0.6, 0.3), "hat",
  g("hat", 0.5), "hat", roll("hat", 4, 0.45), maybe("hat", 0.5, 0.3), g("hat", 0.4), "hat", "hat", maybe("hat", 0.4, 0.25),
];
const hbFill = [
  g("hat", 0.5), maybe("hat", 0.5, 0.3), "hat", roll("hat", 3, 0.5), g("hat", 0.4), "hat", maybe("hat", 0.6, 0.3), "hat",
  roll("snare", 2, 0.4), "hat", roll("hat", 4, 0.45), "hat", roll("snare", 4, 0.5), roll("hat", 6, 0.4), roll("snare", 3, 0.5), roll("hat", 8, 0.45),
];
const doublePerc = [...hb, ...hb, ...hb, ...hbFill]; // 64

// bass — 16n (64). Funky syncopated square; A dorian (A B C D E F# G), rest-heavy for groove.
const bb = [
  "A1", K, K, "A1", K, "A1", K, K, "C2", K, "A1", K, K, "E2", K, K,
];
const bbTurn = [
  "A1", K, K, "A1", K, "G1", K, K, "F#1", K, "G1", K, "A1", K, K, "E2",
];
const bass = [...bb, ...bb, ...bb, ...bbTurn]; // 64

// lead — 8n (32). Sparse stabs leaving room for the drums.
const lead = [
  "E4", K, K, K, "G4", K, "A4", K,
  K, K, "E4", K, K, K, K, K,
  "D4", K, K, "E4", K, "G4", K, K,
  "A4", K, "G4", K, "E4", K, K, K,
];
// backup — 8n (32). Am9-ish stabs (dorian color).
const backup = [
  ["A3", "C4", "E4"], K, K, K, K, K, ["A3", "C4", "E4"], K,
  ["A3", "C4", "E4"], K, K, K, K, K, K, K,
  ["G3", "B3", "D4"], K, K, K, K, K, ["G3", "B3", "D4"], K,
  ["A3", "C4", "E4"], K, K, K, ["E4", "G4", "B4"], K, K, K,
];
// progArp — 16n (64). Bright dorian shimmer.
const arpBar = ["A4", "C5", "E5", "G5", "A5", "G5", "E5", "C5", "A4", "C5", "E5", "G5", "B5", "G5", "E5", "C5"];
const progArp = [...arpBar, ...arpBar, ...arpBar, ...arpBar]; // 64
// urgencyArp — 16n (64). Driving, with ratchet buzz on the turn.
const uBar = ["A4", "E5", "A5", "E5", "A4", "E5", "A5", "E5", "A4", "E5", "A5", "E5", "A4", "E5", "A5", "E5"];
const uFill = ["A4", "E5", "A5", "E5", "A4", "E5", "A5", "E5", roll("A5", 4), roll("E5", 4), roll("A5", 6), roll("E5", 6), roll("A5", 8), roll("E5", 8), "A5", "E5"];
const urgencyArp = [...uBar, ...uBar, ...uBar, ...uFill]; // 64

export const CORPORATE_GLITCH = Object.freeze({
  biome: "corporate",
  name: "Corporate — Glitch",
  root: "A", mode: "dorian",  // drone harmonic wander (#239)
  bars: 4,
  bpm: 112,
  masterFilter: { cutoffLo: 600, cutoffHi: 9000, qLo: 0.7, qHi: 4.2 },
  layers: [
    { key: "drone", axis: "base", baseGain: 0.5, progressBoost: 0.2, wander: true,
      sustain: ["A2", "E3"], synth: { type: "fatsawtooth", count: 3, spread: 18, attack: 2, release: 3, volume: -16 } },
    { key: "basePerc", axis: "progress", lo: 0.0, hi: 0.05, pattern: basePerc,
      synth: { kind: "drums", volume: -4 } },
    { key: "bass", axis: "progress", lo: 0.1, hi: 0.35, grid: "16n", pattern: bass,
      synth: { type: "square", attack: 0.01, decay: 0.18, sustain: 0.25, release: 0.15, volume: -6 } },
    { key: "doublePerc", axis: "progress", lo: 0.2, hi: 0.5, grid: "16n", pattern: doublePerc,
      synth: { kind: "drums", volume: -9 } },
    { key: "lead", axis: "progress", lo: 0.35, hi: 0.65, pattern: lead,
      synth: { type: "sawtooth", attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.2, volume: -10 } },
    { key: "backup", axis: "progress", lo: 0.5, hi: 0.78, pattern: backup,
      synth: { kind: "poly", type: "triangle", attack: 0.02, decay: 0.4, sustain: 0.0, release: 0.3, volume: -13 } },
    { key: "progArp", axis: "progress", lo: 0.62, hi: 0.95, grid: "16n", pattern: progArp,
      synth: { type: "sawtooth", attack: 0.005, decay: 0.14, sustain: 0.0, release: 0.1, volume: -13 } },
    { key: "tensionDrone", axis: "threat", lo: 0.0, hi: 1.0,
      sustain: ["A2", "Bb2"], synth: { type: "fatsawtooth", count: 3, spread: 30, attack: 0.8, release: 1.5, volume: -14 } },
    { key: "urgencyArp", axis: "threat", lo: 0.55, hi: 1.0, grid: "16n", pattern: urgencyArp,
      synth: { type: "sawtooth", attack: 0.005, decay: 0.1, sustain: 0.0, release: 0.08, volume: -15 } },
  ],
  sections: [
    ["basePerc", "doublePerc", "bass", "lead", "backup", "progArp"],
    ["basePerc", "doublePerc", "bass"],
    ["doublePerc", "bass", "progArp"],
    ["basePerc", "bass", "lead"],
  ],
  sectionBars: 8,
  flavors: [{ id: "default", processing: null }],
});
