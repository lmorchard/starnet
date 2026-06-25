# Stem-Aware Analysis (Tier 1) + Richer MIR (Tier 3) — Design Spec

**Session:** 2026-06-17-1718-stem-aware-analysis
**Status:** Approved design — ready for implementation plan
**Builds on:** the audio-reference analyzer + player (PR #242)

## Problem

The analyzer sends the **full mix** to Gemini, which (per Google's audio docs) hears it as
mono at a coarse **32 tokens/second**. So instrument timbres come back blurry and the player's
approximations "don't really sound like" the source — confirmed not to be our 16 kHz transcode
(that matches what Gemini consumes anyway) but a property of analyzing a *blended* mix at low
resolution. We want Gemini to characterize **one instrument at a time**, and to hand it more
**measured timbre facts** it can't hear well, so the generated `synth.options` start closer to
the real sound.

Two complementary moves:
- **Tier 1 — stem separation:** split each track into stems and analyze each in isolation.
- **Tier 3 — richer MIR:** add deterministic spectral-timbre features to the measured facts.

## Goals

- **Primary:** per-instrument Gemini analysis (via stems) → tracks whose `synth`/`steps` reflect
  one isolated instrument, not a blend.
- **Secondary:** richer measured-timbre facts (rolloff, flatness, contrast, ZCR, attack time,
  harmonic/percussive ratio) anchoring `synth.options` where Gemini's ears are weak.
- **Tertiary:** keep the existing single-pass path and the whole player/library/tweaker working
  unchanged.

## Non-goals (v1)

- **Individual synth-layer separation** — no current model isolates pad vs. lead vs. arp; the
  synth layers stay blended in the `other` stem. (The unsolved problem; we accept it.)
- Auto-tuning instruments from stem analysis (the tweaker stays the human-in-the-loop step).
- The prompt-feedback loop (hand-tuned exemplars → prompt) — separate future work.
- Non-Demucs separators.

## Approach

A second, **opt-in** analysis mode. The default `analyze` is unchanged (full-mix MIR + one
Gemini call). `--stems` enables separation + per-stem analysis; `--stems-model` (default
`htdemucs_ft`) selects the Demucs model.

### Data flow (`--stems`)

```
input.mp3/flac
   │
   ├─[full-mix MIR]──────────────► root, mode, bpm, sections   (global anchor; native rate)
   │
   └─[separate (Demucs)]─────────► { drums, bass, vocals, other } wav files
         │
         for each stem with RMS energy above the gate:
            ├─[per-stem MIR]──────► per-stem facts + Tier 3 timbre features
            ├─[transcode]─────────► 16 kHz mono wav
            └─[Gemini]────────────► tracks for THIS isolated stem (prompt: "you hear only {stem}")
         │
   [assemble] root/mode/bpm (full mix) + union of per-stem tracks (each tagged `stem`)
         │
   docs/<slug>.md (grouped by stem) + docs/<slug>.json (per-stem interps + merged score_spec)
```

- **Energy gate:** a stem whose RMS is below a small fraction of the loudest stem's RMS is
  treated as empty and skipped (no MIR/transcode/Gemini). Avoids wasted calls on, e.g., an
  empty piano stem. Threshold tuned by feel; logged when a stem is skipped.
- **Vocals** are analyzed like any stem — these references use vocals as texture/lead, so the
  model emits a "vocal texture" track (it just won't get a perfect synth match; that's fine).
- **Per-song cost:** Demucs is local/free; Gemini is ~one call per non-empty stem (≈3–4). Opt-in,
  so no surprise cost on the default path.

### Why these choices

- **Demucs / `htdemucs_ft`** (4-stem: drums/bass/vocals/other) — best-quality 4-stem model. The
  6-source model (`htdemucs_6s`) adds piano+guitar, which are its *weakest, least-tested* stems
  and nearly empty for synth-based references; it adds no synth stem. Model is a flag so 6s can
  be A/B'd by ear, but `ft` is the default.
- **Opt-in `--stems`** — separation + per-stem Gemini multiplies cost/time; the default path stays
  cheap and unchanged.
- **Reuse `extract_mir` per stem** — a stem is just an audio file; the same MIR runs on it.

## Module layout (extends the existing pure/IO split)

```
audio_reference/
  separate.py   (I/O, NEW)   — Demucs wrapper: separate(path, out_dir, model) -> {stem: wav_path}.
                               Lazy/guarded import; optional [stems] dep (torch+demucs).
  mir.py        (modify)     — extract_mir gains Tier 3 features (rolloff/flatness/contrast/zcr/
                               attack_time/harmonic_ratio); unchanged signature, richer dict.
  features.py   (pure, mod)  — summarizer helpers for the new features (e.g. attack_time, harmonic
                               ratio) — unit-tested.
  prompt.py     (pure, mod)  — surface the Tier 3 facts in the existing build_prompt (so single-
                               pass benefits too) + add build_stem_prompt(meta, mir, stem) with
                               isolation framing. RESPONSE_SCHEMA unchanged.
  scorespec.py  (pure, mod)  — assemble_stems(meta, mir_global, stem_results) -> sidecar with a
                               merged score_spec (per-stem tracks tagged `stem`) + per-stem interps.
  schema.py     (modify)     — Track gains optional `stem`; a StemResult/StemAnalysis shape.
  render.py     (pure, mod)  — group the tracks table by stem when stems were used.
  cli.py        (I/O, mod)   — --stems / --stems-model; orchestrate separate -> per-stem -> assemble.
```

## Data shapes

- `MirFacts` gains a `timbre` block: `{ rolloff_hz, flatness, contrast, zcr, attack_sec,
  harmonic_ratio }` (all floats; flatness/harmonic_ratio in 0..1).
- `Track` gains optional `stem: str` (e.g. "drums", "bass", "other", "vocals"; absent in
  single-pass mode).
- The JSON sidecar in stems mode gains `stems: [{ stem, mir, interpretation }]` alongside `meta`,
  the full-mix `mir`, and the merged `score_spec`. (Single-pass sidecar is unchanged.)

## Dependencies

- New optional extra `[stems] = ["demucs>=4.0", "torch>=2.0"]` (heavy; torch ships cp312 wheels,
  so unlike `basic-pitch`/`[midi]` this should resolve on the project's Python). `separate.py`
  guards the import and errors clearly if `--stems` is used without it installed.

## Testing

Pure logic is unit-tested; the heavy I/O boundary is verified on a real run.

- **Pure / unit-tested:** the Tier 3 feature summarizers (`features.py`), `assemble_stems`
  (merge + `stem` tagging + global root/mode/bpm), `build_stem_prompt` (mentions isolation + the
  stem name + the new measured facts; schema unchanged), render grouping by stem.
- **I/O boundary (manual):** `separate.py` (Demucs) and the per-stem fan-out in `cli.py` — verified
  on a real track on the first `--stems` run (the validation/iteration point), like the original
  Gemini/ffmpeg boundaries.

## Validation / first-run

First real `--stems` run on one reference (e.g. Kontravoid or Agent Side Grinder — dense synth
material) is the validation step: confirm stems separate, each non-empty stem yields sensible
tracks, the assembled score_spec plays in the player, and the per-stem isolation audibly improves
the instrument match vs. the single-pass version. Iterate the energy gate + stem-prompt from there.

## Compatibility

The merged `score_spec` keeps its shape (`{root, mode, bpm, tracks}`); the only addition is the
optional per-track `stem` tag, which the player/library/tweaker ignore today (and could later use
to group cards). The save-back endpoint, manifest, and tweaker are unaffected.
