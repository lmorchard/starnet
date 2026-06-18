# Stem-Aware Analysis + Richer MIR — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in `--stems` analysis mode that separates a track into stems (Demucs), runs the existing MIR + Gemini analysis on each isolated stem, and merges the per-stem tracks into one `score_spec` — plus Tier 3 spectral-timbre features added to the measured facts for both modes.

**Architecture:** A second analysis path alongside the current single-pass one. Pure logic (feature summarizers, stem selection, score-spec assembly, prompt building, stems markdown) is unit-tested; the heavy I/O boundary (`separate.py` Demucs wrapper, the per-stem fan-out in `cli.py`) is verified on a real run. The merged `score_spec` keeps its shape (+ an optional per-track `stem` tag), so the player/library/tweaker are untouched.

**Tech Stack:** Python ≥3.11, `librosa`/`numpy` (existing), `pytest`; new optional `[stems]` extra = `demucs` + `torch` (invoked via subprocess; lazy/guarded).

---

## File structure

```
audio_reference/
  schema.py      (modify)  — Timbre typeddict + MirFacts.timbre; Track.stem (NotRequired); StemResult
  features.py    (pure,mod)— harmonic_ratio, voiced_mean, select_stems  [unit-tested]
  mir.py         (I/O,mod) — extract_mir computes the Tier 3 `timbre` block
  prompt.py      (pure,mod)— Tier 3 facts in build_prompt + new build_stem_prompt  [unit-tested]
  scorespec.py   (pure,mod)— assemble_stems(meta, mir_global, stem_results) -> sidecar  [unit-tested]
  render.py      (pure,mod)— factor _measured_block; add render_stems_markdown  [unit-tested]
  separate.py    (I/O,NEW) — Demucs subprocess wrapper -> {stem: wav_path}
  cli.py         (I/O,mod) — --stems / --stems-model; per-stem orchestration
pyproject.toml   (modify)  — optional [stems] extra
README.md        (modify)  — document --stems
```

**Shared field names (use exactly):** the Tier 3 block is `mir["timbre"] = { "rolloff_hz": float, "flatness": float, "contrast": float, "zcr": float, "harmonic_ratio": float }`. A stem result is `{ "stem": str, "mir": dict, "interpretation": dict }`. A merged track gains `"stem": str`.

> **Note (spec deviation):** the spec listed an `attack_time` feature; it's dropped from v1 — a single attack-time number over a whole stem is ill-defined (attack is per-note), and `harmonic_ratio` + `flatness` + `zcr` already capture transient/percussive character. Easy to add later if wanted.

---

## Task 1: Schema — timbre block, Track.stem, StemResult

**Files:** Modify `audio_reference/schema.py`

- [ ] **Step 1: Add the shapes**

At the top, the import line is `from typing import TypedDict, Optional`. Change it to also import `NotRequired`:
```python
from typing import TypedDict, Optional, NotRequired
```

Add a `Timbre` class immediately above `MirFacts`, add `timbre` to `MirFacts`, add `stem` to `Track`, and add `StemResult` at the end of the file:

```python
class Timbre(TypedDict):
    rolloff_hz: float
    flatness: float        # 0 = tonal, 1 = noisy
    contrast: float
    zcr: float
    harmonic_ratio: float  # 1 = tonal/harmonic, 0 = percussive


# ... inside MirFacts, add this field (alongside brightness / dynamics):
    timbre: Timbre
```

In `Track`, add the optional stem tag:
```python
    stem: NotRequired[str]   # which separated stem this track came from (stems mode only)
```

At the end of the file:
```python
class StemResult(TypedDict):
    stem: str
    mir: MirFacts
    interpretation: LlmInterp
```

- [ ] **Step 2: Verify it imports**

Run: `cd tools/audio-reference && uv run python -c "import audio_reference.schema"`
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add tools/audio-reference/audio_reference/schema.py
git commit -m 'Schema: timbre block, Track.stem, StemResult'
```

---

## Task 2: features.py — harmonic_ratio, voiced_mean, select_stems (pure)

**Files:** Modify `audio_reference/features.py`; Test `tests/test_features.py`

- [ ] **Step 1: Append failing tests to `tests/test_features.py`**

```python
from audio_reference.features import harmonic_ratio, voiced_mean, select_stems


