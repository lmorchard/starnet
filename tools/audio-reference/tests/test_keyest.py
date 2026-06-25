from audio_reference.keyest import estimate_key

# pitch class index: C=0, C#=1, D=2, D#=3, E=4, F=5, F#=6, G=7, G#=8, A=9, A#=10, B=11


def _chroma_for(pitch_classes):
    v = [0.05] * 12  # small noise floor
    for pc in pitch_classes:
        v[pc] = 1.0
    return v


def test_a_minor_triad_reads_a_minor():
    # A, C, E
    key, mode, conf = estimate_key(_chroma_for([9, 0, 4]))
    assert key == "A"
    assert mode == "minor"
    assert 0.0 <= conf <= 1.0


def test_c_major_triad_reads_c_major():
    # C, E, G
    key, mode, conf = estimate_key(_chroma_for([0, 4, 7]))
    assert key == "C"
    assert mode == "major"


def test_confidence_is_normalized():
    key, mode, conf = estimate_key(_chroma_for([0, 4, 7]))
    assert 0.0 <= conf <= 1.0
