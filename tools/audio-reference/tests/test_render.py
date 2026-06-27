from audio_reference.render import render_markdown

META = {
    "artist": "TR/ST", "title": "Icabod", "slug": "trst-icabod",
    "source_file": "icabod.flac", "model": "gemini-2.5-pro",
}
MIR = {
    "bpm": 120.0, "key": "A", "mode": "minor", "key_confidence": 0.82,
    "duration_sec": 245.3,
    "sections": [{"start": 0.0}, {"start": 32.5}, {"start": 120.0}],
    "brightness": {"mean_hz": 1800.0, "min_hz": 400.0, "max_hz": 6000.0},
    "dynamics": {"rms_mean": 0.12, "rms_range_db": 14.0},
    "timbre": {"rolloff_hz": 3200.0, "flatness": 0.12, "contrast": 18.0, "zcr": 0.08, "harmonic_ratio": 0.78},
    "midi_path": "trst-icabod.mid",
}
LLM = {
    "summary": "Brooding analog synthpop with a relentless pulse.",
    "vocabulary": {
        "timbre": "detuned saw pads", "brightness": "dark, low cutoff",
        "envelope": "slow-attack pads", "register_density": "sub bass + sparse lead",
        "harmony_mode": "natural minor, static", "groove": "four-on-the-floor, mechanical",
        "space_grit": "long reverb, light tape grit",
    },
    "tracks": [
        {"name": "pad bed", "instrument": "PolySynth", "pattern": "whole-note swells, 8-bar arc",
         "description": "detuned saw pad, slow attack"},
        {"name": "sub bass", "instrument": "MonoSynth", "pattern": "root-note 1/8s, side-chained",
         "description": "square sub pulse at A1"},
        {"name": "kick", "instrument": "MembraneSynth", "pattern": "four-on-the-floor 1/4s",
         "description": "tight analog kick"},
    ],
    "score_draft": "fatsawtooth drone, square bass at A1, lowpass ~600Hz.",
}


def test_render_includes_header_and_measured_facts():
    md = render_markdown(META, MIR, LLM)
    assert "# TR/ST — Icabod" in md
    assert "120" in md and "A minor" in md          # measured facts surfaced
    assert "4:05" in md                              # 245.3s formatted m:ss
    assert "3 sections" in md or "Sections: 3" in md


def test_render_flags_ground_truth_vs_interpretation():
    md = render_markdown(META, MIR, LLM)
    # the measured block must be labeled as MIR ground truth
    assert "Measured" in md
    # the model interpretation must be labeled too
    assert "Interpretation" in md or "interpretation" in md


def test_render_has_all_seven_vocabulary_dimensions():
    md = render_markdown(META, MIR, LLM)
    for label in ["Timbre", "Brightness", "Envelope", "Register", "Harmony", "Groove", "Space"]:
        assert label in md


def test_render_track_table_shows_instrument_and_pattern():
    md = render_markdown(META, MIR, LLM)
    # the tracks table headers
    assert "Instrument" in md and "Pattern" in md
    # each track's name, Tone.js source, and pattern surface
    assert "pad bed" in md and "sub bass" in md and "kick" in md
    assert "PolySynth" in md and "MonoSynth" in md and "MembraneSynth" in md
    assert "four-on-the-floor 1/4s" in md


def test_render_includes_score_draft_flagged_speculative():
    md = render_markdown(META, MIR, LLM)
    assert "Score-draft" in md or "Score Draft" in md
    assert "speculative" in md.lower()
    assert "fatsawtooth drone" in md


def test_render_stems_markdown_groups_by_stem():
    from audio_reference.render import render_stems_markdown
    stem_results = [
        {"stem": "drums", "mir": {}, "interpretation": {"summary": "punchy kit",
            "tracks": [{"name": "Kick", "instrument": "MembraneSynth", "pattern": "1/4", "description": "boom"}]}},
        {"stem": "bass", "mir": {}, "interpretation": {"summary": "growl bass",
            "tracks": [{"name": "Sub", "instrument": "MonoSynth", "pattern": "1/8", "description": "low"}]}},
    ]
    md = render_stems_markdown(META, MIR, stem_results)
    assert "# TR/ST — Icabod" in md
    assert "120" in md and "A minor" in md
    assert "## drums" in md and "## bass" in md
    assert "punchy kit" in md and "growl bass" in md
    assert "Kick" in md and "Sub" in md


def test_render_stems_markdown_includes_overview_when_provided():
    from audio_reference.render import render_stems_markdown
    overview = {
        "summary": "Brooding analog synthpop with a relentless pulse.",
        "vocabulary": LLM["vocabulary"],
        "tracks": [],
        "score_draft": "fatsawtooth drone, square bass at A1.",
    }
    stem_results = [
        {"stem": "drums", "mir": {}, "interpretation": {"summary": "punchy kit",
            "tracks": [{"name": "Kick", "instrument": "MembraneSynth", "pattern": "1/4", "description": "boom"}]}},
    ]
    md = render_stems_markdown(META, MIR, stem_results, overview)
    # whole-song summary surfaces near the top
    assert "Brooding analog synthpop" in md
    # an Overview section with the full 7-dimension vocabulary grid
    assert "Overview" in md
    for label in ["Timbre", "Brightness", "Envelope", "Register", "Harmony", "Groove", "Space"]:
        assert label in md
    # song-level score draft, flagged speculative
    assert "speculative" in md.lower() and "fatsawtooth drone" in md
    # and the per-stem section is still present
    assert "## drums" in md and "punchy kit" in md


def test_render_stems_markdown_without_overview_has_no_overview_section():
    from audio_reference.render import render_stems_markdown
    stem_results = [{"stem": "drums", "mir": {}, "interpretation": {"summary": "punchy kit", "tracks": []}}]
    md = render_stems_markdown(META, MIR, stem_results)
    assert "Overview (full-mix read)" not in md
