# audio-reference

Analyze a reference track (MP3/FLAC/…) into a technical breakdown plus **playable
[Strudel](https://strudel.cc) code** — built to bridge an AI assistant's no-audio gap when
authoring reactive synth music. Combo of deterministic MIR (librosa + optional basic-pitch)
and a Gemini-via-Vertex "ears" pass.

The interpretation is organized as **tracks** — each one an *instrument* driven by a
*pattern*, with names the model invents to fit the piece. Each track also carries a
**`strudel`** field: one idiomatic Strudel pattern expression, authored from a curated,
version-pinned reference and validated headlessly before write. The Strudel code is the
editable source of truth (no compiler) — generate once, then tweak it by hand in the player.

> The prose interpretation layer (summary, 7-dimension vocabulary, instrument/pattern/description)
> uses Tone.js source names as a familiar *timbre vocabulary*; the **playable** output is Strudel.
> The legacy Tone-shaped `score_spec` (`synth`/`steps`) is retired from the analyzer but its player
> is preserved (see "Play a result").

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

(cd validator && npm install)             # one-time: the headless Strudel validator (node)
```

The `validator/` directory is a small node package (`@strudel/* 1.2.5`, pinned — `1.2.6`
breaks under node ESM) that `analyze` shells out to, transpiling each generated `strudel`
pattern and querying one cycle to confirm it evaluates. If node or `validator/node_modules`
is absent, validation degrades to a warning (the analysis still completes).

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
  vocabulary grid + a **tracks** table + **per-track Strudel code blocks** + a speculative
  score draft.
- `docs/<slug>.json` — meta + raw MIR + the model's structured interpretation + a
  `score_spec` whose tracks each carry a playable `strudel` pattern (a track the validator
  couldn't evaluate is tagged `_strudel_valid: false` and flagged in the `.md`).
- `docs/<slug>.mid`  — basic-pitch transcription (only with the `midi` extra, unless `--no-midi`).

## Play a result (browser harness)

Each artifact's JSON carries a `score_spec` (`{root, mode, bpm, tracks}`, each track an
instrument + a `strudel` pattern). To hear an approximation of the analyzed piece:

```bash
uv run audio-reference play          # serves player/ + docs/ at http://127.0.0.1:8777/player/
                                     # (prints the URL; does NOT open a browser)
```

Open the printed URL, click a track in the **Library** list, and press **Play** — the player
layers every un-muted track's `strudel` into one `stack(...)` and runs it via
[`@strudel/web`](https://strudel.cc). Toggle per-track **Mute**/**Solo** to inspect the
arrangement; tempo follows the track's BPM (`.cpm(bpm/4)`, treating one cycle as one bar).

**Tweak patterns live.** Each track card is an editable **Strudel code box** — edit the
pattern and it re-plays (or hit **Cmd/Ctrl+Enter** in the box). Hit **Save** to write the
edited per-track `strudel` back to `docs/<slug>.json` (the served `play` endpoint does this;
the file-picker / `file://` path is read-only). The code is the source of truth — re-running
`analyze` regenerates it, overwriting hand edits.

The library is driven by `docs/index.json`, a manifest that `analyze` refreshes
automatically; rebuild it by hand with:

```bash
uv run audio-reference index         # rescans docs/*.json -> docs/index.json
```

You can also open `player/index.html` directly over `file://` and use the **file picker**
(the library list needs the served manifest, but the picker works without a server).

The harness loads `@strudel/web` from a CDN; it runs only the per-track `strudel` patterns and
never executes the raw `score_draft` from the Markdown (that stays a read-only reference).

**Legacy Tone player.** The previous Tone.js player is preserved at `player/tone-player.html`
(served alongside the Strudel one) for replaying the pre-Strudel, Tone-shaped `score_spec`
artifacts. It's reference-only — the analyzer no longer emits that format.

## Tests

```bash
uv run --extra dev pytest -q   # pure modules (render, prompt, scorespec, save, strudel_reference, validate, …)
```

The Strudel validator tests skip automatically when node / `validator/node_modules` is
absent. The I/O boundaries (ffmpeg, librosa extraction, Gemini call) are not unit-tested;
verify them by running `analyze` on a real track.
