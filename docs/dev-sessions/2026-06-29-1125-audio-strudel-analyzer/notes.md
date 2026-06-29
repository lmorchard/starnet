# Notes — audio-reference Strudel re-target

## Phase 1: Headless Strudel validator

**De-risk outcome: SUCCESS via node — no browser fallback needed.**

Findings while proving the incantation:
- `@strudel/core@1.2.6` adds a `@kabelsalat/web@^0.4.1` dependency whose `SalatRepl` export
  fails to load under node ESM (`SyntaxError: ... does not provide an export named 'SalatRepl'`).
  **`1.2.5` is the last clean release** → deps PINNED exactly (no caret) in `validator/package.json`.
- `@strudel/core` versions independently from `@strudel/web` (the player uses `@strudel/web@1.0.3`
  from unpkg; the validator uses core/mini/transpiler `1.2.5`). Minor version skew, acceptable —
  validation only checks "does this transpile + produce events," and the 1.x pattern/mini API is stable.
- Working incantation (in `validator/validate.mjs`):
  ```js
  await evalScope(import('@strudel/core'), import('@strudel/mini'));
  const { pattern } = await evaluate(code, transpiler);   // from @strudel/transpiler
  const haps = pattern.queryArc(0, 1);                     // one cycle, no audio
  ```
  Proven: valid → `{ok:true, events:3}`; `stack(...)` → `{ok:true, events:6}`;
  `notez(...)` → `{ok:false, error:"notez is not defined"}`; `""` → `{ok:true, events:0}` (silence).
- Importing `@strudel/core` prints banner noise to the console ("🌀 @strudel/core loaded 🌀",
  "cannot use window: not in browser?"). The validator therefore emits results as ONE
  `__VALIDATOR_RESULT__`-prefixed JSON line; the Python wrapper scans for that sentinel, so banner
  noise can't corrupt the protocol.

