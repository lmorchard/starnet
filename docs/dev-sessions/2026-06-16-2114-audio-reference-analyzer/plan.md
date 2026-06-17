# Audio Reference Analyzer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-contained Python CLI under `tools/audio-reference/` that analyzes a reference track (MP3/FLAC) and emits a technical breakdown — keyed to Starnet's audio vocabulary — to bridge Claude's no-audio gap when drafting Tone.js scores.

**Architecture:** A 4-stage pipeline (transcode → MIR extract → Gemini interpret → render). Deterministic MIR (librosa + basic-pitch) supplies ground-truth facts that anchor a Gemini/Vertex "ears" call; Gemini returns **structured JSON**, and a **pure** render layer merges MIR facts + LLM JSON into a templated Markdown doc + JSON sidecar + MIDI. Pure logic (slug, key-estimation, render, prompt assembly, config resolution) is unit-tested; the thin I/O boundaries (ffmpeg, librosa extraction, Gemini call) are verified manually on the first real run.

**Tech Stack:** Python ≥3.11, `uv` + `pyproject.toml`, `google-genai` (Vertex + ADC), `librosa`, `numpy`, `soundfile`, `basic-pitch` (optional), `ffmpeg` (system), `pytest`.

---

## Plan Revision — Tone.js-centric "tracks" model (post-review)

> Added after review, before implementation. **Where this section conflicts with Tasks 3, 4, or 8 below, this section wins.** It restates the interpretation model only; the pipeline, file layout, and all non-`layers` tasks are unchanged.

**Direction (from review):**
1. Keep the tool's vocabulary **Tone.js-centric and reusable beyond Starnet** — not keyed to Starnet's score model. Starnet is one consumer.
2. The output should be able to **inform building new Tone.js instruments**, not just map onto existing ones — so a "custom synthesis approach" is a valid `instrument` answer.
3. The breakdown must be free to **invent names/roles that fit the analyzed piece** — no fixed taxonomy, no presence checklist.
4. Think in terms of **tracks**, not "layers": a **track** is one **instrument** driven by one **pattern**.

**Revised interpretation shape** — `LlmInterp.layers` is replaced by `LlmInterp.tracks`:

```
Track = {
  "name": str,         # invented label that fits THIS piece (e.g. "sub bass", "shimmer pad", "noise riser")
  "instrument": str,   # a Tone.js source (palette below) OR a short "custom synthesis" description
  "pattern": str,      # the figure driving it: subdivision/step rhythm, note movement, density, phrase length, dynamics
  "description": str,  # arrangement role, when it enters, space/FX
}
```

There is **no `present` flag** — the array enumerates the tracks actually heard. There is **no fixed role list**.

**Tone.js source palette** (named in the prompt as vocabulary, not a hard constraint — "custom" descriptions allowed):
`Synth, MonoSynth, DuoSynth, FMSynth, AMSynth, PolySynth, MembraneSynth, MetalSynth, NoiseSynth, PluckSynth, Sampler, Player, GrainPlayer`.

**Per-task overrides:**
- **Task 3 (schema):** replace the `Layer` TypedDict with `Track` (`name`/`instrument`/`pattern`/`description`); `LlmInterp` has `tracks: list[Track]` (not `layers`).
- **Task 4 (render):** the layer table becomes a **Tracks** table with columns `Track | Instrument | Pattern | Notes`. Tests assert on instrument names + pattern text, not a present/absent flag.
- **Task 8 (prompt):** drop the fixed Starnet `_LAYER_ROLES` list. Instruct the model to enumerate every distinct track it hears, **invent** a fitting name per track, name its Tone.js source (palette or custom), describe the **pattern** driving it, and describe its arrangement role. `RESPONSE_SCHEMA` carries `tracks` (items required: `name`, `instrument`, `pattern`, `description`) instead of `layers`. The 7-dimension vocabulary grid and the Tone.js score-draft are unchanged.

Terminology: the analyzed song is "the reference piece"; within the breakdown a "track" is an arrangement channel (instrument + pattern). Prompt/headers use "instrument tracks" where confusion is possible.

---

## File Structure

```
tools/audio-reference/
  README.md                      — setup (uv, ffmpeg, gcloud ADC), usage
  pyproject.toml                 — deps + console script, uv-managed
  .gitignore                     — ignore transcode temp / __pycache__ / .venv
  audio_reference/
    __init__.py
    slug.py        (pure)        — artist/title → filesystem slug
    schema.py      (pure)        — TypedDicts for MIR facts + LLM interpretation + meta
    render.py      (pure)        — (meta, mir, llm) → Markdown string
    keyest.py      (pure)        — Krumhansl-Schmuckler key/mode estimation from chroma
    transcode.py   (I/O)         — ffmpeg arg builder (pure) + runner
    mir.py         (I/O)         — librosa + basic-pitch → MIR facts dict
    prompt.py      (pure)        — build_prompt(meta, mir) + RESPONSE_SCHEMA + vocabulary
    gemini.py      (I/O)         — Vertex client (ADC); audio + prompt + schema → dict
    config.py      (pure)        — resolve project/location from flag → env
    cli.py         (I/O)         — arg parsing + pipeline orchestration
  docs/                          — generated corpus (tracked in git)
  tests/
    test_slug.py
    test_render.py
    test_keyest.py
    test_transcode.py
    test_prompt.py
    test_config.py
```

