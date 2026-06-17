from audio_reference.config import resolve_setting


def test_flag_wins_over_env():
    assert resolve_setting("flagval", {"X": "envval"}, "X") == "flagval"


def test_env_used_when_no_flag():
    assert resolve_setting(None, {"X": "envval"}, "X") == "envval"


def test_none_when_neither():
    assert resolve_setting(None, {}, "X") is None
