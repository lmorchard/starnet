"""TypedDict shapes for the pipeline's JSON-serializable data (documentation only)."""
from typing import TypedDict, Optional


class Meta(TypedDict):
    artist: str
    title: str
    slug: str
    source_file: str
    model: str


class Brightness(TypedDict):
    mean_hz: float
    min_hz: float
    max_hz: float


class Dynamics(TypedDict):
    rms_mean: float
    rms_range_db: float


class Section(TypedDict):
    start: float


class MirFacts(TypedDict):
    bpm: float
    key: str
    mode: str
    key_confidence: float
    duration_sec: float
    sections: list[Section]
    brightness: Brightness
    dynamics: Dynamics
    midi_path: Optional[str]


class VocabularyGrid(TypedDict):
    timbre: str
    brightness: str
    envelope: str
    register_density: str
    harmony_mode: str
    groove: str
    space_grit: str


class SynthOptions(TypedDict, total=False):
    """Flat, Vertex-safe synth options. The harness expands these to nested Tone options.

    `drive`/`chorus`/`reverbSend` are not Tone constructor options — the harness reads them
    separately and wires per-track effect nodes (Distortion / Chorus / a reverb send).
    """
    oscillatorType: str
    count: int
    spread: float
    attack: float
    decay: float
    sustain: float
    release: float
    volume: float
    harmonicity: float
    modulationIndex: float
    filterType: str
    filterFrequency: float
    filterQ: float
    drive: float        # 0..1 distortion amount (body/grit)
    chorus: float       # 0..1 chorus wet (width)
    reverbSend: float   # 0..1 send to the shared reverb (space)


class SynthSpec(TypedDict):
    type: str               # a palette member (see scorespec.PALETTE)
    options: SynthOptions


class Steps(TypedDict):
    grid: str               # Tone subdivision, e.g. "16n", "8n"
    notes: list[str]        # token grammar: "" rest / "x" unpitched hit / "C4" note / "C4+E4" chord


class Track(TypedDict):
    name: str
    instrument: str         # prose (doc + beyond-engine inspiration)
    pattern: str            # prose
    description: str        # prose
    synth: SynthSpec        # playable
    steps: Steps            # playable


class LlmInterp(TypedDict):
    summary: str
    vocabulary: VocabularyGrid
    tracks: list[Track]
    score_draft: str


class ScoreSpec(TypedDict):
    root: str
    mode: str
    bpm: float
    tracks: list[Track]