**Data shapes** (defined in `schema.py`, used everywhere — match these names exactly):

- `Meta`: `{ "artist": str, "title": str, "slug": str, "source_file": str, "model": str }`
- `MirFacts`: `{ "bpm": float, "key": str, "mode": str, "key_confidence": float, "duration_sec": float, "sections": list[{"start": float}], "brightness": {"mean_hz": float, "min_hz": float, "max_hz": float}, "dynamics": {"rms_mean": float, "rms_range_db": float}, "midi_path": str | None }`
- `LlmInterp`: `{ "summary": str, "vocabulary": {"timbre": str, "brightness": str, "envelope": str, "register_density": str, "harmony_mode": str, "groove": str, "space_grit": str}, "layers": list[{"role": str, "present": bool, "description": str}], "score_draft": str }`

All three are plain JSON-serializable dicts (TypedDict for documentation only — no runtime validation library in v1).

---

## Task 1: Project scaffold

**Files:**
- Create: `tools/audio-reference/pyproject.toml`
- Create: `tools/audio-reference/.gitignore`
- Create: `tools/audio-reference/audio_reference/__init__.py`
- Create: `tools/audio-reference/tests/__init__.py`

- [ ] **Step 1: Create `pyproject.toml`**

```toml
[project]
name = "audio-reference"
version = "0.1.0"
description = "Analyze a reference track into a technical breakdown keyed to a synthesis vocabulary."
requires-python = ">=3.11"
dependencies = [
    "google-genai>=1.0.0",
    "librosa>=0.10.2",
    "numpy>=1.26",
    "soundfile>=0.12",
    "basic-pitch>=0.4.0",
]

[project.optional-dependencies]
dev = ["pytest>=8.0"]

[project.scripts]
audio-reference = "audio_reference.cli:main"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["audio_reference"]
```

- [ ] **Step 2: Create `.gitignore`**

```gitignore
__pycache__/
*.pyc
.venv/
.pytest_cache/
*.egg-info/
# transcode scratch
*.16k.wav
```

- [ ] **Step 3: Create empty package markers**

Create `audio_reference/__init__.py` containing:
```python
"""Audio reference analyzer — reference track → technical breakdown."""
```
Create `tests/__init__.py` as an empty file.

- [ ] **Step 4: Verify the environment resolves**

Run: `cd tools/audio-reference && uv sync --extra dev`
Expected: a `.venv` is created and dependencies resolve without error. (This downloads librosa/basic-pitch — may take a minute. If `basic-pitch` fails to resolve on this platform, note it and continue; Task 7 guards the import.)

- [ ] **Step 5: Commit**

```bash
git add tools/audio-reference/pyproject.toml tools/audio-reference/.gitignore tools/audio-reference/audio_reference/__init__.py tools/audio-reference/tests/__init__.py
git commit -m 'Scaffold audio-reference Python tool (uv + pyproject)'
```

---

## Task 2: Slug derivation (pure)

**Files:**
- Create: `tools/audio-reference/audio_reference/slug.py`
- Test: `tools/audio-reference/tests/test_slug.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_slug.py
from audio_reference.slug import slugify


def test_basic_artist_title():
    assert slugify("TR/ST", "Icabod") == "trst-icabod"


def test_spaces_and_case():
    assert slugify("Agent Side Grinder", "Stripdown") == "agent-side-grinder-stripdown"


def test_collapses_punctuation_and_runs():
    assert slugify("The Knife!!", "Silent  Shout") == "the-knife-silent-shout"


def test_strips_leading_trailing_hyphens():
    assert slugify("  Goldfrapp  ", "  Systemagic  ") == "goldfrapp-systemagic"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tools/audio-reference && uv run pytest tests/test_slug.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'audio_reference.slug'`

- [ ] **Step 3: Write minimal implementation**

```python
# audio_reference/slug.py
"""Pure: artist + title → a filesystem-safe slug."""
import re


def slugify(artist: str, title: str) -> str:
    raw = f"{artist} {title}".lower()
    # non-alphanumerics become hyphen separators
    s = re.sub(r"[^a-z0-9]+", "-", raw)
    return s.strip("-")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tools/audio-reference && uv run pytest tests/test_slug.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add tools/audio-reference/audio_reference/slug.py tools/audio-reference/tests/test_slug.py
git commit -m 'Add slug derivation for audio-reference'
```

---

## Task 3: Data shapes (schema)

**Files:**
- Create: `tools/audio-reference/audio_reference/schema.py`

(No test — TypedDicts are documentation-only, exercised by the render/prompt tests.)

- [ ] **Step 1: Write `schema.py`**

```python
# audio_reference/schema.py
"""TypedDict shapes for the pipeline's JSON-serializable data (documentation only)."""
from typing import TypedDict, Optional


class Meta(TypedDict):
    artist: str
    title: str
    slug: str
    source_file: str
    model: str


class Brightness(TypedDict):
    mean_hz: float
    min_hz: float
    max_hz: float


class Dynamics(TypedDict):
    rms_mean: float
    rms_range_db: float


class Section(TypedDict):
    start: float


class MirFacts(TypedDict):
    bpm: float
    key: str
    mode: str
    key_confidence: float
    duration_sec: float
    sections: list[Section]
    brightness: Brightness
    dynamics: Dynamics
    midi_path: Optional[str]


class VocabularyGrid(TypedDict):
    timbre: str
    brightness: str
    envelope: str
    register_density: str
    harmony_mode: str
    groove: str
    space_grit: str


class Layer(TypedDict):
    role: str
    present: bool
    description: str


class LlmInterp(TypedDict):
    summary: str
    vocabulary: VocabularyGrid
    layers: list[Layer]
    score_draft: str
```

