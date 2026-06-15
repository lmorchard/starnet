// @ts-check
// Corporate Noir biome score — authored patterns-as-data. null = rest.
// Trip-hop / spy-jazz: Portishead, Sneakers, John Barry. Key: D minor, 84 bpm, laid-back.

const K = null; // rest alias for readability
const KICK = "C1", HAT = "hat", SNARE = "snare"; // perc tokens (engine maps to drum voices)

// Laid-back boom-bap: kick on beat 1 and syncopated pickup, snare backbeat on step 4 (beat 3).
// Sparse with swing-feel syncopation; bar 4 adds a small fill.
const basePerc = [
  KICK, K,    K,    K,    SNARE, K,    KICK,  K,         // bar 1
  KICK, K,    K,    K,    SNARE, K,    K,     KICK,       // bar 2 (pickup into bar 3)
  KICK, K,    K,    K,    SNARE, K,    KICK,  K,          // bar 3
  KICK, K,    KICK, SNARE, K,   SNARE, KICK,  SNARE,     // bar 4 (fill)
];
// Trip-hop hats with syncopated ghost snares off the straight grid.
const doublePerc = [
  K,    HAT,  K,    HAT,  SNARE, HAT,  K,    HAT,        // bar 1
  SNARE, HAT, K,    HAT,  K,    HAT,  SNARE, HAT,        // bar 2
  K,    HAT,  K,    HAT,  SNARE, HAT,  K,    HAT,        // bar 3
  SNARE, HAT, SNARE, HAT, SNARE, HAT,  SNARE, SNARE,     // bar 4 (fill)
];
// Smoky upright-style walking bass in D minor (D F A C), syncopated with chromatic passing notes.
const bass = [
  "D2", K,    "F2", K,    "A2", K,    K,    "C2",        // bar 1
  "D2", K,    K,    "F2", K,    "A2", K,    K,           // bar 2
  "C2", K,    "D2", K,    "F2", K,    "Ab2", K,          // bar 3 (chromatic color)
  "A2", K,    "G2", K,    "F2", K,    "E2", "D2",        // bar 4 (walking home)
];
// Jazzy muted-trumpet-style melody, D minor pentatonic with blue notes (F, Ab). Sparse.
const lead = [
  "D4", K,    K,    "F4", K,    K,    "A4", K,           // bar 1
  K,    "C5", K,    "A4", K,    K,    K,    K,           // bar 2
  "F4", K,    K,    "Ab4", K,   "F4", K,    K,           // bar 3 (blue note Ab)
  "A4", K,    "G4", K,    "F4", K,    K,    K,           // bar 4
];
// Lush jazz chords held long and smoky: Dm7, Gm7, A7.
const backup = [
  ["D3","F3","A3","C4"], K, K, K, ["D3","F3","A3","C4"], K, K, K,   // bar 1: Dm7
  ["G3","Bb3","D4","F4"], K, K, K, ["G3","Bb3","D4","F4"], K, K, K, // bar 2: Gm7
  ["D3","F3","A3","C4"], K, K, K, ["D3","F3","A3","C4"], K, K, K,   // bar 3: Dm7
  ["A3","C#4","E4","G4"], K, K, K, ["A3","C#4","E4","G4"], K, K, K, // bar 4: A7 (turnaround)
];
// Warm vibraphone-style (triangle) F-major / Dm-relative ascending arp — the celebratory lift.
// 16th-note grid, 4 bars = 64 steps. Rests interspersed for vibraphone breathiness.
const progArp = [
  "F4",K,"A4",K,"C5",K,"F5",K,"C5",K,"A4",K,"C5",K,"F5",K,
  "F4",K,"A4",K,"C5",K,"F5",K,"C5",K,"A4",K,"C5",K,"F5",K,
  "D4",K,"F4",K,"A4",K,"D5",K,"A4",K,"F4",K,"A4",K,"D5",K,
  "D4",K,"F4",K,"A4",K,"C5",K,"F5",K,"A4",K,"F4",K,"D4",K,
];
// Driving D-minor 16th arp (D F A D) with an Eb for menace, 64 steps.
const urgencyArp = [
  "D4","F4","A4","D5","A4","F4","D4","F4","A4","D5","A4","F4","D4","F4","A4","Eb5",
  "D4","F4","A4","D5","A4","F4","D4","F4","A4","D5","A4","F4","D4","F4","A4","Eb5",
  "D4","F4","A4","D5","A4","F4","D4","F4","A4","D5","A4","F4","D4","F4","A4","Eb5",
  "D4","F4","A4","D5","A4","F4","D4","F4","A4","D5","Eb4","Eb5","D5","A4","F4","D4",
];

export const CORPORATE_NOIR = Object.freeze({
  biome: "corporate",
  name: "Corporate — Noir",
  root: "D", mode: "dorian",  // drone harmonic wander (#239)
  bpm: 84,
  masterFilter: { cutoffLo: 500, cutoffHi: 7000, qLo: 0.7, qHi: 3.5 },
  layers: [
    { key: "drone",        axis: "base",     baseGain: 0.5, progressBoost: 0.2, wander: true,
      sustain: ["D3","A3"], synth: { type: "fatsawtooth", count: 3, spread: 14, attack: 2.5, release: 4, volume: -17 } },
    { key: "basePerc",     axis: "progress", lo: 0.0,  hi: 0.05, pattern: basePerc,
      synth: { kind: "drums", volume: -7 } },
    { key: "bass",         axis: "progress", lo: 0.1,  hi: 0.35, pattern: bass,
      synth: { type: "triangle", attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.2, volume: -8 } },
    { key: "doublePerc",   axis: "progress", lo: 0.25, hi: 0.55, pattern: doublePerc,
      synth: { kind: "drums", volume: -9 } },
    { key: "lead",         axis: "progress", lo: 0.35, hi: 0.65, pattern: lead,
      synth: { type: "triangle", attack: 0.02, decay: 0.25, sustain: 0.2, release: 0.3, volume: -9 } },
    { key: "backup",       axis: "progress", lo: 0.5,  hi: 0.78, pattern: backup,
      synth: { kind: "poly", type: "triangle", attack: 0.03, decay: 0.5, sustain: 0.1, release: 0.5, volume: -14 } },
    { key: "progArp",      axis: "progress", lo: 0.62, hi: 0.95, grid: "16n", pattern: progArp,
      synth: { type: "triangle", attack: 0.005, decay: 0.3, sustain: 0.0, release: 0.2, volume: -13 } },
    { key: "tensionDrone", axis: "threat",   lo: 0.0,  hi: 1.0,
      sustain: ["D3","Eb3"], synth: { type: "fatsawtooth", count: 3, spread: 30, attack: 0.8, release: 1.5, volume: -15 } },
    { key: "urgencyArp",   axis: "threat",   lo: 0.55, hi: 1.0, grid: "16n", pattern: urgencyArp,
      synth: { type: "sawtooth", attack: 0.005, decay: 0.12, sustain: 0.0, release: 0.08, volume: -14 } },
  ],
  // Arrangement sections (progress layers audible per section); seeded-random, no repeat.
  sections: [
    ["basePerc", "doublePerc", "bass", "lead", "backup", "progArp"], // full
    ["bass", "basePerc", "backup"],                                  // smoky groove + chords
    ["lead", "backup", "progArp"],                                   // melodic, no drums
    ["basePerc", "doublePerc", "bass"],                              // rhythm section
  ],
  sectionBars: 8,
  flavors: [ { id: "default", processing: null } ],
});
