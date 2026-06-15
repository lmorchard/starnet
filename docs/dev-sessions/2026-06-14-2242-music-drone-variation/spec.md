# Spec — Vary the music drone chord over a run

GitHub issue: https://github.com/lmorchard/starnet/issues/239

## Problem

Every reactive score holds a single sustained drone power-chord (root + perfect fifth, e.g.
`A2+E3`) for an entire run. It's monotonous — the same incessant pad start to finish. The
overworld **hub** ambient has the same problem and was specifically called out as needing more
variety.

## Goal

The always-present base `drone` layer occasionally shifts its power-chord to another diatonic
degree, so the harmonic bed slowly evolves. Deterministic per run seed, always consonant, no
gaps or clicks. Applies to **run scores and the hub** ambient.

## Scope divergence from the issue (approved by Les)

The issue says "the hub ambient stay as-is" and "scores without `root`/`mode` (hub) simply don't
wander." Les explicitly asked to **also vary the hub** — "we need more variety there" — and chose
to wander **both the drone and the Cmaj pad together** (the high `shimmer` stays as a static
anchor). So the hub opts into the same mechanism with two wander targets.

## Refinement of the issue's mechanism: diatonic transposition (not `chordForDegree`)

The issue sketched a `chordForDegree(root, mode, degree, octave)` power-fifth function. Wandering
the **pad** as well makes a cleaner primitive available: **diatonic transposition of each layer's
home chord by a shared scale-step offset δ**. This is what the engine actually uses.

- For the drone's power-fifth home (`A+E`), every allowed δ keeps it a **perfect fifth**; the one
  excluded offset (δ=1, landing the drone on `ii`) is exactly the one that would make it
  diminished — so the exclusion rule falls out naturally.
- For the pad's **triad** home (`C-E-G`), diatonic transposition keeps it a diatonic triad.
- Drone + pad planing together by the same δ yields a clean run of diatonic 7th chords —
  **Am7 → Cmaj7 → Dm7 → Em7 → Fmaj7 → G7** (δ = 0,2,3,4,5,6) — all consonant and functional, so
  moving the pad carries no clash risk. δ=0 reproduces the home sound (Am7) exactly.

## Approach

### 1. New pure module `js/audio/harmony.js` (Tone-free, unit-tested)

- `SCALES`: mode name → 7 semitone intervals from the root (`aeolian` `[0,2,3,5,7,8,10]`,
  `dorian` `[0,2,3,5,7,9,10]`, plus `phrygian`/`mixolydian`/etc. as the scores in play need).
- `scaleNotes(root, mode) → [7 spelled note names]` — spells the scale so transposition output
  matches the key's accidental style (flats for C dorian, sharps for F# scores).
- `transposeDiatonic(notes, root, mode, steps) → notes` — maps each input note to its scale
  degree + octave **by pitch class** (so `Bb` matches a flat-spelled scale tone), shifts by
  `steps` scale degrees with octave wrap, re-spells from `scaleNotes`. `steps = 0` is identity.
- `ALLOWED_STEPS = [0, 2, 3, 4, 5, 6]` — offsets that land the **drone** (home degree i) on
  `{i, III, iv, v, VI, VII}`; **excludes δ=1 (`ii`)**, the offset that would break the perfect fifth.
- `pickNextStep(rngFn, currentStep) → step` — equal weight over `ALLOWED_STEPS`, no immediate repeat.
- note-name ⟷ MIDI helpers (parse/emit `"Bb2"`, `"F#2"`, etc.).

### 2. Score data — add `root` + `mode`, mark wander targets

- All 8 Corporate variants + the hub get `root` (e.g. `"A"`) and `mode` (e.g. `"aeolian"`),
  derived from existing harmony. A unit test asserts `transposeDiatonic(drone.sustain, root, mode,
  0)` is the identity and that the drone fifth stays perfect across every allowed step.
- Mark wandering sustained layers with a `wander: true` flag on the layer spec:
  - Corporate scores: only `drone`.
  - Hub: `drone` **and** `pad`. (`shimmer` stays static.)
- A score with no `root`/`mode` (or no `wander` layers) does not wander — opt-in preserved.

### 3. Engine wander loop (`js/audio/engine.js`) — mirror section automation

- Independent seeded RNG: `makeSeededRng((getSeed()||"audio") + ":drone")` — deterministic per
  run, never touches gameplay RNG.
- In `buildLayer`, stash each wander layer's home notes (`layer.wanderHome = spec.sustain`).
- On `start()`, if the active score has `root && mode` and ≥1 `wander` layer:
  - `currentStep = 0`; `Tone.Transport.scheduleRepeat(wander, "${bars}m", "${bars}m")` every
    `score.droneBars ?? DRONE_BARS_DEFAULT` bars (bar-quantized, like sections; default tuned to 4).
- `wander()`: `currentStep = pickNextStep(rng, currentStep)`; for each wander layer, compute
  `transposeDiatonic(layer.wanderHome, root, mode, currentStep)` and on its `sustainSynth` call
  `triggerRelease(currentNotes)` + `triggerAttack(newNotes)`. All wander layers move by the same
  δ on the same tick. The drone synth's slow attack/release envelopes overlap → gapless morph.
- Teardown/cleanup mirrors section state: clear the scheduled id, null the rng, reset `currentStep`;
  re-init on the next `start()`.

### 4. Playground aid (optional, for ear-checking)

Add a "wander now" button (and/or a degree readout) to `js/audio/playground.js` /
`preview/audio.html` so the morph can be triggered on demand instead of waiting the bar interval.

## Out of scope

- The `tensionDrone` (threat layer, already threat-reactive) — untouched.
- Per-note sequenced layers, mixer gains, the two-axis model — untouched.
- Hand-authored alternate chord progressions (this is algorithmic from a scale model).

## Testing

- **`harmony.js` unit tests:** `transposeDiatonic` — `steps=0` is identity; every output note is
  in `scaleNotes(root, mode)`; the drone power-fifth stays exactly +7 semitones for every
  `ALLOWED_STEPS` entry; octave wrap is correct; flats/sharps spell per key. `scaleNotes` spells
  known scales correctly. `pickNextStep` never repeats immediately, only emits `ALLOWED_STEPS`,
  and is deterministic for a seeded rng.
- **Score-data invariant test:** for every score with `root`/`mode`, `transposeDiatonic(drone
  .sustain, root, mode, 0)` equals the drone `sustain`; the planed drone fifth is perfect across
  all allowed steps. (Confirms each score's `root`/`mode` actually matches its authored harmony.)
- **Engine test (headless-safe):** the wander step sequence is seeded/deterministic, never repeats
  immediately, never emits the `ii` offset — tested against `pickNextStep`, not Tone. (Tone calls
  themselves stay un-unit-tested; verified by ear.)
- `make check` green (lint + 1310+ tests).
- **Ear-check checkpoint with Les** in a live run + hub before merge — the one thing tests can't
  cover. Wander cadence (`DRONE_BARS_DEFAULT`, currently 4), envelope overlap feel, hub consonance against the Cmaj pad.

## Verification / done criteria

- A run's drone audibly shifts chords a few times over a typical run; the hub drifts in the
  overworld; both stay consonant and gapless.
- Same seed → same wander sequence (determinism preserved; gameplay RNG untouched).
- `make check` green; manual ear-check approved by Les; MANUAL.md / audio-direction.md updated.

## Notes

- Branch `music-drone-variation` off `main`; not part of event-SFX work (#229 / PR #237).
- `docs/audio-direction.md` is the music-subsystem reference; update its drone-layer row +
  deferred list to reflect that the drone now wanders (run + hub).
