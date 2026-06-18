"""I/O boundary: run Demucs (via subprocess) to split a track into stems.

Demucs + torch are heavy and optional — install the `[stems]` extra. Invoked as a subprocess
(`python -m demucs ...`) to avoid importing torch into the main process and to dodge API churn.
"""
import glob
import os
import subprocess
import sys


def separate(input_path: str, out_dir: str, model: str = "htdemucs_ft") -> dict:
    """Split `input_path` into stems with Demucs. Returns {stem_name: wav_path}.

    Demucs writes `<out_dir>/<model>/<track_basename>/<stem>.wav`. Raises RuntimeError with a
    clear message if Demucs isn't installed or the run fails.
    """
    cmd = [sys.executable, "-m", "demucs", "-n", model, "--out", out_dir, input_path]
    try:
        subprocess.run(cmd, check=True, capture_output=True)
    except FileNotFoundError as e:
        raise RuntimeError("demucs not available — install the [stems] extra "
                           "(uv sync --extra stems)") from e
    except subprocess.CalledProcessError as e:
        msg = e.stderr.decode("utf-8", "replace")[-2000:] if e.stderr else str(e)
        if "No module named demucs" in msg:
            msg = "demucs not installed — run: uv sync --extra stems"
        raise RuntimeError(f"demucs failed: {msg}") from e

    stem_root = os.path.join(out_dir, model)
    found = {}
    for wav in glob.glob(os.path.join(stem_root, "*", "*.wav")):
        stem = os.path.splitext(os.path.basename(wav))[0]   # e.g. "drums"
        found[stem] = wav
    if not found:
        raise RuntimeError(f"demucs produced no stems under {stem_root}")
    return found
