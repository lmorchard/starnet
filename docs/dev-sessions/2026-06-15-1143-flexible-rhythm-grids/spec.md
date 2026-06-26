# Spec — Flexible rhythm grids + step modifiers

## Problem

Music score patterns are too lock-step. Two coupled limitations:

1. **Grid/length is hardcoded by convention.** Each layer's `Tone.Sequence` clocks one pattern
   element per `grid` step (default `8n`, arps override `16n`). The pattern *length* is just the
   literal array length (32 for 8n, 64 for 16n), tied to "4 bars" only implicitly — duplicated
   across every pattern/score and enforced solely by magic numbers (`32`/`64`) in
   `tests/audio-scores-all.js`. Nothing lets a layer use a finer/odd grid cleanly.
2. **No per-step expressiveness.** A step is only a note / chord / perc token / rest, all at fixed
   velocity. Can't author rolls, stutters, ghost notes, or glitchy non-repetition.

Authoring goals this unlocks: glitchy funky drums, amen/fast-break-style synthesized drum
patterns (intricate kicks, ghost snares, fast hat rolls — **not** sample chopping), old-school
chiptune fast arpeggios, more complex melodic rhythms.

## Decisions (from brainstorm)

- **Shared nominal loop length per score**, but layers may run **longer whole-bar loops** (revised
  during execution — see notes.md). A pattern length must be a whole number of bars; a layer can
  loop longer than the score's `bars` (e.g. an 8-bar drum phrase over a 4-bar groove) and cycle
  independently — a constrained, whole-bar polymeter. Free (non-integer-bar) polymeter stays out.
- **No samples.** "Amen/fast-break" = the *rhythmic style* on the existing synthesized drum
  voices, not `Tone.Player` slicing. Synthesis-over-stems principle holds.
- **`prob` re-rolls every loop** (seeded → deterministic per run), for the glitch/non-repeat feel.
- **YAGNI:** polymeter, sample playback, swing/micro-timing, Euclidean/generative fills,
  conditional triggers — all explicitly out; easy to add later atop this.

## Design

### 1. Source of truth: `bars` × `stepsPerBar`

Score gains a `bars` field (shared loop length). Per-layer `grid` stays; `stepsPerBar` is derived
from the grid, so the magic 32/64 lengths disappear and any grid becomes usable per layer:

```js
export const SCORE = {
  bpm: 120,
  bars: 4,                              // shared loop length (source of truth)
  layers: [
    { key: "bass", grid: "16n", pattern: [/* 4 × 16 = 64 */] },
    { key: "hats", grid: "32n", pattern: [/* 4 × 32 = 128 */] },   // now possible
    { key: "arp",  grid: "16t", pattern: [/* triplets, 4 × 24 */] }, // now possible
  ],
};
```

Expected pattern length `= bars × stepsPerBar(grid)`; the all-scores test asserts this **derived**
value instead of hardcoded 32/64.

### 2. New pure module `js/audio/rhythm.js` (Tone-free, unit-tested)

The testable logic, kept out of the Tone layer (mirrors `harmony.js`):

- `GRID_STEPS` — steps-per-bar per grid name in 4/4: `8n`→8, `16n`→16, `32n`→32, `4n`→4,
  `8t`→12, `16t`→24, etc.
- `stepsPerBar(grid)` and `expectedSteps(bars, grid)` (= `bars × stepsPerBar`).
- `normalizeStep(step) → { value, ratchet, prob, vel } | null`. `value` is the note/chord/token;
  accepts the legacy plain forms (string / chord array / token / `null`) and the new object form.
  `ratchet` defaults 1, `prob` defaults 1, `vel` defaults null (voice default).
- `ratchetOffsets(cellSeconds, n) → number[]` — evenly-spaced sub-hit time offsets within a cell.
- `shouldFire(prob, rngFn) → boolean` — `prob >= 1` always true (no rng draw); else `rngFn() < prob`.

### 3. Step format (backward-compatible superset)

A step stays `null` | `"A4"` | `["A3","C4"]` | perc token. **New optional object form:**

```js
{ note: "C2", ratchet: 4 }    // 4 fast evenly-spaced hits in the cell — rolls/stutter/fills/chip buzz
{ note: "snare", prob: 0.6 }  // fires 60% of loops — glitchy non-repeat (seeded)
{ note: "snare", vel: 0.35 }  // ghost note (velocity)
```

`note` may be a single note, a chord array, or a perc token; modifiers compose (`{note,ratchet,prob,vel}`).

### 4. Engine (`engine.js`)

- Import `rhythm.js`. The three `Tone.Sequence` callbacks (drums / poly / mono) route each step
  through one `playStep(triggerFn, step, time, grid, rng)` helper:
  - `normalizeStep`; if `value == null` → rest.
  - `shouldFire(prob, rng)` → skip if it doesn't.
  - `ratchetOffsets(Tone.Time(grid).toSeconds(), ratchet)` → trigger the voice at `time + offset`
    for each (with `vel` if set). Plain steps (ratchet 1, prob 1, no vel) keep today's single hit.
- `prob` rng: one seeded stream per score, `makeSeededRng(getSeed()+":rhythm")` (independent of
  gameplay RNG, like the drone wander). Advanced per object-step occurrence.
- Velocity threads into `triggerAttackRelease(note, dur, time, vel)` for pitched voices; drum
  voices take `vel` too but keep their own fixed hold times (`dur` is ignored for drums).

### 5. Three new showcase scores (corporate biome)

Each is a full score (the 9 canonical `LAYER_KEYS`, `root`/`mode`, `wander` drone) exercising the
features, added to `BIOME_SCORES.corporate` (pool 8 → 11):

- **Glitchy funky drums** — fine-grid (16n/32n) perc with `ratchet` rolls, `prob` ghost-note
  stutter, `vel` dynamics; syncopated funk kick/snare. (e.g. "Corporate — Glitch".)
- **Chiptune arps** — 32n (or `ratchet`-buzzed) square/pulse arpeggios, fast NES-style. ("— Chip".)
- **Clever melody** — a syncopated, finer-grid lead with off-beat phrasing and a couple of
  `ratchet` flourishes. ("— Cipher" or similar.)

### 6. Backward compatibility

Existing 8 scores: add `bars: 4` (one line each). Their grids (8n/16n) + lengths (32/64) already
equal `4 × stepsPerBar`, so they validate unchanged and sound identical. Plain-token steps never
touch the object path.

## Testing

- **`rhythm.js` unit tests:** `stepsPerBar`/`expectedSteps` for each grid; `normalizeStep` for
  every legacy + object form; `ratchetOffsets` spacing; `shouldFire` thresholds + determinism.
- **`audio-scores-all` updates:** assert length `= expectedSteps(bars, grid)` (drop magic 32/64);
  the well-formedness note-validator normalizes object steps before validating the underlying
  note/token; bump score count 8 → 11; names unique.
- **Per-score harmony invariant** (existing #239 test) covers the 3 new scores' `root`/`mode`.
- `make check` green.
- **Ear-check with Les** (the part tests can't cover): do the new rhythms sound good; is `prob`
  every-loop the right feel; ratchet timing clean. Via `preview/audio.html` (scores in selector).

## Out of scope

Polymeter, sample/slice playback, swing/micro-timing, Euclidean/generative fills, conditional
triggers. The bot/census are unaffected (audio is browser-only; headless never loads the engine).
