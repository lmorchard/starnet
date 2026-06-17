from audio_reference.index import index_entry, build_index

SIDE_A = {"meta": {"slug": "trst-icabod", "artist": "TR/ST", "title": "Icabod"},
          "score_spec": {"root": "F#", "mode": "minor", "bpm": 126.0, "tracks": [{}, {}, {}]}}
SIDE_B = {"meta": {"slug": "the-knife-silent-shout", "artist": "The Knife", "title": "Silent Shout"},
          "score_spec": {"root": "E", "mode": "major", "bpm": 129.0, "tracks": [{}]}}


def test_index_entry_summarizes_meta_and_spec():
    assert index_entry(SIDE_A) == {
        "slug": "trst-icabod", "artist": "TR/ST", "title": "Icabod",
        "root": "F#", "mode": "minor", "bpm": 126.0, "tracks": 3,
    }


def test_build_index_sorted_by_slug():
    idx = build_index([SIDE_B, SIDE_A])
    assert [e["slug"] for e in idx] == ["the-knife-silent-shout", "trst-icabod"]
    assert idx[1]["tracks"] == 3


def test_index_entry_tolerates_missing_fields():
    e = index_entry({})
    assert e["slug"] == "" and e["tracks"] == 0 and e["bpm"] is None
