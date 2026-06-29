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
