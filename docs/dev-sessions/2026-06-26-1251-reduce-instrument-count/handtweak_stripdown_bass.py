#!/usr/bin/env python3
"""One-off hand-tweak: replace Stripdown's bass `steps` with Les's by-ear transcription.

The model guessed a busy 1-bar arpeggio (E2 G2 A2 B2 ...) for the bass. By ear it's a
4-bar chromatic descending pedal: hammer each root in straight 8ths, walk the root down
E -> D -> C# -> C connecting the Em (i) and C (VI) chords, with the last 8th of bars 1-3
anticipating the next root (pickup) just ahead of the bar line.

Updates the bass track in `stems[].interpretation.tracks`, rebuilds score_spec via
assemble_stems, and regenerates the .md via render_stems_markdown so all three stay in
sync. Re-run `analyze` would overwrite this (hand-tuned tracks are authored) — re-apply
this script if so. Run from tools/audio-reference/.
"""
import json
from audio_reference.scorespec import assemble_stems, sanitize_numbers
from audio_reference.render import render_stems_markdown

SLUG = "agent-side-grinder-stripdown"

# 16-bar form: descending phrase A (x3) then answer phrase B (x1). Each bar = 8 eighths.
# Octaves: A-phrase sits E2..C2; B-phrase dips to A1 then climbs back A1->B1->C2->D2.
PHRASE_A = (
    ["E2"] * 7 + ["D2"] +             # pedal E, pickup to D
    ["D2"] * 7 + ["E2"] +             # pedal D, pickup back to E
    ["E2"] * 3 + ["D2"] * 4 + ["C#2"] +   # E, walk to D, pickup C#
    ["C#2"] * 3 + ["C2"] * 5           # C#, land and sit on C (over the C chord)
)
PHRASE_B = (
    ["E2"] * 7 + ["D2"] +             # pedal E, pickup to D
    ["D2"] * 7 + ["A1"] +             # pedal D, pickup DOWN to A (dip)
    ["A1"] * 3 + ["B1"] * 4 + ["C2"] +    # climb A -> B, pickup C
    ["C2"] * 3 + ["D2"] * 5            # C, rise and sit on D (sets up the return to E)
)
assert len(PHRASE_A) == 32 and len(PHRASE_B) == 32
NOTES = PHRASE_A * 3 + PHRASE_B
assert len(NOTES) == 128

PATTERN = ("16-bar bass form in driving straight 8th-notes: a 4-bar chromatic descending "
           "pedal phrase (E->D->C#->C, connecting Em(i) to C(VI)) played 3x, then a 4-bar "
           "answer phrase that dips to A and climbs back A->B->C->D. Each root is pedaled, "
           "and the last 8th of most bars anticipates the next root (pickup) ahead of the bar line.")
DESCRIPTION = ("The harmonic + rhythmic engine: a chromatic descending pedal bass with an "
               "antecedent/consequent shape (3 descending statements + 1 dip-and-rise answer). "
               "Anticipation pickups pull each change ahead of the downbeat. "
               "(Hand-transcribed by ear; replaces the model's 1-bar arpeggio guess.)")

# Fuller but PUNCHY analog patch ("bowm bowm" — each 8th re-articulates, not a drone):
# percussive AD envelope (sustain ~0, decay shapes each hit), fat saws + drive + resonant
# lowpass for rounded body, louder. High sustain made it a continuous drone — keep it low.
SYNTH_OPTIONS = {
    "oscillatorType": "sawtooth",
    "attack": 0.01, "decay": 0.34, "sustain": 0.0, "release": 0.1,
    "volume": 8, "filterType": "lowpass", "filterFrequency": 250, "filterQ": 2.5,
    "drive": 0.6, "reverbSend": 0.3,
}

d = json.load(open(f"docs/{SLUG}.json"))
meta, mir, stems, overview = d["meta"], d["mir"], d["stems"], d.get("overview")

updated = 0
for sr in stems:
    if sr["stem"] != "bass":
        continue
    for t in sr["interpretation"]["tracks"]:
        t["steps"] = {"grid": "8n", "notes": NOTES}
        t["pattern"] = PATTERN
        t["description"] = DESCRIPTION
        t["synth"] = {"type": "MonoSynth", "options": SYNTH_OPTIONS}
        updated += 1
assert updated == 1, f"expected 1 bass track, updated {updated}"

sidecar = sanitize_numbers(assemble_stems(meta, mir, stems, overview))
with open(f"docs/{SLUG}.json", "w") as fh:
    json.dump(sidecar, fh, indent=2, allow_nan=False)
with open(f"docs/{SLUG}.md", "w") as fh:
    fh.write(render_stems_markdown(meta, mir, stems, overview))
print(f"updated bass steps ({len(NOTES)} notes) + prose; rewrote {SLUG}.json + .md")
