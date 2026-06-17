"""I/O boundary: librosa + basic-pitch → measured-facts dict. Uses keyest for key/mode."""
import numpy as np
import librosa

from .keyest import estimate_key


def _sections(y, sr) -> list[dict]:
    """Coarse structural boundaries (seconds) via librosa onset/agglomerative segmentation."""
    try:
        boundaries = librosa.segment.agglomerative(
            librosa.feature.mfcc(y=y, sr=sr), 8
        )
        times = librosa.frames_to_time(boundaries, sr=sr)
        return [{"start": float(t)} for t in times]
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
    rms_nonzero = rms[rms > 0]
    rms_range_db = (
        float(20 * np.log10(rms_nonzero.max() / rms_nonzero.min()))
        if rms_nonzero.size else 0.0
    )

    midi_path = _midi(input_path, midi_out) if midi_out else None

    return {
        "bpm": bpm,
        "key": key,
        "mode": mode,
        "key_confidence": conf,
        "duration_sec": duration,
        "sections": _sections(y, sr),
        "brightness": {
            "mean_hz": float(centroid.mean()),
            "min_hz": float(centroid.min()),
            "max_hz": float(centroid.max()),
        },
        "dynamics": {
            "rms_mean": float(rms.mean()),
            "rms_range_db": rms_range_db,
        },
        "midi_path": midi_path,
    }
