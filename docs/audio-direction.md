# Starnet — Audio Direction

> **Status: v1 shipped — wired into the game.** Reactive two-axis music with 8 selectable
> Corporate scores + section-breakdown automation, driven by live game state. Tuning harness
> at `preview/audio.html`. Deferred / fast-follow items are tracked at the bottom.

## Why this doc exists

Two reasons:

1. **Persist the design** so a future session doesn't re-litigate engine choice, references, or architecture.
2. **Bridge a hard constraint:** the AI assistant (Claude) building this *cannot hear the
   output*. Collaboration on sound therefore depends on a **shared technical + referential
   vocabulary** — precise enough that Les's ears plus Claude's parameter control converge
   without Claude ever hearing a note. That vocabulary is part of this doc on purpose.

## Decisions so far

### Engine: Tone.js (synthesis, not samples)

Chosen over Elementary, SunVox, and Strudel. Rationale:

- **Aesthetic:** Starnet is a retro-vector / phosphene game; the sonic analog is **synthesis**,
  not sample stems. (Rules out sample-loop workflows.)
- **AI-tractability** (the thing this project is exploring):
  - Large training corpus → Claude generates reliable Tone.js, hallucinates little.
  - Imperative, stateful objects with normal JS exceptions → **debuggable**, vs Elementary's
    declarative AudioWorklet graph that fails as *silence/noise* with no stack trace.
  - Permits the only architecture that's testable-without-hearing: push **musical decision
    logic into pure, testable JS** (like `js/ui/node-glyphs.js`) and let the engine be a dumb
    output device.
- **One library covers music *and* SFX:** Tone's one-shot `triggerAttackRelease` maps directly
  onto game events; Elementary's persistent graph makes fire-and-forget SFX awkward.
- **License:** MIT (Strudel is AGPL — avoided).

SunVox stays a possible *later* hybrid (author set-piece tracks, drive reactive layers from JS)
if the JS-synth timbre ceiling ever frustrates. Not for v1 — one engine, learn the loop first.

### Intensity model: TWO AXES (progress + threat)

The music's state is driven by two **independent** axes that combine:

- **PROGRESS axis** — how deep / how much of the LAN is owned. Controls **fullness**:
  adds layers as the player penetrates (drone + sparse perc → double-time perc → lead + backup).
  This is the "reward" feel.
- **THREAT axis** — alert level, ICE detection, injury. Controls **aggression**:
  dissonance, master-filter sweep, urgent drone, the darksynth color.