- [ ] **Step 2: Verify it imports**

Run: `cd tools/audio-reference && uv run python -c "import audio_reference.schema"`
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add tools/audio-reference/audio_reference/schema.py
git commit -m 'Add data shapes for audio-reference pipeline'
```

---

## Task 4: Markdown render (pure)

**Files:**
- Create: `tools/audio-reference/audio_reference/render.py`
- Test: `tools/audio-reference/tests/test_render.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_render.py
from audio_reference.render import render_markdown

META = {
    "artist": "TR/ST", "title": "Icabod", "slug": "trst-icabod",
    "source_file": "icabod.flac", "model": "gemini-2.5-pro",
}
MIR = {
    "bpm": 120.0, "key": "A", "mode": "minor", "key_confidence": 0.82,
    "duration_sec": 245.3,
    "sections": [{"start": 0.0}, {"start": 32.5}, {"start": 120.0}],
    "brightness": {"mean_hz": 1800.0, "min_hz": 400.0, "max_hz": 6000.0},
    "dynamics": {"rms_mean": 0.12, "rms_range_db": 14.0},
    "midi_path": "trst-icabod.mid",
}
LLM = {
    "summary": "Brooding analog synthpop with a relentless pulse.",
    "vocabulary": {
        "timbre": "detuned saw pads", "brightness": "dark, low cutoff",
        "envelope": "slow-attack pads", "register_density": "sub bass + sparse lead",
        "harmony_mode": "natural minor, static", "groove": "four-on-the-floor, mechanical",
        "space_grit": "long reverb, light tape grit",
    },
    "layers": [
        {"role": "drone", "present": True, "description": "detuned pad bed"},
        {"role": "bass", "present": True, "description": "square sub pulse"},
        {"role": "lead", "present": False, "description": "absent until late"},
    ],
    "score_draft": "fatsawtooth drone, square bass at A1, lowpass ~600Hz.",
}


def test_render_includes_header_and_measured_facts():
    md = render_markdown(META, MIR, LLM)
    assert "# TR/ST — Icabod" in md
    assert "120" in md and "A minor" in md          # measured facts surfaced
    assert "4:05" in md                              # 245.3s formatted m:ss
    assert "3 sections" in md or "Sections: 3" in md


def test_render_flags_ground_truth_vs_interpretation():
    md = render_markdown(META, MIR, LLM)
    # the measured block must be labeled as MIR ground truth
    assert "Measured" in md
    # the model interpretation must be labeled too
    assert "Interpretation" in md or "interpretation" in md


def test_render_has_all_seven_vocabulary_dimensions():
    md = render_markdown(META, MIR, LLM)
    for label in ["Timbre", "Brightness", "Envelope", "Register", "Harmony", "Groove", "Space"]:
        assert label in md


def test_render_layer_table_marks_presence():
    md = render_markdown(META, MIR, LLM)
    assert "drone" in md and "bass" in md and "lead" in md
    # absent layer flagged
    assert "absent until late" in md


def test_render_includes_score_draft_flagged_speculative():
    md = render_markdown(META, MIR, LLM)
    assert "Score-draft" in md or "Score Draft" in md
    assert "speculative" in md.lower()
    assert "fatsawtooth drone" in md
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tools/audio-reference && uv run pytest tests/test_render.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'audio_reference.render'`

- [ ] **Step 3: Write minimal implementation**

```python
# audio_reference/render.py
"""Pure: merge measured MIR facts + LLM interpretation into a Markdown doc."""


def _mmss(seconds: float) -> str:
    m, s = divmod(int(round(seconds)), 60)
    return f"{m}:{s:02d}"


