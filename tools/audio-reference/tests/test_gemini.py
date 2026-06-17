import json

from audio_reference.gemini import is_transient


def test_truncated_json_is_transient():
    # a malformed/truncated response body (long outputs near the token cap)
    err = json.JSONDecodeError("Expecting ',' delimiter", "{bad", 3)
    assert is_transient(err) is True


def test_ordinary_errors_are_not_transient():
    assert is_transient(ValueError("nope")) is False
    assert is_transient(KeyError("missing")) is False
    assert is_transient(Exception("generic")) is False