They're separable on purpose: a **deep-but-safe** LAN sounds rich & calm; a **shallow-but-hot**
LAN sounds sparse & menacing. (Not one combined "heat" ladder — that couldn't tell those apart.)

**Guiding principle:** *progression = reward via unfolding; threat = warning via urgency.* This
dictates how each axis sounds — progress layers **blossom** (satisfying, melodic, additive);
threat layers **alarm** (urgent, dissonant, intrusive).

### The layering vision (Les's words)

- Start **sparse and spare** — just percussion + a subtle wandering synth drone.
- Layer in **double-time percussion** as the player progresses deeper into the LAN.
- Reward progress by layering in **lead + backup** (progress is "also a kind of tension").
- On **injury / detection / ICE discovery**, throw in more **audio urgency**.
- Music **changes setting by biome** (see palette); alien/ancient biomes get *much weirder*.
- **Texture: triggered vocal samples.** Occasional short vocal/voice fragments as atmosphere
  (Boards of Canada style) — garbled comms, numbers-station counts, corrupted system voices,
  detuned whispers. Very on-theme for a hacking game. See the texture note below.

### Generation: authored patterns-as-data

Each layer is a fixed note/pattern array (like the prototype), hand-authored per biome **score**.
The two axes fade layers in/out. Variety comes from **seeded selection among authored pattern
variants** (using the game's existing `js/rng.js` named streams), not full generativity — keeps
runs deterministic and the vibe intentional. A *hybrid* pass (light generative fills/variation
on top) is a possible later enhancement, not v1.

### Texture: triggered vocal/sample one-shots

A deliberate, **bounded** reintroduction of samples — one-shots, **not** music stems (the
synthesis-over-stems rule still holds for the music itself). Tone handles these natively
(`Tone.Player` / `Tone.Players` / `Tone.Sampler`), and they're the fire-and-forget shape Tone
excels at.

- **Content (cyberpunk-appropriate):** corrupted comms, numbers-station counting, distorted
  system voices ("access… denied"), hazy whispers. Pairs with the BoC alien-biome flavor *and*
  can flavor Corporate (system-voice fragments).
- **Processed through the master-bus FX** (pitch/detune, filter, reverb) for the *wrong/hazy*
  feel — they shouldn't sound clean.
- **Assets:** small files, lazy-loaded, **browser-only** (headless-safe like everything else).
  Source = record/synthesize **originals** (avoid sampling others' copyrighted tracks).

### Texture: aged-media / lo-fi processing

A *processing* flavor — the "70s filmstrip" feel in some Boards of Canada: **vinyl crackle,
tape hiss/saturation, wow-and-flutter** pitch wobble, band-limited EQ. In Tone: a low-level
noise/crackle bed + chorus/vibrato for the wobble + filtering/bitcrush. It's an **FX flavor
applied to a score**, not a score itself — pairs naturally with the trip-hop/spy and alien
palettes, and with the vocal-texture one-shots.

### Flavor within a biome

Scores are keyed by **biome**, but a biome can host **multiple flavors** so different LANs feel
distinct — e.g. a swanky spy-jazz infiltration vs a sterile corporate grid, both "corporate."
A score = base palette + layer set + optional processing flavor (e.g. aged-media).
**Decision (v1):** a LAN picks its flavor by **seeded random selection within its biome**
(via `js/rng.js` — e.g. the `world` stream), trivial today with a single biome and a small
flavor set.

## Reference palette

These are a **palette**, not a single choice — assign per biome and per flavor *within* a biome.
Retain all of them.

| Anchor | Character | Use for |
|---|---|---|
| **Mr. Robot** (Mac Quayle) | minimal, static, pulsing, glitchy, "hacking" | Corporate **base** layer (low threat) |
| **Perturbator / Carpenter Brut** (darksynth) | aggressive, driving, neon menace | Corporate **high-threat** layer |
| **Deus Ex** (Alexander Brandon) | dark ambient + trip-hop/industrial, brooding | Corporate mid-layer / alt flavor |
| **Blade Runner / Vangelis** | lush noir saw pads, reverb-drenched | atmosphere/ambience, any biome |
| **Trip-hop / spy-jazz** (Portishead, Massive Attack; *Sneakers*, John Barry, Lalo Schifrin) | downtempo noir, swanky "infiltration cool" — vibraphone, muted trumpet, upright bass, wah, vinyl crackle | "heist/infiltration" **LAN flavor**; a swanky Corporate sub-flavor |
| **Boards of Canada** | warm, hazy, **detuned**, unsettling, *off* | **alien/ancient biomes** (future) |
| **EVE Online** (RealX, Jon Hallur & co.) | vast, cold, slow-evolving deep-space ambience; melancholic wonder | the **sparse base "wandering drone"** layer; interplanetary atmosphere / overworld |
| **Ladytron** (early — *604* / *Light & Magic*) | cold, deadpan, motorik analog synthpop; minimal | a **colder, more detached** Corporate flavor (vs Mr. Robot's brooding) |
| **Ladyhawke** ("Magic") | relentless driving bass, periodic **choral voice** stabs, occasional **handclaps** | propulsive Corporate flavor; concrete layer ideas — a choral-stab layer + handclap perc accent |
| *(room for weirder)* | glitch/IDM (Aphex, Autechre) | truly alien LANs, if BoC isn't strange enough |

**Corporate biome (the only one built today):** Mr. Robot static dread at the base, sliding
toward Perturbator aggression as threat rises.

## Shared sound vocabulary

The grid we use to talk about sound precisely. Each maps to a Tone.js lever Claude controls,
a plain-language effect, and an anchor.

| Dimension | Tone.js lever | Sonic effect | Anchor |
|---|---|---|---|
| **Timbre** | `oscillator.type`: saw/square/triangle/sine/FM/noise | saw=bright/buzzy; square=hollow/chip; triangle=soft; sine=pure/sub; FM=metallic; noise=wind/perc | saw→Vangelis; FM→DX7 |
| **Brightness** | filter `frequency` (cutoff), `Q` (resonance) | low=dark/muffled; high=open; high Q=whistling/acid | the tension sweep |
| **Envelope** | ADSR `attack/decay/sustain/release` | slow attack=pad; fast+low sustain=pluck/stab; long release=washy | pad vs stab |
| **Register/density** | octave choice, notes per bar | sub-bass↔lead; sparse↔wall-of-sound | Carpenter vs Perturbator |
| **Harmony/mode** | note arrays, chord progression | major=bright; natural minor=melancholy; **Phrygian ♭2=menace**; static drone=dread | the mood engine |
| **Groove** | tempo, grid, syncopation | propulsive↔floating; mechanical↔human | techno vs ambient |
| **Space/grit** | reverb, delay, chorus/detune, distortion, bitcrush | room size; echo; width; aggression/digital decay | BR reverb; bitcrush="ICE hit" |

**Calibration protocol:** Claude predicts a sound *from its parameters*; Les reports what his
ears actually hear; we tune Claude's mental model from the divergence. (Already found one purely
from theory: a plain Am–F–C–G progression reads "anthemic indie," not "cyberpunk intrusion" —
fixes are harmonic: go static/modal or add the Phrygian ♭2.)

## Integration surface (from a code scan — verify file:line at implementation time)

The audio system is a **new event-bus subscriber**, `js/audio/audio-renderer.js`, mirroring
`js/ui/visual-renderer.js` / `js/ui/log-renderer.js` (but living in its own `js/audio/` subsystem).

- **Event bus:** `import { on, E } from "../core/events.js";`
- **Wiring:** call `initAudioRenderer()` in `js/ui/main.js` (after `initVisualRenderer()`).
- **Headless-safe:** main.js is the *only* browser entry. The headless paths
  (`scripts/playtest.js`, `scripts/bot/cli.js`, `scripts/lib/headless-engine.js`) do **not**
  import the renderers — audio must stay out of them too, or it breaks the bot/census.
- **AudioContext** must be created behind a **user gesture** (first click/keypress).

### Signals → axes

**PROGRESS axis** — compute from `state.nodes` on `E.STATE_CHANGED`:
- `ownedCount / total` where `node.accessLevel === "owned"` (best single "penetration" metric).
- Finer grain available via `node.visibility` (`hidden`/`revealed`/`accessible`) and
  `accessLevel` (`locked`/`open`/`owned`).
- Per-event nudges: `E.NODE_ACCESSED` (went deeper), `E.NODE_REVEALED`.

**THREAT axis** — from state + events:
- `state.globalAlert`: `"green" | "yellow" | "red" | "trace"`; `state.traceSecondsRemaining`.
- Events: `E.ALERT_GLOBAL_RAISED {prev,next}`, `E.ALERT_COOLED`, `E.ALERT_TRACE_STARTED {seconds}`,
  `E.ALERT_TRACE_CANCELLED`.
- ICE: `E.ICE_DETECT_PENDING {label,dwellMs}` (rising), `E.ICE_DETECTED {label}` (lock!),
  `E.ICE_MOVED {toVisible,...}`; `state.ice.instances[*].detectionCount` / `attentionNodeId`.
- Injury: `state.player.health.current`, `state.player.deckIntegrity.current` — **no dedicated
  event**; diff on `E.STATE_CHANGED`.

### Biome selection

- `state` carries a biome via network `meta.biome` (currently only `"corporate"`, set in
  `js/core/network/assemble.js`). Also `state.spec.threat/wealth/complexity/depth` (Grades S–F)
  for difficulty-aware flavor.
- Audio picks a **score** (layer set + synth configs + reference palette) keyed on biome,
  defaulting to `"corporate"`.

### Discrete event SFX (Tone one-shots)

`E.ACTION_FEEDBACK {action,phase,progress}` and `E.ACTION_RESOLVED {action,success,detail}`
cover probe/xploit/dump/fetch/mine — natural hooks for fire-and-forget SFX. `E.RUN_STARTED` /
`E.RUN_ENDED {outcome}` for stingers.

## v1 Design (approved)

**Guiding principle:** progression = **reward via unfolding**; threat = **warning via urgency**.

### Scope

- **Shipped:** music only — a two-axis layered engine wired to live game state; **8 selectable
  Corporate scores** (Dread / Cold / Noir / Vast / Neon / Industrial / Pulse / Haze) chosen per
  run by an independent seeded RNG; **section-breakdown automation** (seeded-random, no-repeat,
  bar-quantized, subtractive over progress layers); a biome-independent **hub ambient** track
  (all sustained pads) with **faded transitions** (hub ↔ run, fade-out on jack-out); a **Music
  on/off** menu toggle (persisted); **`music` console commands** (status/list/next/set/on/off);
  and the `preview/audio.html` tuning harness.
- **Perf:** per-note AudioParam automation is pruned by recycling sequenced synths when they
  fall silent (Web Audio never prunes past automation; unbounded growth caused over-time
  stutter — see the `engine.js` recycle logic).
- **Deferred (fast-follows, not precluded):** event SFX; vocal-texture one-shots (content-blocked
  on original recordings); bar-quantized layer entrances; the aged-media processing flavor; other
  biomes; the hybrid generative pass. **Constraint:** the engine MUST expose its master bus + FX
  chain so the deferred SFX / vocal one-shots can be added later as a pure addition — no rework.

### Module layout (`js/audio/` subsystem)

- **`js/audio/mixer.js`** — *pure; no Tone, no DOM.* `(progress, threat) → { perLayerGain,
  masterCutoff, masterQ }`. **Unit-tested without sound** — the only layer either collaborator
  can verify.
- **`js/audio/scores/corporate.js`** — *pure data.* Layer definitions: pattern note-arrays,
  synth configs, per-layer axis mapping, flavor variants.
- **`js/audio/engine.js`** — Tone wrapper. Owns AudioContext, Transport/sequencer, per-layer
  synths + gain nodes, master bus + master filter, `rampTo` automation. Imports Tone from
  `/dist/tone.js`. API: `start() / stop() / setProgress(x) / setThreat(x) / setScore(s)`.
- **`js/audio/audio-renderer.js`** — event-bus subscriber (browser-only). Derives the two axis
  scalars from state/events, calls engine methods. Gates AudioContext on first user gesture.
  Wired in `js/ui/main.js` after `initVisualRenderer()`; kept out of all headless entry points.
- **Vendor:** bundle Tone → `dist/tone.js` (esbuild ESM, like `dist/lit.js`) + a `make` target.
- **Tuning harness:** new **`preview/audio.html`** + **`js/audio/playground.js`** — per-layer
  mutes + progress/threat sliders + play/stop. (Leaves the existing root `preview.html` in place;
  a `preview/` reorg of the old harness is an optional separate tidy-up.)

### Corporate score — layers & axis mapping

All layers run on the Transport in sync from the start; only their **gains** move, so everything
stays rhythmically aligned as layers fade in. Progress layers *blossom*; threat layers *alarm*.

| Layer | Role / character | Driven by | Anchor |
|---|---|---|---|
| **Drone** | wandering detuned pad, always present | baseline + slight ↑ progress | EVE / BoC |
| **Base perc** | sparse kick + hat, minimal pulse | progress > 0 (early) | Mr. Robot |
| **Double-time perc** | busier hats/snare | progress ~0.3→0.7 | Mr. Robot |
| **Bass** | square/sub bassline | progress ~0.2→0.5 | — |
| **Lead** | melodic lead — the reward | progress ~0.55→0.85 | — |
| **Backup** | chord stabs / harmony pad | progress ~0.6→0.9 | — |
| **Tension drone** | detuned aggressive swell | **threat** 0→1 | Perturbator |
| **Urgency arp** | driving darksynth arp / double-kick | **threat** ~0.6→1 | Perturbator |
| *master filter* | cutoff + Q sweep over whole mix | **threat** | (the tension sweep) |

**Progress scalar** = `ownedCount / totalNodes` (smoothed), nudged earlier by revealed/accessed
counts so the music starts unfolding before nodes are fully owned.
**Threat scalar** = `globalAlert` (green/yellow/red/trace → 0/.33/.66/1) blended with a transient
bump from recent `ICE_DETECTED` and a term for low health/deck. Smoothed, **fast attack (~0.3s)
/ slow release (~1.5s)** — adrenaline spike, gradual calm-down.

### Transitions

- **One continuous piece per run** — starts at `RUN_STARTED` (post-gesture), evolves the whole
  run, resolves with an outcome-appropriate tail at `RUN_ENDED`.
- **Smooth `rampTo` crossfades** for layer entrances (~0.5–2s). All patterns are Transport-synced,
  so a fade-in still lands on the grid — smoothness without bar-queue complexity (bar-quantized
  entrances deferred).

## Prototypes

- `audio-tone.html` — Tone.js, 4-part song, per-track mutes, tempo, global tension sweep
  (master lowpass + Q + drone). **The chosen direction.**
- `audio-elementary.html` — Elementary equivalent (same song), kept for reference/comparison.

## Deferred / fast-follows (not blocking v1)

1. **More instrument variety across scores** — teach the engine more synth voices (FM/bell,
   metal, pluck, AM) so scores can vary timbre *while keeping the cohesive "voice font"* (Les:
   the current shared palette fits together well — widen it, don't fragment it).
2. **Event SFX** — one-shots on probe/xploit/dump/fetch and run start/end. Hooks exist
   (`E.ACTION_FEEDBACK`, `E.ACTION_RESOLVED`); engine exposes `getMasterInput()` for routing.
3. **Vocal/texture one-shots** — BoC-style fragments; triggering model + original samples.
4. **Aged-media / lo-fi processing flavor** — vinyl crackle, tape wobble, band-limited EQ.
5. **Other biomes** — alien/ancient (BoC/weirder); the per-biome score pool already supports it.
6. **Hand-authored section arcs** — ordered section sequences (intro → build → drop) shuffled
   among, for more intentional arrangement than pure seeded-random (Les's idea).
7. **Hybrid generative pass** — light generative fills/variation atop the authored patterns.
8. **`setScore` mid-run rebuilds the whole graph** (brief gap) — fine for per-run selection;
   revisit if seamless live score transitions are ever wanted.