def test_harmonic_ratio_all_harmonic_is_one_all_perc_is_zero():
    assert harmonic_ratio([1.0, -1.0, 1.0], [0.0, 0.0, 0.0]) == 1.0
    assert harmonic_ratio([0.0, 0.0], [0.5, -0.5]) == 0.0
    r = harmonic_ratio([1.0, 1.0], [1.0, 1.0])
    assert abs(r - 0.5) < 1e-9


def test_harmonic_ratio_silence_is_zero():
    assert harmonic_ratio([0.0, 0.0], [0.0, 0.0]) == 0.0


def test_voiced_mean_gates_quiet_frames():
    # values 100 on loud frames, 0 on silent frames -> mean ~100 (silence gated out)
    vals = [0.0, 0.0, 100.0, 100.0]
    rms = [0.0, 0.0, 1.0, 1.0]
    assert voiced_mean(vals, rms) == 100.0


def test_voiced_mean_falls_back_when_lengths_mismatch():
    assert voiced_mean([10.0, 20.0], [1.0]) == 15.0


def test_select_stems_skips_near_empty():
    rms = {"drums": 0.5, "bass": 0.4, "other": 0.3, "vocals": 0.01}
    keep = select_stems(rms, floor_ratio=0.06)
    assert set(keep) == {"drums", "bass", "other"}    # vocals (0.01 < 0.06*0.5) dropped


def test_select_stems_empty_input():
    assert select_stems({}) == []
    assert select_stems({"a": 0.0, "b": 0.0}) == []
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd tools/audio-reference && uv run pytest tests/test_features.py -v`
Expected: FAIL — `ImportError: cannot import name 'harmonic_ratio'`.

- [ ] **Step 3: Append the implementations to `audio_reference/features.py`**

(The file already imports `numpy as np`.)

```python
def harmonic_ratio(harmonic, percussive) -> float:
    """Fraction of energy in the harmonic (tonal) component vs. total (harmonic + percussive).
    1.0 = fully tonal, 0.0 = fully percussive."""
    h = float(np.sum(np.square(np.asarray(harmonic, dtype=float))))
    p = float(np.sum(np.square(np.asarray(percussive, dtype=float))))
    total = h + p
    return h / total if total > 0 else 0.0


def voiced_mean(values, rms, floor_ratio: float = 0.05) -> float:
    """Mean of per-frame `values` over frames whose RMS exceeds floor_ratio*peak (gates silence).
    Falls back to the overall mean when RMS can't be aligned (different length / all zero)."""
    values = np.asarray(values, dtype=float)
    rms = np.asarray(rms, dtype=float)
    if values.size == 0:
        return 0.0
    if rms.size == values.size and rms.size and rms.max() > 0:
        mask = rms > rms.max() * floor_ratio
        sel = values[mask] if mask.any() else values
    else:
        sel = values
    return float(sel.mean())


def select_stems(rms_by_stem: dict, floor_ratio: float = 0.06) -> list:
    """Stem names whose RMS is at least floor_ratio of the loudest stem's — skip near-empty ones."""
    if not rms_by_stem:
        return []
    peak = max(rms_by_stem.values())
    if peak <= 0:
        return []
    return [s for s, r in rms_by_stem.items() if r >= peak * floor_ratio]
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd tools/audio-reference && uv run pytest tests/test_features.py -v`
Expected: PASS (all, including the new 6).

- [ ] **Step 5: Commit**

```bash
git add tools/audio-reference/audio_reference/features.py tools/audio-reference/tests/test_features.py
git commit -m 'features: harmonic_ratio, voiced_mean, select_stems'
```

---

## Task 3: mir.py — Tier 3 timbre block

**Files:** Modify `audio_reference/mir.py`

(No new unit test — librosa I/O boundary; the pure summarizers are tested in Task 2; verified on a real run.)

- [ ] **Step 1: Import the helpers**

The file currently has `from .features import dynamic_range_db, brightness_stats, dedupe_sections`. Change it to:
```python
from .features import dynamic_range_db, brightness_stats, dedupe_sections, harmonic_ratio, voiced_mean
```

- [ ] **Step 2: Compute the timbre block in `extract_mir`**

After the existing `centroid` / `rms` lines and before the `return {...}`, add:
```python
    rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
    flatness = librosa.feature.spectral_flatness(y=y)[0]
    contrast = librosa.feature.spectral_contrast(y=y, sr=sr)
    zcr = librosa.feature.zero_crossing_rate(y)[0]
    y_harm, y_perc = librosa.effects.hpss(y)
    timbre = {
        "rolloff_hz": voiced_mean(rolloff, rms),
        "flatness": float(flatness.mean()),
        "contrast": float(contrast.mean()),
        "zcr": float(zcr.mean()),
        "harmonic_ratio": harmonic_ratio(y_harm, y_perc),
    }
