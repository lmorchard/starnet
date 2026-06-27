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
        "filterFrequency": 400,   # way down (was 4000->1500->400): kills the "tss", low "smaash"
        "filterQ": 1,
    },
    "Industrial Kick": {          # straight "thump": low octaves kills MembraneSynth's pitch-chirp ("thwip")
        "attack": 0.001, "decay": 0.8, "sustain": 0, "release": 0.12,
        "octaves": 1.0,           # NEW player option: tiny pitch sweep = straight thump, not a chirp
        "pitchDecay": 0.05,
        "drive": 0.0,
        "volume": 2,
    },
}

# A tonal snare BODY layered under the noise (NoiseSynth alone = no pitch = reads as a hat).
# A short MembraneSynth "tok" at a snare-body pitch, low octaves so it's a clean tone not a chirp.
SNARE_BODY_NAME = "Snare Body"
SNARE_BODY = {
    "name": SNARE_BODY_NAME,
    "instrument": "tonal snare body (membrane tok) under the noise",
    "pattern": "Backbeat on 2 & 4, doubling the Gated Snare with a pitched body for weight.",
    "description": "Layered with the Gated Snare: noise = the 'snares', this tonal hit = the drum body.",
    "synth": {"type": "MembraneSynth", "options": {
        "oscillatorType": "sine", "octaves": 1.5, "pitchDecay": 0.03,
        "attack": 0.001, "decay": 0.2, "sustain": 0, "release": 0.1,
        "volume": -1, "drive": 0.1, "reverbSend": 0.4,
    }},
    "steps": {"grid": "4n", "notes": ["", "D3", "", "D3"]},   # D3 ~ snare-body fundamental, on 2 & 4
}

# Step (rhythm) overrides — {grid, notes}. The groove Les hears:
#   thump-smash 4/4 backbone (kick on 1 & 3, snare on 2 & 4) + a 16th-note synth hat "orbital"
#   that plays for 4 bars then drops out for 4 bars ("every other 4 bars" = an 8-bar cycle).
# The hi-hat is an ACCENT/FILL, not a constant beat: a descending-pitch 16th-note metallic run
# (MetalSynth is pitched) for 1 bar, then 7 bars off. The descent gives the "orbital" motion.
# (True L->R pan-sweep isn't possible — no per-track pan / automation in the harness.)
_HAT_FILL = ["C6", "B5", "A#5", "A5", "G#5", "G5", "F#5", "F5",
             "E5", "D#5", "D5", "C#5", "C5", "B4", "A#4", "A4"]
STEPS_OVERRIDES = {
    "Industrial Kick":   {"grid": "4n",  "notes": ["A0", "", "A0", ""]},   # deep thump on 1 & 3
    # (Gated Snare already hits 2 & 4 — the smash backbeat — so it's left as-is.)
    "8th Note Hi-Hat":   {"grid": "16n", "notes": _HAT_FILL + [""] * 112},  # 1-bar descending fill, 7 off
    "Off-beat Open Hat": {"grid": "8n",  "notes": [""] * 8},                 # silenced (no constant hat)
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

# Add/refresh the tonal snare body (idempotent: drop any prior copy first), in the drums stem.
for sr in stems:
    sr["interpretation"]["tracks"] = [t for t in sr["interpretation"]["tracks"] if t.get("name") != SNARE_BODY_NAME]
for sr in stems:
    if any(t.get("name") == "Gated Snare" for t in sr["interpretation"]["tracks"]):
        sr["interpretation"]["tracks"].append(SNARE_BODY)
        break

sidecar = sanitize_numbers(assemble_stems(meta, mir, stems, overview))
with open(f"docs/{SLUG}.json", "w") as fh:
    json.dump(sidecar, fh, indent=2, allow_nan=False)
with open(f"docs/{SLUG}.md", "w") as fh:
    fh.write(render_stems_markdown(meta, mir, stems, overview))
print(f"tamed drum tracks: {', '.join(applied)}; rewrote {SLUG}.json + .md")
