// @ts-check
// Hub ambient — a calm, biome-independent background for the overworld hub. Intentionally
// ALL sustained pads (no sequenced notes), so it adds no per-note param accumulation while
// the player lingers between runs. A warm, slightly-hopeful drift (Am over a Cmaj shimmer).
export const HUB_AMBIENT = Object.freeze({
  biome: "hub",
  name: "Hub Ambient",
  bpm: 70,
  masterFilter: { cutoffLo: 2200, cutoffHi: 7000, qLo: 0.7, qHi: 1.5 },
  layers: [
    { key: "drone", axis: "base", baseGain: 0.6,
      sustain: ["A2", "E3"],
      synth: { type: "fatsawtooth", count: 3, spread: 22, attack: 3, release: 4, volume: -15 } },
    { key: "pad", axis: "base", baseGain: 0.5,
      sustain: ["C4", "E4", "G4"],
      synth: { type: "fatsawtooth", count: 3, spread: 26, attack: 4, release: 5, volume: -19 } },
    { key: "shimmer", axis: "base", baseGain: 0.32,
      sustain: ["E5", "B5"],
      synth: { type: "triangle", attack: 5, release: 6, volume: -24 } },
  ],
  flavors: [{ id: "default", processing: null }],
});