```

Add `"timbre": timbre,` to the returned dict (next to `"brightness"` / `"dynamics"`).

- [ ] **Step 3: Verify it imports**

Run: `cd tools/audio-reference && uv run python -c "import audio_reference.mir"`
Expected: no output, exit 0.

- [ ] **Step 4: Commit**

```bash
git add tools/audio-reference/audio_reference/mir.py
git commit -m 'mir: add Tier 3 timbre features (rolloff/flatness/contrast/zcr/harmonic ratio)'
```

---

## Task 4: prompt.py — surface timbre facts + build_stem_prompt (pure)

**Files:** Modify `audio_reference/prompt.py`; Test `tests/test_prompt.py`

- [ ] **Step 1: Add timbre to the test MIR fixture + append failing tests in `tests/test_prompt.py`**

At the top of the file, the `MIR` fixture dict has `"dynamics": {...}, "midi_path": None`. Add a `timbre` block to it (insert before `"midi_path": None`):
```python
       "timbre": {"rolloff_hz": 3200.0, "flatness": 0.12, "contrast": 18.0, "zcr": 0.08, "harmonic_ratio": 0.78},
```

Append:
```python
def test_prompt_includes_timbre_facts():
    p = build_prompt(META, MIR).lower()
    assert "rolloff" in p
    assert "flatness" in p or "tonal" in p
    assert "harmonic" in p


def test_build_stem_prompt_frames_isolation():
    from audio_reference.prompt import build_stem_prompt
    p = build_stem_prompt(META, MIR, "drums")
    assert "drums" in p
    assert "isolated" in p.lower() or "only" in p.lower()
    # still asks for the same structured output
    assert "synth" in p.lower() and "steps" in p.lower()
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd tools/audio-reference && uv run pytest tests/test_prompt.py -v`
Expected: FAIL — missing "rolloff" substring; `ImportError: build_stem_prompt`.

- [ ] **Step 3: Add the timbre facts to `build_prompt`**

In `build_prompt`, the measured-facts block ends with the dynamics line:
```python
- Dynamics: RMS range {mir['dynamics']['rms_range_db']:.1f} dB
```
Add a timbre line right after it (still inside the f-string). Use `.get` defaults so a fixture without `timbre` won't crash:
```python
- Timbre: spectral rolloff {tb.get('rolloff_hz', 0):.0f} Hz, flatness {tb.get('flatness', 0):.2f} (0=tonal,1=noisy), contrast {tb.get('contrast', 0):.1f}, zero-crossing {tb.get('zcr', 0):.3f}, harmonic ratio {tb.get('harmonic_ratio', 0):.2f} (1=tonal, 0=percussive)
```
And define `tb` next to the existing locals (`sections = ...`, `palette = ...`):
```python
    tb = mir.get("timbre", {})
```

- [ ] **Step 4: Add `build_stem_prompt` at the end of `prompt.py`**

```python
def build_stem_prompt(meta: dict, mir: dict, stem: str) -> str:
    """Per-stem prompt: same task as build_prompt, but framed as one isolated stem."""
    intro = (
        f'IMPORTANT: You are hearing ONLY the isolated "{stem}" stem of "{meta["title"]}" '
        f'(separated from the full mix). Describe just the instrument(s) present in THIS stem — '
        f"it may be a single instrument or a few. Ignore anything you'd expect from other stems.\n\n"
    )
    return intro + build_prompt(meta, mir)
