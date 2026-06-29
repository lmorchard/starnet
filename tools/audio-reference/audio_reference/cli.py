"""CLI orchestration: analyze a track, (re)build the library index, or serve the player."""
import argparse
import functools
import glob
import http.server
import json
import os
import socketserver
import sys
import tempfile

from dotenv import load_dotenv

from .slug import slugify
from .config import resolve_setting
from .transcode import to_16k_mono
from .mir import extract_mir
import librosa

from .separate import separate
from .features import select_stems
from .prompt import build_prompt, build_stem_prompt, RESPONSE_SCHEMA
from .gemini import analyze_audio
from .render import render_markdown, render_stems_markdown
from .scorespec import build_sidecar, sanitize_numbers, assemble_stems
from .index import build_index
from .save import safe_slug, apply_score_spec
from .validate import validate_strudel

DEFAULT_MODEL = "gemini-2.5-pro"
DEFAULT_PORT = 8777


def _validate_tracks(tracks: list) -> None:
    """Headlessly validate each track's `strudel`; warn + tag invalid ones. Never drops a track —
    a hallucinated pattern is surfaced (stderr + `_strudel_valid:false`), not silently lost."""
    if not tracks:
        return
    results = validate_strudel([t.get("strudel", "") for t in tracks])
    for t, r in zip(tracks, results):
        if not r["ok"]:
            print(f"[validate] track {t.get('name')!r}: {r['error']}", file=sys.stderr)
            t["_strudel_valid"] = False
        elif r["events"] == 0:
            print(f"[validate] track {t.get('name')!r}: parses but 0 events (silent?)", file=sys.stderr)


def write_index(out_dir: str) -> int:
    """Scan out_dir for sidecars and (re)write index.json. Returns the entry count."""
    sidecars = []
    for f in sorted(glob.glob(os.path.join(out_dir, "*.json"))):
        if os.path.basename(f) == "index.json":
            continue
        try:
            with open(f) as fh:
                sidecars.append(json.load(fh))
        except (ValueError, OSError):
            continue  # skip unreadable / malformed sidecars
    idx = build_index(sidecars)
    with open(os.path.join(out_dir, "index.json"), "w") as fh:
        json.dump(idx, fh, indent=2)
    return len(idx)


def _analyze_stems(args, meta, mir, md_path, json_path) -> int:
    project = resolve_setting(args.project, os.environ, "GOOGLE_CLOUD_PROJECT")
    location = resolve_setting(args.location, os.environ, "GOOGLE_CLOUD_LOCATION")
    with tempfile.TemporaryDirectory() as tmp:
        print(f"[stems] separating with {args.stems_model} ...", file=sys.stderr)
        stem_wavs = separate(args.audio, tmp, args.stems_model)

        # energy gate: skip near-silent stems
        rms = {}
        for stem, wav in stem_wavs.items():
            y, sr = librosa.load(wav, sr=None, mono=True)
            rms[stem] = float((y ** 2).mean() ** 0.5) if y.size else 0.0
        keep = select_stems(rms)
        skipped = sorted(set(stem_wavs) - set(keep))
        if skipped:
            print(f"[stems] skipping near-empty: {', '.join(skipped)}", file=sys.stderr)

        stem_results = []
        for stem in keep:
            wav = stem_wavs[stem]
            print(f"[stems] analyzing '{stem}' ...", file=sys.stderr)
            smir = extract_mir(wav, None)
            wav16 = os.path.join(tmp, f"{stem}.16k.wav")
            to_16k_mono(wav, wav16)
            with open(wav16, "rb") as fh:
                audio_bytes = fh.read()
            prompt = build_stem_prompt(meta, smir, stem)
            interp = analyze_audio(audio_bytes, "audio/wav", prompt, RESPONSE_SCHEMA,
                                   args.model, project, location)
            _validate_tracks(interp.get("tracks", []))
            stem_results.append({"stem": stem, "mir": smir, "interpretation": interp})

        # Whole-song overview: the per-stem passes are each blind to the others, so nothing
        # describes the track as a whole. One full-mix pass gives a holistic read (summary +
        # 7-dimension vocabulary + score_draft). Its tracks are ignored — score_spec uses stems.
        print("[stems] analyzing full mix (overview) ...", file=sys.stderr)
        mix16 = os.path.join(tmp, "fullmix.16k.wav")
        to_16k_mono(args.audio, mix16)
        with open(mix16, "rb") as fh:
            mix_bytes = fh.read()
        overview = analyze_audio(mix_bytes, "audio/wav", build_prompt(meta, mir), RESPONSE_SCHEMA,
                                 args.model, project, location)

    print("[stems] rendering artifacts ...", file=sys.stderr)
    sidecar = sanitize_numbers(assemble_stems(meta, mir, stem_results, overview))
    md = render_stems_markdown(meta, mir, stem_results, overview)
    with open(md_path, "w") as fh:
        fh.write(md)
    with open(json_path, "w") as fh:
        json.dump(sidecar, fh, indent=2, allow_nan=False)
    write_index(args.out)
    print(f"wrote {md_path}\nwrote {json_path}\nrefreshed {os.path.join(args.out, 'index.json')}",
          file=sys.stderr)
    return 0


