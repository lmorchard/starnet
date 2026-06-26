#!/usr/bin/env python3
"""Count melodic vs percussion tracks per audio-reference corpus artifact.

Classification mirrors player/player.js: percussion = synth.type in
{MembraneSynth, MetalSynth, NoiseSynth}, everything else melodic. Also flags
likely near-duplicate parts (same pool + same synth.type appearing >1x) as a
rough proxy for the over-splitting the prompt change targets.

Usage: python3 count_tracks.py [DOCS_DIR]   (default: tools/audio-reference/docs)
"""
import json
import sys
from collections import Counter
from pathlib import Path

PERC = {"MembraneSynth", "MetalSynth", "NoiseSynth"}

docs = Path(sys.argv[1] if len(sys.argv) > 1 else
            "tools/audio-reference/docs")

rows = []
for jf in sorted(docs.glob("*.json")):
    if jf.name == "index.json":
        continue
    data = json.loads(jf.read_text())
    tracks = data.get("score_spec", {}).get("tracks", [])
    mel = perc = 0
    type_counts = Counter()
    for t in tracks:
        stype = (t.get("synth") or {}).get("type", "?")
        pool = "perc" if stype in PERC else "mel"
        type_counts[(pool, stype)] += 1
        if pool == "perc":
            perc += 1
        else:
            mel += 1
    dups = {k: c for k, c in type_counts.items() if c > 1}
    rows.append((jf.stem, mel, perc, len(tracks), dups))

print(f"{'track':<52} {'mel':>4} {'perc':>5} {'total':>6}   near-dup (pool/type:count)")
print("-" * 110)
tot_mel = tot_perc = tot = 0
for name, mel, perc, total, dups in rows:
    tot_mel += mel
    tot_perc += perc
    tot += total
    dupstr = ", ".join(f"{p}/{ty}:{c}" for (p, ty), c in sorted(dups.items())) or "-"
    print(f"{name:<52} {mel:>4} {perc:>5} {total:>6}   {dupstr}")
print("-" * 110)
n = len(rows) or 1
print(f"{'MEAN':<52} {tot_mel/n:>4.1f} {tot_perc/n:>5.1f} {tot/n:>6.1f}")
print(f"\nTarget: ~2-6 melodic + ~5-8 percussion.  Player caps: 4 melodic + 6 perc.")
