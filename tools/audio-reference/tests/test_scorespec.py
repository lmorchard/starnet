from audio_reference.scorespec import (
    PALETTE, PLAYABLE_SOURCES, is_supported, build_score_spec, build_sidecar,
)

MIR = {
    "bpm": 129.0, "key": "F#", "mode": "minor", "key_confidence": 0.69,
    "duration_sec": 292.0, "sections": [{"start": 0.0}],
    "brightness": {"mean_hz": 1549.0, "min_hz": 95.0, "max_hz": 7565.0},
    "dynamics": {"rms_mean": 0.063, "rms_range_db": 22.4}, "midi_path": None,
}
META = {"artist": "The Knife", "title": "Silent Shout", "slug": "the-knife-silent-shout",
        "source_file": "x.mp3", "model": "gemini-2.5-pro"}
INTERP = {
    "summary": "s", "vocabulary": {}, "score_draft": "d",
    "tracks": [
        {"name": "Kick", "instrument": "MembraneSynth", "pattern": "1/4s", "description": "",
         "synth": {"type": "MembraneSynth", "options": {"volume": -5}},
         "steps": {"grid": "4n", "notes": ["C1", "C1", "C1", "C1"]}},
    ],
}


def test_palette_membership():
    assert is_supported("FMSynth") is True
    assert is_supported("NoiseSynth") is True
    assert is_supported("Sampler") is False        # excluded (needs assets)
    assert is_supported("Nonsense") is False
    assert "MembraneSynth" in PALETTE


def test_playable_sources_excludes_sample_based_and_matches_palette():
    # PLAYABLE_SOURCES is the single source of truth offered to the model for synth.type;
    # it must NOT offer sources the harness can't construct.
    for excluded in ("Sampler", "Player", "GrainPlayer"):
        assert excluded not in PLAYABLE_SOURCES
    assert frozenset(PLAYABLE_SOURCES) == PALETTE


def test_build_score_spec_maps_root_mode_bpm_and_passes_tracks():
    spec = build_score_spec(MIR, INTERP)
    assert spec["root"] == "F#"                    # mir.key -> root
    assert spec["mode"] == "minor"
    assert spec["bpm"] == 129.0
    assert spec["tracks"] == INTERP["tracks"]      # tracks passed through verbatim
    assert spec["tracks"][0]["synth"]["type"] == "MembraneSynth"


def test_build_score_spec_tolerates_missing_tracks():
    spec = build_score_spec(MIR, {"summary": "x"})
    assert spec["tracks"] == []


def test_build_sidecar_includes_all_blocks_and_score_spec():
    side = build_sidecar(META, MIR, INTERP)
    assert set(side.keys()) == {"meta", "mir", "interpretation", "score_spec"}
    assert side["meta"] == META
    assert side["mir"] == MIR
    assert side["interpretation"] == INTERP
    assert side["score_spec"]["bpm"] == 129.0
