"""CLI orchestration: transcode → MIR → Gemini → render → write artifacts."""
import argparse
import json
import os
import sys
import tempfile

from .slug import slugify
from .config import resolve_setting
from .transcode import to_16k_mono
from .mir import extract_mir
from .prompt import build_prompt, RESPONSE_SCHEMA
from .gemini import analyze_audio
from .render import render_markdown

DEFAULT_MODEL = "gemini-2.5-pro"


def main(argv=None) -> int:
    argv = argv if argv is not None else sys.argv[1:]
    parser = argparse.ArgumentParser(prog="audio-reference")
    sub = parser.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("analyze", help="analyze one track")
    a.add_argument("audio")
    a.add_argument("--artist", required=True)
    a.add_argument("--title", required=True)
    a.add_argument("--out", default="docs")
    a.add_argument("--no-midi", action="store_true")
    a.add_argument("--model", default=DEFAULT_MODEL)
    a.add_argument("--project", default=None)
    a.add_argument("--location", default=None)
    args = parser.parse_args(argv)

    if args.cmd != "analyze":
        parser.error("unknown command")

    slug = slugify(args.artist, args.title)
    os.makedirs(args.out, exist_ok=True)
    md_path = os.path.join(args.out, f"{slug}.md")
    json_path = os.path.join(args.out, f"{slug}.json")
    midi_path = None if args.no_midi else os.path.join(args.out, f"{slug}.mid")

    meta = {
        "artist": args.artist, "title": args.title, "slug": slug,
        "source_file": os.path.basename(args.audio), "model": args.model,
    }

    print(f"[1/4] MIR extraction on {args.audio} ...", file=sys.stderr)
    mir = extract_mir(args.audio, midi_path)

    print("[2/4] transcoding to 16kHz mono for Gemini ...", file=sys.stderr)
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, f"{slug}.16k.wav")
        to_16k_mono(args.audio, wav)
        with open(wav, "rb") as fh:
            audio_bytes = fh.read()

    print(f"[3/4] Gemini interpretation ({args.model}) ...", file=sys.stderr)
    prompt = build_prompt(meta, mir)
    project = resolve_setting(args.project, os.environ, "GOOGLE_CLOUD_PROJECT")
    location = resolve_setting(args.location, os.environ, "GOOGLE_CLOUD_LOCATION")
    llm = analyze_audio(audio_bytes, "audio/wav", prompt, RESPONSE_SCHEMA,
                        args.model, project, location)

    print("[4/4] rendering artifacts ...", file=sys.stderr)
    md = render_markdown(meta, mir, llm)
    with open(md_path, "w") as fh:
        fh.write(md)
    with open(json_path, "w") as fh:
        json.dump({"meta": meta, "mir": mir, "interpretation": llm}, fh, indent=2)

    print(f"wrote {md_path}\nwrote {json_path}"
          + (f"\nwrote {midi_path}" if midi_path and mir.get("midi_path") else ""),
          file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
