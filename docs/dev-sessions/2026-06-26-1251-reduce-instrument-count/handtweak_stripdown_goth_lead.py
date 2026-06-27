#!/usr/bin/env python3
"""Hand-tweak: re-voice Stripdown's "Goth Lead Synth" from a frantic distorted-saw arpeggio
toward a sultry, spooky-60s reverb guitar with a hand-transcribed melody (Les, by ear).

HOW TO EDIT:
- TIMBRE lives in SYNTH (synth type + options). reverbSend 0..1 feeds the shared cathedral reverb.
- RHYTHM + NOTES live in GRID + the PHRASE_* arrays. Each array slot is ONE step of GRID
  ("8n" = an eighth-note; switch to "16n" for twice the resolution). "" = a rest (no trigger);
  a note name (e.g. "F#3") strikes that note. A HELD note is just a note followed by rests —
  it rings out per the synth's decay/release + reverb (there's no explicit tie). Keep each
  phrase a multiple of the grid's bar (8 slots at 8n) for clean bar alignment, though any
  length will loop.

Then run from tools/audio-reference/:
    uv run python3 ../../docs/dev-sessions/2026-06-26-1251-reduce-instrument-count/handtweak_stripdown_goth_lead.py
and refresh the player (http://127.0.0.1:8778/player/). Re-running `analyze` would overwrite
this track (hand-tuned tracks are authored), so this script re-applies it.
"""
import json
from audio_reference.scorespec import assemble_stems, sanitize_numbers
from audio_reference.render import render_stems_markdown

SLUG = "agent-side-grinder-stripdown"
TRACK = "Goth Lead Synth"

# Guitar with lots of reverb, voiced as a MonoSynth (PluckSynth's decay/ring isn't dialable;
# its pluck was too short/plucky). Sawtooth through a soft lowpass + a long-ish decay/release
# so it RINGS like a reverby guitar rather than a short stab. A touch of drive for body.
SYNTH = {"type": "MonoSynth", "options": {
    "oscillatorType": "sawtooth",
    "attack": 0.01, "decay": 0.35, "sustain": 0.25, "release": 1.2,
    "volume": 0, "filterType": "lowpass", "filterFrequency": 1600, "filterQ": 3.5,
    "drive": 0.15, "reverbSend": 0.8,
}}
GRID = "8n"

# Les's melody by ear, two phrases (4 bars), mostly E Dorian (E F# G A B C# D) + chromatic spice.
# Octaves/rhythm are a first-pass guess: D's kept low (below the E), C# reached up for the tritone.
PHRASE_1 = [   # E (held) | G E G G# A D (G# chromatic passing) | D drops below | D A G back up
    "E3", "",  "G3", "E3", "G3", "G#3", "A3", "D3",
    "", "D3",  "", "D3", "A3", "", "G3", "",
]
PHRASE_2 = [   # E F# G D | F# G C# (G->C# tritone, descending into C#3) | F# G F# A G
    "E3", "F#3", "G3", "D3", "",   "F#3", "G3", "C#3",
    "", "F#3", "G3", "F#3", "A3", "", "G3",   "",
]
# On the bass's 4th pattern (its answer phrase uses C natural, not C#), the melody follows:
# C#3 -> C3 to avoid a C/C# cross-relation clash with the bass.
PHRASE_2_VAR = [("C3" if x == "C#3" else x) for x in PHRASE_2]

PERIOD = PHRASE_1 + PHRASE_2            # the 4-bar period (statement+answer x2)
# Melody is a 16-bar loop locked to the bass's 16-bar form: period x3, then a 4th with C#->C.
NOTES = PERIOD * 3 + (PHRASE_1 + PHRASE_2_VAR)

PATTERN = ("(REWORK) Sultry, melancholic, spooky-60s guitar lead (reverb-drenched) — NOT the "
           "model's frantic 16th arpeggio. Mostly E Dorian (raised 6th = C#) with chromatic/"
           "tritone spice. Two-phrase melody by ear: P1 = E | G E G G# A D | D A G; "
           "P2 = E F# G D | F# G C# (G->C# tritone) | F# G F# A G.")
DESCRIPTION = ("Re-voiced from a bright distorted saw to a reverb-drenched ringing guitar "
               "(MonoSynth, long decay/release). Melody hand-transcribed by ear "
               "(first phrase; rhythm being refined).")

d = json.load(open(f"docs/{SLUG}.json"))
meta, mir, stems, overview = d["meta"], d["mir"], d["stems"], d.get("overview")

updated = 0
for sr in stems:
    for t in sr["interpretation"]["tracks"]:
        if t.get("name") == TRACK:
            t["synth"] = SYNTH
            t["steps"] = {"grid": GRID, "notes": NOTES}
            t["pattern"] = PATTERN
            t["description"] = DESCRIPTION
            updated += 1
assert updated == 1, f"expected 1 '{TRACK}' track, updated {updated}"

sidecar = sanitize_numbers(assemble_stems(meta, mir, stems, overview))
with open(f"docs/{SLUG}.json", "w") as fh:
    json.dump(sidecar, fh, indent=2, allow_nan=False)
with open(f"docs/{SLUG}.md", "w") as fh:
    fh.write(render_stems_markdown(meta, mir, stems, overview))
print(f"re-voiced '{TRACK}' -> {SYNTH['type']} (grid {GRID}, {len(NOTES)} steps); rewrote {SLUG}.json + .md")
