"""Pure: the playable score-spec + the JSON sidecar assembly.

A score-spec is `{root, mode, bpm, tracks}` — the generalized, engine-shaped data the
browser harness plays. `root`/`mode`/`bpm` come from the MIR ground truth; `tracks` are
the LLM's enriched tracks (each carrying `synth` + `steps`) passed through verbatim.
"""
import math

# Tone.js sources the harness can construct (ordered, for prompting). The single source of
# truth for "playable" instruments — excludes sample-based sources (Sampler/Player/GrainPlayer)
# which need audio assets. Keep in sync with player/player.js PALETTE.
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
