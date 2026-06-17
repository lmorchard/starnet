"""Pure: Krumhansl-Schmuckler key/mode estimation from a 12-bin chroma vector."""
import numpy as np

_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Krumhansl-Kessler key profiles.
_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def _corr(a: np.ndarray, b: np.ndarray) -> float:
    a = a - a.mean()
    b = b - b.mean()
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


def estimate_key(chroma_mean) -> tuple[str, str, float]:
    """Return (key_name, "major"|"minor", confidence in 0..1)."""
    chroma = np.asarray(chroma_mean, dtype=float)
    best = ("C", "major", -2.0)
    for tonic in range(12):
        maj = _corr(chroma, np.roll(_MAJOR, tonic))
        minr = _corr(chroma, np.roll(_MINOR, tonic))
        if maj > best[2]:
            best = (_NOTES[tonic], "major", maj)
        if minr > best[2]:
            best = (_NOTES[tonic], "minor", minr)
    # map correlation (-1..1) onto a 0..1 confidence
    conf = max(0.0, min(1.0, (best[2] + 1.0) / 2.0))
    return (best[0], best[1], conf)
