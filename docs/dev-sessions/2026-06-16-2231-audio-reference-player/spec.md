# Audio Reference Player — Design Spec

**Session:** 2026-06-16-2231-audio-reference-player
**Status:** Approved design — ready for implementation plan
**Builds on:** `2026-06-16-2114-audio-reference-analyzer` (the analyzer tool + Tone.js tracks model)

## Problem

The analyzer (`tools/audio-reference/`) produces a per-track breakdown whose most
actionable output is the speculative **score-draft** — but it's *read*, not *heard*.
Claude can't listen, and Les has to mentally audition Tone.js code to judge whether the
interpretation is any good. We want to close the loop: hand the artifact to a browser and
**hear an approximation of the analyzed piece**, so the interpretation can be judged by
ear and iterated.

A second, equal goal surfaced during design: Starnet's music engine today is centered on
one composition with a **fixed layer taxonomy** (`drone`/`basePerc`/…/`urgencyArp`), a
two-axis `progress`/`threat` structure, and a **narrow instrument set** (`kind: drums|poly`
plus a few oscillator types). Les wants to **expand** it. A player driven by a *generalized*
score format — open tracks, the full Tone.js instrument palette — turns every analyzed
reference into a concrete, audible proposal for what the expanded engine should support.

## Goals

- **Primary:** play a generated artifact in the browser — hear an approximation of the
  reference piece — so the interpretation is judged by ear and iterated.
- **Secondary:** make the artifact carry a **generalized, engine-shaped score-spec** (open
  tracks + full instrument palette) that doubles as a worked proposal for expanding Starnet's
  music engine.
- **Tertiary:** keep the raw `score_draft` as the *beyond-the-engine* inspiration layer —
  it can express synthesis (LFO-on-filter, distortion chains, FM modulation) the structured
  spec doesn't yet model.

## Background: how Starnet's engine consumes a score today

A score is already declarative data (`js/audio/scores/corporate.js`):

```js
export const CORPORATE_SCORE = {
  root: "A", mode: "aeolian", bpm: 120,
  masterFilter: { cutoffLo: 600, cutoffHi: 8600, qLo: 0.7, qHi: 4.7 },
  layers: [
    { key: "bass", axis: "progress", lo: 0.1, hi: 0.35, pattern: bass,
      synth: { type: "square", attack: 0.01, decay: 0.25, sustain: 0.3, release: 0.2, volume: -6 } },
    { key: "progArp", axis: "progress", grid: "16n", pattern: progArp,
      synth: { type: "sawtooth", attack: 0.005, ... } },
    // ...
  ],
};
// pattern = token array on a grid: "A1" note · ["A3","C4","E4"] chord · "hat"/"snare"/"C1" drums · null = rest
```

`js/audio/engine.js` interprets each layer into `new Tone.Sequence(handler, spec.pattern, grid)`.
The player mirrors this **shape** (declarative track = synth + pattern) but **not** its
limits: no fixed `key` taxonomy, no `axis`/`lo`/`hi` reactive gating, and an open instrument
palette instead of `kind: drums|poly`.

## Design

### 1. Data — enrich each track with a playable layer

Each `track` in the LLM interpretation keeps its existing prose fields and gains two
structured, schema-validated fields:

```jsonc
{
  "name": "Growl Bass",                         // existing
  "instrument": "Distorted MonoSynth, 2 detuned saws, LFO on lowpass",  // existing prose
  "pattern": "driving 1/8 root notes, side-chained",                    // existing prose
  "description": "...",                          // existing prose
  "synth": {                                    // NEW — playable
    "type": "MonoSynth",                        // ∈ palette (whitelist)
    "options": { "oscillator": { "type": "fatsawtooth", "count": 2, "spread": 40 },
                 "envelope": { "attack": 0.01, "decay": 0.1, "sustain": 0.2, "release": 0.2 },
                 "volume": -6 }
  },
  "steps": {                                    // NEW — playable
    "grid": "16n",                              // Tone subdivision
    "notes": ["E2","E2",null,"E2","G2", ...]    // null = rest · string = note · [..] = chord
  }
}
```

