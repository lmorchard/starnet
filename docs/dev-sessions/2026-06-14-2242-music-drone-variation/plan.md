# Plan — drone harmonic variation

TDD throughout for the pure module + score data. The Tone-touching engine wander is verified by
its pure helper (`pickNextStep`) in tests and by ear in the playground.

## Phase 1 — `js/audio/harmony.js` (pure, TDD)

1. Write `tests/audio/harmony.test.js` first (red):
   - `SCALES` has the modes the scores use.
   - `scaleNotes("A","aeolian")` → `["A","B","C","D","E","F","G"]`; `scaleNotes("C","dorian")` →
     `["C","D","Eb","F","G","A","Bb"]`; a sharp key (`F#`...) spells with sharps.
   - `transposeDiatonic(["A2","E3"],"A","aeolian",0)` === `["A2","E3"]` (identity).
   - `transposeDiatonic(["A2","E3"],"A","aeolian",2)` === `["C3","G3"]`; `...,6)` === `["G3","D4"]`.
   - For every `ALLOWED_STEPS` entry, the transposed `["A2","E3"]` is a perfect fifth (+7 semis)
     and both notes ∈ scale.
   - `transposeDiatonic(["C4","E4","G4"],"A","aeolian",2)` → `["E4","G4","B4"]` (triad planes).
   - `pickNextStep`: only emits `ALLOWED_STEPS`; never equals `currentStep`; deterministic per seed.
2. Implement `harmony.js` to green. Run `make lint` (it's `@ts-check`).

## Phase 2 — score data `root`/`mode` + `wander` flags (TDD)

1. Read each corporate variant's lead/bass notes to confirm mode (aeolian vs dorian vs phrygian).
   Record the mapping in notes.md.
2. Write `tests/audio/score-harmony.test.js` first (red): import every score; assert each has
   `root`+`mode`, `transposeDiatonic(drone.sustain, root, mode, 0)` === `drone.sustain`, and the
   planed drone fifth is perfect across all `ALLOWED_STEPS`.
3. Add `root`/`mode` to all 8 corporate scores + hub; add `wander:true` to the `drone` layer
   (all scores) and the hub `pad` layer. Green.

## Phase 3 — engine wander loop (`js/audio/engine.js`)

1. Stash `wanderHome`/`wander` in `buildLayer` for flagged sustained layers.
2. Add wander state (`droneRng`, `droneTimerId`, `currentStep`) mirroring the section state; init
   in `start()` (gated on `score.root && score.mode` && ≥1 wander layer), tear down in `teardown()`.
3. `wander()`: `pickNextStep` → `transposeDiatonic` each wander layer's home → `triggerRelease`
   old + `triggerAttack` new on its `sustainSynth`; track current notes per layer.
4. `make check` green (engine has no new unit test beyond `pickNextStep`; it's `@ts-nocheck`).

## Phase 4 — playground ear-check aid

1. Add a "Wander now" button (+ current-step/chord readout) to `js/audio/playground.js` /
   `preview/audio.html` that calls a small engine hook to force a wander tick immediately.
2. Keep it playground-only (like `setMuted`/`setSectionsEnabled`).

## Phase 5 — ear-check + docs

1. **Checkpoint with Les:** `make serve`, listen in a live run and in the hub. Tune `droneBars`
   and confirm the morph feel + hub consonance (esp. static shimmer vs the planing pad). Adjust
   constants only.
2. Update `MANUAL.md` (drone now evolves) and `docs/audio-direction.md` (drone-layer row +
   deferred list: drone wander shipped for run + hub).
3. `make check` green; write notes.md summary.

## Risks / watch-items

- **Note spelling** across keys (flats vs sharps) — covered by `scaleNotes` + pitch-class matching.
- **Teardown leak** — the new `scheduleRepeat` id must be cleared like `sectionTimerId` (the repo
  has a prior run-start timer-leak regression; mirror the section cleanup exactly).
- **Determinism** — `:drone` stream only; never call gameplay RNG. Same seed → same wander.
- **Static shimmer** in the hub may add mild upper tension on Dm7/Fmaj7 — note for the ear-check;
  fallback is to wander or drop it (cheap follow-up, not blocking).
- Headless safety unchanged (engine isn't imported by headless entry points).
