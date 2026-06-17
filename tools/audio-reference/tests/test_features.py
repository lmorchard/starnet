from audio_reference.features import (
    dynamic_range_db,
    brightness_stats,
    dedupe_sections,
)


# --- dynamic_range_db: silent frames must not blow up the range ---

def test_silent_frames_dont_blow_up_range():
    # a near-silent head + a normal body. Naive 20*log10(max/min) would be ~100 dB;
    # the gated/percentile range must stay sane.
    rms = [1e-5] * 10 + [0.2, 0.25, 0.3, 0.28, 0.22, 0.26, 0.24, 0.21, 0.27, 0.23] * 5
    r = dynamic_range_db(rms)
    assert 0.0 <= r < 40.0


def test_constant_level_is_near_zero_range():
    assert dynamic_range_db([0.4] * 100) < 1.0


def test_empty_or_silent_returns_zero():
    assert dynamic_range_db([]) == 0.0
    assert dynamic_range_db([0.0, 0.0, 0.0]) == 0.0


# --- brightness_stats: silent frames must be excluded from the centroid floor ---

def test_silent_frames_excluded_from_brightness():
    rms = [0.0, 0.0, 0.0, 1.0, 1.0, 1.0]
    centroid = [0.0, 0.0, 0.0, 1000.0, 1200.0, 1400.0]
    mean, lo, hi = brightness_stats(centroid, rms)
    assert lo == 1000.0          # the 0 Hz silent frames are gated out
    assert hi == 1400.0
    assert 1000.0 <= mean <= 1400.0


def test_brightness_falls_back_when_lengths_mismatch():
    # if rms can't be aligned, just use the centroid as-is (no crash)
    mean, lo, hi = brightness_stats([500.0, 1500.0], [0.5])
    assert lo == 500.0 and hi == 1500.0


# --- dedupe_sections: merge boundaries that are too close together ---

def test_dedupe_merges_close_boundaries():
    times = [0.0, 0.5, 1.4, 2.0, 80.0, 81.0, 82.5]
    assert dedupe_sections(times, min_gap=2.0) == [0.0, 2.0, 80.0, 82.5]


def test_dedupe_sorts_and_keeps_first():
    assert dedupe_sections([5.0, 0.0, 5.1], min_gap=2.0) == [0.0, 5.0]
