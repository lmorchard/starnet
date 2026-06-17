"""Pure: robust summaries of per-frame MIR features.

librosa hands back per-frame RMS and spectral-centroid arrays that include the
track's near-silent head/tail. Naive min/max over those frames produces nonsense
(e.g. a 140 dB "dynamic range", a 0 Hz brightness floor). These helpers gate out
silence and use percentiles so the reported figures are physically meaningful.
"""
import numpy as np


def dynamic_range_db(rms, floor_db: float = -60.0,
                     lo_pct: float = 5.0, hi_pct: float = 95.0) -> float:
    """Spread (dB) of the loud portion of a per-frame RMS envelope.

    Frame levels are taken relative to the peak; frames quieter than `floor_db`
    below peak (silence) are dropped, then the lo..hi percentile spread is returned.
    """
    rms = np.asarray(rms, dtype=float)
    rms = rms[np.isfinite(rms)]
    if rms.size == 0:
        return 0.0
    peak = rms.max()
    if peak <= 0:
        return 0.0
    db = 20.0 * np.log10(np.maximum(rms, peak * 1e-6) / peak)  # <= 0 dB, relative to peak
    voiced = db[db > floor_db]
    if voiced.size == 0:
        return 0.0
    lo, hi = np.percentile(voiced, [lo_pct, hi_pct])
    return float(hi - lo)


def brightness_stats(centroid, rms, floor_ratio: float = 0.05):
    """(mean, min, max) spectral centroid over *voiced* frames only.

    Frames whose RMS is below `floor_ratio` of the peak are treated as silence and
    excluded, so the brightness floor isn't pinned to 0 Hz by silent frames. Falls
    back to the raw centroid when RMS can't be aligned (different length / all zero).
    """
    centroid = np.asarray(centroid, dtype=float)
    rms = np.asarray(rms, dtype=float)
    if centroid.size == 0:
        return (0.0, 0.0, 0.0)
    if rms.size == centroid.size and rms.size and rms.max() > 0:
        mask = rms > rms.max() * floor_ratio
        voiced = centroid[mask] if mask.any() else centroid
    else:
        voiced = centroid
    return (float(voiced.mean()), float(voiced.min()), float(voiced.max()))


def dedupe_sections(times, min_gap: float = 2.0) -> list[float]:
    """Sort boundary times and drop any that fall within `min_gap` of the previous kept one."""
    out: list[float] = []
    for t in sorted(float(x) for x in times):
        if not out or t - out[-1] >= min_gap:
            out.append(t)
    return out
