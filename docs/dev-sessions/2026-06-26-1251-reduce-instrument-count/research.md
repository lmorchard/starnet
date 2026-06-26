# Research — reduce instrument count

## Where instruments are generated
- `tools/audio-reference/audio_reference/prompt.py`
  - `build_prompt` (`prompt.py:92`) — the whole-song prompt. Key over-split driver:
    "break the piece into TRACKS … **Enumerate every distinct track you actually hear**
    (don't force a fixed set)." No budget, no consolidation rule.
  - `build_stem_prompt` (`prompt.py:160`) — wraps `build_prompt`, prepends "you are hearing
    ONLY the isolated '{stem}' stem … it may be a single instrument **or a few**." Loose.
  - `RESPONSE_SCHEMA` (`prompt.py:19`) — `tracks` is an unbounded array (no `maxItems`).

## Classification (mirrors player)
- `player/player.js:32` — `PERCUSSION_TYPES = {MembraneSynth, MetalSynth, NoiseSynth}`; everything else melodic.
- `player/player.js:33` — `TRACK_CAPS = { melodic: 4, perc: 6 }` (PR #245). Tracks past a pool's cap start muted.

## Quantified problem (count_tracks.py over docs/*.json, all 11 artifacts)
- **Melodic mean 8.1 (range 5–11)** vs target 2–6 → THIS is the over-split.
- **Percussion mean 5.9 (range 4–8)** vs target 5–8 → already on-target; barely needs trimming.
- Near-dup clustering is melodic: trst-icabod has 8 MonoSynths; gruesome-twosome & agent-side-grinder 6 each.

## Critical: everything is stem-separated (4 stems: drums/bass/vocals/other)
Over-splitting happens **per stem**, because each stem independently runs the "enumerate every
distinct track" instruction. Distribution (representative):
- **drums stem** → the kit (kick/snare/hats/…), ~4–6 pieces. Mostly fine. Occasional double-hat
  ("Offbeat Hat" + "Driving Hat", both MetalSynth) = a consolidation target.
- **bass stem** → 2–3 MonoSynths that are usually ONE line ("Subdued EBM Bass" + "Driven EBM Bass";
  icabod's bass stem = 3 basses). Highest-value consolidation.
- **vocals stem** → lead + a "reverb pad"/"choir pad" layer that is an FX duplicate of the lead.
- **other stem** → multiple pads/leads ("Foundation Pad" + "High Pad Layer").

Implication: a single whole-song budget won't directly bind a stem run. The lever is **per-stem
budgets in `build_stem_prompt`** + an explicit **consolidation rule** (merge parts differing only
in FX / octave / intensity).

## Verification constraints
- **No source audio in repo** (no mp3/flac/wav). `index.json` records no source paths. Re-running
  `--stems` needs the original audio + demucs (heavy) → likely needs Les, who has the music.
- ADC file present (`~/.config/gcloud/application_default_credentials.json`) but **no `.env`**
  (no GOOGLE_CLOUD_PROJECT/LOCATION in-repo).
- Hand-tuned tracks in `docs/*.json` are "authored" — README warns re-running `analyze` overwrites tweaks.
- **Runnable-without-Vertex verification:** `tests/test_prompt.py` already asserts prompt content.
  No test currently covers `build_stem_prompt`. New budget/consolidation language → new assertions.