def render_markdown(meta: dict, mir: dict, llm: dict) -> str:
    v = llm["vocabulary"]
    lines: list[str] = []
    lines.append(f"# {meta['artist']} — {meta['title']}")
    lines.append("")
    lines.append(f"> {llm['summary']}")
    lines.append("")
    lines.append(f"*Source: `{meta['source_file']}` · Model: {meta['model']}*")
    lines.append("")

    # --- Measured (MIR ground truth) ---
    lines.append("## Measured facts (MIR ground truth)")
    lines.append("")
    lines.append(f"- **Tempo:** {mir['bpm']:.0f} BPM")
    lines.append(f"- **Key:** {mir['key']} {mir['mode']} "
                 f"(confidence {mir['key_confidence']:.2f})")
    lines.append(f"- **Duration:** {_mmss(mir['duration_sec'])}")
    lines.append(f"- **Sections: {len(mir['sections'])}** "
                 f"(boundaries at {', '.join(_mmss(s['start']) for s in mir['sections'])})")
    b = mir["brightness"]
    lines.append(f"- **Brightness (spectral centroid):** mean {b['mean_hz']:.0f} Hz "
                 f"(range {b['min_hz']:.0f}–{b['max_hz']:.0f} Hz)")
    d = mir["dynamics"]
    lines.append(f"- **Dynamics:** RMS mean {d['rms_mean']:.3f}, "
                 f"range {d['rms_range_db']:.1f} dB")
    if mir.get("midi_path"):
        lines.append(f"- **MIDI transcription:** `{mir['midi_path']}`")
    lines.append("")

    # --- Vocabulary grid (interpretation) ---
    lines.append("## Vocabulary grid (model interpretation)")
    lines.append("")
    lines.append("| Dimension | Reading |")
    lines.append("|---|---|")
    lines.append(f"| Timbre | {v['timbre']} |")
    lines.append(f"| Brightness | {v['brightness']} |")
    lines.append(f"| Envelope | {v['envelope']} |")
    lines.append(f"| Register/density | {v['register_density']} |")
    lines.append(f"| Harmony/mode | {v['harmony_mode']} |")
    lines.append(f"| Groove | {v['groove']} |")
    lines.append(f"| Space/grit | {v['space_grit']} |")
    lines.append("")

    # --- Layer breakdown (interpretation) ---
    lines.append("## Layer breakdown (model interpretation)")
    lines.append("")
    lines.append("| Layer | Present | Notes |")
    lines.append("|---|---|---|")
    for layer in llm["layers"]:
        mark = "yes" if layer["present"] else "no"
        lines.append(f"| {layer['role']} | {mark} | {layer['description']} |")
    lines.append("")

    # --- Score draft (speculative) ---
    lines.append("## Score-draft starter (speculative)")
    lines.append("")
    lines.append("> Model-guessed synth parameters — speculative, tune by ear.")
    lines.append("")
    lines.append(llm["score_draft"])
    lines.append("")

    return "\n".join(lines)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tools/audio-reference && uv run pytest tests/test_render.py -v`
Expected: PASS (5 passed)

- [ ] **Step 5: Commit**

```bash
git add tools/audio-reference/audio_reference/render.py tools/audio-reference/tests/test_render.py
git commit -m 'Add pure Markdown renderer for audio-reference'
```

---

## Task 5: Key/mode estimation (pure)

**Files:**
- Create: `tools/audio-reference/audio_reference/keyest.py`
- Test: `tools/audio-reference/tests/test_keyest.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_keyest.py
from audio_reference.keyest import estimate_key

# pitch class index: C=0, C#=1, D=2, D#=3, E=4, F=5, F#=6, G=7, G#=8, A=9, A#=10, B=11


def _chroma_for(pitch_classes):
    v = [0.05] * 12  # small noise floor
    for pc in pitch_classes:
        v[pc] = 1.0
    return v


def test_a_minor_triad_reads_a_minor():
    # A, C, E
    key, mode, conf = estimate_key(_chroma_for([9, 0, 4]))
    assert key == "A"
    assert mode == "minor"
    assert 0.0 <= conf <= 1.0


def test_c_major_triad_reads_c_major():
    # C, E, G
    key, mode, conf = estimate_key(_chroma_for([0, 4, 7]))
    assert key == "C"
    assert mode == "major"


def test_confidence_is_normalized():
    key, mode, conf = estimate_key(_chroma_for([0, 4, 7]))
    assert 0.0 <= conf <= 1.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tools/audio-reference && uv run pytest tests/test_keyest.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'audio_reference.keyest'`

- [ ] **Step 3: Write minimal implementation**

```python
# audio_reference/keyest.py
"""Pure: Krumhansl-Schmuckler key/mode estimation from a 12-bin chroma vector."""
import numpy as np

_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Krumhansl-Kessler key profiles.
_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def _corr(a: np.ndarray, b: np.ndarray) -> float:
    a = a - a.mean()
    b = b - b.mean()
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


def estimate_key(chroma_mean) -> tuple[str, str, float]:
    """Return (key_name, "major"|"minor", confidence in 0..1)."""
    chroma = np.asarray(chroma_mean, dtype=float)
    best = ("C", "major", -2.0)
    for tonic in range(12):
        maj = _corr(chroma, np.roll(_MAJOR, tonic))
        minr = _corr(chroma, np.roll(_MINOR, tonic))
        if maj > best[2]:
            best = (_NOTES[tonic], "major", maj)
        if minr > best[2]:
            best = (_NOTES[tonic], "minor", minr)
    # map correlation (-1..1) onto a 0..1 confidence
    conf = max(0.0, min(1.0, (best[2] + 1.0) / 2.0))
    return (best[0], best[1], conf)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tools/audio-reference && uv run pytest tests/test_keyest.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add tools/audio-reference/audio_reference/keyest.py tools/audio-reference/tests/test_keyest.py
git commit -m 'Add Krumhansl-Schmuckler key estimation'
```

---

## Task 6: Transcode (ffmpeg arg builder pure + runner)

**Files:**
- Create: `tools/audio-reference/audio_reference/transcode.py`
- Test: `tools/audio-reference/tests/test_transcode.py`

- [ ] **Step 1: Write the failing test** (only the pure arg builder is tested)

```python
# tests/test_transcode.py
from audio_reference.transcode import ffmpeg_args


