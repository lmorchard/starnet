# Reduce Instrument Count Spec

**Goal:** Make the audio-reference analyzer generate leaner, more deliberate arrangements — ~2–6 melodic/harmonic parts plus a ~5–8 piece drum kit — by changing the analysis prompt to budget tracks per stem and consolidate near-duplicates. (No player changes.)

**Source:** User request from 2026-06-26 (follow-on to PR #242 / #245).

## Current state

- `tools/audio-reference/audio_reference/prompt.py` builds the Gemini prompt.
  - `build_prompt` (`prompt.py:92`) tells the model to "break the piece into TRACKS … **Enumerate every distinct track you actually hear** (don't force a fixed set)." No budget, no consolidation guidance.
  - `build_stem_prompt` (`prompt.py:160`) prepends an isolated-stem intro ("it may be a single instrument **or a few**") and calls `build_prompt` unchanged.
  - `RESPONSE_SCHEMA` (`prompt.py:19`) — `tracks` is an unbounded array.
- Track classification (mirrors player): percussion = `synth.type` ∈ {MembraneSynth, MetalSynth, NoiseSynth}; else melodic (`player/player.js:32`). Player caps melodic 4 / perc 6 (`player/player.js:33`).
- **Measured problem** (`count_tracks.py` over all 11 `docs/*.json`): melodic mean **8.1** (range 5–11) vs target 2–6; percussion mean **5.9** (range 4–8) vs target 5–8. Over-splitting is melodic; percussion is already on-target.
- **All corpus artifacts are stem-separated** (drums/bass/vocals/other — one Gemini call per stem). Splitting compounds per stem: bass → 2–3 near-identical MonoSynths; vocals → lead + an FX-layer "reverb pad"; other → stacked pads. See `research.md`.
- Stem names are lowercase demucs basenames: `drums`, `bass`, `vocals`, `other` (+ `piano`, `guitar` under `htdemucs_6s`). `build_stem_prompt(meta, mir, stem)` receives one of these (`cli.py:76`).

## Desired end state

`build_prompt` and `build_stem_prompt` carry an explicit **arrangement budget** plus a **consolidation rule**, so a re-run of the corpus lands near ~3–6 melodic + ~5–8 percussion per song. Concretely:

- `build_prompt(meta, mir, budget=None)` — `budget` defaults to a whole-song budget string. The TRACKS section leads with leanness, states the budget, and states the consolidation rule.
- `build_stem_prompt(meta, mir, stem)` — looks up a stem-specific budget and passes it to `build_prompt` (so the whole-song numbers never leak into a stem prompt). Per-stem budgets:
  - `drums` → render the kit as ~5–8 distinct percussion pieces; don't split one hat/snare pattern into multiple voices.
  - `bass` → 1–2 parts max (a sub + a separate driven mid-bass is two; one line at two intensities/FX is one).
  - `vocals` → 1–2 parts (lead + its reverb/double/harmony layer is ONE track).
  - `other` → 1–3 parts (merge stacked pads sharing register/role).
  - `piano`/`guitar`/unknown → generic "1–3 parts; consolidate near-duplicates."
- **Consolidation rule** (universal, in `build_prompt`): if two candidate tracks differ only in FX (reverb/delay), octave, or intensity (subdued vs driven), MERGE them into one track capturing the dominant character. Two hats → one; subdued + driven bass → one.
- `RESPONSE_SCHEMA` unchanged (no `maxItems`).
- `tests/test_prompt.py` covers the new budget + consolidation language in `build_prompt` AND `build_stem_prompt` (the latter currently has no test). All existing prompt tests stay green.

## Design decisions

- **Decision:** Strong textual preference + consolidation rule; no schema `maxItems`.
  - **Why:** Lets Gemini keep one extra part when genuinely warranted. Vertex's JSON-Schema subset enforces `maxItems` unreliably, and a hard cap clips legitimately busy tracks.
  - **Rejected:** Hard `maxItems` cap — brittle and awkward per-stem (6/stem = 24 total).
- **Decision:** Per-stem budgets injected via a `budget` parameter on `build_prompt`.
  - **Why:** Every corpus artifact is stem-separated; the over-split happens per stem, so a single whole-song number doesn't bind a stem run. Parameterizing avoids the whole-song budget contradicting the per-stem budget when `build_stem_prompt` reuses `build_prompt`.
  - **Rejected:** One budget shared by both prompts — a stem run would see "2–6 melodic" per stem and could still emit 6 bass parts.
- **Decision:** Verify this session via `pytest` (prompt-content assertions, runnable without Vertex); Les re-runs the corpus on the real audio later.
  - **Why:** No source audio in the repo; a full re-run is ~44 Gemini calls + demucs and needs the music + project config, which Les has.
- **Decision:** When the corpus is re-run, overwrite `docs/` (default `--out`).
  - **Why:** Les's call; accepts that hand-tuned tracks regenerate in exchange for uniformly leaner arrangements.

## Patterns to follow

- Module-level prompt constants + f-string assembly already used in `prompt.py:12` (`TONE_SOURCES`), `prompt.py:19` (`RESPONSE_SCHEMA`). Add `WHOLE_SONG_BUDGET`, `STEM_BUDGETS`, `CONSOLIDATION_RULE` the same way.
- `build_stem_prompt` already composes by delegating to `build_prompt` (`prompt.py:167`) — keep that shape; just thread `budget` through.
- Test style: content assertions on the built string, schema-shape assertions on `RESPONSE_SCHEMA` (`tests/test_prompt.py`). Mirror for new cases.
- Verification harness: `count_tracks.py` (in this session dir) quantifies counts from `docs/*.json` — reuse it post-re-run to compare.

## What we're NOT doing

- **No player changes.** `TRACK_CAPS`, mixing, gating all stay as shipped in #245. Revisiting the 4-melodic cap once arrangements are leaner is a deferred follow-up, not this session.
- **No schema `maxItems`** or other structural cap on `tracks`.
- **No re-running the corpus in-session** (no audio in repo). No edits to existing `docs/*.json`.
- **No MIR / classification / stem-separation changes** — `select_stems`, `separate.py`, `scorespec.py` untouched.
- **No changes to the 7-dimension vocabulary, score-draft, or token-grammar** sections of the prompt.

## Open questions

- *Will the per-stem budgets actually land melodic ≤ 6 after a real re-run?* **Default:** ship the prompt change as specified and let Les's re-run + `count_tracks.py` confirm; if still high, a follow-up tightening pass (smaller `other`/`vocals` budgets) is cheap. Does not block planning.