```

- [ ] **Step 5: Run to verify all pass**

Run: `cd tools/audio-reference && uv run pytest tests/test_prompt.py -v`
Expected: PASS (all, including the 2 new).

- [ ] **Step 6: Commit**

```bash
git add tools/audio-reference/audio_reference/prompt.py tools/audio-reference/tests/test_prompt.py
git commit -m 'prompt: surface Tier 3 timbre facts + add build_stem_prompt'
```

---

## Task 5: scorespec.py — assemble_stems (pure)

**Files:** Modify `audio_reference/scorespec.py`; Test `tests/test_scorespec.py`

- [ ] **Step 1: Append failing tests to `tests/test_scorespec.py`**

```python
from audio_reference.scorespec import assemble_stems

MIR_GLOBAL = {"bpm": 129.0, "key": "F#", "mode": "minor", "key_confidence": 0.9,
              "duration_sec": 200.0, "sections": [{"start": 0.0}],
              "brightness": {"mean_hz": 1500.0, "min_hz": 100.0, "max_hz": 7000.0},
              "dynamics": {"rms_mean": 0.1, "rms_range_db": 18.0}, "midi_path": None}
STEM_RESULTS = [
    {"stem": "drums", "mir": {}, "interpretation": {"tracks": [
        {"name": "Kick", "instrument": "MembraneSynth", "pattern": "1/4", "description": "",
         "synth": {"type": "MembraneSynth", "options": {}}, "steps": {"grid": "4n", "notes": ["C1"]}}]}},
    {"stem": "bass", "mir": {}, "interpretation": {"tracks": [
        {"name": "Sub", "instrument": "MonoSynth", "pattern": "1/8", "description": "",
         "synth": {"type": "MonoSynth", "options": {}}, "steps": {"grid": "8n", "notes": ["F#1"]}}]}},
]


def test_assemble_stems_merges_and_tags_tracks():
    side = assemble_stems({"slug": "x"}, MIR_GLOBAL, STEM_RESULTS)
    ss = side["score_spec"]
    assert ss["root"] == "F#" and ss["mode"] == "minor" and ss["bpm"] == 129.0
    assert [t["name"] for t in ss["tracks"]] == ["Kick", "Sub"]
    assert [t["stem"] for t in ss["tracks"]] == ["drums", "bass"]      # each tagged with its stem


def test_assemble_stems_sidecar_shape():
    side = assemble_stems({"slug": "x"}, MIR_GLOBAL, STEM_RESULTS)
    assert set(side.keys()) == {"meta", "mir", "stems", "score_spec"}
    assert side["stems"] == STEM_RESULTS
    assert side["mir"] == MIR_GLOBAL
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd tools/audio-reference && uv run pytest tests/test_scorespec.py -v`
Expected: FAIL — `ImportError: cannot import name 'assemble_stems'`.

- [ ] **Step 3: Append `assemble_stems` to `audio_reference/scorespec.py`**

```python
def assemble_stems(meta: dict, mir_global: dict, stem_results: list) -> dict:
    """Merge per-stem analyses into one sidecar. root/mode/bpm come from the full-mix MIR;
    every per-stem track is tagged with its stem. stem_results: [{stem, mir, interpretation}]."""
    tracks = []
    for sr in stem_results:
        for t in sr.get("interpretation", {}).get("tracks", []):
            tracks.append({**t, "stem": sr["stem"]})
    return {
        "meta": meta,
        "mir": mir_global,
        "stems": stem_results,
        "score_spec": {
            "root": mir_global["key"],
            "mode": mir_global["mode"],
            "bpm": mir_global["bpm"],
            "tracks": tracks,
        },
    }
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd tools/audio-reference && uv run pytest tests/test_scorespec.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/audio-reference/audio_reference/scorespec.py tools/audio-reference/tests/test_scorespec.py
git commit -m 'scorespec: assemble_stems (merge + tag per-stem tracks)'
```

---

## Task 6: render.py — stems markdown (pure)

**Files:** Modify `audio_reference/render.py`; Test `tests/test_render.py`

- [ ] **Step 1: Append failing test to `tests/test_render.py`**

```python
def test_render_stems_markdown_groups_by_stem():
    from audio_reference.render import render_stems_markdown
    stem_results = [
        {"stem": "drums", "mir": {}, "interpretation": {"summary": "punchy kit",
            "tracks": [{"name": "Kick", "instrument": "MembraneSynth", "pattern": "1/4", "description": "boom"}]}},
        {"stem": "bass", "mir": {}, "interpretation": {"summary": "growl bass",
            "tracks": [{"name": "Sub", "instrument": "MonoSynth", "pattern": "1/8", "description": "low"}]}},
    ]
    md = render_stems_markdown(META, MIR, stem_results)
    assert "# TR/ST — Icabod" in md
    assert "120" in md and "A minor" in md            # global measured facts
    assert "## drums" in md and "## bass" in md       # a section per stem
    assert "punchy kit" in md and "growl bass" in md  # per-stem summaries
    assert "Kick" in md and "Sub" in md               # per-stem tracks
