# Notes — reduce instrument count

## What shipped
Analysis-prompt change in `tools/audio-reference/audio_reference/prompt.py`:
- New constants: `WHOLE_SONG_BUDGET`, `STEM_BUDGETS` (drums/bass/vocals/other) + `GENERIC_STEM_BUDGET`, `CONSOLIDATION_RULE`.
- `build_prompt(meta, mir, budget=None)` — budget-parameterized; injects budget + consolidation rule into the TRACKS section.
- **Softened** the over-split driver: "Enumerate every distinct track you actually hear" → "Identify the FEW tracks that actually define the piece — be deliberate and lean, not exhaustive."
- `build_stem_prompt` threads a per-stem budget through `build_prompt` (drums = 5–8 kit; bass/vocals = 1–2; other = 1–3; unknown = generic 1–3), and dropped "or a few."
- `tests/test_prompt.py`: +5 tests (budget/consolidation present, enumeration softened, per-stem budgets, generic fallback, whole-song-budget leak guard). 12 → 17 prompt tests; full suite 63 passed.

## Key finding that shaped the work
The over-split is **melodic, not percussive** (melodic mean 8.1 vs target 2–6; percussion 5.9 vs target 5–8 — already on-target), and **every corpus artifact is stem-separated**, so splitting compounds per stem. That's why the fix is per-stem budgets + a consolidation rule, not a single whole-song cap or a schema `maxItems`. Quantified with `count_tracks.py` (kept in this session dir).

## Decisions (from Les)
1. Strong textual preference + consolidation rule — no schema `maxItems`.
2. Per-stem budgets in `build_stem_prompt`.
3. Verify via pytest this session; Les re-runs the corpus on real audio later.
4. Re-run overwrites `docs/` (default `--out`).

## Verification status
- `uv run --extra dev pytest -q` → **63 passed**.
- NOT yet verified against real Gemini output — no source audio in repo; needs Les's re-run.

## Follow-ups / open
- **Les re-runs the corpus** (`analyze … --stems` on the real audio), then `python3 count_tracks.py` to confirm melodic ≤ ~6. If still high, tighten `other`/`vocals` budgets — cheap.
- **Deferred (out of scope):** revisit player `TRACK_CAPS` (4 melodic) once arrangements are leaner — may bump melodic cap to 5–6 so the default mix shows the whole song. Player change, separate session.
- Existing `docs/*.json` still carry the OLD (over-split) arrangements + hand-tweaks until the re-run.
