from audio_reference.save import safe_slug, apply_score_spec


def test_safe_slug_accepts_plain_kebab():
    assert safe_slug("trst-icabod")
    assert safe_slug("the-knife-silent-shout")
    assert safe_slug("blacklung")


def test_safe_slug_rejects_unsafe():
    for bad in ["", "../etc", "a/b", "a.b", "UPPER", "trailing-", "-lead", "a--b", "a b"]:
        assert not safe_slug(bad), bad


def test_apply_score_spec_replaces_only_score_spec():
    sidecar = {"meta": {"slug": "x"}, "mir": {"bpm": 120}, "interpretation": {"summary": "s"},
               "score_spec": {"root": "A", "tracks": []}}
    new = {"root": "C", "mode": "minor", "bpm": 120,
           "tracks": [{"name": "k", "strudel": 'sound("bd*4")'}]}
    out = apply_score_spec(sidecar, new)
    assert out["score_spec"] == new
    assert out["score_spec"]["tracks"][0]["strudel"] == 'sound("bd*4")'   # edited Strudel round-trips
    assert out["meta"] == sidecar["meta"]            # other blocks preserved
    assert out["mir"] == sidecar["mir"]
    assert out["interpretation"] == sidecar["interpretation"]
    assert sidecar["score_spec"] == {"root": "A", "tracks": []}  # input not mutated
