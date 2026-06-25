"""ffmpeg transcode to 16 kHz mono — matched to how Gemini consumes audio, and a size guard.

Per Google's audio docs, Gemini downsamples audio to a low ("16 Kbps") resolution, combines
multiple channels into one, and represents each second as just 32 tokens — so a pristine
high-rate stereo file gives it nothing extra (it reduces to mono/low-res itself). We do the
reduction up front mainly to stay under the 20 MB inline-request cap; it is NOT a quality lever
(the 32-tokens/sec representation, not our transcode, is what limits fine-timbre fidelity).
The full-quality MIR path (mir.py, native sample rate) is unaffected.
See: https://ai.google.dev/gemini-api/docs/audio
"""
import subprocess


def ffmpeg_args(input_path: str, output_path: str) -> list[str]:
    """Pure: build the ffmpeg command line."""
    return [
        "ffmpeg", "-y",
        "-i", input_path,
        "-ac", "1",          # mono (Gemini downmixes to one channel anyway)
        "-ar", "16000",      # 16 kHz (well within Gemini's reduced internal resolution)
        output_path,
    ]


def to_16k_mono(input_path: str, output_path: str) -> None:
    """I/O boundary: run ffmpeg. Raises CalledProcessError on failure."""
    subprocess.run(
        ffmpeg_args(input_path, output_path),
        check=True,
        capture_output=True,
    )
