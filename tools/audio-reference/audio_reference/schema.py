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


class Track(TypedDict):
    """One arrangement channel: an instrument driven by a pattern.

    Names/roles are invented per piece (no fixed taxonomy); `instrument` is a
    Tone.js source type or a short custom-synthesis description.
    """
    name: str
    instrument: str
    pattern: str
    description: str


class LlmInterp(TypedDict):
    summary: str
    vocabulary: VocabularyGrid
    tracks: list[Track]
    score_draft: str
