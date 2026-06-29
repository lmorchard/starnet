"""Write a hand-translated Strudel sidecar for Stripdown, derived from the known-good Tone-era
analysis (git HEAD). Keeps meta/mir/interpretation/overview prose; swaps each track's playable
field synth/steps -> strudel; drops the dead open-hat; regenerates the .md; refreshes index.json."""
import json, subprocess, sys, os
sys.path.insert(0, ".")
from audio_reference.validate import validate_strudel
from audio_reference.render import render_stems_markdown
from audio_reference.cli import write_index

WT = "/Users/lorchard/devel/starnet-game-2026/.claude/worktrees/audio-strudel-analyzer"
DOCS = os.path.join(WT, "tools/audio-reference/docs")
side = json.loads(subprocess.check_output(
    ["git", "-C", WT, "show", "origin/main:tools/audio-reference/docs/agent-side-grinder-stripdown.json"]))

SPC = {"1m": 1, "1n": 1, "2n": 2, "4n": 4, "8n": 8, "16n": 16, "32n": 32}
def tok(t):
    if t == "": return "~"
    if "+" in t: return "[" + ",".join(p.lower() for p in t.split("+")) + "]"
    return t.lower()
def melodic(notes, grid, suffix, trim=False):
    spc = SPC[grid]; notes = list(notes)
    if trim:
        while len(notes) % spc: notes.pop()
    body = " ".join(tok(t) for t in notes); bars = len(notes) / spc
    return f'note("{body}"){"" if bars==1 else f".slow({bars:g})"}{suffix}'

MELODIC = {
    # Electric-piano-ish FM: harmonicity 1 (1:1, warm) + a MODERATE index that DECAYS fast via the
    # mod-envelope = bright "tine" attack then mellow body (jangly EP/guitar). No distortion (it was
    # the harsh/shrill part); lowpass tames the top; room+delay for melancholic space.
    "Goth Lead Synth": '.s("sine").fm(6).fmh(2).fmattack(0.001).fmdecay(0.6).fmsustain(0.35)'
                       '.attack(0.002).decay(0.3).sustain(0.45).release(0.6)'
                       '.lpf(4500).room(0.5).delay(0.12).gain(0.85)',
    "Cathedral Pad": '.s("sawtooth").attack(2.5).release(5).lpf(1200).room(0.8).gain(0.4)',
    "Lead Drone (unison double)": '.s("sawtooth").lpf(1900).attack(0.05).release(2.8).room(0.9).gain(0.4)',
    # Punchy analog bass, up front: open the lowpass so harmonics/grit come through (de-mud),
    # tight amp decay for punch, drive for analog grit, gain up front.
    "Motorik Bass": '.s("sawtooth").lpf(1500).resonance(3).distort(0.6)'
                    '.attack(0.004).decay(0.16).sustain(0.3).release(0.08).gain(0.95)',
}
CUSTOM = {
    "Industrial Kick": 'sound("bd ~ bd ~").gain(1.1)',
    "Gated Snare": 'sound("~ sd ~ sd").room(0.6).gain(0.9)',
    "8th Note Hi-Hat": 'cat(note("c6 b5 a#5 a5 g#5 g5 f#5 f5 e5 d#5 d5 c#5 c5 b4 a#4 a4").s("hh").gain(0.5), silence, silence, silence, silence, silence, silence, silence)',
}
DROP = {"Off-beat Open Hat"}

def strudel_for(t):
    name = t["name"]
    if name in CUSTOM: return CUSTOM[name]
    return melodic(t["steps"]["notes"], t["steps"]["grid"], MELODIC[name], trim=(name == "Motorik Bass"))

def convert(tracks):
    out = []
    for t in tracks:
        if t["name"] in DROP: continue
        nt = {k: t[k] for k in ("name", "instrument", "pattern", "description") if k in t}
        if "stem" in t: nt["stem"] = t["stem"]
        nt["strudel"] = strudel_for(t)
        out.append(nt)
    return out

# score_spec tracks (player reads these) + per-stem interpretation tracks (the .md renders these)
side["score_spec"]["tracks"] = convert(side["score_spec"]["tracks"])
for sr in side.get("stems", []):
    sr["interpretation"]["tracks"] = convert(sr["interpretation"].get("tracks", []))

# MIR octave-halved the tempo (detected ~120 for a track that moves at ~240); the patterns are
# correct as authored (1 cycle = 1 bar of eighths), so double score_spec.bpm to the felt rate. The
# player's .cpm(bpm/4) then renders it at tempo. mir.bpm stays the raw measurement.
side["score_spec"]["bpm"] = side["score_spec"]["bpm"] * 2

# validate final playable set
res = validate_strudel([t["strudel"] for t in side["score_spec"]["tracks"]])
bad = [(t["name"], r["error"]) for t, r in zip(side["score_spec"]["tracks"], res) if not r["ok"]]
assert not bad, f"invalid after translate: {bad}"
print(f"all {len(res)} tracks valid")

jpath = os.path.join(DOCS, "agent-side-grinder-stripdown.json")
mpath = os.path.join(DOCS, "agent-side-grinder-stripdown.md")
with open(jpath, "w") as fh:
    json.dump(side, fh, indent=2, allow_nan=False)
with open(mpath, "w") as fh:
    fh.write(render_stems_markdown(side["meta"], side["mir"], side["stems"], side.get("overview")))
n = write_index(DOCS)
print(f"wrote {jpath}\nwrote {mpath}\nindex: {n} tracks")