```

(The `META`/`MIR` fixtures already exist at the top of `tests/test_render.py`. `MIR` needs a `timbre` block for the measured-facts helper; add the same line as in Task 4 to the `MIR` fixture here:
```python
    "timbre": {"rolloff_hz": 3200.0, "flatness": 0.12, "contrast": 18.0, "zcr": 0.08, "harmonic_ratio": 0.78},
```
)

- [ ] **Step 2: Run to verify it fails**

Run: `cd tools/audio-reference && uv run pytest tests/test_render.py -v`
Expected: FAIL — `ImportError: cannot import name 'render_stems_markdown'`.

- [ ] **Step 3: Factor the measured block + add the stems renderer in `render.py`**

`render_markdown` currently builds the "## Measured facts" block inline. Extract it into a helper so both renderers share it. Add near the top (after `_mmss`):

```python
def _measured_lines(mir: dict) -> list:
    """The 'Measured facts (MIR ground truth)' block as a list of markdown lines."""
    lines = ["## Measured facts (MIR ground truth)", ""]
    lines.append(f"- **Tempo:** {mir['bpm']:.0f} BPM")
    lines.append(f"- **Key:** {mir['key']} {mir['mode']} (confidence {mir['key_confidence']:.2f})")
    lines.append(f"- **Duration:** {_mmss(mir['duration_sec'])}")
    lines.append(f"- **Sections: {len(mir['sections'])}** "
                 f"(boundaries at {', '.join(_mmss(s['start']) for s in mir['sections'])})")
    b = mir["brightness"]
    lines.append(f"- **Brightness (spectral centroid):** mean {b['mean_hz']:.0f} Hz "
                 f"(range {b['min_hz']:.0f}–{b['max_hz']:.0f} Hz)")
    d = mir["dynamics"]
    lines.append(f"- **Dynamics:** RMS mean {d['rms_mean']:.3f}, range {d['rms_range_db']:.1f} dB")
    tb = mir.get("timbre")
    if tb:
        lines.append(f"- **Timbre:** rolloff {tb['rolloff_hz']:.0f} Hz, flatness {tb['flatness']:.2f}, "
                     f"contrast {tb['contrast']:.1f}, ZCR {tb['zcr']:.3f}, "
                     f"harmonic ratio {tb['harmonic_ratio']:.2f}")
    if mir.get("midi_path"):
        lines.append(f"- **MIDI transcription:** `{mir['midi_path']}`")
    lines.append("")
    return lines


def _track_table(tracks: list) -> list:
    """A Track | Instrument | Pattern | Notes table as markdown lines."""
    lines = ["| Track | Instrument | Pattern | Notes |", "|---|---|---|---|"]
    for t in tracks:
        lines.append(f"| {t.get('name','')} | {t.get('instrument','')} | "
                     f"{t.get('pattern','')} | {t.get('description','')} |")
    lines.append("")
    return lines


