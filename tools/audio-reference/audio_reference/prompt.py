"""Pure: assemble the Gemini prompt + structured-output response schema.

The vocabulary + tracks model are Tone.js-centric general synthesis language, so the
output maps onto any Tone.js project's scores — Starnet is one consumer. A track is one
instrument (a Tone.js source) driven by one pattern; track names are invented per piece.
"""

# The Tone.js source palette offered to the model as vocabulary (not a hard constraint).
TONE_SOURCES = [
    "Synth", "MonoSynth", "DuoSynth", "FMSynth", "AMSynth", "PolySynth",
    "MembraneSynth", "MetalSynth", "NoiseSynth", "PluckSynth",
    "Sampler", "Player", "GrainPlayer",
]

# Gemini structured-output schema (a JSON Schema subset Vertex accepts).
RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "vocabulary": {
            "type": "object",
            "properties": {
                "timbre": {"type": "string"},
                "brightness": {"type": "string"},
                "envelope": {"type": "string"},
                "register_density": {"type": "string"},
                "harmony_mode": {"type": "string"},
                "groove": {"type": "string"},
                "space_grit": {"type": "string"},
            },
            "required": ["timbre", "brightness", "envelope", "register_density",
                         "harmony_mode", "groove", "space_grit"],
        },
        "tracks": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "instrument": {"type": "string"},
                    "pattern": {"type": "string"},
                    "description": {"type": "string"},
                    "synth": {
                        "type": "object",
                        "properties": {
                            "type": {"type": "string"},
                            "options": {
                                "type": "object",
                                "properties": {
                                    "oscillatorType": {"type": "string"},
                                    "count": {"type": "integer"},
                                    "spread": {"type": "number"},
                                    "attack": {"type": "number"},
                                    "decay": {"type": "number"},
                                    "sustain": {"type": "number"},
                                    "release": {"type": "number"},
                                    "volume": {"type": "number"},
                                    "harmonicity": {"type": "number"},
                                    "modulationIndex": {"type": "number"},
                                    "filterType": {"type": "string"},
                                    "filterFrequency": {"type": "number"},
                                    "filterQ": {"type": "number"},
                                },
                            },
                        },
                        "required": ["type", "options"],
                    },
                    "steps": {
                        "type": "object",
                        "properties": {
                            "grid": {"type": "string"},
                            "notes": {"type": "array", "items": {"type": "string"}},
                        },
                        "required": ["grid", "notes"],
                    },
                },
                "required": ["name", "instrument", "pattern", "description", "synth", "steps"],
            },
        },
        "score_draft": {"type": "string"},
    },
    "required": ["summary", "vocabulary", "tracks", "score_draft"],
}


def build_prompt(meta: dict, mir: dict) -> str:
    sections = ", ".join(f"{s['start']:.1f}s" for s in mir["sections"])
    palette = ", ".join(TONE_SOURCES)
    return f"""You are a synthesis-literate music analyst. You are listening to an audio track
and producing a TECHNICAL breakdown for a developer who builds reactive synth music in Tone.js
and CANNOT hear audio. Be concrete and parameter-oriented, not poetic.

Track: "{meta['title']}" by {meta['artist']}.

MEASURED GROUND TRUTH (from signal analysis — treat these as authoritative; do NOT contradict them):
- Tempo: {mir['bpm']:.0f} BPM
- Key: {mir['key']} {mir['mode']} (confidence {mir['key_confidence']:.2f})
- Duration: {mir['duration_sec']:.0f}s
- Section boundaries at: {sections}
- Spectral centroid (brightness): mean {mir['brightness']['mean_hz']:.0f} Hz
- Dynamics: RMS range {mir['dynamics']['rms_range_db']:.1f} dB

Describe the track along these SEVEN dimensions (one concise reading each):
  timbre, brightness, envelope, register/density, harmony/mode, groove, space/grit.

Then break the piece into TRACKS. A TRACK is one INSTRUMENT driven by one PATTERN.
Enumerate every distinct track you actually hear (don't force a fixed set). For each track give:
- name: a short label you INVENT to fit THIS piece (e.g. "sub bass", "shimmer pad", "noise riser").
- instrument: the Tone.js source that would most naturally produce it — one of:
    {palette}
  — OR a brief description of a CUSTOM synthesis approach if no built-in source fits
  (e.g. "two detuned FMSynths through a bitcrusher"). Custom answers are encouraged where apt.
- pattern: the figure driving it — subdivision/step rhythm, note movement, density,
  phrase length, and dynamics (e.g. "root-note 1/8s, side-chained, 2-bar loop").
- description: its role in the arrangement, when it enters/drops, and any space/FX.
- synth: a PLAYABLE instrument spec — `type` MUST be one of the Tone.js sources:
    {palette}
  (pick the nearest if the real instrument is sample-based), and `options` is a FLAT object
  using only these optional scalar fields where relevant: oscillatorType (e.g. "sawtooth",
  "square", "fatsawtooth", "triangle", "sine"), count, spread, attack, decay, sustain,
  release, volume (dB, usually negative), harmonicity, modulationIndex, filterType, filterFrequency, filterQ.
- steps: a PLAYABLE 1-2 bar loop — `grid` is the Tone subdivision (e.g. "16n", "8n", "4n")
  and `notes` is an ARRAY OF STRINGS using this token grammar:
    "" (empty string) = a rest; "x" = an unpitched hit (use for NoiseSynth percussion);
    "C4" = a single note; "C4+E4+G4" = a chord (plus-separated). Keep it consistent with the
    pattern and grid you described, and concrete enough to loop.

Finally, write a short SCORE-DRAFT STARTER: concrete Tone.js-flavored suggestions
(oscillator types, ADSR, filter cutoff/Q, example note arrays) that would approximate this track.
Mark it as speculative.

Respond ONLY as JSON matching the provided schema."""
