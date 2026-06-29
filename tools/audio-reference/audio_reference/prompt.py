"""Pure: assemble the Gemini prompt + structured-output response schema.

A track is one instrument driven by one pattern; track names are invented per piece. The PROSE
fields (instrument/pattern/description) describe synthesis in general terms (Tone.js source names
are used as a familiar timbre vocabulary), while the PLAYABLE field is a `strudel` code string —
one Strudel pattern expression authored from the curated STRUDEL REFERENCE.
"""

from .strudel_reference import strudel_reference_block

# The Tone.js source palette offered to the model for the PROSE `instrument` field — the
# full vocabulary, including sample-based sources, since prose is just descriptive.
TONE_SOURCES = [
    "Synth", "MonoSynth", "DuoSynth", "FMSynth", "AMSynth", "PolySynth",
    "MembraneSynth", "MetalSynth", "NoiseSynth", "PluckSynth",
    "Sampler", "Player", "GrainPlayer",
]

# Arrangement budgets: the model over-splits without an explicit ceiling — bass lines become
# two near-identical synths, a lead vocal plus its reverb tail become two tracks, etc. These
# strings are injected into the TRACKS section (whole-song by default; per-stem in stem mode).
WHOLE_SONG_BUDGET = (
    "ARRANGEMENT BUDGET: aim for a LEAN, deliberate arrangement — about 2-6 melodic/harmonic "
    "parts PLUS a drum kit of about 5-8 percussion pieces. Prefer fewer, fuller tracks."
)

# Per-stem budgets (keys are demucs stem basenames). Each stem is analyzed in isolation, so a
# whole-song budget doesn't bind it — without a per-stem ceiling the bass stem alone yields 2-3
# tracks. Unknown stems (e.g. piano/guitar under htdemucs_6s) fall back to GENERIC_STEM_BUDGET.
STEM_BUDGETS = {
    "drums": (
        "ARRANGEMENT BUDGET: this is the DRUMS stem — render the kit as about 5-8 distinct "
        "percussion pieces (kick, snare, claps, hats, toms, cymbals). Don't split a single "
        "hi-hat or snare pattern into multiple tracks unless they are genuinely independent voices."
    ),
    "bass": (
        "ARRANGEMENT BUDGET: this is the BASS stem — output 1-2 parts at most. A sub-bass PLUS a "
        "separate driven mid-bass is two; a single bassline you'd merely describe at two "
        "intensities or FX settings is ONE."
    ),
    "vocals": (
        "ARRANGEMENT BUDGET: this is the VOCALS stem — output 1-2 parts. A lead vocal and its "
        "reverb/double/harmony layer is ONE track, not two."
    ),
    "other": (
        "ARRANGEMENT BUDGET: this is the OTHER stem (pads, leads, arps, FX) — output 1-3 parts. "
        "Merge stacked pads that share a register or role."
    ),
}
GENERIC_STEM_BUDGET = (
    "ARRANGEMENT BUDGET: this is one isolated stem — output 1-3 parts at most; consolidate "
    "near-duplicates."
)

# Universal consolidation rule (applies whole-song and per-stem).
CONSOLIDATION_RULE = (
    "CONSOLIDATE near-duplicates: if two candidate tracks differ ONLY in FX (reverb/delay/width), "
    "octave, or intensity (subdued vs driven), MERGE them into ONE track capturing the dominant "
    "character. Two hi-hats -> one; a subdued + a driven bass of the same line -> one."
)

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
                    "strudel": {"type": "string"},
                },
                "required": ["name", "instrument", "pattern", "description", "strudel"],
            },
        },
        "score_draft": {"type": "string"},
    },
    "required": ["summary", "vocabulary", "tracks", "score_draft"],
}