def test_ffmpeg_args_downmix_to_16k_mono():
    args = ffmpeg_args("in.flac", "out.16k.wav")
    assert args[0] == "ffmpeg"
    assert "-y" in args                  # overwrite without prompt
    assert "in.flac" in args
    assert "out.16k.wav" == args[-1]
    # 16kHz mono
    assert "16000" in args
    i = args.index("-ac")
    assert args[i + 1] == "1"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tools/audio-reference && uv run pytest tests/test_transcode.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'audio_reference.transcode'`

- [ ] **Step 3: Write minimal implementation**

```python
# audio_reference/transcode.py
"""ffmpeg transcode to 16kHz mono (what Gemini uses internally, and under Vertex's size cap)."""
import subprocess


def ffmpeg_args(input_path: str, output_path: str) -> list[str]:
    """Pure: build the ffmpeg command line."""
    return [
        "ffmpeg", "-y",
        "-i", input_path,
        "-ac", "1",          # mono
        "-ar", "16000",      # 16 kHz
        output_path,
    ]


def to_16k_mono(input_path: str, output_path: str) -> None:
    """I/O boundary: run ffmpeg. Raises CalledProcessError on failure."""
    subprocess.run(
        ffmpeg_args(input_path, output_path),
        check=True,
        capture_output=True,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tools/audio-reference && uv run pytest tests/test_transcode.py -v`
Expected: PASS (1 passed)

- [ ] **Step 5: Commit**

```bash
git add tools/audio-reference/audio_reference/transcode.py tools/audio-reference/tests/test_transcode.py
git commit -m 'Add ffmpeg transcode (16kHz mono) for audio-reference'
```

---

## Task 7: MIR extraction (I/O — librosa + basic-pitch)

**Files:**
- Create: `tools/audio-reference/audio_reference/mir.py`

(No unit test — this is the librosa I/O boundary; `estimate_key` is already tested in Task 5. Verified manually in Task 11.)

- [ ] **Step 1: Write `mir.py`**

```python
# audio_reference/mir.py
"""I/O boundary: librosa + basic-pitch → measured-facts dict. Uses keyest for key/mode."""
import numpy as np
import librosa

from .keyest import estimate_key


def _sections(y, sr) -> list[dict]:
    """Coarse structural boundaries (seconds) via librosa onset/agglomerative segmentation."""
    try:
        boundaries = librosa.segment.agglomerative(
            librosa.feature.mfcc(y=y, sr=sr), 8
        )
        times = librosa.frames_to_time(boundaries, sr=sr)
        return [{"start": float(t)} for t in times]
    except Exception:
        return [{"start": 0.0}]


def _midi(input_path: str, out_path: str) -> str | None:
    """Optional basic-pitch transcription. Returns the .mid path, or None on any failure."""
    try:
        from basic_pitch.inference import predict_and_save
        from basic_pitch import ICASSP_2022_MODEL_PATH
        import os
        out_dir = os.path.dirname(out_path) or "."
        predict_and_save([input_path], out_dir, True, False, False, False,
                         model_or_model_path=ICASSP_2022_MODEL_PATH)
        # basic-pitch names output "<stem>_basic_pitch.mid"; caller renames to out_path.
        stem = os.path.splitext(os.path.basename(input_path))[0]
        produced = os.path.join(out_dir, f"{stem}_basic_pitch.mid")
        if os.path.exists(produced):
            os.replace(produced, out_path)
            return out_path
        return None
    except Exception:
        return None


def extract_mir(input_path: str, midi_out: str | None) -> dict:
    """Run MIR on the ORIGINAL (full-quality) file. midi_out=None skips transcription."""
    y, sr = librosa.load(input_path, sr=None, mono=True)
    duration = float(librosa.get_duration(y=y, sr=sr))

    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    bpm = float(np.atleast_1d(tempo)[0])

    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    key, mode, conf = estimate_key(chroma.mean(axis=1).tolist())

    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    rms = librosa.feature.rms(y=y)[0]
    rms_nonzero = rms[rms > 0]
    rms_range_db = (
        float(20 * np.log10(rms_nonzero.max() / rms_nonzero.min()))
        if rms_nonzero.size else 0.0
    )

    midi_path = _midi(input_path, midi_out) if midi_out else None

    return {
        "bpm": bpm,
        "key": key,
        "mode": mode,
        "key_confidence": conf,
        "duration_sec": duration,
        "sections": _sections(y, sr),
        "brightness": {
            "mean_hz": float(centroid.mean()),
            "min_hz": float(centroid.min()),
            "max_hz": float(centroid.max()),
        },
        "dynamics": {
            "rms_mean": float(rms.mean()),
            "rms_range_db": rms_range_db,
        },
        "midi_path": midi_path,
    }
```

- [ ] **Step 2: Verify it imports**

Run: `cd tools/audio-reference && uv run python -c "import audio_reference.mir"`
Expected: no output, exit 0. (If `basic_pitch` is missing it is imported lazily inside `_midi`, so the module still imports.)

- [ ] **Step 3: Commit**

```bash
git add tools/audio-reference/audio_reference/mir.py
git commit -m 'Add MIR extraction (librosa + optional basic-pitch)'
```

---

## Task 8: Prompt + response schema (pure)

**Files:**
- Create: `tools/audio-reference/audio_reference/prompt.py`
- Test: `tools/audio-reference/tests/test_prompt.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_prompt.py
from audio_reference.prompt import build_prompt, RESPONSE_SCHEMA

META = {"artist": "TR/ST", "title": "Icabod", "slug": "trst-icabod",
        "source_file": "icabod.flac", "model": "gemini-2.5-pro"}
MIR = {"bpm": 120.0, "key": "A", "mode": "minor", "key_confidence": 0.82,
       "duration_sec": 245.3, "sections": [{"start": 0.0}, {"start": 32.5}],
       "brightness": {"mean_hz": 1800.0, "min_hz": 400.0, "max_hz": 6000.0},
       "dynamics": {"rms_mean": 0.12, "rms_range_db": 14.0}, "midi_path": None}


def test_prompt_embeds_measured_facts():
    p = build_prompt(META, MIR)
    assert "120" in p              # the measured BPM is handed to the model
    assert "A minor" in p          # measured key
    assert "TR/ST" in p and "Icabod" in p


def test_prompt_names_all_seven_dimensions():
    p = build_prompt(META, MIR).lower()
    for dim in ["timbre", "brightness", "envelope", "register", "harmony", "groove", "space"]:
        assert dim in p


def test_prompt_names_the_layer_roles():
    p = build_prompt(META, MIR).lower()
    for role in ["drone", "perc", "bass", "lead", "backup", "arp", "tension"]:
        assert role in p


def test_response_schema_has_required_top_level_keys():
    props = RESPONSE_SCHEMA["properties"]
    for key in ["summary", "vocabulary", "layers", "score_draft"]:
        assert key in props
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tools/audio-reference && uv run pytest tests/test_prompt.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'audio_reference.prompt'`

- [ ] **Step 3: Write minimal implementation**

```python
# audio_reference/prompt.py
"""Pure: assemble the Gemini prompt + structured-output response schema.

The vocabulary + layer model mirror docs/audio-direction.md so the output maps onto
the game's Tone.js score data.
"""

# Gemini structured-output schema (a JSON Schema subset Vertex accepts).
RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "vocabulary": {
            "type": "object",
            "properties": {
                "timbre": {"type": "string"},
                "brightness": {"type": "string"},
                "envelope": {"type": "string"},
                "register_density": {"type": "string"},
                "harmony_mode": {"type": "string"},
                "groove": {"type": "string"},
                "space_grit": {"type": "string"},
            },
            "required": ["timbre", "brightness", "envelope", "register_density",
                         "harmony_mode", "groove", "space_grit"],
        },
        "layers": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "role": {"type": "string"},
                    "present": {"type": "boolean"},
                    "description": {"type": "string"},
                },
                "required": ["role", "present", "description"],
            },
        },
        "score_draft": {"type": "string"},
    },
    "required": ["summary", "vocabulary", "layers", "score_draft"],
}

