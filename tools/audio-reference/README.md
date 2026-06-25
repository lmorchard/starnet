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

### Stem-separated analysis (`--stems`)

```bash
uv sync --extra stems                       # one-time: installs demucs + torch (heavy)
uv run audio-reference analyze track.mp3 --artist A --title T --stems
#   --stems-model htdemucs_ft   (default; or htdemucs_6s for piano/guitar stems)
```

Separates the track into stems (drums / bass / vocals / other) and analyzes **each in isolation**,
so Gemini characterizes one instrument at a time instead of the blended mix (the full mix is heard
at a coarse 32 tokens/sec — see the transcode note above). Near-empty stems are skipped. The merged
`docs/<slug>.json` keeps the same `score_spec` shape (each track tagged with its `stem`), so the
player works unchanged. Costs ~one Gemini call per non-empty stem. Single-pass remains the default.

## Output

- `docs/<slug>.md`   — the breakdown: measured facts (MIR ground truth) + 7-dimension
  vocabulary grid + a **tracks** table (track / instrument / pattern / notes) + a
  speculative score draft.
- `docs/<slug>.json` — meta + raw MIR + the model's structured interpretation.
- `docs/<slug>.mid`  — basic-pitch transcription (only with the `midi` extra, unless `--no-midi`).

## Play a result (browser harness)

Each artifact's JSON carries a `score_spec` — a generalized, engine-shaped score
(`{root, mode, bpm, tracks}`, each track an instrument + a step pattern). To hear an
approximation of the analyzed piece:

```bash
uv run audio-reference play          # serves player/ + docs/ at http://127.0.0.1:8777/player/
                                     # (prints the URL; does NOT open a browser)
```

Open the printed URL, click a track in the **Library** list, and press **Play**. Toggle
per-track **Mute**/**Solo** to inspect the arrangement.

**Tweak instruments live.** Each track card exposes its synth type + options (oscillator,
ADSR, filter, drive, chorus, reverb send, FM harmonicity/modIndex, …). Changing a control
rebuilds that track in place so you hear it immediately. Hit **Save** to write the tweaked
`score_spec` back to `docs/<slug>.json` (the served `play` endpoint does this; the
file-picker / `file://` path is read-only). Hand-tuned tracks become authored — re-running
`analyze` on them would overwrite the tweaks.

The library is driven by `docs/index.json`, a manifest that `analyze` refreshes
automatically; rebuild it by hand with:

```bash
uv run audio-reference index         # rescans docs/*.json -> docs/index.json
```

You can also open `player/index.html` directly over `file://` and use the **file picker**
(the library list needs the served manifest, but the picker works without a server).

The harness loads Tone.js from a CDN and only constructs instruments from a fixed palette
(`Synth`, `MonoSynth`, `FMSynth`, `MetalSynth`, `NoiseSynth`, …) — it never executes the raw
`score_draft` from the Markdown (that stays a read-only reference). Sample-based sources
(`Sampler`/`Player`) are out of scope for now; those tracks emit a nearest-synth approximation.

## Tests

```bash
uv run pytest -v      # pure modules only (render, keyest, slug, transcode, prompt, config)
```

The I/O boundaries (ffmpeg, librosa extraction, Gemini call) are not unit-tested;
verify them by running `analyze` on a real track.
