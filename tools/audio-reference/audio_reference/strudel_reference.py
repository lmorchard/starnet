"""Curated, version-pinned Strudel reference injected into the analysis prompt.

The model's Strudel knowledge is assumed partial/stale, so the prompt hands it an AUTHORITATIVE
subset: only functions and sounds the player (`@strudel/web`) can actually run. Every function and
sound below was confirmed by evaluating it against the live player runtime (session 2026-06-29);
generated patterns are additionally checked headlessly by the node validator (`validate.py`).

Pinned so prompt and runtime can't silently drift.
"""

# @strudel/web version the player loads (player/index.html). The vocabulary below is what THAT
# runtime accepts (e.g. `.rev()` needs parens here; bare `.rev` is not a getter in 1.0.3).
STRUDEL_VERSION = "1.0.3"

# Curated reliable subset of the ~227 sounds @strudel/web registers — chosen so the model picks
# recognizable, stable names, not obscure sample packs. `note(...).sound(<synth/noise>)` for
# pitched/colored; `sound(<drum>)` for unpitched hits.
AVAILABLE_SOUNDS = {
    "synth": ["sawtooth", "square", "triangle", "sine"],
    "noise": ["white", "pink", "brown"],
    "drums": ["bd", "sd", "rim", "cp", "hh", "oh", "lt", "mt", "ht", "cr", "rd", "cb", "perc"],
}


def strudel_reference_block() -> str:
    """The reference text injected into the prompt (single-sourced from AVAILABLE_SOUNDS)."""
    synth = ", ".join(AVAILABLE_SOUNDS["synth"])
    noise = ", ".join(AVAILABLE_SOUNDS["noise"])
    drums = ", ".join(AVAILABLE_SOUNDS["drums"])
    return f"""
STRUDEL REFERENCE (pinned to @strudel/web {STRUDEL_VERSION} — use ONLY what is listed here):

A pattern is one expression realized per CYCLE (treat one cycle as one bar). Write a 1-2 cycle loop.

MINI-NOTATION (inside the string given to note()/sound()/n()):
  "a b c d"  sequence across the cycle      "~"   a rest
  "[a b]"    subdivide a step (twice speed)  "a*2" speed/repeat a step up
  "<a b>"    alternate, one per cycle        "a/2" stretch a step over 2 cycles
  "a,b"      stack (sound together)          "a!3" repeat a three times

PITCHED vs UNPITCHED:
  note("c3 eb3 g3").sound("sawtooth")  pitched — note names (c d e f g a b, sharps c#, flats eb, octave digit) or numbers
  sound("bd ~ sd ~")                   unpitched drum hits (a drum name below)
  n("0 2 4").sound("sawtooth")         index into a scale

SOUNDS — synth (use with note()): {synth}
       — noise: {noise}
       — drums (use with sound()): {drums}

STRUCTURE / TRANSFORMS:
  stack(p1, p2, ...)  layer parts        .fast(n) / .slow(n)  speed up / down
  .rev()              reverse (parens!)  .add(note(n))        transpose by n semitones
  .struct("x ~ x x")  impose a rhythm    .euclid(3, 8)        euclidean rhythm
  .ply(n)             repeat each event  .degradeBy(0..1)     randomly thin events

EFFECTS (chain after the sound):
  .lpf(hz) / .cutoff(hz)  low-pass cutoff    .hpf(hz)       high-pass
  .resonance(0..~20)      filter Q           .gain(0..1)    level
  .room(0..1)             reverb send        .delay(0..1)   echo
  .pan(0..1)              stereo (0=L, 1=R)  .shape(0..1)   waveshape distortion / grit
  .crush(1..16)           bitcrush           .coarse(n)     sample-rate reduce
  .attack(s) .decay(s) .sustain(0..1) .release(s)  amplitude envelope

RULES: one expression per track; use ONLY the names above; no import/require; no sound names
outside the lists. Voice pitches to the harmony/mode you described.
""".rstrip()
