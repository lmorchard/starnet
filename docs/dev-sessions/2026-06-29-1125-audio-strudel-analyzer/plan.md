# Audio-reference: emit Strudel — Implementation Plan

**Goal:** Re-target the analyzer to emit per-track Strudel code (validated) in place of Tone `synth`/`steps`, and replace the Tone player with a minimal Strudel player that plays/edits/saves it.

**Approach:** LLM emits Strudel code directly (code is the editable source of truth — no compiler); prompt carries a curated, version-pinned Strudel reference; generated code is validated headlessly before write; per-track strings assemble into a `stack(...)` at play time. Old Tone player preserved as a renamed reference artifact. Reduced 3-track corpus.

**Tech stack:** Python (`audio_reference`, uv), Gemini via google-genai/Vertex, `@strudel/web`@1.0.3 (browser player) + `@strudel/core`/`mini`/`transpiler` (node validator), vanilla JS player.

**Verification note:** `tools/audio-reference` has no Makefile; tests run via `uv run --extra dev pytest -q` (cwd `tools/audio-reference`). JS is checked with `node --check`. Vertex-calling steps (the corpus regen) are run by Les (API cost) and use project `moz-fx-future-products-nonprod`.

---

## Phase 1: Headless Strudel validator

A function that takes Strudel code and reports whether it transpiles + produces events, so the pipeline can reject hallucinated API before writing. Foundation for the de-risk and for phase 3's wiring.

**Files:**
- Create: `tools/audio-reference/validator/package.json` — deps `@strudel/core`, `@strudel/mini`, `@strudel/transpiler`; `"type": "module"`.
- Create: `tools/audio-reference/validator/validate.mjs` — reads code lines from stdin (one JSON-encoded string per line), evaluates each headlessly, prints one JSON result per line.
- Create: `tools/audio-reference/audio_reference/validate.py` — Python wrapper shelling out to node.
- Create: `tools/audio-reference/.gitignore` (or append) — ignore `validator/node_modules/`.
- Test: `tools/audio-reference/tests/test_validate.py`

**Key changes:**
- `validate_strudel(codes: list[str], *, validator_dir: str | None = None) -> list[dict]` — returns `[{"ok": bool, "events": int, "error": str | None}]`, one per input. Shells `node validator/validate.mjs`, feeds JSON-encoded code per stdin line, parses JSON-per-line out. On node missing / nonzero exit, returns `ok=False` with the error (never raises into the pipeline).
- `validate.mjs` core (transpile → eval in scope → query one cycle):

```js
// reads JSON string per stdin line; emits {ok,events,error} JSON per line.
import { evalScope } from '@strudel/core';
import { transpiler } from '@strudel/transpiler';
const scope = await evalScope(import('@strudel/core'), import('@strudel/mini'));
async function check(code) {
  try {
    const { output } = transpiler(code);                 // mini-notation literals -> pattern calls
    const pattern = await new Function(...Object.keys(scope), `return (${output})`)(...Object.values(scope));
    const haps = pattern.queryArc(0, 1);                 // one cycle, no audio
    return { ok: Array.isArray(haps), events: haps.length, error: null };
  } catch (e) { return { ok: false, events: 0, error: String(e && e.message || e) }; }
}
```

> **De-risk first (record in notes.md).** Before building the wrapper, confirm the transpile+query incantation against the actually-installed `@strudel/*` versions with two hand-written strings — one valid (`note("c3 e3 g3").s("sawtooth")`), one bogus (`notez("c3").bogus()`). If the node `evalScope`/`transpiler` API differs from the sketch, pin it to what the installed package exposes. **Fallback if node proves too fiddly within ~1h:** a single-launch headless-browser validator (Playwright loads `@strudel/web`, calls `evaluate()` per code, collects thrown errors) — proven to surface errors in the spike. The `validate_strudel` Python signature stays identical either way.