_LAYER_ROLES = ["drone", "basePerc", "doublePerc", "bass", "lead", "backup",
                "progArp", "tensionDrone", "urgencyArp"]


def build_prompt(meta: dict, mir: dict) -> str:
    sections = ", ".join(f"{s['start']:.1f}s" for s in mir["sections"])
    return f"""You are a synthesis-literate music analyst. You are listening to an audio track
and producing a TECHNICAL breakdown for a developer who builds reactive synth music in Tone.js
and CANNOT hear audio. Be concrete and parameter-oriented, not poetic.

Track: "{meta['title']}" by {meta['artist']}.

MEASURED GROUND TRUTH (from signal analysis — treat these as authoritative; do NOT contradict them):
- Tempo: {mir['bpm']:.0f} BPM
- Key: {mir['key']} {mir['mode']} (confidence {mir['key_confidence']:.2f})
- Duration: {mir['duration_sec']:.0f}s
- Section boundaries at: {sections}
- Spectral centroid (brightness): mean {mir['brightness']['mean_hz']:.0f} Hz
- Dynamics: RMS range {mir['dynamics']['rms_range_db']:.1f} dB

Describe the track along these SEVEN dimensions (one concise reading each):
  timbre, brightness, envelope, register/density, harmony/mode, groove, space/grit.

Then break it into LAYERS, using these role names where they apply:
  {", ".join(_LAYER_ROLES)}
(drone, perc, bass, lead, backup, arp, tension). For each role say whether it is present and what it does.

Finally, write a short SCORE-DRAFT STARTER: concrete Tone.js-flavored suggestions
(oscillator types, ADSR, filter cutoff/Q, example note arrays) that would approximate this track.
Mark it as speculative.

Respond ONLY as JSON matching the provided schema."""
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tools/audio-reference && uv run pytest tests/test_prompt.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add tools/audio-reference/audio_reference/prompt.py tools/audio-reference/tests/test_prompt.py
git commit -m 'Add Gemini prompt + response schema for audio-reference'
```

---

## Task 9: Config resolution (pure)

**Files:**
- Create: `tools/audio-reference/audio_reference/config.py`
- Test: `tools/audio-reference/tests/test_config.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_config.py
from audio_reference.config import resolve_setting


def test_flag_wins_over_env():
    assert resolve_setting("flagval", {"X": "envval"}, "X") == "flagval"


def test_env_used_when_no_flag():
    assert resolve_setting(None, {"X": "envval"}, "X") == "envval"


