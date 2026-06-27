#!/usr/bin/env python3
"""Hand-tweak: trim Stripdown's arrangement to the tracks Les wants to keep (by ear).

Removes tracks that don't serve the arrangement. Idempotent — drops them if present, across
all stems. Run from tools/audio-reference/. Re-running analyze would restore them.
"""
import json
from audio_reference.scorespec import assemble_stems, sanitize_numbers
from audio_reference.render import render_stems_markdown

SLUG = "agent-side-grinder-stripdown"
REMOVE = {
    "Digital Clap/Rim",
    "Overdriven Chords",
    "Declamatory Lead Vocal",
    "Wailing Sax Solo",
}

d = json.load(open(f"docs/{SLUG}.json"))
meta, mir, stems, overview = d["meta"], d["mir"], d["stems"], d.get("overview")

removed = []
for sr in stems:
    keep = []
    for t in sr["interpretation"]["tracks"]:
        (removed if t.get("name") in REMOVE else keep).append(t.get("name"))
    sr["interpretation"]["tracks"] = [t for t in sr["interpretation"]["tracks"] if t.get("name") not in REMOVE]

sidecar = sanitize_numbers(assemble_stems(meta, mir, stems, overview))
with open(f"docs/{SLUG}.json", "w") as fh:
    json.dump(sidecar, fh, indent=2, allow_nan=False)
with open(f"docs/{SLUG}.md", "w") as fh:
    fh.write(render_stems_markdown(meta, mir, stems, overview))
print(f"removed: {', '.join(removed) or '(none — already gone)'}; rewrote {SLUG}.json + .md")