**Verification — automated:**
- [x] `cd tools/audio-reference/validator && npm install` succeeds (pinned @strudel/* 1.2.5)
- [x] `node --check validator/validate.mjs`
- [x] `uv run --extra dev pytest -q tests/test_validate.py` — 4 passed (valid→ok+events; bogus→not ok+error; batch order)

**Verification — manual:**
- [x] De-risk run logged in notes.md: node incantation works (no browser fallback); kabelsalat/1.2.5 pin + sentinel-output findings recorded.
- [ ] Ad-hoc Gemini call (minimal prompt) for "a driven sawtooth bassline in A minor" piped through `validate_strudel` — does Gemini produce evaluatable Strudel at all? Note the verdict; it informs how heavy the phase-2 reference must be. **(Deferred — needs Les's GCP creds; non-blocking.)**

---

## Phase 2: Curated Strudel reference

A version-pinned reference block (functions + available sounds) injected into the prompt, so the model writes Strudel from authoritative vocabulary instead of its (assumed partial) memory.

**Files:**
- Create: `tools/audio-reference/audio_reference/strudel_reference.py`
- Test: `tools/audio-reference/tests/test_strudel_reference.py`

**Key changes:**
- `STRUDEL_VERSION = "1.0.3"` — pins the reference to the embedded `@strudel/web`.
- `AVAILABLE_SOUNDS: dict[str, list[str]]` — `{"synth": ["sawtooth","square","triangle","sine","fatsawtooth", ...], "drums": ["bd","sd","hh","oh","cp","rim", ...]}` (the synth voices from `registerSynthSounds` + the dirt-sample names we rely on; enumerated from the running `@strudel/web` — see manual step).
- `STRUDEL_REFERENCE: str` — the reference text: mini-notation (`"c3 e3 ~ [g3 a3]"`, `~` rest, `*`/`/` speed, `<>` alternation, `[]` subdivision, `,` stack), core fns (`note`, `n`, `sound`/`s`, `stack`), structure (`.fast`/`.slow`/`.add`/`.struct`), effects (`.lpf`/`.cutoff`, `.room`, `.gain`, `.delay`, `.pan`, ADSR `.attack/.decay/.sustain/.release`), and the available-sound lists. Pinned, concrete, no invented fns.
- `strudel_reference_block() -> str` — returns the reference wrapped for prompt injection.

**Verification — automated:**
- [x] `uv run --extra dev pytest -q tests/test_strudel_reference.py` — 5 passed (core fns, sounds, version pin, `.rev()` gotcha)

**Verification — manual:**
- [x] Enumerated sounds + validated every documented function against the live `@strudel/web@1.0.3` runtime (227 sounds registered; curated subset; `.rev()` needs parens). All listed names confirmed playable.

---

## Phase 3: Analyzer emits validated Strudel

The core slice: schema + prompt emit a per-track `strudel` string instead of `synth`/`steps`; the prose interpretation layer is untouched; generated code is validated in the analyze flow; markdown shows the code.

**Files:**
- Modify: `tools/audio-reference/audio_reference/schema.py` — `Track`: replace `synth: SynthSpec` + `steps: Steps` with `strudel: str`. Leave `SynthSpec`/`SynthOptions`/`Steps` defined but unused-by-Track (or remove; see manual). Keep `name/instrument/pattern/description/stem`.
- Modify: `tools/audio-reference/audio_reference/prompt.py` — `RESPONSE_SCHEMA` track items: drop `synth`/`steps`, add `"strudel": {"type": "string"}`; `required` → `[name, instrument, pattern, description, strudel]`. Rewrite the per-track `synth`/`steps`/token-grammar instructions in `build_prompt` into a Strudel-code instruction; inject `strudel_reference_block()`; keep the 7-dim, budgets, consolidation, harmonization paragraphs.
- Modify: `tools/audio-reference/audio_reference/render.py` — add a per-track fenced ```strudel code block under the track table (in both `render_markdown` and `render_stems_markdown`).
- Modify: `tools/audio-reference/audio_reference/cli.py` — after each `analyze_audio` returns, run `validate_strudel([t["strudel"] for t in interp["tracks"]])`; on any `ok:False`, print a `[validate]` warning to stderr naming the track + error and tag the track (`t["_strudel_valid"] = False`). Keep the (possibly-invalid) code — never drop the analysis; surface it.
- Modify: `tools/audio-reference/audio_reference/scorespec.py` — docstrings only (tracks now carry `strudel`, not `synth`/`steps`); `build_score_spec`/`assemble_stems`/`sanitize_numbers` are field-agnostic and need no logic change.
- Test: `tests/test_prompt.py`, `tests/test_scorespec.py`, `tests/test_render.py` (update); `tests/test_save.py` (extend).

**Key changes:**
- `Track`: `strudel: str` replaces `synth`/`steps`.
- Prompt track instruction (replaces the `synth`/`steps` bullet block):

```
- strudel: a PLAYABLE Strudel pattern for this track as a CODE STRING — one expression
  (e.g. note("c2 [eb2 g2] c2 g1").s("sawtooth").lpf(600).gain(0.7)). Use ONLY the functions
  and sounds in the STRUDEL REFERENCE below. For unpitched percussion use sound("bd"/"hh"/...).
  Make it a 1-2 bar loop consistent with the pattern + harmony you described.
{strudel_reference_block()}
```

- Validation wiring (in both `cmd_analyze` and `_analyze_stems`, after each interp):

```python
from .validate import validate_strudel
results = validate_strudel([t.get("strudel", "") for t in interp.get("tracks", [])])
for t, r in zip(interp.get("tracks", []), results):
    if not r["ok"]:
        print(f"[validate] track {t.get('name')!r}: {r['error']}", file=sys.stderr)
        t["_strudel_valid"] = False
```

**Test updates (replace synth/steps assertions):**
- `test_prompt.py`: replace `test_response_schema_track_requires_synth_and_steps` → `..._requires_strudel` (assert `strudel` in track props + required, type string; assert `synth`/`steps` NOT in track required). Replace `test_prompt_explains_synth_steps_and_token_grammar` → assert prompt names `strudel`, shows an example with `note(`/`sound(`, and includes the reference (`.lpf`, `stack`, a sound name). Keep 7-dim / budget / consolidation / body tests. (Drop `test_response_schema_synth_options_has_body_fields`; the `drive/chorus` body guidance moves into prose `instrument` + the Strudel `.lpf`/`.gain` reference.) Update `test_build_stem_prompt_frames_isolation` (`steps`→`strudel`).
- `test_scorespec.py`: change `INTERP`/`STEM_RESULTS` tracks to carry `"strudel": 'note("c1*4").s("bd")'` instead of `synth`/`steps`; update `test_build_score_spec_*` to assert `spec["tracks"][0]["strudel"]` passes through. Keep `sanitize_numbers`, palette tests can stay (PALETTE still exists for the Tone reference player) or move to a `test_legacy` note — **default: keep PALETTE/PLAYABLE_SOURCES + their tests** (still used by the reference Tone player).
- `test_render.py`: assert the rendered markdown contains a ```strudel fenced block with a track's code.
- `test_save.py`: add a track with `strudel` to the fixture; assert `apply_score_spec` round-trips it (it already replaces score_spec wholesale).

**Verification — automated:**
- [x] `uv run --extra dev pytest -q` — full suite green (76 passed)
- [x] `uv run --extra dev pytest -q tests/test_prompt.py tests/test_scorespec.py tests/test_render.py tests/test_save.py`
- [x] End-to-end: `build_prompt` embeds the reference (5929 chars), schema track `required` is `[name, instrument, pattern, description, strudel]`, `validate_strudel` flags garbage / passes real patterns.

**Verification — manual:**
- [x] Typedef fate decided: **keep** `SynthSpec`/`SynthOptions`/`Steps`/PALETTE, documented as reference-Tone-player-only (schema.py + scorespec.py docstrings).

---

## Phase 4: Minimal Strudel player (Tone player preserved)

Replace the player with a Strudel one reusing the existing shell (library, `/save`, per-track cards, focus-pause), swapping each card's synth-knobs for a code box and the play path for `@strudel/web` `evaluate(stack(...))`. Old player kept as a served reference artifact.

**Files:**
- Rename: `tools/audio-reference/player/player.js` → `player/tone-player.js`; `player/index.html` → `player/tone-player.html` (fix its script `src`). Still served at `/player/tone-player.html` — reference only, untouched otherwise.
- Create: `tools/audio-reference/player/index.html` — Strudel player shell (loads `@strudel/web`@1.0.3 + `player.js`).
- Create: `tools/audio-reference/player/player.js` — the Strudel player.

**Key changes (player.js), reusing spike patterns (`tmp/strudel-spike/index.html`) + the old shell:**
- Boot: `initStrudel()` then **poll** for `window.note`/`evaluate` (returns undefined, registers globals async — memory `strudel-superdough-spike.md`); `await getAudioContext().resume()` on the Start click; kick off `samples('github:tidalcycles/dirt-samples')` in the background.
- Library list + load from `docs/index.json` / `docs/{slug}.json` (reuse old fetch logic).
- Per-track card: track name + an editable `<textarea>` bound to `row.strudel` (replaces synth-knob controls) + mute/solo checkboxes (reuse).
- Play: `hush(); evaluate('stack(\n' + rows.filter(audible).map(r => r.strudel).join(',\n') + '\n)')`. Stop: `hush()`. (No DSP pools/recycler/`expandOptions`/`triggerStep` — Strudel owns scheduling.)
- Save: POST to `/save/{slug}` a `score_spec` whose `tracks` carry the edited per-track `strudel` (reuse the old save wiring; the endpoint already replaces score_spec wholesale).

**Verification — automated:**
- [x] `node --check tools/audio-reference/player/player.js`
- [x] `node --check tools/audio-reference/player/tone-player.js` (rename didn't break it)

**Verification — manual:**
- [x] Drove the player end-to-end (Playwright, isolated temp serve dir + hand-written Strudel fixture): load → 3 editable cards; Play → `▶ playing`, ctx running, no warnings (tempo via `.cpm(bpm/4)`); edit a track + mute one → auto-replay clean; Save → `saved ✓` and disk reflects the edit with meta/interpretation preserved.
- [x] `/player/tone-player.html` + `tone-player.js` serve (200); rename + script-src fix verified.
- [ ] **Listening check (pending Les + Phase 5):** play a *real regenerated* track and confirm it sounds recognizable; play an old Tone artifact in `tone-player.html`.

---

## Phase 5: Rebuild reduced corpus (3 tracks) — Les-run

Regenerate the three chosen tracks through the new pipeline so the library + player have real Strudel content. Run by Les (Vertex API cost), project `moz-fx-future-products-nonprod`.

**Files:**
- Modify (data): `tools/audio-reference/docs/*.json` + `.md` + `index.json` for the three slugs (analyzer output).
- Create: `docs/dev-sessions/2026-06-29-1125-audio-strudel-analyzer/regen.sh` — the three `analyze` invocations (mirrors the prior `rerun_all.sh`).

**Key changes:** `regen.sh` runs, for each of the three source mp3s in `~/Downloads`:
```sh
uv run audio-reference analyze "$SRC" --artist "..." --title "..." --stems \
  --stems-model htdemucs_ft --model gemini-2.5-pro --out docs --project moz-fx-future-products-nonprod
```
(Agent Side Grinder — Stripdown; Parallels — Dry Blood; The Knife — Heartbeats.)

**Verification — automated:**
- [ ] For each regenerated `docs/{slug}.json`: every `score_spec.tracks[].strudel` passes `validate_strudel` (no `_strudel_valid:false` tags left), and `index.json` lists the three.

**Verification — manual:**
- [ ] Les runs `regen.sh`; the `[validate]` stderr stream is clean (or flagged tracks are reviewed).
- [ ] Each of the three loads in the Strudel player and sounds recognizably like its reference.

---

## Phase 6: Docs

Update the tool docs to describe the Strudel output + player and the preserved Tone reference player.

**Files:**
- Modify: `tools/audio-reference/README.md` — output is now Strudel code per track; the player is the Strudel player; `tone-player.html` is the preserved reference; note `--project moz-fx-future-products-nonprod`; mention `validator/` + `npm install`.
- Modify: `tools/audio-reference/audio_reference/schema.py` + `scorespec.py` docstrings — describe the `strudel` field; mark Tone typedefs/PALETTE as reference-player-only.

**Verification — automated:**
- [ ] `uv run --extra dev pytest -q` — still green (docstring-only changes)

**Verification — manual:**
- [ ] README walks a new reader from `analyze` → Strudel sidecar → Strudel player → save, with no stale Tone-output claims.

---

## Plan self-review

- **Spec coverage:** analyzer→Strudel (P3) ✓; no-compiler/code-as-truth (P3, save unchanged) ✓; curated reference (P2) ✓; node eval validation (P1, wired P3) ✓; per-track assemble-at-play (P4 play path) ✓; replace player + preserve Tone as reference (P4) ✓; reduced 3-track corpus (P5) ✓; empirical de-risk first (P1 manual) ✓; interpretation layer untouched (P3 leaves summary/vocabulary/prose) ✓; GCP project (P5) ✓.
- **Placeholder scan:** none — signatures, schema edits, the validator incantation, the play-path assembly, and each test edit are spelled out. The one flagged *risk* (node vs browser validator) carries an explicit decision rule + fallback, not a TODO.
- **Type consistency:** `Track.strudel: str` used consistently across schema (P3), RESPONSE_SCHEMA (P3), validator input (P1/P3), player `row.strudel` (P4), save round-trip (P3/P4), corpus validation (P5). `validate_strudel(codes)->[{ok,events,error}]` signature identical in P1 and P3.
