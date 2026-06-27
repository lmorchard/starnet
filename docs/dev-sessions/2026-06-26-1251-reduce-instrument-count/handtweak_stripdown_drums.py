#!/usr/bin/env python3
"""Hand-tweak: tame Stripdown's drums by ear (Les: "snares really prominent and smashy").

Merges option OVERRIDES into named drum tracks (keeps their other options). The main offender
is the Gated Snare: reverbSend 0.75 made every hit explode into the long cathedral tail, plus a
harsh bandpass + no volume trim. Pull the reverb down so it punches dry, trim it, tighten/darken.

Run from tools/audio-reference/. Re-run analyze would overwrite this (hand-tuned = authored).
"""
import json
from audio_reference.scorespec import assemble_stems, sanitize_numbers
from audio_reference.render import render_stems_markdown

SLUG = "agent-side-grinder-stripdown"

# track name -> option overrides (merged into the track's existing synth.options)
# Les wants the snare SMASHIER/CRASHIER (industrial gated-reverb snare). The dry hit is clamped
# short by the harness (PERC: decay<=0.2, release<=0.1), so the crash comes from a big reverb
# tail + loud + bright broadband noise.
OVERRIDES = {
    "Gated Snare": {
        "reverbSend": 0.7,        # big crash tail in the 4.5s cathedral
        "volume": 4,              # loud, up front
        "decay": 0.2,             # as long as the PERC clamp allows
        "filterType": "lowpass",  # KEEP the body (highpass left only hiss = "tsss"); lowpass = "smash"
        "filterFrequency": 1500,  # down ~an octave from 4000: deeper, less hissy smash
        "filterQ": 1,
    },
    "Industrial Kick": {          # "thwipp" -> deep "thump" with sub: kill the synthy edge, long boom
        "attack": 0.001, "decay": 0.8, "sustain": 0, "release": 0.12,
        "drive": 0.0,             # the drive was the synthy "thwip"
        "volume": 2,
    },
}

# Step (rhythm) overrides — {grid, notes}. The groove Les hears:
#   thump-smash 4/4 backbone (kick on 1 & 3, snare on 2 & 4) + a 16th-note synth hat "orbital"
#   that plays for 4 bars then drops out for 4 bars ("every other 4 bars" = an 8-bar cycle).
_BAR16 = ["x"] * 16                  # one bar of straight 16th-note hat hits
_OFFBEATS = ["", "x"] * 4            # one bar of 8th-note offbeats (the open hat)
STEPS_OVERRIDES = {
    "Industrial Kick":   {"grid": "4n",  "notes": ["A0", "", "A0", ""]},   # deep thump on 1 & 3
    # (Gated Snare already hits 2 & 4 — the smash backbeat — so it's left as-is.)
    "8th Note Hi-Hat":   {"grid": "16n", "notes": _BAR16 * 4 + [""] * 64},  # 16ths: 4 bars on, 4 off
    "Off-beat Open Hat": {"grid": "8n",  "notes": _OFFBEATS * 4 + [""] * 32},  # offbeats: 4 on, 4 off
}

d = json.load(open(f"docs/{SLUG}.json"))
meta, mir, stems, overview = d["meta"], d["mir"], d["stems"], d.get("overview")

applied = set()
for sr in stems:
    for t in sr["interpretation"]["tracks"]:
        name = t.get("name")
        if name in OVERRIDES:
            t.setdefault("synth", {}).setdefault("options", {}).update(OVERRIDES[name])
            applied.add(name)
        if name in STEPS_OVERRIDES:
            so = STEPS_OVERRIDES[name]
            t["steps"] = {"grid": so["grid"], "notes": so["notes"]}
            applied.add(name)
missing = (set(OVERRIDES) | set(STEPS_OVERRIDES)) - applied
assert not missing, f"tracks not found: {missing}"

sidecar = sanitize_numbers(assemble_stems(meta, mir, stems, overview))
with open(f"docs/{SLUG}.json", "w") as fh:
    json.dump(sidecar, fh, indent=2, allow_nan=False)
with open(f"docs/{SLUG}.md", "w") as fh:
    fh.write(render_stems_markdown(meta, mir, stems, overview))
print(f"tamed drum tracks: {', '.join(applied)}; rewrote {SLUG}.json + .md")
