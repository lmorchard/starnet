# Spec — Soundfont authoring/deployment seam + cull build-step

**Issue:** [#277](https://github.com/lmorchard/starnet/issues/277)
**Base branch:** `retire-tonejs` (carries the Strudel runtime, `soundfont.js`, and the
authoring prebake #274). Rebase onto `main` once `retire-tonejs` lands.
**Date:** 2026-07-01

## Problem

The game ships one vendored soundfont — GeneralUser GS, 32 MB — and loads all 287 of its
presets. But the shipped `.strudel` songs reference only about three of them
(`gus_synth_bass_1`, `gus_warm_pad`, `gus_tine_electric_piano`); the rest of each song is
built from Strudel's own oscillators (`sawtooth`, `square`, `triangle`) and drum samples
(`bd`, `sd`, `hh`), which are not in the soundfont at all. We ship 32 MB to use three presets.

Two needs pull in opposite directions:

- **Authoring** wants a *wider* palette. Composition is in early exploration; more instruments
  on hand is directly useful now.
- **Deployment** wants a *narrower* one. Players should download only what the songs use.

The resolution is to stop treating "the soundfont" as one artifact. Separate the **authoring
font** (rich, large, in flux) from the **deployment font** (culled, tiny, shipped), and add a
reproducible build step that distills the former into the latter.

## Findings that shape the design

- **The runtime parser cannot read `.sf3`.** Loader chain: `soundfont.js` → `@strudel/soundfonts`
  → `sfumato` → `soundfont2`. `sfumato` reads samples as raw Int16 PCM; `soundfont2` is a pure
  uncompressed-SF2 parser with no Ogg/Vorbis/zlib path. A compressed `.sf3` cannot be loaded at
  runtime and cannot be culled without first decompressing it to `.sf2`. This confines `.sf3` to a
  one-time conversion input, never a runtime or build dependency.
- **`soundfont2` reads but does not write SF2.** It parses to a structured object (metadata,
  preset/instrument/sample tables, Int16 sample data). Emitting a pruned font means writing our
  own SF2 serializer. That serializer is the main risk in this work.
- **Sound registration is fully under our control.** `soundfont.js` walks `sf.presets` and
  registers each under a `gus_*` name. A strict-subset font resolves identically as long as the
  names match — so a culled deployment font is transparent to songs.
- **The palette is deliberately in flux.** The cull must handle a moving target: re-scan usage on
  every build, never freeze a hand-maintained list.

## Aesthetic vector (initial, not locked)

The game's sound leans **techno, synthpop, EBM, postpunk, darkwave**, plus a grab-bag of
**new-age and alien-sounding** instruments. Not classical; probably not rock, except perhaps a few
ironic heavy-metal guitars. This is an initial direction, not a fixed palette.

Implications for this work (it does not change the tooling, which is genre-agnostic):

- We will only ever use a **thin slice of any General MIDI font** — the GM synth-lead / pad / FX
  range (presets ~80–103: leads, pads, "atmosphere", "sci-fi", "goblins" — the alien/new-age
  grab-bag), a few electric pianos and synth basses, and at most one distortion guitar. The
  orchestral / acoustic / ethnic bulk that dominates a GM font's size is exactly what we cull.
  **The cull's payoff is therefore larger for this game than for a general music tool.**
- Future font picks (beyond this arc) should lean toward dedicated electronic / analog-synth SF2s
  rather than more GM sets. The manifest + cull make adding them trivial. Out of scope here.

## Goals

1. **Seam.** Decouple authoring font from deployment font so authoring-palette size no longer
   affects what players download.
2. **Cull.** A reproducible Node build step (a `make` target) that tree-shakes each authoring SF2
   down to only the presets songs reference, re-scanning usage each run.
3. **Multi-font, non-fungible.** A manifest keyed by prefix (`gus_`, `msg_`), each font culled
   independently; prefixes never aliased across sets.
4. **Vendor MuseScore_General** as a second authoring font (`msg_`), proving the seam and cull
   end-to-end across N fonts and widening the authoring palette immediately.

## Non-goals

- Strudel's own drum/oscillator sounds (`bd`/`sd`/`hh`, `sawtooth`) — not in any SF2; a separate
  runtime-fetch concern. Noted, not addressed here.
- CI automation of the cull beyond a `make` target. Wire into CI later.
- A general-purpose SF2 editor. The writer only needs to emit a valid pruned subset that
  `soundfont2` re-parses and the runtime plays.
- Runtime `.sf3` support.

## Architecture

### Soundfont manifest

`audio-content/soundfonts/manifest.js` — the single source of truth for which fonts exist and
where their two forms live:

```js
[
  {
    prefix: "gus_",
    authoringPath: "audio-content/soundfonts/GeneralUser-GS.sf2",
    deployPath:    "audio-content/soundfonts/GeneralUser-GS.deploy.sf2",
    license:       "audio-content/soundfonts/GeneralUser-GS.LICENSE.txt",
    allow: [],   // escape hatch: preset names to keep even if the scanner misses them
  },
  { prefix: "msg_", authoringPath: "…/MuseScore_General.sf2", deployPath: "…/MuseScore_General.deploy.sf2", license: "…", allow: [] },
]
```

### Generalized loader (the seam) — `js/audio/strudel/soundfont.js`

Today `soundfont.js` hardcodes one URL and prefix. Generalize it to loop the manifest:

- For each entry, prefer `deployPath`, else fall back to `authoringPath`. In the browser
  "exists" means a successful fetch: attempt `deployPath`, and on a fetch failure (404 in dev,
  where no deploy font has been built) fall back to `authoringPath`. One extra failed request in
  dev is acceptable; revisit with an explicit manifest flag only if that proves noisy.
- Register that font's presets under its `prefix` exactly as today.
- Consequence: dev/authoring with the large authoring font present locally gets the full palette;
  prod/CI ships only the small committed deploy font. Same names either way → songs unaffected.

### SF2 writer — `js/audio/soundfont/sf2-writer.js` (pure module)

Takes a pruned structured object (the shape `soundfont2` produces, minus dropped presets) and
serializes it to an SF2 `ArrayBuffer`. Pure and unit-testable. This is the hard part; see below.

### Cull script — `scripts/cull-soundfonts.js` + `make cull-soundfonts`

For each manifest entry:
1. Scan used sounds (below).
2. Parse the authoring SF2 with `soundfont2`.
3. Prune the reachable graph to used presets → their instruments → their samples; remap indices.
4. Serialize with `sf2-writer` to `deployPath`.
5. Log kept/dropped preset counts and before/after bytes. No silent truncation.

### Usage scanner (inside the cull script)

Union of:
- Tokens matching `<prefix>\w+` in `audio-content/songs/*.strudel`.
- The same across `js/audio/strudel/data/*` (drones and cues also name soundfont sounds).
- The manifest `allow` list, for any names built dynamically that a static scan cannot see.

Map each found name back to a preset via the inverse of `sanitize()` in `soundfont.js`. Emit the
kept set and the dropped set to the log.

## Data flow

- **Authoring / dev:** browser loads the authoring SF2 (large font present locally) → all presets
  registered → compose freely across the wide palette.
- **Build:** `make cull-soundfonts` → scan songs+data → per font, emit the minimal SF2 to
  `deployPath` → commit the deploy fonts.
- **Runtime / prod:** `soundfont.js` prefers `deployPath`; names identical → songs resolve
  unchanged.

## The SF2 writer — detail and risk

`soundfont2` gives us `metaData` (INFO), preset/instrument/sample tables, and Int16 `sampleData`.
The writer must:

- **Prune** the reachable graph: kept presets → referenced instruments → referenced samples;
  remap all index references (`instrument`, `sampleID`, bag ranges).
- **Serialize** `RIFF/sfbk`:
  - `LIST INFO` — version + metadata (carried through; bump/annotate as culled).
  - `LIST sdta` — `smpl` (Int16 PCM). Drop any 24-bit `sm24` chunk (force 16-bit).
  - `LIST pdta` — `phdr`, `pbag`, `pmod`, `pgen`, `inst`, `ibag`, `imod`, `igen`, `shdr`.
- **Get the fiddly bits right** (each a known SF2-spec footgun):
  - Terminal sentinel records: `EOP` (phdr), `EOI` (inst), `EOS` (shdr).
  - 46 zero-samples of padding between samples, with recomputed `start`/`end`/`startLoop`/
    `endLoop` offsets into the compacted `smpl` block.
  - Monotonically increasing bag indices in `phdr`/`inst`.

**Validation is the honesty gate.** After writing, reparse the output with `soundfont2` and assert
the kept preset names are present and orphans are gone. A writer that "runs" but emits a file the
runtime rejects is a failure, not a partial success. Where feasible, headlessly trigger a note per
kept preset to confirm playback.

### Risk

The writer is bounded but genuinely fiddly. If it proves deeper than expected, the fallback is a
one-time manual Polyphone pass to produce the deploy fonts (a stopgap, not the deliverable) while
the writer is finished — but the goal is the reproducible build step, not the manual ritual.

## MuseScore_General vendoring (`msg_`)

**Sourcing model:**
- **Authoring input** = uncompressed MuseScore_General `.sf2`, kept **local + gitignored**, fetched
  from a permissive host (reusing the prebake's existing fetch-the-font pattern). Produced via a
  one-time `sf3convert` if no clean `.sf2` host exists. Not committed — the uncompressed font is
  ~150–200 MB.
- **Committed to the repo** = only the small **culled deploy `.sf2`** (the `msg_` presets songs
  use) plus its MIT `LICENSE`.
- Apply the same gitignore-the-authoring-font model to `gus_` for consistency (GeneralUser GS at
  32 MB is small enough to keep committed too; unify under the manifest either way).

**Verification tasks** (the issue flags both as recollection, not audited):
- Confirm the MuseScore_General **MIT license** text and vendor it alongside the deploy font.
- Confirm a **CORS-fetchable host** for the authoring `.sf2` (or the `.sf3` + conversion path).

## Testing

- **Unit — `sf2-writer`:** round-trip a tiny hand-built structure (parse → write → reparse,
  assert equality of presets/instruments/samples). Prune keeps the referenced graph, drops orphans.
- **Integration — real cull:** cull the 32 MB GeneralUser GS to its ~3 used presets → reparse with
  `soundfont2` → assert the `gus_` names survive, others gone, output ≪ 32 MB.
- **Guard — scanner:** catches every `gus_`/`msg_` token across songs + data; `allow` honored;
  drop-list logged.
- **Seam:** loader prefers `deployPath` when present, falls back to `authoringPath` otherwise.

## Sequencing

1. **Seam** — manifest + generalized `soundfont.js` with `deployPath → authoringPath` fallback.
   Game behavior unchanged (no deploy fonts yet → falls back to authoring).
2. **Usage scanner** — songs + data + `allow`, with logged kept/dropped sets.
3. **SF2 writer + cull script** — the hard part; prove it on `gus_` (32 MB → ≪ 1 MB) with the
   round-trip validation.
4. **`make cull-soundfonts`** target.
5. **Vendor MuseScore_General** — sourcing + license/host verification + `msg_` manifest entry +
   cull; end-to-end N-font proof.

## Open questions / risks

- SF2 writer depth (mitigation above).
- Whether a clean uncompressed `.sf2` host for MuseScore_General exists, or we must run
  `sf3convert` once locally.
- Shared samples across GM presets mean cull savings are sublinear in preset count — still a large
  win when whole instrument families go unused, but worth measuring the actual output size.