def render_stems_markdown(meta: dict, mir_global: dict, stem_results: list) -> str:
    """Markdown for stems mode: global measured facts + a section per analyzed stem."""
    lines = [f"# {meta['artist']} — {meta['title']}", "",
             f"*Source: `{meta['source_file']}` · Model: {meta['model']} · stem-separated*", ""]
    lines += _measured_lines(mir_global)
    for sr in stem_results:
        interp = sr.get("interpretation", {})
        lines.append(f"## {sr['stem']}")
        lines.append("")
        if interp.get("summary"):
            lines.append(f"> {interp['summary']}")
            lines.append("")
        lines += _track_table(interp.get("tracks", []))
    return "\n".join(lines)
```

You do NOT need to rewrite `render_markdown`'s body to use `_measured_lines` (leave the single-pass renderer working as-is); the helper exists for the stems renderer. (Optionally refactor later.)

- [ ] **Step 4: Run to verify pass (no regressions)**

Run: `cd tools/audio-reference && uv run pytest tests/test_render.py -v`
Expected: PASS — the existing render tests AND the new stems test.

- [ ] **Step 5: Commit**

```bash
git add tools/audio-reference/audio_reference/render.py tools/audio-reference/tests/test_render.py
git commit -m 'render: stems markdown (global facts + per-stem sections)'
```

---

## Task 7: separate.py — Demucs wrapper (I/O)

**Files:** Create `audio_reference/separate.py`

(No unit test — subprocess/Demucs boundary; verified on the first real `--stems` run.)

- [ ] **Step 1: Write `audio_reference/separate.py`**

```python
"""I/O boundary: run Demucs (via subprocess) to split a track into stems.

Demucs + torch are heavy and optional — install the `[stems]` extra. Invoked as a subprocess
(`python -m demucs ...`) to avoid importing torch into the main process and to dodge API churn.
"""
import glob
import os
import subprocess
import sys


def separate(input_path: str, out_dir: str, model: str = "htdemucs_ft") -> dict:
    """Split `input_path` into stems with Demucs. Returns {stem_name: wav_path}.

    Demucs writes `<out_dir>/<model>/<track_basename>/<stem>.wav`. Raises RuntimeError with a
    clear message if Demucs isn't installed or the run fails.
    """
    cmd = [sys.executable, "-m", "demucs", "-n", model, "--out", out_dir, input_path]
    try:
        subprocess.run(cmd, check=True, capture_output=True)
    except FileNotFoundError as e:
        raise RuntimeError("demucs not available — install the [stems] extra "
                           "(uv sync --extra stems)") from e
    except subprocess.CalledProcessError as e:
        msg = e.stderr.decode("utf-8", "replace")[-2000:] if e.stderr else str(e)
        if "No module named demucs" in msg:
            msg = "demucs not installed — run: uv sync --extra stems"
        raise RuntimeError(f"demucs failed: {msg}") from e

    stem_root = os.path.join(out_dir, model)
    found = {}
    for wav in glob.glob(os.path.join(stem_root, "*", "*.wav")):
        stem = os.path.splitext(os.path.basename(wav))[0]   # e.g. "drums"
        found[stem] = wav
    if not found:
        raise RuntimeError(f"demucs produced no stems under {stem_root}")
    return found
```

- [ ] **Step 2: Verify it imports (no torch needed to import this module)**

Run: `cd tools/audio-reference && uv run python -c "import audio_reference.separate"`
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add tools/audio-reference/audio_reference/separate.py
git commit -m 'Add Demucs stem-separation wrapper (subprocess, guarded)'
```

---

## Task 8: pyproject — optional [stems] extra

**Files:** Modify `tools/audio-reference/pyproject.toml`

- [ ] **Step 1: Add the extra**

In `[project.optional-dependencies]`, add a `stems` entry alongside the existing `midi` / `dev`:
```toml
stems = ["demucs>=4.0", "torch>=2.0"]
```

- [ ] **Step 2: Verify the core env still resolves (do NOT install stems here — torch is large)**

Run: `cd tools/audio-reference && uv sync --extra dev`
Expected: resolves without error (the heavy `stems` extra is only pulled when explicitly requested).

- [ ] **Step 3: Commit**

```bash
git add tools/audio-reference/pyproject.toml tools/audio-reference/uv.lock
git commit -m 'Add optional [stems] extra (demucs + torch)'
```

