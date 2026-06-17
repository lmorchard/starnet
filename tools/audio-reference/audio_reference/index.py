"""Pure: build the docs/index.json manifest — one summary row per analyzed track.

The browser player fetches this to render a clickable library (no OS file picker).
"""


def index_entry(sidecar: dict) -> dict:
    """Summarize one JSON sidecar (meta + score_spec) into a manifest row."""
    meta = sidecar.get("meta", {})
    spec = sidecar.get("score_spec", {})
    return {
        "slug": meta.get("slug", ""),
        "artist": meta.get("artist", ""),
        "title": meta.get("title", ""),
        "root": spec.get("root", ""),
        "mode": spec.get("mode", ""),
        "bpm": spec.get("bpm"),
        "tracks": len(spec.get("tracks", []) or []),
    }


def build_index(sidecars) -> list:
    """Manifest rows for a list of sidecars, sorted by slug for a stable library order."""
    return sorted((index_entry(s) for s in sidecars), key=lambda e: e["slug"])