def cmd_analyze(args) -> int:
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

    if args.stems:
        return _analyze_stems(args, meta, mir, md_path, json_path)

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
    _validate_tracks(llm.get("tracks", []))

    print("[4/4] rendering artifacts ...", file=sys.stderr)
    md = render_markdown(meta, mir, llm)
    with open(md_path, "w") as fh:
        fh.write(md)
    with open(json_path, "w") as fh:
        # sanitize_numbers + allow_nan=False guarantee strict, browser-parseable JSON
        # (Gemini can emit Infinity for a numeric option, which json.loads silently accepts).
        json.dump(sanitize_numbers(build_sidecar(meta, mir, llm)), fh, indent=2, allow_nan=False)

    write_index(args.out)  # keep the player's library manifest fresh

    print(f"wrote {md_path}\nwrote {json_path}"
          + (f"\nwrote {midi_path}" if midi_path and mir.get("midi_path") else "")
          + f"\nrefreshed {os.path.join(args.out, 'index.json')}",
          file=sys.stderr)
    return 0


def cmd_index(args) -> int:
    n = write_index(args.out)
    print(f"wrote {os.path.join(args.out, 'index.json')} ({n} tracks)", file=sys.stderr)
    return 0


class _NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    """Static handler + a POST /save/<slug> route that writes a tweaked score_spec back to
    docs/<slug>.json. No-cache so edited player.js / fresh docs are always served."""
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *a):  # quiet per-request logging
        pass

    def do_POST(self):
        if not self.path.startswith("/save/"):
            self.send_error(404, "not found")
            return
        slug = self.path[len("/save/"):]
        if not safe_slug(slug):
            self.send_error(400, "bad slug")
            return
        path = os.path.join(self.directory, "docs", f"{slug}.json")
        if not os.path.isfile(path):
            self.send_error(404, "no such track")
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            score_spec = json.loads(self.rfile.read(length))
            with open(path) as fh:
                sidecar = json.load(fh)
            merged = sanitize_numbers(apply_score_spec(sidecar, score_spec))
            with open(path, "w") as fh:
                json.dump(merged, fh, indent=2, allow_nan=False)
            write_index(os.path.join(self.directory, "docs"))
        except (ValueError, OSError) as e:
            self.send_error(400, f"save failed: {e}")
            return
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"ok":true}')


class _Server(socketserver.TCPServer):
    allow_reuse_address = True


def cmd_play(args) -> int:
    directory = os.path.abspath(args.dir)
    handler = functools.partial(_NoCacheHandler, directory=directory)
    with _Server(("127.0.0.1", args.port), handler) as httpd:
        url = f"http://127.0.0.1:{args.port}/player/"
        print(f"serving {directory}", file=sys.stderr)
        print(f"open {url}   (Ctrl-C to stop)", file=sys.stderr)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped.", file=sys.stderr)
    return 0


def main(argv=None) -> int:
    argv = argv if argv is not None else sys.argv[1:]
    # Load .env (cwd + parents) so GOOGLE_CLOUD_PROJECT / GOOGLE_CLOUD_LOCATION
    # need not be exported each run. CLI flags still win over .env (resolve_setting).
    load_dotenv()
    parser = argparse.ArgumentParser(prog="audio-reference")
    sub = parser.add_subparsers(dest="cmd", required=True)

    a = sub.add_parser("analyze", help="analyze one track")
    a.add_argument("audio")
    a.add_argument("--artist", required=True)
    a.add_argument("--title", required=True)
    a.add_argument("--out", default="docs")
    a.add_argument("--no-midi", action="store_true")
    a.add_argument("--stems", action="store_true", help="separate into stems and analyze each in isolation")
    a.add_argument("--stems-model", default="htdemucs_ft", help="Demucs model (e.g. htdemucs_ft, htdemucs_6s)")
    a.add_argument("--model", default=DEFAULT_MODEL)
    a.add_argument("--project", default=None)
    a.add_argument("--location", default=None)
    a.set_defaults(func=cmd_analyze)

    ix = sub.add_parser("index", help="(re)build docs/index.json from existing sidecars")
    ix.add_argument("--out", default="docs")
    ix.set_defaults(func=cmd_index)

    pl = sub.add_parser("play", help="serve the player + docs locally (does not open a browser)")
    pl.add_argument("--port", type=int, default=DEFAULT_PORT)
    pl.add_argument("--dir", default=".", help="directory to serve (must contain player/ and docs/)")
    pl.set_defaults(func=cmd_play)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