---

## Task 9: cli.py — --stems orchestration (I/O)

**Files:** Modify `audio_reference/cli.py`

(No unit test — orchestration over already-tested pure parts + I/O boundaries; verified on the first real run in Task 10.)

- [ ] **Step 1: Add imports**

Near the other `from .` imports add:
```python
import librosa
from .separate import separate
from .features import select_stems
from .prompt import build_stem_prompt
from .scorespec import assemble_stems
from .render import render_stems_markdown
```

- [ ] **Step 2: Add the flags to the `analyze` subparser**

After `a.add_argument("--no-midi", action="store_true")` add:
```python
    a.add_argument("--stems", action="store_true", help="separate into stems and analyze each in isolation")
    a.add_argument("--stems-model", default="htdemucs_ft", help="Demucs model (e.g. htdemucs_ft, htdemucs_6s)")
```

- [ ] **Step 3: Branch `cmd_analyze` into the stems path**

In `cmd_analyze`, after `meta = {...}` is built and the full-mix `mir` is extracted (the `[1/4] MIR extraction` step), insert the stems branch BEFORE the existing single-pass transcode/Gemini block. Wrap the existing single-pass body in `else`:

```python
    print(f"[1/4] MIR extraction on {args.audio} ...", file=sys.stderr)
    mir = extract_mir(args.audio, midi_path)

    if args.stems:
        return _analyze_stems(args, meta, mir, md_path, json_path)

    # ---- single-pass (existing path) ----
    print("[2/4] transcoding to 16kHz mono for Gemini ...", file=sys.stderr)
    ... (unchanged) ...
```

- [ ] **Step 4: Add the `_analyze_stems` orchestrator**

```python
def _analyze_stems(args, meta, mir, md_path, json_path) -> int:
    project = resolve_setting(args.project, os.environ, "GOOGLE_CLOUD_PROJECT")
    location = resolve_setting(args.location, os.environ, "GOOGLE_CLOUD_LOCATION")
    with tempfile.TemporaryDirectory() as tmp:
        print(f"[stems] separating with {args.stems_model} ...", file=sys.stderr)
        stem_wavs = separate(args.audio, tmp, args.stems_model)

        # energy gate: skip near-silent stems
        rms = {}
        for stem, wav in stem_wavs.items():
            y, sr = librosa.load(wav, sr=None, mono=True)
            rms[stem] = float((y ** 2).mean() ** 0.5) if y.size else 0.0
        keep = select_stems(rms)
        skipped = sorted(set(stem_wavs) - set(keep))
        if skipped:
            print(f"[stems] skipping near-empty: {', '.join(skipped)}", file=sys.stderr)

        stem_results = []
        for stem in keep:
            wav = stem_wavs[stem]
            print(f"[stems] analyzing '{stem}' ...", file=sys.stderr)
            smir = extract_mir(wav, None)                       # per-stem MIR (no MIDI)
            wav16 = os.path.join(tmp, f"{stem}.16k.wav")
            to_16k_mono(wav, wav16)
            with open(wav16, "rb") as fh:
                audio_bytes = fh.read()
            prompt = build_stem_prompt(meta, smir, stem)
            interp = analyze_audio(audio_bytes, "audio/wav", prompt, RESPONSE_SCHEMA,
                                   args.model, project, location)
            stem_results.append({"stem": stem, "mir": smir, "interpretation": interp})

    print("[stems] rendering artifacts ...", file=sys.stderr)
    sidecar = sanitize_numbers(assemble_stems(meta, mir, stem_results))
    md = render_stems_markdown(meta, mir, stem_results)
    with open(md_path, "w") as fh:
        fh.write(md)
    with open(json_path, "w") as fh:
        json.dump(sidecar, fh, indent=2, allow_nan=False)
    write_index(args.out)
    print(f"wrote {md_path}\nwrote {json_path}\nrefreshed {os.path.join(args.out, 'index.json')}",
          file=sys.stderr)
    return 0
```

- [ ] **Step 5: Verify the CLI parses and the pure suite is green**