def test_none_when_neither():
    assert resolve_setting(None, {}, "X") is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tools/audio-reference && uv run pytest tests/test_config.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'audio_reference.config'`

- [ ] **Step 3: Write minimal implementation**

```python
# audio_reference/config.py
"""Pure: resolve a Vertex setting from CLI flag → environment.

(gcloud-config fallback happens implicitly inside the google-genai client when both
flag and env are None, so it is not modeled here.)
"""
from typing import Optional, Mapping


def resolve_setting(flag: Optional[str], env: Mapping[str, str], env_key: str) -> Optional[str]:
    if flag:
        return flag
    return env.get(env_key)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tools/audio-reference && uv run pytest tests/test_config.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add tools/audio-reference/audio_reference/config.py tools/audio-reference/tests/test_config.py
git commit -m 'Add Vertex config resolution for audio-reference'
```

---

## Task 10: Gemini client (I/O boundary)

**Files:**
- Create: `tools/audio-reference/audio_reference/gemini.py`

(No unit test — Vertex network boundary; verified manually in Task 11.)

- [ ] **Step 1: Write `gemini.py`**

```python
# audio_reference/gemini.py
"""I/O boundary: call Gemini on Vertex (ADC) with audio + prompt + response schema → dict."""
import json
from typing import Optional

from google import genai
from google.genai import types


def analyze_audio(
    audio_bytes: bytes,
    mime_type: str,
    prompt: str,
    response_schema: dict,
    model: str,
    project: Optional[str],
    location: Optional[str],
) -> dict:
    """Returns the parsed JSON interpretation. Auth via ADC (no key)."""
    client = genai.Client(vertexai=True, project=project, location=location)
    resp = client.models.generate_content(
        model=model,
        contents=[
            types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
            prompt,
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=response_schema,
        ),
    )
    return json.loads(resp.text)
```

- [ ] **Step 2: Verify it imports**

Run: `cd tools/audio-reference && uv run python -c "import audio_reference.gemini"`
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add tools/audio-reference/audio_reference/gemini.py
git commit -m 'Add Gemini/Vertex client for audio-reference'
```

---

## Task 11: CLI orchestration (I/O boundary)

**Files:**
- Create: `tools/audio-reference/audio_reference/cli.py`

(No unit test — orchestration glue over already-tested pure parts + already-built I/O boundaries; verified by the first real run below.)

- [ ] **Step 1: Write `cli.py`**

```python
# audio_reference/cli.py
"""CLI orchestration: transcode → MIR → Gemini → render → write artifacts."""
import argparse
import json
import os
import sys
import tempfile

from .slug import slugify
from .config import resolve_setting
from .transcode import to_16k_mono
from .mir import extract_mir
from .prompt import build_prompt, RESPONSE_SCHEMA
from .gemini import analyze_audio
from .render import render_markdown

DEFAULT_MODEL = "gemini-2.5-pro"


def main(argv=None) -> int:
    argv = argv if argv is not None else sys.argv[1:]
    parser = argparse.ArgumentParser(prog="audio-reference")
    sub = parser.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("analyze", help="analyze one track")
    a.add_argument("audio")
    a.add_argument("--artist", required=True)
    a.add_argument("--title", required=True)
    a.add_argument("--out", default="docs")
    a.add_argument("--no-midi", action="store_true")
    a.add_argument("--model", default=DEFAULT_MODEL)
    a.add_argument("--project", default=None)
    a.add_argument("--location", default=None)
    args = parser.parse_args(argv)

    if args.cmd != "analyze":
        parser.error("unknown command")

    slug = slugify(args.artist, args.title)
    os.makedirs(args.out, exist_ok=True)
    md_path = os.path.join(args.out, f"{slug}.md")
    json_path = os.path.join(args.out, f"{slug}.json")
    midi_path = None if args.no_midi else os.path.join(args.out, f"{slug}.mid")

    meta = {
        "artist": args.artist, "title": args.title, "slug": slug,
        "source_file": os.path.basename(args.audio), "model": args.model,
    }

    print(f"[1/4] MIR extraction on {args.audio} ...", file=sys.stderr)
    mir = extract_mir(args.audio, midi_path)

    print("[2/4] transcoding to 16kHz mono for Gemini ...", file=sys.stderr)
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, f"{slug}.16k.wav")
        to_16k_mono(args.audio, wav)
        with open(wav, "rb") as fh:
            audio_bytes = fh.read()

    print(f"[3/4] Gemini interpretation ({args.model}) ...", file=sys.stderr)
    prompt = build_prompt(meta, mir)
    project = resolve_setting(args.project, os.environ, "GOOGLE_CLOUD_PROJECT")
    location = resolve_setting(args.location, os.environ, "GOOGLE_CLOUD_LOCATION")
    llm = analyze_audio(audio_bytes, "audio/wav", prompt, RESPONSE_SCHEMA,
                        args.model, project, location)

    print("[4/4] rendering artifacts ...", file=sys.stderr)
    md = render_markdown(meta, mir, llm)
    with open(md_path, "w") as fh:
        fh.write(md)
    with open(json_path, "w") as fh:
        json.dump({"meta": meta, "mir": mir, "interpretation": llm}, fh, indent=2)

    print(f"wrote {md_path}\nwrote {json_path}"
          + (f"\nwrote {midi_path}" if midi_path and mir.get("midi_path") else ""),
          file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 2: Verify the CLI parses (no network)**

Run: `cd tools/audio-reference && uv run audio-reference analyze --help`
Expected: argparse help text listing `--artist`, `--title`, `--no-midi`, `--model`, etc., exit 0.

- [ ] **Step 3: Run the full pure test suite**

Run: `cd tools/audio-reference && uv run pytest -v`
Expected: PASS — all tests from Tasks 2,4,5,6,8,9 (slug, render, keyest, transcode, prompt, config).

- [ ] **Step 4: Commit**

```bash
git add tools/audio-reference/audio_reference/cli.py
git commit -m 'Add CLI orchestration for audio-reference'
```

---

## Task 12: README + first-run validation

**Files:**
- Create: `tools/audio-reference/README.md`
- Create (generated): `tools/audio-reference/docs/<slug>.md` etc. from the first real run.

- [ ] **Step 1: Write `README.md`**

```markdown
# audio-reference

