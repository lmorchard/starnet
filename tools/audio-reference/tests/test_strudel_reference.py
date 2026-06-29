from audio_reference.strudel_reference import (
    AVAILABLE_SOUNDS,
    STRUDEL_VERSION,
    strudel_reference_block,
)


def test_available_sounds_has_synth_and_drums():
    assert "sawtooth" in AVAILABLE_SOUNDS["synth"]
    assert "bd" in AVAILABLE_SOUNDS["drums"]
    assert "hh" in AVAILABLE_SOUNDS["drums"]


def test_reference_block_names_core_functions():
    block = strudel_reference_block()
    for token in ["note(", "sound(", "stack(", ".lpf(", ".room(", ".gain("]:
        assert token in block


def test_reference_block_lists_available_sounds():
    block = strudel_reference_block()
    for sound in ["sawtooth", "triangle", "bd", "hh", "sd"]:
        assert sound in block


def test_reference_block_is_version_pinned():
    block = strudel_reference_block()
    assert STRUDEL_VERSION in block
    assert STRUDEL_VERSION == "1.0.3"


def test_reference_block_documents_rev_with_parens():
    # bare `.rev` is not a getter in 1.0.3 (confirmed against the runtime); document `.rev()`.
    assert ".rev()" in strudel_reference_block()


def test_reference_warns_mininotation_is_string_only_and_offers_cat():
    # the `<note(...), note(...)>` failure mode (mini-notation used as bare JS) — the reference must
    # say `< > [ ]` etc. are string-only and point to cat()/stack() for whole-pattern combination.
    block = strudel_reference_block()
    assert "cat(" in block
    assert "ONLY VALID INSIDE A STRING" in block