Run: `cd tools/audio-reference && uv run audio-reference analyze --help`
Expected: help text now lists `--stems` and `--stems-model`.
Run: `cd tools/audio-reference && uv run pytest -q`
Expected: PASS (all pure tests; stems path isn't exercised without `[stems]` installed).

- [ ] **Step 6: Commit**

```bash
git add tools/audio-reference/audio_reference/cli.py
git commit -m 'cli: --stems / --stems-model per-stem analysis orchestration'
```

---

## Task 10: README + first-run validation

**Files:** Modify `tools/audio-reference/README.md`; regenerated docs from the first run.

- [ ] **Step 1: Document `--stems` in `README.md`**

After the existing `--no-midi` flag docs (in the Usage section), add:
```markdown
### Stem-separated analysis (`--stems`)

```bash
uv sync --extra stems                       # one-time: installs demucs + torch (heavy)
uv run audio-reference analyze track.mp3 --artist A --title T --stems
#   --stems-model htdemucs_ft   (default; or htdemucs_6s for piano/guitar stems)
```

Separates the track into stems (drums / bass / vocals / other) and analyzes each in isolation,
so Gemini characterizes one instrument at a time instead of the blended mix. Near-empty stems are
skipped. The merged `docs/<slug>.json` keeps the same `score_spec` shape (each track tagged with
its `stem`), so the player works unchanged. Costs ~one Gemini call per non-empty stem.
```

- [ ] **Step 2: Commit the README**

```bash
git add tools/audio-reference/README.md
git commit -m 'README: document --stems'
```

- [ ] **Step 3: First real run (manual — needs the [stems] extra + ADC + an audio file)**

```bash
cd tools/audio-reference
uv sync --extra stems
uv run audio-reference analyze "/path/to/Kontravoid - Native State (Official Video).mp3" \
  --artist "Kontravoid" --title "Native State" --stems --no-midi
```
Expected: `[stems] separating …`, `[stems] analyzing 'drums' …` etc., then `wrote docs/kontravoid-native-state.{md,json}`. Inspect:
- the `.json` has a top-level `stems: [...]` and a `score_spec` whose tracks carry `stem` tags;
- it's valid JSON (no Infinity);
- load it in the player (`uv run audio-reference play`) and confirm it plays and the per-stem
  isolation audibly improves the instrument match vs. the single-pass version.

**This is the validation/iteration point** — tune the `select_stems` floor + the `build_stem_prompt`
framing here before committing the regenerated corpus.

- [ ] **Step 4: Commit the regenerated artifact**

```bash
git add tools/audio-reference/docs/
git commit -m 'Add first stem-separated reference analysis'
```

---

## Self-Review notes

- **Spec coverage:** opt-in `--stems` + `--stems-model` (T9) · per-stem MIR+transcode+Gemini fan-out (T9) · full-mix global anchor (T9) · energy gate (T2 `select_stems` + T9) · assemble/tag (T5) · Tier 3 features (T2 pure + T3 mir) · facts in both prompts (T4) · stem prompt isolation (T4) · stems markdown grouped by stem (T6) · `separate.py` Demucs + `[stems]` extra (T7,T8) · schema shapes (T1) · player compatibility (score_spec shape unchanged + `stem` tag) · README + first-run (T10) · pure-vs-IO test split throughout. The spec's `attack_time` is intentionally dropped (documented above).
- **Placeholder scan:** no TBD/TODO; every code step has complete code. Energy-gate floor (`0.06`) and the per-feature numbers are concrete; "tuned by feel" applies only to post-first-run iteration.
- **Type consistency:** `mir["timbre"]` keys (`rolloff_hz`/`flatness`/`contrast`/`zcr`/`harmonic_ratio`) identical across schema (T1), features/mir (T2,T3), prompt (T4), render (T6). `stem_results` item shape `{stem, mir, interpretation}` identical across T5 (`assemble_stems`), T6 (`render_stems_markdown`), T9 (cli). `assemble_stems(meta, mir_global, stem_results)` and `build_stem_prompt(meta, mir, stem)` and `separate(input, out_dir, model)` and `select_stems(rms_by_stem, floor_ratio)` signatures match between definition and call sites in T9.
```
