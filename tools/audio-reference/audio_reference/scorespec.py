"""Pure: the playable score-spec + the JSON sidecar assembly.

A score-spec is `{root, mode, bpm, tracks}` — the data the player plays. `root`/`mode`/`bpm`
come from the MIR ground truth; `tracks` are the LLM's enriched tracks (each carrying a
`strudel` pattern string) passed through verbatim. The assembly here is field-agnostic, so it
needs no change as the per-track playable field evolves.
"""
import math

# Tone.js sources — RETAINED for the reference Tone player (player/tone-player.js) and the
# pre-Strudel corpus. The live analyzer no longer emits `synth.type`; PALETTE is no longer in the
# prompt path. Keep in sync with player/tone-player.js PALETTE.
PLAYABLE_SOURCES = [
    "Synth", "MonoSynth", "DuoSynth", "FMSynth", "AMSynth", "PolySynth",
    "MembraneSynth", "MetalSynth", "NoiseSynth", "PluckSynth",
]
PALETTE = frozenset(PLAYABLE_SOURCES)


def is_supported(synth_type: str) -> bool:
    """True if the harness can construct this Tone.js source."""
    return synth_type in PALETTE


def build_score_spec(mir: dict, interp: dict) -> dict:
    """Assemble the playable score-spec from MIR ground truth + LLM interpretation."""
    return {
        "root": mir["key"],
        "mode": mir["mode"],
        "bpm": mir["bpm"],
        "tracks": interp.get("tracks", []),
    }


def build_sidecar(meta: dict, mir: dict, interp: dict) -> dict:
    """The full JSON sidecar: measured + interpreted data + the playable score-spec."""
    return {
        "meta": meta,
        "mir": mir,
        "interpretation": interp,
        "score_spec": build_score_spec(mir, interp),
    }


def assemble_stems(meta: dict, mir_global: dict, stem_results: list, overview: dict = None) -> dict:
    """Merge per-stem analyses into one sidecar. root/mode/bpm come from the full-mix MIR;
    every per-stem track is tagged with its stem. stem_results: [{stem, mir, interpretation}].

    `overview` (optional) is a whole-song interpretation from analyzing the full mix — a
    holistic read (summary + 7-dimension vocabulary + score_draft) that the per-stem passes,
    each blind to the others, can't provide. Stored under top-level `overview`; the playable
    `score_spec` tracks still come from the (better-isolated) stems, not the overview."""
    tracks = []
    for sr in stem_results:
        for t in sr.get("interpretation", {}).get("tracks", []):
            tracks.append({**t, "stem": sr["stem"]})
    sidecar = {
        "meta": meta,
        "mir": mir_global,
        "stems": stem_results,
        "score_spec": {
            "root": mir_global["key"],
            "mode": mir_global["mode"],
            "bpm": mir_global["bpm"],
            "tracks": tracks,
        },
    }
    if overview is not None:
        sidecar["overview"] = overview
    return sidecar


def sanitize_numbers(obj):
    """Return a copy with non-finite floats (inf/-inf/nan) replaced by None.

    Gemini sometimes emits `Infinity` for a numeric option (e.g. `filterQ`). Python's
    json.loads accepts it (a non-standard extension) and json.dump writes it back as the
    literal `Infinity` — which is invalid JSON that the browser's JSON.parse rejects. Coerce
    to None: it serializes as `null`, and the harness already skips null options (Tone default).
    """
    if isinstance(obj, float):
        return obj if math.isfinite(obj) else None
    if isinstance(obj, dict):
        return {k: sanitize_numbers(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize_numbers(v) for v in obj]
    return obj
