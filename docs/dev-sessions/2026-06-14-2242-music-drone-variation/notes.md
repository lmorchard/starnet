# Notes — drone harmonic variation

## Mode analysis per score (from lead/bass note content)

Confirmed by reading each score's authored lead + bass arrays. A couple diverge from the issue's
sketch — trust the data:

| Score | root | mode | evidence |
|---|---|---|---|
| Dread | A | aeolian | A B C D E F G; Bb is the chromatic ♭2 turn, not the mode |
| Cold | C | **aeolian** | bass `Ab` (♭6) → natural minor, NOT dorian as the issue guessed |
| Noir | D | dorian | minor (♭3 F), no 6th written; noir-jazz dorian per issue; `Ab` is a blue note |
| Haze | G | **ionian (major)** | lead `B` (maj3) + `F#` (maj7), `C` natural → G major |
| Industrial | E | **phrygian** | lead/bass `F` natural (♭2) + `C` (♭6) → E phrygian (matches the menace) |
| Neon | F# | aeolian | F# A B C# E (minor pentatonic); default natural minor |
| Pulse | A | **ionian (major)** | lead `C#` (maj3) + `F#` → A major |
| Vast | A | aeolian | A C E G (Am7), bass `F` (♭6) |
| Hub | A | aeolian | drone A+E over Cmaj pad = Am7; relative-major shimmer |

## Design correction during execution

A fixed `ALLOWED_STEPS` is mode-specific and WRONG outside aeolian. The diminished diatonic fifth
sits on a different degree per mode (e.g. E phrygian: the bad offset is step 4, and step 1 is
fine — the reverse of aeolian). Fix: `consonantSteps(droneNotes, root, mode)` computes, per score,
the offsets that preserve the drone chord's interval shape (its perfect fifth). The engine picks
from that per-score set. The pad (hub) follows the drone's steps; its triad is allowed to change
quality (that's the desired diatonic planing) and stays consonant combined with the drone.

## Bug: "loud crackly static that gets worse over time" (ear-check feedback)

Root-caused with the `superpowers:systematic-debugging` discipline + a temporary in-engine
diagnostic (`_wanderDebug`) driven via Playwright (measured voice pool size, per-voice param-event
timeline length, and a master-tap analyser peak across forced wanders).

- **Ruled out:** voice leak (Tone reuses + GCs voices — pool plateaued, didn't run away) and
  amplitude clipping (master peak stayed ~0.06, flat).
- **Confirmed:** the v1 wander retriggered ONE long-lived `PolySynth` per layer every few bars.
  Tone reuses that synth's voices, and Web Audio never prunes their `setValueAtTime`/ramp events,
  so the per-voice automation timeline (and the voice pool under load) **climbed monotonically**
  (pool 2→8, maxVoiceEvents 2→5 over 10 wanders) → compounding audio-thread crackle. This is the
  exact hazard the file already documents for sequenced layers — but sustained layers were exempt
  from the recycler under a now-false "one trigger" assumption.
- **Fix:** mint a FRESH synth per wander (`makeSynth` factory); the new synth attacks the new
  chord while the old releases, then the old is disposed after its release tail (`retireSynth`,
  cleaned up in `teardown`). Each synth instance is triggered exactly once → no accumulation.
- **Verified:** same stress test after the fix → pool flat at 2, maxVoiceEvents flat at 2, peak
  unchanged. Crossfade overlap preserved.
- **Still pending:** Les's live ear-check (he stepped away) — confirm the crackle is gone by ear
  and the morph still sounds seamless.
