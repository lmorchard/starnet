# Plan — Flexible rhythm grids + step modifiers

TDD on the pure module + score-data tests. The Tone-touching `playStep` is verified by its pure
helpers (`rhythm.js`) in tests and by ear in the playground (browser-only, like the drone wander).

## Phase 1 — `js/audio/rhythm.js` (pure, TDD)

1. Write `tests/audio-rhythm.test.js` first (red):
   - `stepsPerBar`: `8n`→8, `16n`→16, `32n`→32, `4n`→4, `8t`→12, `16t`→24; unknown grid throws.
   - `expectedSteps(4, "16n")` → 64; `expectedSteps(4, "8n")` → 32 (proves the old magic numbers).
   - `normalizeStep`: `null`→null; `"A4"`→{value:"A4",ratchet:1,prob:1,vel:null};
     `["A3","C4"]`→ chord value; `"snare"`→ token value; `{note:"C2",ratchet:4}`→ ratchet 4;
     `{note:"snare",prob:0.6,vel:0.35}` → prob/vel set; object with no `note` throws.
   - `ratchetOffsets(0.5, 1)`→`[0]`; `ratchetOffsets(0.5, 4)`→`[0,0.125,0.25,0.375]`.
   - `shouldFire(1, throwingRng)`→true (no draw); `shouldFire(0.6, ()=>0.5)`→true,
     `shouldFire(0.6, ()=>0.7)`→false; deterministic for a given rng sequence.
2. Implement `rhythm.js` to green. `make lint` (it's `@ts-check`).

## Phase 2 — engine integration (`engine.js`)

1. Import `rhythm.js`; add a `_rhythmRng = makeSeededRng(getSeed()+":rhythm")` set up in `start()`,
   reset in `teardown()` (mirror the drone-wander rng lifecycle).
2. Add `playStep(trigger, step, time, grid)`: normalize → `shouldFire` gate → for each
   `ratchetOffsets` entry call `trigger(value, time+offset, vel)`. Plain steps stay a single hit.
3. Route the three Sequence callbacks through it:
   - drums: `trigger=(tok,t,vel)=>` map token → kick/snare/hat `triggerAttackRelease(..., t, vel)`.
   - poly + mono: `trigger=(note,t,vel)=> s.triggerAttackRelease(note, grid, t, vel)`.
4. `make check` green (engine is `@ts-nocheck`; no new unit test beyond rhythm.js).

## Phase 3 — `bars` + test refactor (TDD-ish)

1. Update `tests/audio-scores-all.test.js` first: replace hardcoded `32`/`64` length checks with
   `assert.equal(byKey[k].pattern.length, expectedSteps(score.bars, byKey[k].grid || "8n"))` for
   every pattern layer; make the note-validator `normalizeStep` each element before validating;
   assert `score.bars` is a positive int. Run → red (scores lack `bars`).
2. Add `bars: 4` to all 8 existing scores + the hub. Green; sounds identical (verified by ear later).

## Phase 4 — three showcase scores

Author as full corporate-biome scores (9 canonical `LAYER_KEYS`, `root`/`mode`, `wander` drone),
registered in `js/audio/scores/index.js` (pool 8 → 11). Bump the "8 scores" assertion → 11.

1. **`corporate-glitch.js`** — glitchy funky drums: 16n/32n perc, `ratchet` hat/snare rolls, `prob`
   ghost-note stutter, `vel` funk dynamics; syncopated kick. Other layers minimal/supportive.
2. **`corporate-chip.js`** — chiptune: 32n square/pulse fast arps (lead/progArp), `ratchet` buzz,
   tight NES envelopes; simple driving bass/perc.
3. **`corporate-cipher.js`** — clever melody: syncopated finer-grid lead with off-beat phrasing +
   a couple `ratchet` flourishes; restrained backing so the melody reads.

Each: derive `root`/`mode` to match its authored harmony (passes the #239 invariant test); confirm
pattern lengths satisfy `expectedSteps`.

## Phase 5 — ear-check + docs

1. **Checkpoint with Les:** `make dev`, audition the 3 new scores + spot-check an existing score is
   unchanged. Tune feel; confirm `prob` every-loop is right; ratchet timing clean.
2. Update `docs/audio-direction.md` (rhythm grids + step modifiers; the 3 new scores) and any
   score-count mention. `MANUAL.md` only if player-facing behavior changed (it doesn't, really —
   internal authoring).
3. `make check` green; notes.md summary.

## Risks / watch-items

- **`audio-scores-all` is strict** — exact 9 `LAYER_KEYS` per score, well-formed notes/tokens. New
  scores must define all 9 layers; the note-validator must normalize object steps or it rejects them.
- **Velocity arg position** — `MembraneSynth`/`NoiseSynth`/`Synth` `triggerAttackRelease` take
  velocity as the trailing arg; confirm per voice when wiring `playStep`.
- **Ratchet at fast grids** — many sub-hits on a 32n cell = dense retriggers; watch CPU and the
  param-recycle path (sequenced voices already recycle; ratchets add events within a cell, pruned
  on recycle). Spot-check in the browser.
- **Determinism** — `:rhythm` stream only; never gameplay RNG. Same seed → same glitch pattern.
- Headless safety unchanged (engine not imported by headless entry points).
