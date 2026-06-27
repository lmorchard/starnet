# Plan — reduce instrument count

Single vertical slice; pure prompt-module change + tests. No player, schema, or MIR changes.

## Phase 1 — add budget/consolidation constants & thread `budget` through `build_prompt`
**Files:** `tools/audio-reference/audio_reference/prompt.py`
1. Add module constants near `TONE_SOURCES`:
   - `WHOLE_SONG_BUDGET` — "~2–6 melodic/harmonic parts PLUS a drum kit of ~5–8 percussion pieces."
   - `CONSOLIDATION_RULE` — merge tracks differing only in FX/octave/intensity (two hats → one; subdued+driven bass → one).
   - `STEM_BUDGETS` dict (`drums`/`bass`/`vocals`/`other`) + `GENERIC_STEM_BUDGET` fallback.
2. `build_prompt(meta, mir, budget=None)` → `budget = budget or WHOLE_SONG_BUDGET`.
3. Rewrite the TRACKS intro (`prompt.py:115-116`): soften "Enumerate every distinct track you actually hear" → deliberate/lean framing; inject `{budget}` and `{consolidation_rule}`.

## Phase 2 — per-stem budget in `build_stem_prompt`
**Files:** `prompt.py`
1. `build_stem_prompt` looks up `STEM_BUDGETS.get(stem, GENERIC_STEM_BUDGET)`, passes it as `budget=` to `build_prompt`.
2. Drop the now-redundant "it may be a single instrument or a few" line (budget governs count).

## Phase 3 — tests
**Files:** `tools/audio-reference/tests/test_prompt.py`
- `build_prompt` contains the consolidation rule + whole-song budget (lean/merge/consolidate, melodic+percussion numbers).
- `build_stem_prompt("drums")` → kit framing; `("bass")`/`("vocals")` → 1–2 framing; unknown stem → generic budget.
- **Leak guard:** the whole-song budget phrase is ABSENT from a stem prompt.
- Existing assertions (`invent`, palette, token grammar, schema shape) stay green.

## Verify
- `uv run pytest tests/test_prompt.py -q` (and full `pytest` for no regressions).
- Re-run of the corpus is Les's, later (no audio in repo); compare with `count_tracks.py`.
