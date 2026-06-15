// @ts-check
// Hub ambient — a calm, biome-independent background for the overworld hub. Intentionally
// ALL sustained pads (no sequenced notes), so it adds no per-note param accumulation while
// the player lingers between runs. A warm, slightly-hopeful drift (Am over a Cmaj shimmer).
export const HUB_AMBIENT = Object.freeze({
  biome: "hub",
  name: "Hub Ambient",
  root: "A", mode: "aeolian",  // drone + pad harmonic wander (#239)
  bpm: 70,
  masterFilter: { cutoffLo: 2200, cutoffHi: 7000, qLo: 0.7, qHi: 1.5 },
  layers: [
    // drone + pad plane together by the same diatonic step; the high shimmer stays a static
    // anchor. Combined they cycle Am7 → Cmaj7 → Dm7 → Em7 → Fmaj7 → G7. (#239)
    { key: "drone", axis: "base", baseGain: 0.6, wander: true,
      sustain: ["A2", "E3"],
      synth: { type: "fatsawtooth", count: 3, spread: 22, attack: 3, release: 4, volume: -15 } },
    { key: "pad", axis: "base", baseGain: 0.5, wander: true,
      sustain: ["C4", "E4", "G4"],
      synth: { type: "fatsawtooth", count: 3, spread: 26, attack: 4, release: 5, volume: -19 } },
    { key: "shimmer", axis: "base", baseGain: 0.32,
      sustain: ["E5", "B5"],
      synth: { type: "triangle", attack: 5, release: 6, volume: -24 } },
  ],
  flavors: [{ id: "default", processing: null }],
});
