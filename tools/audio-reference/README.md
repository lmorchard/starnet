# audio-reference

Analyze a reference track (MP3/FLAC/…) into a technical breakdown keyed to a
**Tone.js synthesis vocabulary** — built to bridge an AI assistant's no-audio gap when
authoring Tone.js synth music. Combo of deterministic MIR (librosa + optional
basic-pitch) and a Gemini-via-Vertex "ears" pass.

The output is Tone.js-centric and reusable beyond any single project: the interpretation
is organized as **tracks** — each one an *instrument* (a Tone.js source, or a described
custom-synthesis approach) driven by a *pattern* — with track names the model invents to
fit the analyzed piece. That makes it equally useful for drafting a new score and for
informing *new* Tone.js instruments.

## Setup

Requirements: Python ≥3.11, [uv](https://docs.astral.sh/uv/), `ffmpeg`, and Google
Cloud ADC.

```bash
# system dep
#   macOS:  brew install ffmpeg
#   Fedora: sudo dnf install ffmpeg
#   Debian: sudo apt install ffmpeg

uv sync --extra dev                       # create env + install deps (core MIR + Gemini)
gcloud auth application-default login     # one-time ADC setup
cp .env.example .env                      # then edit: set GOOGLE_CLOUD_PROJECT / LOCATION
```

Project/location resolve in this order: CLI flag → environment → `.env` (cwd + parents)
→ gcloud config default (inside the google-genai client). The `.env` file is gitignored;
`.env.example` is the template. You can also `export GOOGLE_CLOUD_PROJECT` /
`GOOGLE_CLOUD_LOCATION` or pass `--project` / `--location` instead.

### Optional: MIDI transcription (`--extra midi`)

The MIDI riff sketch uses `basic-pitch`, a heavy ML dependency kept out of the core
install. Enable it with:

```bash
uv sync --extra midi --extra dev
```

> **Caveat:** `basic-pitch` pulls `tensorflow`, which currently ships **no cp312 wheel on
> macOS** (cp311 only). If `--extra midi` fails to resolve, either run the tool on Python
> 3.11 (`uv python pin 3.11 && uv sync --extra midi`) or just skip MIDI and use `--no-midi`.
> The core breakdown (measured facts + vocabulary grid + tracks + score draft) does not
> need it; `mir._midi` guards the import so a missing install degrades gracefully.

## Usage

```bash
uv run audio-reference analyze ~/music/icabod.flac --artist "TR/ST" --title "Icabod"
#   → docs/trst-icabod.md   docs/trst-icabod.json   docs/trst-icabod.mid

# flags
--out DIR          output dir (default: ./docs)
--no-midi          skip basic-pitch transcription (lighter/faster; also the fallback
                   if the `midi` extra isn't installed)
--model NAME       Gemini model (default: gemini-2.5-pro)
--project / --location   Vertex overrides (else env / gcloud config)
```

## Output

- `docs/<slug>.md`   — the breakdown: measured facts (MIR ground truth) + 7-dimension
  vocabulary grid + a **tracks** table (track / instrument / pattern / notes) + a
  speculative score draft.
- `docs/<slug>.json` — meta + raw MIR + the model's structured interpretation.
- `docs/<slug>.mid`  — basic-pitch transcription (only with the `midi` extra, unless `--no-midi`).

## Tests

```bash
uv run pytest -v      # pure modules only (render, keyest, slug, transcode, prompt, config)
```

The I/O boundaries (ffmpeg, librosa extraction, Gemini call) are not unit-tested;
verify them by running `analyze` on a real track.
