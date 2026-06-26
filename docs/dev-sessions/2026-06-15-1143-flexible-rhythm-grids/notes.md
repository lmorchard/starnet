# Notes — Flexible rhythm grids + step modifiers

## What shipped

- **`js/audio/rhythm.js`** (pure, 10 unit tests): `GRID_STEPS`, `stepsPerBar`, `expectedSteps`,
  `normalizeStep`, `ratchetOffsets`, `shouldFire`.
- **`engine.js`**: one `playStep(trigger, step, time, grid)` helper now backs all three Sequence
  callbacks (drums/poly/mono) — seeded `:rhythm` prob gate, ratchet sub-hits, velocity threading.
  `rhythmRng` set up in `start()`, reset in `teardown()` (mirrors the drone-wander rng lifecycle).
- **Scores**: `bars` field added to all 9 existing scores + hub (all `bars: 4`, sound unchanged).
  `audio-scores-all` now derives length from `bars × stepsPerBar` and normalizes object steps
  before validating notes/tokens.
- **3 showcase scores** (pool 8 → 11): Glitch (ratchet/prob/vel funk drums, A dorian), Chip
  (32n square arps, A aeolian), Cipher (8t triplet lead 3-against-4, D dorian).

## Decisions

- Shared loop length (no polymeter); synthesis-only (no sample slicing — "amen/fast-break" = the
  rhythmic *style* on synth drums). `prob` re-rolls every loop (seeded → deterministic per run).

## Verification

- `make check` green (1462 tests, 10 new in `audio-rhythm`).
- Browser smoke (Playwright): all 3 new scores play, 0 console errors, **no "Max polyphony
  exceeded"** even with dense 32n ratchets — voice pool stays bounded.

## Observed (pre-existing, NOT fixed here)

- Tone logs "Events scheduled inside of scheduled callbacks should use the passed in scheduling
  time" — traced to the #239 drone-wander's `triggerRelease`/`triggerAttack` inside its
  `scheduleRepeat` callback (they don't pass the scheduled `time`). Cosmetic timing jitter on the
  chord morph; pre-existing on merged `main`. Candidate tidy-up: pass `time` through `wanderDrone`.
  `playStep` itself uses the passed-in `time` correctly.
- The "BiquadFilterNode channel count changes" warnings are routine Tone routing noise (voices
  connecting to the master filter), unrelated to this change.

## Revised during ear-check

- **Punchier snare** (global, `drumVoices`): added a `MembraneSynth` body transient (~D3) under
  the noise crack; Les then tuned the decays longer (noise/​body sustain+decay).
- **Per-layer whole-bar loop lengths**: Les authored an 8-bar `basePerc` phrase in Glitch over its
  4-bar groove. Rather than force uniformity, relaxed the all-scores length check from
  `== bars × stepsPerBar` to "a positive multiple of `stepsPerBar`" (whole bars). Engine already
  loops each Sequence independently, so a longer phrase cycles against the rest — a constrained
  whole-bar polymeter. `score.bars` is now the *nominal* loop (also only ever read by the test/docs,
  not the engine). Docs updated.

## Still pending

- **Les's ear-check** — do the 3 scores sound good? Is `prob` every-loop the right feel? Ratchet
  timing/voicing clean at 32n? Tune by ear in `preview/audio.html` (scores in the selector).