Analyze a reference track (MP3/FLAC/…) into a technical breakdown keyed to a
synthesis vocabulary — built to bridge an AI assistant's no-audio gap when authoring
Tone.js synth music. Combo of deterministic MIR (librosa + basic-pitch) and a
Gemini-via-Vertex "ears" pass.

## Setup

Requirements: Python ≥3.11, [uv](https://docs.astral.sh/uv/), `ffmpeg`, and Google
Cloud ADC.

```bash
# system dep
#   macOS:  brew install ffmpeg
#   Fedora: sudo dnf install ffmpeg
#   Debian: sudo apt install ffmpeg

uv sync --extra dev                       # create env + install deps
gcloud auth application-default login     # one-time ADC setup
export GOOGLE_CLOUD_PROJECT=your-project  # or pass --project
export GOOGLE_CLOUD_LOCATION=us-central1  # or pass --location
```

## Usage

```bash
uv run audio-reference analyze ~/music/icabod.flac --artist "TR/ST" --title "Icabod"
#   → docs/trst-icabod.md   docs/trst-icabod.json   docs/trst-icabod.mid

# flags
--out DIR          output dir (default: ./docs)
--no-midi          skip basic-pitch transcription (lighter/faster)
--model NAME       Gemini model (default: gemini-2.5-pro)
--project / --location   Vertex overrides (else env / gcloud config)
```

## Output

- `docs/<slug>.md`   — the breakdown (measured facts + vocabulary grid + layers + score draft)
- `docs/<slug>.json` — meta + raw MIR + the model's structured interpretation
- `docs/<slug>.mid`  — basic-pitch transcription (unless `--no-midi`)

## Tests

```bash
uv run pytest -v      # pure modules only (render, keyest, slug, transcode, prompt, config)
```

The I/O boundaries (ffmpeg, librosa extraction, Gemini call) are not unit-tested;
verify them by running `analyze` on a real track.
```

- [ ] **Step 2: Commit the README**

```bash
git add tools/audio-reference/README.md
git commit -m 'Add audio-reference README'
```

- [ ] **Step 3: First real run (manual validation — requires ffmpeg + ADC + a real audio file)**

Run (substitute a real local file):
```bash
cd tools/audio-reference
uv run audio-reference analyze /path/to/a-reference-track.flac --artist "TR/ST" --title "Icabod"
```
Expected: progress lines `[1/4]`…`[4/4]`, then `wrote docs/trst-icabod.md` etc.
Inspect `docs/trst-icabod.md`:
- measured BPM/key look plausible vs. what you know of the track
- all 7 vocabulary dimensions filled
- layer table present
- score-draft section present and flagged speculative

**This is the validation/iteration point.** If the output shape or prompt needs work
(it probably will), iterate `prompt.py` / `render.py` here before committing the corpus.

- [ ] **Step 4: Commit the first corpus artifact**

```bash
git add tools/audio-reference/docs/
git commit -m 'Add first analyzed reference track'
```

---

## Self-Review notes

- **Spec coverage:** transcode (T6) · MIR incl. key/sections/brightness/dynamics (T5,T7) · basic-pitch optional `--no-midi` (T7,T11) · Gemini/Vertex/ADC structured JSON (T8,T9,T10) · render to MD+JSON+MIDI (T4,T11) · CLI + flags + config (T9,T11) · uv/pyproject (T1) · README + ADC docs (T12) · pure-vs-IO testing split (throughout) · first-run validation (T12). All spec sections map to a task.
- **Placeholder scan:** no TBD/TODO; every code step has complete code.
- **Type consistency:** `Meta`/`MirFacts`/`LlmInterp` key names are identical across `schema.py`, `render.py`, `prompt.py`, `mir.py`, `cli.py` (`bpm`, `key`, `mode`, `key_confidence`, `duration_sec`, `sections[].start`, `brightness.{mean_hz,min_hz,max_hz}`, `dynamics.{rms_mean,rms_range_db}`, `midi_path`; `vocabulary.{timbre,brightness,envelope,register_density,harmony_mode,groove,space_grit}`; `layers[].{role,present,description}`; `summary`, `score_draft`). `slugify`, `estimate_key`, `ffmpeg_args`, `build_prompt`, `RESPONSE_SCHEMA`, `resolve_setting`, `analyze_audio`, `render_markdown`, `extract_mir`, `to_16k_mono` signatures are consistent between definition and call sites.
```
