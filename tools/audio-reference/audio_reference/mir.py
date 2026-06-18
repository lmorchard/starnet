"""I/O boundary: librosa + basic-pitch → measured-facts dict. Uses keyest for key/mode."""
import numpy as np
import librosa

from .keyest import estimate_key
from .features import dynamic_range_db, brightness_stats, dedupe_sections, harmonic_ratio, voiced_mean


def _sections(y, sr) -> list[dict]:
    """Coarse structural boundaries (seconds) via librosa onset/agglomerative segmentation.

    Agglomerative clustering into a fixed count tends to emit near-duplicate boundaries;
    `dedupe_sections` merges any that fall within ~2s of each other.
    """
    try:
        boundaries = librosa.segment.agglomerative(
            librosa.feature.mfcc(y=y, sr=sr), 8
        )
        times = librosa.frames_to_time(boundaries, sr=sr)
        return [{"start": t} for t in dedupe_sections(times, min_gap=2.0)]
    except Exception:
        return [{"start": 0.0}]


def _midi(input_path: str, out_path: str) -> str | None:
    """Optional basic-pitch transcription. Returns the .mid path, or None on any failure."""
    try:
        from basic_pitch.inference import predict_and_save
        from basic_pitch import ICASSP_2022_MODEL_PATH
        import os
        out_dir = os.path.dirname(out_path) or "."
        predict_and_save([input_path], out_dir, True, False, False, False,
                         model_or_model_path=ICASSP_2022_MODEL_PATH)
        # basic-pitch names output "<stem>_basic_pitch.mid"; caller renames to out_path.
        stem = os.path.splitext(os.path.basename(input_path))[0]
        produced = os.path.join(out_dir, f"{stem}_basic_pitch.mid")
        if os.path.exists(produced):
            os.replace(produced, out_path)
            return out_path
        return None
    except Exception:
        return None


def extract_mir(input_path: str, midi_out: str | None) -> dict:
    """Run MIR on the ORIGINAL (full-quality) file. midi_out=None skips transcription."""
    y, sr = librosa.load(input_path, sr=None, mono=True)
    duration = float(librosa.get_duration(y=y, sr=sr))

    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    bpm = float(np.atleast_1d(tempo)[0])

    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    key, mode, conf = estimate_key(chroma.mean(axis=1).tolist())

    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    rms = librosa.feature.rms(y=y)[0]
    # Gate near-silent head/tail frames so dynamics/brightness stay physical.
    b_mean, b_min, b_max = brightness_stats(centroid, rms)
    rms_range_db = dynamic_range_db(rms)

    rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
    flatness = librosa.feature.spectral_flatness(y=y)[0]
    contrast = librosa.feature.spectral_contrast(y=y, sr=sr)
    zcr = librosa.feature.zero_crossing_rate(y)[0]
    y_harm, y_perc = librosa.effects.hpss(y)
    timbre = {
        "rolloff_hz": voiced_mean(rolloff, rms),
        "flatness": float(flatness.mean()),
        "contrast": float(contrast.mean()),
        "zcr": float(zcr.mean()),
        "harmonic_ratio": harmonic_ratio(y_harm, y_perc),
    }

    midi_path = _midi(input_path, midi_out) if midi_out else None

    return {
        "bpm": bpm,
        "key": key,
        "mode": mode,
        "key_confidence": conf,
        "duration_sec": duration,
        "sections": _sections(y, sr),
        "brightness": {
            "mean_hz": b_mean,
            "min_hz": b_min,
            "max_hz": b_max,
        },
        "dynamics": {
            "rms_mean": float(rms.mean()),
            "rms_range_db": rms_range_db,
        },
        "timbre": timbre,
        "midi_path": midi_path,
    }