The **score-spec** the harness plays is `{ root, mode, bpm, tracks }` where `root`/`mode`/
`bpm` come from the MIR facts and `tracks` are the enriched tracks. A **pure (unit-tested)
function assembles it from `(mir, interpretation)`**, and the CLI writes it as a top-level
`score_spec` key in the JSON sidecar (alongside the existing `meta`/`mir`/`interpretation`).
The harness reads `json.score_spec` directly — it does no re-derivation. No separate parallel
structure — the playable data lives on the track it describes.

**Instrument palette (whitelist).** The `synth.type` must be one of the known Tone.js
sources the harness can construct: `Synth, MonoSynth, DuoSynth, FMSynth, AMSynth, PolySynth,
MembraneSynth, MetalSynth, NoiseSynth, PluckSynth`. (`Sampler`/`Player`/`GrainPlayer` need
audio assets — out of scope for v1; a track whose prose instrument is sample-based emits the
nearest synth approximation in `synth`, noted in its prose.)

### 2. Harness — one reusable page, not per-track HTML

A single self-contained page under `tools/audio-reference/player/` (e.g. `index.html` +
`player.js`), Tone.js loaded from a CDN. It is **not** generated per track — artifacts stay
pure data (`.md`/`.json`); the player is one reusable tool.

- **Load:** a file picker (`<input type=file>` + `FileReader`) reads a `docs/<slug>.json`
  from disk. Zero-server: works opened directly via `file://`, no fetch/CORS.
- **Build:** for each track, `new Tone[synth.type](synth.options)` → routed to a master
  `Tone.Gain` (optionally through a shared `Tone.Reverb`). `synth.type` is validated against
  the palette whitelist; an unknown type is skipped with a visible warning. **No `eval`** —
  the harness only ever calls known Tone constructors with plain-data options.
- **Schedule:** each track's `steps.notes` drives a `Tone.Sequence` at `steps.grid`. A small
  per-type trigger adapter handles signature differences (`NoiseSynth` has no pitch;
  `MembraneSynth`/melodic synths take a note; `PolySynth` takes note-or-chord).
- **Controls:** global play/stop (starts/stops `Tone.Transport`), tempo display (`bpm`),
  and per-track **mute/solo**. Loops the score-spec's bar length.
- **Safety:** type whitelist + data-only options. The harness never executes the raw
  `score_draft` (that stays display-only in the doc).

### 3. Prompt — extend, don't replace

`prompt.py` + `RESPONSE_SCHEMA` gain the per-track `synth` (`type` + free-form `options`
object) and `steps` (`grid` + `notes` array) alongside the existing prose. The raw
`score_draft` field is unchanged. The prompt instructs the model to make `synth.type` a
palette member and to render `steps.notes` as a concrete, loopable token array on a stated
grid, consistent with the prose pattern.

### 4. Testing

- **Pure / unit-tested:** the score-spec assembly (interpretation + MIR → `{root, mode, bpm,
  tracks}`), the `synth.type` palette validator/whitelist, and any token-array normalization.
  `RESPONSE_SCHEMA` gains assertions for the new `synth`/`steps` shapes (mirrors existing
  prompt tests).
- **Render:** `render.py` gains nothing required, but may surface `synth.type`/`grid` in the
  tracks table; covered by `test_render`.
- **I/O boundary (validated by ear):** the harness JS is exercised against the two existing
  corpus tracks (Icabod, Silent Shout) — load the `.json`, press play, confirm it produces
  plausible sound. Not unit-tested.

## Out of scope (v1)

- A `play` convenience subcommand (serve `docs/` + open browser). Easy follow-up; the
  file-picker harness needs no server.
- `Sampler`/`Player`/`GrainPlayer` (sample assets) and arbitrary effects chains beyond a
  shared reverb.
- Re-emitting Starnet engine score files (`js/audio/scores/*.js`) from the spec — the spec
  is *inspiration/proposal*, not codegen, in v1.
- The reactive two-axis (`progress`/`threat`) gating — the player is a static demo.

## Iteration plan

Spec → plan → execute → **iterate by ear**. The first listen on Icabod/Silent Shout is the
validation point (mirroring the analyzer's first-run gate): regenerate those two tracks with
the extended prompt, load them in the harness, and tune the prompt's `synth`/`steps`
instructions and the harness's trigger adapters until the playback is a recognizable
approximation.
