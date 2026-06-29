import os
import shutil

import pytest

from audio_reference.validate import validate_strudel

_VALIDATOR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "validator"))
_have_validator = bool(shutil.which("node")) and os.path.isdir(os.path.join(_VALIDATOR, "node_modules"))
requires_validator = pytest.mark.skipif(
    not _have_validator, reason="needs node + validator/node_modules (run `npm install` in validator/)"
)


def test_empty_input_returns_empty():
    assert validate_strudel([]) == []


@requires_validator
def test_valid_pattern_is_ok_with_events():
    [r] = validate_strudel(['note("c3 e3 g3").s("sawtooth").lpf(600)'])
    assert r["ok"] is True
    assert r["events"] > 0
    assert r["error"] is None


@requires_validator
def test_bogus_pattern_is_flagged():
    [r] = validate_strudel(['notez("c3").bogusFn()'])
    assert r["ok"] is False
    assert r["error"]  # non-empty error message


@requires_validator
def test_batch_preserves_order_and_length():
    rs = validate_strudel(['note("c3").s("sawtooth")', 'notez()', 'stack(sound("bd hh sd hh"))'])
    assert len(rs) == 3
    assert rs[0]["ok"] is True
    assert rs[1]["ok"] is False
    assert rs[2]["ok"] is True
