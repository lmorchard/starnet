# Audio Reference Analyzer — Design Spec

**Session:** 2026-06-16-2114-audio-reference-analyzer
**Status:** Approved design — ready for implementation plan

## Problem

Claude (the AI assistant collaborating on Starnet's procedural music) **cannot hear
audio**. The Tone.js scores in `js/audio/scores/` are authored entirely in
synthesis/music terms through a shared technical vocabulary (see
`docs/audio-direction.md`). When Les wants to draw on a real reference track for
inspiration — e.g. "Icabod" (TR/ST), "Silent Shout" (The Knife), "Systemagic"
(Goldfrapp) — there's no bridge: Claude can't listen to it, and describing it by hand
is lossy.

This tool closes that gap: hand it an audio file (MP3/FLAC/etc.), and it produces a
**technical breakdown keyed to a Tone.js synthesis vocabulary** — accurate enough that
Claude can translate it toward a `js/audio/scores/*.js` draft, and detailed enough that
Les learns concrete technical facts about the track he can tweak from.

> **Reframe (post-review):** the breakdown's vocabulary is **Tone.js-centric and
> reusable beyond Starnet**, not keyed to Starnet's own score model. The interpretation
> is organized as **tracks** — each an *instrument* (a Tone.js source, or a custom
> synthesis approach) driven by a *pattern* — with track names **invented to fit the
> analyzed piece** rather than chosen from a fixed taxonomy. This makes the output useful
> for inventing *new* Tone.js instruments, not just mapping onto existing Starnet layers.
> See the "Plan Revision" section in `plan.md` for the concrete data shapes.

## Goals

- **Primary:** power **LLM-assisted score drafts** — output that maps onto our score
  model (root/mode, bpm, layer breakdown, the 7-dimension vocabulary grid).
- **Secondary:** give Les real measured technical detail (BPM, key, structure, a MIDI
  riff sketch) for his own learning and hand-tweaking.
- **Tertiary:** build a **reference corpus** — consistently-shaped docs we can diff
  across tracks and cite from score files.

Optimize for **Claude at the keyboard**; the other two consumers fall out of the same
artifact.

## Approach

A **combo** tool (chosen over LLM-only): deterministic Music Information Retrieval (MIR)
extracts ground-truth facts, which are fed *into* the LLM call to anchor it. The LLM
("ears") narrates timbre/arrangement that MIR can't; MIR supplies the hard facts the LLM
would otherwise hallucinate (BPM, key, structure). Neither half alone is sufficient.

Implemented as a **self-contained Python tool** under `tools/audio-reference/`, written
to be **spinoff-ready** (own README, deps, docs/corpus — does not reach into the parent
Starnet repo's structure). The 7-dimension vocabulary it targets is general
synthesis language, so it travels if the tool is extracted later.

## Pipeline

```
input.flac/mp3
   │
   ├─[transcode]─→ 16kHz mono temp  ───────────────┐  (for Gemini; under Vertex's ~20MB inline cap)
   │                                                │
   ├─[MIR] (on ORIGINAL file)                       │
   │     librosa:  BPM, key/mode (chroma→Krumhansl-Schmuckler),
   │               beat grid, section boundaries,
   │               spectral centroid (brightness) curve, RMS (dynamics) curve
   │     basic-pitch:  audio → MIDI riff sketch (optional, --no-midi)
   │              │                                 │
   │              └──── measured facts (dict) ──────┤
   │                                                ▼
   └──────────────────────────────────→ [Gemini / Vertex call]
                  audio + measured facts + target vocabulary + response schema
                                                │
                                   structured JSON interpretation
                                                │
                       [render] ── MIR facts + LLM JSON → templated Markdown
                                                │
              docs/<slug>.md   +   docs/<slug>.json   +   docs/<slug>.mid
```

**Key architectural choice** (mirrors the game's own audio philosophy — pure data/logic
split from the I/O boundary): **Gemini returns structured JSON, not prose.** The
Markdown is rendered from a template merging MIR ground-truth + the LLM's structured
interpretation. This keeps every track's doc consistently shaped, makes the rendering
layer pure and unit-testable, and gives the JSON sidecar both the measured data and the
model's interpretation.

## Why these tool choices

- **Gemini via Vertex AI + ADC** — Claude/Claude API can't take audio input, so the
  "ears" must be an external audio-capable model. Gemini is strongest at audio
  description. Vertex + Application Default Credentials matches how Les normally accesses
  Gemini — no API-key management. The unified `google-genai` SDK supports
  `genai.Client(vertexai=True, project=…, location=…)` reading ADC automatically.
- **16 kHz mono transcode before sending** — primarily a size guard for the 20 MB inline cap,
  not a quality lever. Per Google's audio docs, Gemini downsamples to a low ("16 Kbps")
  resolution, downmixes multiple channels to one, and represents each second as **32 tokens** —
  so a high-rate stereo file gives it nothing extra (it reduces to mono/low-res itself). That
  coarse 32-tokens/sec representation — not our transcode — is what limits fine-timbre fidelity.
  MIR still runs on the full-quality original. See https://ai.google.dev/gemini-api/docs/audio
- **librosa + Krumhansl-Schmuckler** — librosa has no built-in key detector; we compute
  key/mode from the chroma vector against Krumhansl-Schmuckler major/minor profiles
  (a standard recipe).
- **basic-pitch is the heaviest dep** (pulls an ML runtime). Made **optional via
  `--no-midi`** so the core MIR+LLM path stays light.

## Module layout

```
tools/audio-reference/
  README.md              — setup (uv, ffmpeg, gcloud ADC), usage
  pyproject.toml         — deps, uv-managed
  audio_reference/
    cli.py               — arg parsing + orchestration (the I/O boundary)
    transcode.py         — ffmpeg → 16kHz mono
    mir.py               — librosa + basic-pitch → measured-facts dict
    gemini.py            — Vertex client (ADC), audio + prompt → structured JSON
    prompt.py            — prompt template + response schema + the vocabulary grid
    render.py            — (pure) facts + LLM JSON → Markdown
    schema.py            — the output data shapes
  docs/                  — generated corpus (tracked in git — it's the point)
  tests/                 — unit tests for the pure bits
```

## CLI

```bash
# from tools/audio-reference/
uv run audio-reference analyze ~/music/icabod.flac --artist "TR/ST" --title "Icabod"
#   → docs/trst-icabod.md   docs/trst-icabod.json   docs/trst-icabod.mid

# flags
--artist / --title       metadata (also derives the <slug>)
--out DIR                override output dir (default: ./docs)
--no-midi                skip basic-pitch (lighter, faster)
--model NAME             override Gemini model (default: gemini-2.5-pro)
--project / --location   Vertex overrides (else env / gcloud config)
```

## Config & auth

- **ADC** — no keys. `gcloud auth application-default login` is the one-time setup
  (documented in README).
- Project/location resolution order: CLI flag → env (`GOOGLE_CLOUD_PROJECT`,
  `GOOGLE_CLOUD_LOCATION`) → `gcloud config` default.
- Default model `gemini-2.5-pro`; overridable via `--model`.

## Output artifact (per track)

1. **Markdown doc** (`docs/<slug>.md`) — the human + Claude artifact:
   - **Header:** artist/title, plus **measured facts** (BPM, key/mode, duration, section
     map) explicitly flagged as *MIR ground-truth* vs. the model's *interpretation*.
   - **7-dimension vocabulary grid** from `audio-direction.md`, filled in: timbre,
     brightness, envelope, register/density, harmony/mode, groove, space/grit.
   - **Layer-by-layer breakdown** mapped to our score model (drone / perc / bass / lead /
     backup / arp / tension) — what each layer is doing.
   - **Score-draft starter:** concrete Tone.js-flavored suggestions (osc types, ADSR,
     filter, note arrays). Most speculative section (the model guessing synth params from
     a description); kept in v1, flagged as speculative, iterate after seeing results.
2. **JSON sidecar** (`docs/<slug>.json`) — raw MIR data (chroma, tempo, segment
   boundaries, spectral curves) + the LLM's structured interpretation + path to the MIDI.
3. **MIDI** (`docs/<slug>.mid`) — basic-pitch transcription (unless `--no-midi`).

## Dependencies

- Python ≥3.11, **`uv`**-managed via `pyproject.toml` (no pip/requirements.txt).
- `google-genai`, `librosa`, `numpy`, `soundfile`, `basic-pitch` (optional-heavy).
- **System:** `ffmpeg` (transcode) — documented in README, not pip-installable.

## Testing

Mirrors the game's "test the pure parts, keep the I/O boundary thin":

- **Unit-test the pure modules:** `render.py` (golden Markdown from a fixed facts+JSON
  fixture), key-estimation math in `mir.py`, slug derivation, prompt/schema assembly.
- `transcode.py` / `gemini.py` / basic-pitch are thin I/O boundaries — verified manually
  against a real track on the first run, not unit-tested.
- `pytest` for the pure bits (documented in README).

## Validation / first-run phase

The **first real run is itself the validation step.** Run on one reference track (e.g.
"Icabod"), read the output together, then iterate the prompt + artifact shape. The
artifact shape above is a v1 starting point explicitly expected to change once we see
real output.

## Out of scope (v1)

- Batch processing of many tracks at once (one track per invocation for now).
- Auto-generating actual committed `.js` score files (the tool produces *drafts/notes*,
  not game code).
- Non-Gemini LLM backends (Vertex/Gemini only for v1).
- Caching / re-analysis dedup.

## Reference tracks (initial corpus targets)

"Problems" (Ghost Cop), "Icabod" (TR/ST), "Systemagic" (Goldfrapp), "Silent Shout"
(The Knife), "Step Forward" (Kite), "Dressed for Space" (TR/ST), "Stripdown" (Agent Side
Grinder).
