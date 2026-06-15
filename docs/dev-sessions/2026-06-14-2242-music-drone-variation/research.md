# Research — drone harmonic variation

## Audio subsystem map (verified at this commit)

- `js/audio/engine.js` — Tone wrapper. Owns master bus, per-layer synths/gains, the
  **section-automation** loop (the pattern to mirror), and the param-recycle GC. Key bits:
  - `buildLayer(spec)`: a `spec.sustain` layer becomes a `Tone.PolySynth` stored as
    `layers[key] = { gain, sustainSynth, sustain }`. Sustained layers are kicked off in
    `start()` via `sustainSynth.triggerAttack(layer.sustain)`.
  - Section automation: `sectionRng = makeSeededRng((getSeed()||"audio")+":sections")`,
    `Tone.Transport.scheduleRepeat(() => advanceSection(), "${bars}m", "${bars}m")`,
    seeded no-immediate-repeat pick, cleaned up in `teardown()` via `Tone.Transport.clear(id)`.
  - `recycleTick()` only touches **sequenced** layers (`l.seq`); sustained drone layers are
    never recycled → wander state on the drone synth is safe across the run.
  - `teardown()` already resets all section transient state; the drone-wander state must be
    reset there too, and re-initialised in `start()`.
- `js/audio/scores/*.js` — pure data. Base `drone` layer is `axis:"base"`, `sustain:[low,fifth]`
  (root + perfect fifth power voicing). `tensionDrone` is `axis:"threat"` with `[root, ♭2]`
  (Phrygian menace) — **out of scope**, leave as-is.
- `js/audio/scores/index.js` — `BIOME_SCORES.corporate` pool + `selectScore(biome)`
  (independent `:score` seeded RNG). Hub is **not** in the pool; selected directly.
- `js/audio/audio-renderer.js` — `desiredScore()` returns `HUB_AMBIENT` in the overworld,
  the per-run score during a run. Same `engine` instance plays both, so a wander mechanism in
  the engine covers hub + run with no renderer changes.
- `js/audio/mixer.js` — `computeMix`; `axis:"base"` gain = `baseGain + progressBoost*progress`.
  Untouched by this work (wander changes pitch, not gain).
- `js/core/rng.js` — `makeSeededRng(seedString)` + `getSeed()`. Independent of gameplay streams.

## Drone roots/fifths per score (from `sustain` of the `drone` layer)

| Score | drone sustain | root | fifth | mode (to assign) |
|---|---|---|---|---|
| Dread (corporate.js) | A2 E3 | A | E | aeolian |
| Cold | C3 G3 | C | G | dorian |
| Noir | D3 A3 | D | A | dorian |
| Haze | G2 D3 | G | D | (derive: aeolian/dorian by lead notes) |
| Industrial | E2 B2 | E | B | (derive — phrygian-leaning) |
| Neon | F#2 C#3 | F# | C# | (derive) |
| Pulse | A2 E3 | A | E | aeolian |
| Vast | A2 E3 A3 | A | E | aeolian |
| **Hub** (hub.js) | A2 E3 | A | E | aeolian |

Mode per score will be confirmed during execution by reading each score's lead/bass note
content (the diatonic content reveals natural-6 dorian vs flat-6 aeolian, etc.).

## Power-fifth consonance check (why exclude degree ii)

Allowed degrees **{i, III, iv, v, VI, VII}** = all diatonic degrees minus **ii**. With a fixed
**+7 semitone** (perfect-fifth) voicing, every allowed degree keeps **both** notes in-key; only
ii's diatonic fifth is a tritone / leaves the scale (e.g. A-aeolian ii = B, B+F# pulls F# out of
the F-natural scale). The home chord equals `chordForDegree(root, mode, i, octave)`, so wandering
to i returns home — a free invariant to assert in tests.

## Decisions locked by research

- Wander operates on the existing drone `PolySynth` via `triggerRelease(old)` + `triggerAttack(new)`;
  the drone synth's configured slow attack/release envelopes overlap into a gapless morph.
- Octave is parsed from the drone layer's home `sustain[0]` (e.g. `"A2"` → 2) — no new score field
  needed beyond `root`/`mode`.
- One mechanism, gated on `score.root && score.mode`. Scores without them don't wander (still true
  for any future opt-out score), but **the hub now opts in** (Les's added requirement; diverges
  from the issue's "hub stays as-is").
