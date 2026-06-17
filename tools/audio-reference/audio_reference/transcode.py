"""ffmpeg transcode to 16kHz mono (what Gemini uses internally, and under Vertex's size cap)."""
import subprocess


def ffmpeg_args(input_path: str, output_path: str) -> list[str]:
    """Pure: build the ffmpeg command line."""
    return [
        "ffmpeg", "-y",
        "-i", input_path,
        "-ac", "1",          # mono
        "-ar", "16000",      # 16 kHz
        output_path,
    ]


def to_16k_mono(input_path: str, output_path: str) -> None:
    """I/O boundary: run ffmpeg. Raises CalledProcessError on failure."""
    subprocess.run(
        ffmpeg_args(input_path, output_path),
        check=True,
        capture_output=True,
    )
