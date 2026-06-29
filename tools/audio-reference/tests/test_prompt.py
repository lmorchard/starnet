from audio_reference.prompt import build_prompt, RESPONSE_SCHEMA

META = {"artist": "TR/ST", "title": "Icabod", "slug": "trst-icabod",
        "source_file": "icabod.flac", "model": "gemini-2.5-pro"}
MIR = {"bpm": 120.0, "key": "A", "mode": "minor", "key_confidence": 0.82,
       "duration_sec": 245.3, "sections": [{"start": 0.0}, {"start": 32.5}],
       "brightness": {"mean_hz": 1800.0, "min_hz": 400.0, "max_hz": 6000.0},
       "dynamics": {"rms_mean": 0.12, "rms_range_db": 14.0},
       "timbre": {"rolloff_hz": 3200.0, "flatness": 0.12, "contrast": 18.0, "zcr": 0.08, "harmonic_ratio": 0.78},
       "midi_path": None}


def test_prompt_embeds_measured_facts():
    p = build_prompt(META, MIR)
    assert "120" in p              # the measured BPM is handed to the model
    assert "A minor" in p          # measured key
    assert "TR/ST" in p and "Icabod" in p


def test_prompt_names_all_seven_dimensions():
    p = build_prompt(META, MIR).lower()
    for dim in ["timbre", "brightness", "envelope", "register", "harmony", "groove", "space"]:
        assert dim in p


def test_prompt_uses_tracks_model_with_instrument_and_pattern():
    p = build_prompt(META, MIR).lower()
    # the conceptual model: tracks = instrument driven by pattern
    assert "track" in p
    assert "instrument" in p
    assert "pattern" in p
    # the model is invited to invent fitting names, not pick a fixed taxonomy
    assert "invent" in p


def test_prompt_names_tone_js_source_palette():
    p = build_prompt(META, MIR)
    # a sampling of the Tone.js source palette must be offered as vocabulary
    for src in ["PolySynth", "MonoSynth", "FMSynth", "MembraneSynth", "NoiseSynth"]:
        assert src in p
    # and a custom-synthesis escape hatch (informs new instruments)
    assert "custom" in p.lower()


def test_response_schema_has_required_top_level_keys():
    props = RESPONSE_SCHEMA["properties"]
    for key in ["summary", "vocabulary", "tracks", "score_draft"]:
        assert key in props


def test_response_schema_track_items_require_instrument_and_pattern():
    item = RESPONSE_SCHEMA["properties"]["tracks"]["items"]
    for field in ["name", "instrument", "pattern", "description"]:
        assert field in item["properties"]
        assert field in item["required"]


def test_response_schema_track_requires_strudel():
    item = RESPONSE_SCHEMA["properties"]["tracks"]["items"]
    assert "strudel" in item["properties"]
    assert item["properties"]["strudel"]["type"] == "string"
    assert "strudel" in item["required"]
    # the old Tone-shaped playable fields are gone from the emitted schema
    assert "synth" not in item["properties"] and "steps" not in item["properties"]
    assert "synth" not in item["required"] and "steps" not in item["required"]


def test_prompt_explains_strudel_and_embeds_reference():
    p = build_prompt(META, MIR)
    assert "strudel" in p.lower()
    assert "note(" in p and "sound(" in p          # an example pattern is shown
    # the curated reference is embedded: a function, stack(), a drum sound, and the version pin
    assert ".lpf(" in p and "stack(" in p
    assert "bd" in p and "1.0.3" in p


def test_prompt_asks_for_body_and_grit():
    p = build_prompt(META, MIR).lower()
    assert "body" in p
    assert "grit" in p or "shape" in p             # distortion/grit via Strudel .shape/.crush


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
    assert "strudel" in p.lower()


def test_prompt_has_budget_and_consolidation_rule():
    p = build_prompt(META, MIR).lower()
    # whole-song budget: lean arrangement with both pools sized
    assert "budget" in p and "lean" in p
    assert "melodic" in p and "percussion" in p
    # consolidation rule drives merging of near-duplicates
    assert "consolidate" in p and "merge" in p


def test_prompt_softens_exhaustive_enumeration():
    # the old "enumerate every distinct track" framing drove the over-split; it's gone,
    # replaced by deliberate/lean language.
    p = build_prompt(META, MIR).lower()
    assert "enumerate every distinct" not in p
    assert "lean" in p and "deliberate" in p


def test_build_stem_prompt_budgets_per_stem():
    from audio_reference.prompt import build_stem_prompt
    drums = build_stem_prompt(META, MIR, "drums").lower()
    assert "kit" in drums and "5-8" in drums
    bass = build_stem_prompt(META, MIR, "bass").lower()
    assert "bass stem" in bass and "1-2" in bass
    vocals = build_stem_prompt(META, MIR, "vocals").lower()
    assert "vocals stem" in vocals and "1-2" in vocals
    # consolidation rule is inherited by every stem prompt
    assert "consolidate" in bass


def test_build_stem_prompt_unknown_stem_uses_generic_budget():
    from audio_reference.prompt import build_stem_prompt
    p = build_stem_prompt(META, MIR, "piano").lower()
    assert "isolated stem" in p and "1-3 parts" in p
    assert "consolidate" in p


def test_build_stem_prompt_does_not_leak_whole_song_budget():
    # the whole-song "2-6 melodic + 5-8 perc" budget must NOT appear in a single-stem prompt,
    # or it would contradict the per-stem budget.
    from audio_reference.prompt import build_stem_prompt, WHOLE_SONG_BUDGET
    bass = build_stem_prompt(META, MIR, "bass")
    assert WHOLE_SONG_BUDGET not in bass
    assert "drum kit of about 5-8" not in bass.lower()
