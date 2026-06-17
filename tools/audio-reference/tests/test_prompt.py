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


def test_response_schema_track_requires_synth_and_steps():
    item = RESPONSE_SCHEMA["properties"]["tracks"]["items"]
    for field in ["synth", "steps"]:
        assert field in item["properties"]
        assert field in item["required"]
    synth = item["properties"]["synth"]
    assert "type" in synth["properties"] and "options" in synth["properties"]
    steps = item["properties"]["steps"]
    assert "grid" in steps["properties"] and "notes" in steps["properties"]
    # notes is an array of plain strings (Vertex-safe token grammar)
    assert steps["properties"]["notes"]["type"] == "array"
    assert steps["properties"]["notes"]["items"]["type"] == "string"


def test_prompt_explains_synth_steps_and_token_grammar():
    p = build_prompt(META, MIR).lower()
    assert "synth" in p and "steps" in p
    assert "grid" in p
    # the token grammar must be spelled out for the model
    assert "rest" in p and "chord" in p