**Still open (manual, needs Les's GCP creds):** the ad-hoc "does Gemini actually write good
Strudel" check. Not blocking — the Phase 5 corpus regen will reveal real model behavior through the
validator, and the Phase 2 reference is authored to be authoritative regardless. Run if convenient:
one `analyze`-style call asking for a Strudel pattern, piped through `validate_strudel`.

Verification: `node --check` ✓, `pytest tests/test_validate.py` 4 passed ✓, full suite 71 passed ✓.

## Phase 2: Curated Strudel reference

Sounds + functions enumerated/validated against the LIVE player runtime (`@strudel/web@1.0.3`),
not memory:
- The runtime registers **227** sounds. Curated a reliable subset into `AVAILABLE_SOUNDS`:
  synth `sawtooth/square/triangle/sine`, noise `white/pink/brown`, drums
  `bd sd rim cp hh oh lt mt ht cr rd cb perc`. (Did not dump all 227 — keeps the model on
  recognizable, stable names.)
- Confirmed-working functions (evaluated in 1.0.3, all ok): `note`/`sound`/`s`/`n`/`stack`,
  `lpf`/`cutoff`/`hpf`/`resonance`/`gain`/`room`/`delay`/`pan`/`shape`/`crush`/`coarse`,
  ADSR, `fast`/`slow`/`ply`/`degradeBy`/`add`/`struct`/`euclid`, mini-notation `~ [] <> , * / !`.
- **Gotcha:** bare `.rev` errors in 1.0.3 (`u.play is not a function` — not a getter there);
  `.rev()` with parens works. Reference documents `.rev()`. (Asserted in test.)

`strudel_reference.py` is single-sourced from `AVAILABLE_SOUNDS`; the block is version-pinned
("pinned to @strudel/web 1.0.3"). Verification: `pytest tests/test_strudel_reference.py` 5 passed ✓.

## Phase 3: Analyzer emits validated Strudel

The surgical core slice — only the playable projection changed; the prose interpretation layer
(summary, 7-dim vocabulary, instrument/pattern/description) is untouched.
- `schema.py`: `Track` now carries `strudel: str` + `_strudel_valid: NotRequired[bool]` instead of
  `synth`/`steps`. `SynthSpec`/`SynthOptions`/`Steps`/PALETTE kept + documented as reference-Tone-player-only.
- `prompt.py`: `RESPONSE_SCHEMA` track requires `strudel` (string); the `synth`/`steps`/token-grammar
  bullets became one `strudel` bullet + the injected `strudel_reference_block()`. 7-dim, budgets,
  consolidation, harmonization, score-draft kept (harmonization/score-draft de-Tone'd). PROSE
  `instrument` bullet still uses Tone source names as a familiar timbre vocabulary (interpretation layer).
- `render.py`: per-track ```strudel fenced blocks (flagged "⚠ did not validate" when tagged) in both
  the non-stems and stems markdown.
- `cli.py`: `_validate_tracks()` runs `validate_strudel` after each scoring interp (per-stem + non-stems;
  overview tracks skipped — they're not played), warns to stderr + tags `_strudel_valid:false`, never drops.
- `scorespec.py`: docstrings only — assembly is field-agnostic, no logic change.

Verification: full suite **76 passed**; end-to-end confirmed prompt embeds reference + schema requires
strudel + validator flags garbage. Test churn: test_prompt (strudel schema + reference + body/grit, dropped
synth-options test), test_scorespec (fixtures→strudel), test_render (strudel blocks), test_save (strudel round-trip).

## Phase 4: Minimal Strudel player

- Tone player preserved: `player/player.js`→`tone-player.js`, `index.html`→`tone-player.html` (script-src
  fixed, marked "reference only" with a link to the Strudel player). Still served.
- New `player/index.html` (loads `@strudel/web@1.0.3`) + `player/player.js` (Strudel). Reuses the shell
  (library, file picker, /save, mute/solo, focus-pause); each track card is an editable code box instead
  of synth knobs. Play assembles `stack(<un-muted tracks>)` and runs `evaluate()`; edits/mute auto-replay
  while playing; Cmd/Ctrl+Enter in a box replays.
- **Tempo gotcha:** 1.0.3 exposes NO global `setcps`/`setcpm` (probed: only `cps`/`cpm` controls +
  `scheduler`). Solution: append `.cpm(bpm/4)` to the program (1 cycle = 1 bar = 4 beats) — rides on the
  pattern, no global needed. Confirmed `.cps()`/`.cpm()` evaluate cleanly in 1.0.3.
- Old Tone sidecars (no `strudel`) load but show a "no Strudel patterns — regenerate" notice.

Verification: `node --check` both ✓. Drove the whole flow via Playwright against an isolated temp serve
dir (symlinked player + a hand-written Strudel fixture): load→play(.cpm)→edit→mute(auto-replay)→Save→disk,
all clean, meta/interpretation preserved on save. Listening-quality + real-track + old-artifact-playback
checks deferred to Les/Phase 5.

## Phase 5 (prep) + Phase 6 (docs)

- **Phase 5 — awaiting Les.** `regen.sh` written + executable: analyzes the three tracks (Agent Side
  Grinder — Stripdown, Parallels — Dry Blood, The Knife — Heartbeats) with `--stems --model gemini-2.5-pro
  --project moz-fx-future-products-nonprod`. Les runs it (Vertex cost); watch `[validate]` lines.
- **Phase 6 — done.** README rewritten (Strudel output, validator `npm install`, Strudel player + tempo +
  preserved tone-player.html, Tests). schema.py/scorespec.py docstrings already mark Tone typedefs as
  reference-player-only. Full suite still **76 passed**.

## Phase 7: Validation hardening (prevent + recover) — from a real regen failure

Les's first regen (Agent Side Grinder — Stripdown) surfaced one invalid track: 'Motorik Bass' emitted
`<note(...), note(...)>.sound(...)` — mini-notation `<>` alternation used as bare JS → "Unexpected token
(1:0)". The validator caught it (working as intended). Two complementary fixes:
- **PREVENT (reference):** added `cat(p1, p2)` for whole-pattern alternation + an explicit rule that
  `< > [ ] * / ! , ~` are string-only and to never start an expression with `<`.
- **RECOVER (repair loop):** `_validate_and_repair_tracks` (cli.py) feeds the validator's exact error
  back to the model — `build_repair_prompt` (prompt.py) + `gemini.repair_strudel` (text-only, structured
  `{strudel}` output) — for up to `REPAIR_ATTEMPTS=2` fix-it turns, re-validating each; still-invalid
  tracks tagged `_strudel_valid:false` (kept). Repair only fires for failed tracks → cheap.
Confirmed: the `cat(...)` rewrite of the actual failed pattern validates (8 events). Suite **78 passed**.
Repair-loop call path is the gemini I/O boundary (not unit-tested, per repo convention); `build_repair_prompt`
is unit-tested. **Re-running regen.sh now self-heals most errors.**

## Open / for Les
- Run `regen.sh` (Phase 5) → audition the three tracks in the player → confirm listening quality.
- Optional Phase-1 de-risk: ad-hoc "does Gemini write good Strudel" check (regen reveals this anyway).
- Spike server on :8791 + Playwright browser left running from this session (harmless; close at will).