def build_prompt(meta: dict, mir: dict, budget: str | None = None) -> str:
    budget = budget or WHOLE_SONG_BUDGET
    sections = ", ".join(f"{s['start']:.1f}s" for s in mir["sections"])
    palette = ", ".join(TONE_SOURCES)
    tb = mir.get("timbre", {})
    return f"""You are a synthesis-literate music analyst. You are listening to an audio track
and producing a TECHNICAL breakdown for a developer who builds reactive synth music in Strudel
(a live-coding pattern language) and CANNOT hear audio. Be concrete and parameter-oriented, not poetic.

Track: "{meta['title']}" by {meta['artist']}.

MEASURED GROUND TRUTH (from signal analysis — treat these as authoritative; do NOT contradict them):
- Tempo: {mir['bpm']:.0f} BPM
- Key: {mir['key']} {mir['mode']} (confidence {mir['key_confidence']:.2f})
- Duration: {mir['duration_sec']:.0f}s
- Section boundaries at: {sections}
- Spectral centroid (brightness): mean {mir['brightness']['mean_hz']:.0f} Hz
- Dynamics: RMS range {mir['dynamics']['rms_range_db']:.1f} dB
- Timbre: spectral rolloff {tb.get('rolloff_hz', 0):.0f} Hz, flatness {tb.get('flatness', 0):.2f} (0=tonal,1=noisy), contrast {tb.get('contrast', 0):.1f}, zero-crossing {tb.get('zcr', 0):.3f}, harmonic ratio {tb.get('harmonic_ratio', 0):.2f} (1=tonal, 0=percussive)

Describe the track along these SEVEN dimensions (one concise reading each):
  timbre, brightness, envelope, register/density, harmony/mode, groove, space/grit.

Then break the piece into TRACKS. A TRACK is one INSTRUMENT driven by one PATTERN.
{budget}
Identify the FEW tracks that actually define the piece — be deliberate and lean, not exhaustive.
Don't force a fixed set, but don't pad it either: prefer fewer, fuller tracks over many thin
near-duplicates. {CONSOLIDATION_RULE}
For each track give:
- name: a short label you INVENT to fit THIS piece (e.g. "sub bass", "shimmer pad", "noise riser").
- instrument: the Tone.js source that would most naturally produce it — one of:
    {palette}
  — OR a brief description of a CUSTOM synthesis approach if no built-in source fits
  (e.g. "two detuned FMSynths through a bitcrusher"). Custom answers are encouraged where apt.
- pattern: the figure driving it — subdivision/step rhythm, note movement, density,
  phrase length, and dynamics (e.g. "root-note 1/8s, side-chained, 2-bar loop").
- description: its role in the arrangement, when it enters/drops, and any space/FX.
- strudel: a PLAYABLE Strudel pattern for this track, as ONE code-string EXPRESSION — e.g.
    note("c2 [eb2 g2] c2 g1").sound("sawtooth").lpf(600).resonance(4).gain(0.7)
  Use ONLY the functions and sounds in the STRUDEL REFERENCE below. Pitched parts:
  note("...").sound(<synth>); drums/percussion: sound("bd ~ sd ~") with the drum names listed.
  GIVE IT BODY where the track calls for it — shape the filter (.lpf/.cutoff + .resonance), add
  grit (.shape/.crush), width/space (.room/.delay/.pan) — matched to THIS song (heavy for
  industrial/aggressive, clean for clean tracks). Make it a 1-2 cycle loop consistent with the
  pattern + harmony you described.
{strudel_reference_block()}

HARMONIZE the playable `strudel` pattern to the MODE and MOOD you actually hear — do NOT just follow the
measured major/minor label. The measured key is the best automatic estimate, but at lower
confidence it often names the relative MAJOR of a darker MINOR tonality (or vice-versa); major
and its relative minor share the same notes, so the FEEL comes from which chords you voice and
which tonic you center on. If the track feels dark/minor, voice MINOR chords and center on the
minor tonic even when the measured label says major. (The measured key stays the reported fact;
only the playable harmony should follow your ears.)

Finally, write a short SCORE-DRAFT STARTER: concrete synthesis suggestions
(sound/oscillator choices, ADSR, filter cutoff/Q, example Strudel patterns) that would approximate this track.
Mark it as speculative.

Respond ONLY as JSON matching the provided schema."""


def build_stem_prompt(meta: dict, mir: dict, stem: str) -> str:
    """Per-stem prompt: same task as build_prompt, but framed as one isolated stem with a
    stem-specific arrangement budget (the whole-song budget doesn't bind a single stem)."""
    intro = (
        f'IMPORTANT: You are hearing ONLY the isolated "{stem}" stem of "{meta["title"]}" '
        f"(separated from the full mix). Describe just the instrument(s) present in THIS stem. "
        f"Ignore anything you'd expect from other stems.\n\n"
    )
    return intro + build_prompt(meta, mir, budget=STEM_BUDGETS.get(stem, GENERIC_STEM_BUDGET))


def build_repair_prompt(bad_code: str, error: str) -> str:
    """A focused fix-it turn: a generated Strudel pattern failed to evaluate — return a corrected
    one. Fed the validator's exact error + the same curated reference the original was authored from."""
    return f"""A Strudel pattern you wrote failed to evaluate and must be fixed.

BROKEN PATTERN:
{bad_code}

EVALUATION ERROR: {error}

Return a CORRECTED single Strudel pattern expression that preserves the musical intent as closely
as possible (same notes / rhythm / sound where you can) but evaluates cleanly. Use ONLY the
functions and sounds in the reference below. A common cause: mini-notation symbols like `< > [ ]`
only work INSIDE a string — to alternate whole patterns use cat(...), to layer use stack(...).
{strudel_reference_block()}

Respond ONLY as JSON: {{"strudel": "<the corrected expression>"}}."""
