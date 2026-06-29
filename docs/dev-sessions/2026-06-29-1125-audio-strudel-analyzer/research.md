# Research — audio-reference analyzer (current state)

Documentarian findings, 2026-06-29. Paths relative to `tools/audio-reference/audio_reference/` unless noted.

## Pipeline (analyze command)
`cli.py:227` `analyze` → `cmd_analyze` (`cli.py:106`):
1. `slugify` (`slug.py`)
2. `extract_mir(audio, midi)` → librosa tempo/key/sections/brightness/dynamics/timbre (`mir.py:45`); optional basic-pitch MIDI (`mir.py:25`). MIR schema `schema.py:36-46`.
3. `to_16k_mono` (`transcode.py`)
4. `build_prompt(meta, mir)` (`prompt.py:135-205`)
5. `analyze_audio(bytes, "audio/wav", prompt, RESPONSE_SCHEMA, model, ...)` (`gemini.py:29-62`)
6. `build_sidecar(meta, mir, llm)` (`scorespec.py:34-41`) + `sanitize_numbers` (`scorespec.py:72-86`)
7. write `{slug}.md`, `{slug}.json`, optional `{slug}.mid`; `write_index` (`cli.py:33-47`, `index.py:22`)

Stems mode `_analyze_stems` (`cli.py:50-102`): Demucs separate (`separate.py`) → RMS gate `select_stems` (`features.py`) → per-stem `build_stem_prompt` (`prompt.py:208-216`) → per-stem Gemini calls → full-mix overview pass → `assemble_stems` (`scorespec.py:44-69`), tracks tagged `stem`.

CLI commands (`cli.py`): `analyze` (227), `index` (240), `play` (244, serves player + `/save/<slug>` POST).

## Output has TWO layers (the key design fact)
`build_sidecar` (`scorespec.py:34-41`) writes `docs/{slug}.json` =
- `meta` — track metadata
- `mir` — measured librosa facts
- **`interpretation`** — `{summary, vocabulary(7-dim), tracks[], score_draft}` — *prose, engine-agnostic* (the learning artifact)
- **`score_spec`** — *the playable Tone projection* (`build_score_spec`, `scorespec.py:24-31`)

Stems variant `assemble_stems` adds `stems[]` + optional `overview`.

The interpretation `tracks[]` and the `score_spec` `tracks[]` overlap: each Track (`schema.py:93-101`) carries BOTH prose (`instrument`, `pattern`, `description`) AND playable (`synth`, `steps`). So "Tone-ness" is concentrated in `synth` + `steps`.

## The Tone-shaped vocabulary (what changes)
- `SynthSpec` (`schema.py:83-86`): `{type: str ∈ PALETTE, options: SynthOptions}`
- `PLAYABLE_SOURCES`/PALETTE (`scorespec.py:12-15`): Synth, MonoSynth, DuoSynth, FMSynth, AMSynth, PolySynth, MembraneSynth, MetalSynth, NoiseSynth, PluckSynth
- `SynthOptions` (`schema.py:59-81`): flat scalars — oscillatorType, count, spread, ADSR, volume, harmonicity, modulationIndex, filterType/Frequency/Q, drive, chorus, reverbSend (last 3 are harness effect nodes, not Tone ctor opts — `scorespec.py:62`)
- `Steps` (`schema.py:88-91`): `{grid: str (Tone subdiv), notes: list[str]}` token grammar: `""`=rest, `"x"`=unpitched hit, `"C4"`=note, `"C4+E4+G4"`=chord

## LLM call — FORCED structured output
`gemini.py:45-56`: google-genai SDK, Vertex (`genai.Client(vertexai=True)`), model `gemini-2.5-pro` default (`cli.py:29`), `response_mime_type="application/json"` + `response_schema=RESPONSE_SCHEMA`, `max_output_tokens=65536`, 4-attempt retry (`gemini.py:18-62`). So the model emits **structured JSON against a schema**, not free text.
RESPONSE_SCHEMA is a hand-built dict in `prompt.py:62-132`: top-level `[summary, vocabulary, tracks, score_draft]`; tracks require `[name, instrument, pattern, description, synth, steps]`; synth `{type, options}`; steps `{grid, notes[str]}`.

## Tests asserting the output format (~67 total, 11 files)
- `test_prompt.py`: schema shape — `test_response_schema_track_requires_synth_and_steps` (58-69), `..._synth_options_has_body_fields` (80-84), 7-dim names (20-23), per-stem budgets (124-133)
- `test_scorespec.py`: PALETTE/PLAYABLE_SOURCES (27-58), `build_score_spec` mapping (61-67), `build_sidecar` blocks (75-81), `assemble_stems` tag + overview (100-130), sanitize_numbers (35-50)
- `test_render.py`: markdown tracks table + stems/overview sections (58-114)
- `test_index.py`: index row shape (9-19); `test_save.py`: `apply_score_spec` replaces only score_spec (15-24)
Any change to ScoreSpec/Track/SynthSpec/Steps touches test_prompt + test_scorespec + test_render.

## Player + save + corpus
- Player `player/player.js` consumes `score_spec` → Tone graph: PALETTE (4-8), `expandOptions` flattens options→Tone ctor (57-95), `triggerStep` plays steps tokens (130-143), per-pool DSP caps (34-40), persistent reverb bus (179-197). **Player is entirely Tone-based.**
- `/save/<slug>` POST (`cli.py:161-198`) → `apply_score_spec` (`save.py:12-16`) replaces only `score_spec`, preserves other blocks; re-writes index.
- Corpus regen: `docs/dev-sessions/2026-06-26-1251-reduce-instrument-count/rerun_all.sh` (11 tracks, `analyze --stems`).

## No runtime schema validation
`schema.py` TypedDicts are documentation only; enforcement is Vertex's structured-output at the API boundary + `sanitize_numbers` for JSON safety. Player tolerates missing options (Tone defaults).
