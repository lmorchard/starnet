"""TypedDict shapes for the pipeline's JSON-serializable data (documentation only)."""
from typing import TypedDict, Optional, NotRequired


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


class Timbre(TypedDict):
    rolloff_hz: float
    flatness: float        # 0 = tonal, 1 = noisy
    contrast: float
    zcr: float
    harmonic_ratio: float  # 1 = tonal/harmonic, 0 = percussive


class MirFacts(TypedDict):
    bpm: float
    key: str
    mode: str
    key_confidence: float
    duration_sec: float
    sections: list[Section]
    brightness: Brightness
    dynamics: Dynamics
    timbre: Timbre
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


# SynthSpec / Steps describe the OLD Tone-shaped playable projection. They are retained to
# document the reference Tone player's data (player/tone-player.js) and the pre-Strudel corpus;
# the live analyzer no longer emits them — a Track now carries `strudel` (see below).
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
    strudel: str            # playable: one Strudel pattern expression — the editable source of truth
    stem: NotRequired[str]              # which separated stem this track came from (stems mode only)
    _strudel_valid: NotRequired[bool]   # tagged False by the analyze pipeline when the node
                                        # validator can't evaluate `strudel`; absent = valid/unchecked


class LlmInterp(TypedDict):
    summary: str
    vocabulary: VocabularyGrid
    tracks: list[Track]
    score_draft: str


class StemResult(TypedDict):
    stem: str
    mir: MirFacts
    interpretation: LlmInterp


class ScoreSpec(TypedDict):
    root: str
    mode: str
    bpm: float
    tracks: list[Track]
