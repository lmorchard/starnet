// @ts-check
// Phase-1 reactive score (corporate biome) as DATA. Synth voices only (no drum samples) so the
// engine ships offline without the dirt-sample set (deferred to Phase 2). Interpreted by music.js.
//
// Two axes (see js/audio/signals.js): PROGRESS = LAN ownership (0..1), THREAT = alert+injury (0..1).
// Layers gate/morph on one axis. C-aeolian-ish dread. ~8 voices to exercise the perf gate.
//
// CONTENT (the "wad" boundary): this is data the AGPL engine interprets — kept free of engine/
// Strudel imports so it can stay separately licensable.

export const CORPORATE = {
  name: "Corporate — Strudel",
  bpm: 120,
  layers: [
    // Driving bass — always present; filter opens + level rises with THREAT.
    { sound: "sawtooth", note: "c2 c2 c2 c2 g1 g1 g1 g1", axis: "threat", lpf: [300, 3500], gain: [0.35, 0.85] },
    // Arp — climbs up to an octave and speeds up as PROGRESS (LAN owned) rises.
    { sound: "triangle", note: "c4 eb4 g4 bb4", axis: "progress", addNote: [0, 12], fast: [1, 2], gain: 0.28, room: 0.4 },
    // Ambient pad bed — constant, sets the harmonic floor.
    { sound: "sawtooth", note: "c3 eb3 g3", axis: "base", gain: 0.12, lpf: 800, room: 0.6 },
    // Sub pulse — constant low heartbeat.
    { sound: "sine", note: "c1 ~ c1 ~", axis: "base", gain: 0.2 },
    // Tension blips — barely there until THREAT climbs.
    { sound: "square", note: "c5 ~ ~ c5 ~ c5 ~ ~", axis: "threat", gain: [0, 0.4], lpf: 4000 },
    // Mid stab — opens up (level + filter) with THREAT.
    { sound: "square", note: "~ c4 ~ eb4", axis: "threat", gain: [0, 0.25], lpf: [600, 2500] },
    // High shimmer — emerges as PROGRESS rises (sense of opening up the LAN).
    { sound: "triangle", note: "c6 eb6 g6 c7", axis: "progress", gain: [0, 0.18], room: 0.7, fast: 2 },
    // Counter-arp — fills in with PROGRESS.
    { sound: "triangle", note: "g4 f4 eb4 d4", axis: "progress", gain: [0, 0.2], room: 0.4 },
  ],
};
