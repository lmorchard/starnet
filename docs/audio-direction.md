# Starnet — Audio Direction

> **Status: v1 shipped — wired into the game.** Reactive two-axis music with 11 selectable
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

#### Flexible rhythm grids + step modifiers

The pattern format supports per-layer grids and per-step expressiveness (pure logic in
`js/audio/rhythm.js`, applied by the engine's `playStep`):

- **`bars` × `stepsPerBar`** — a score declares `bars` (nominal loop length); each layer's `grid`
  (`8n`/`16n`/`32n`/`8t`/…) derives `stepsPerBar`. A pattern's length must be a **whole number of
  bars** (a multiple of `stepsPerBar`) — no hardcoded magic. Any grid per layer — a `32n` arp or an
  `8t` triplet line beside a straight `8n` groove (3-against-4 cross-rhythm). A layer may also run a
  **longer loop** than the score's `bars` (e.g. an 8-bar drum phrase over a 4-bar groove); each
  `Tone.Sequence` loops independently, so the longer phrase cycles against the rest (a constrained,
  whole-bar polymeter). Sections/wander are bar-quantized and unaffected.
- **Step modifiers** — a step may be `{ note, ratchet?, prob?, vel? }`: `ratchet: N` = N fast
  evenly-spaced sub-hits in the cell (rolls/stutter/fills/chiptune buzz); `prob: 0–1` = fires that
  fraction of loops (glitch non-repeat, seeded `:rhythm` stream, re-rolled every loop, never
  gameplay RNG); `vel` = velocity (ghost notes/accents). Plain steps (note/chord/token/`null`)
  collapse to a single full-velocity hit — fully backward-compatible.
- **Out of scope:** free polymeter (loops must be whole bars — see above for the constrained
  whole-bar version that IS supported), sample/slice playback (synthesis-only holds), swing,
  Euclidean/generative fills.

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

- **Shipped:** music only — a two-axis layered engine wired to live game state; **11 selectable
  Corporate scores** (Dread / Cold / Noir / Vast / Neon / Industrial / Pulse / Haze / Glitch /
  Chip / Cipher — the last three showcase the flexible rhythm grids + step modifiers) chosen per
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
| **Drone** | wandering detuned pad, always present; harmonically wanders (see below) | baseline + slight ↑ progress | EVE / BoC |
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

### Drone harmonic wander (#239)

The always-present `drone` no longer holds one chord all run — it **planes to neighbouring
diatonic degrees** every few bars (`DRONE_BARS_DEFAULT`, currently 4; overridable per score via
`droneBars`) so the harmonic bed evolves. Algorithmic, not hand-authored:

- **`js/audio/harmony.js`** (pure, Tone-free, unit-tested) — `transposeDiatonic(notes, root, mode,
  steps)` shifts a chord by `steps` scale degrees within the score's key; `consonantSteps(drone,
  root, mode)` returns the offsets that keep the drone's perfect fifth perfect (the excluded one
  is mode-specific — a fixed list is wrong outside aeolian); `pickNextStep(rng, current, steps)`
  picks the next offset, no immediate repeat.
- **Score data** — each wandering score declares `root` + `mode`; sustained layers opt in with
  `wander: true`. Home chord = step 0.
- **Engine** — an independent seeded RNG (`getSeed()+":drone"`, never gameplay RNG) drives a
  bar-quantized `Transport.scheduleRepeat`, mirroring the section automation. Each wander layer
  crossfades on its own `PolySynth` (`triggerRelease` old + `triggerAttack` new) — the slow
  attack/release envelopes overlap into a gapless morph.
- **Scope** — only the base `drone` in run scores. The **hub** wanders its `drone` **and** `pad`
  together (cycling Am7 → Cmaj7 → Dm7 → Em7 → Fmaj7 → G7); the high shimmer stays a static anchor.
  The threat `tensionDrone` is untouched. Ear-check the cadence/feel via the **WANDER NOW** button
  in `preview/audio.html` (the hub is selectable there too).

### Transitions

- **One continuous piece per run** — starts at `RUN_STARTED` (post-gesture), evolves the whole
  run, resolves with an outcome-appropriate tail at `RUN_ENDED`.
- **Smooth `rampTo` crossfades** for layer entrances (~0.5–2s). All patterns are Transport-synced,
  so a fade-in still lands on the grid — smoothness without bar-queue complexity (bar-quantized
  entrances deferred).

## Event SFX subsystem (shipped, #229)

A synthesized **sound-effects layer**, independent of the music: discrete one-shot cues fired on
game events **plus a sustained drone per timed action in progress**, in a **"cold machine
telemetry"** palette (dry, low-register, technical — detuned/minor intervals over major triads,
danger in low FM growl; reverb is opt-in per cue, default dry). It mirrors the music subsystem's
split (pure data + pure mapping + a thin Tone boundary + a browser-only subscriber) and runs on its
**own always-available bus** — SFX work with music off, and in the hub.

**Modules (`js/audio/`):**

- **`sfx/defs.js`** — *pure data, `@ts-check`.* `CUES` map (`cueId → { kind, ...params, volume }`)
  grouped by family + `CUE_IDS`. Unit-tested (`tests/sfx-defs.test.js`): every cue's `kind` is a
  known primitive with its required params.
- **`sfx/cues.js`** — *pure, `@ts-check`.* `resolveCue(type, payload) → cueId | null` — the
  event→cue mapping. Unit-tested (`tests/sfx-cues.test.js`): key cases + exhaustiveness (every
  resolvable cue exists in `CUES`). **State-reflective cues** read fields off the payload: access
  by `next` level (`access.open`/`access.owned`), mine by `detail.rarity`, fetch by `detail.total`
  tier (`fetch`/`fetch.big`), `EXPLOIT_PARTIAL_BURN`→`burn`, `NODE_ALERT_RAISED`→`node.alert`.
  Cues that need state beyond the payload — `NODE_REVEALED` (node grade + burst cascade), and the
  per-event pitch tweaks (`alert.up`/`node.alert`/`burn` detune) — are applied renderer-side.
  Encoding vocabulary: more hits/notes + ascending pitch = more control/value/rarity; lower +
  dissonant = loss/wear. The `chord` primitive's `hits`/`hitGap` give the "double/triple hit".
- **`sfx/drones.js`** — *pure data, `@ts-check`.* `DRONES` (one sustained-voice spec per timed
  action — probe/xploit/dump/fetch/mine/lie-low/reboot) + `DRONE_IDS` + `resolveDrone(action)`.
  Each drone echoes its action's on-graph animation (scanning pulse, grinding tighten, draining
  noise, lock-on beat, etc.). Spec values sweep with progress via `{from,to}` ranges on
  cutoff/detune/gain. Unit-tested (`tests/sfx-drones.test.js`).
- **`sfx/engine.js`** — *`@ts-nocheck`, the only Web Audio boundary for SFX.* `createSfx()` →
  `{ unlock, setEnabled, isEnabled, play, startDrone, getMasterInput }`. Owns its own master `Gain`
  → opt-in reverb → destination. `play(spec)` synthesizes a one-shot from five **primitives** —
  `blip` / `sweep` / `chord` / `noise` / `fm` — scheduled at `ctx.currentTime + 0.02` (not
  `Tone.now()`, to dodge the music's lookahead) and **disposed after it finishes**.
  `startDrone(spec) → { setProgress(p), stop() }` builds a **held** voice
  (osc/noise/fm/dual source → filter → amp gain → fade gain), fades in, re-shapes on progress
  0→1, and fades out + disposes on stop. Both paths dispose after use, so SFX add no long-lived
  AudioParam accumulation (the bug that caused the music engine's over-time stutter). One-shot
  voice cap drops cues over the limit; drones are bounded by concurrent timed actions.
- **`sfx/renderer.js`** — *browser-only, `@ts-check`.* `initSfxRenderer()` subscribes to the routed
  events, resolves each to a cue, and plays it; pitches `alert.up` up at red; diffs
  `player.health` / `deckIntegrity` on `STATE_CHANGED` for `hurt.*` (no damage event exists);
  dedupes identical cues within 50ms; arms the AudioContext on first gesture. Drives the drones from
  `ACTION_FEEDBACK` (`start` → `startDrone` keyed by `nodeId:action`; `progress` → `setProgress`;
  `complete`/`cancel` → `stop`); stops all drones on `RUN_STARTED`/`RUN_ENDED` and when SFX is
  disabled. Owns the persisted `starnet:sfx-enabled` pref and emits `SFX_CHANGED`.
- **`sfx/commands.js`** — *browser-only.* `sfx` console command (`status | on | off | list |
  test <cue>`), mirroring `music-commands.js`.
- **HUD:** an `SFX: ON/OFF` menu button beside the music toggle; `SFX_CHANGED` keeps button +
  console in sync (GUI/console symmetry).
- **Wiring:** `initSfxRenderer()` + `sfx-commands` import live in `js/ui/main.js` only. Headless
  entry points (`scripts/`) never import any of it.
- **Harness:** `preview/sfx.html` + `js/audio/sfx/playground.js` — a button per one-shot cue, and a
  toggle + progress slider per drone to audition/tune the sustained voices.

**Not in v1:** music ducking under SFX; sample/vocal one-shots (item 3 above); positional audio;
per-cue volume UI beyond the master SFX toggle. Starter cue specs are ear-tunable (rough drafts).

## Testing, verifying & debugging the audio code

Hard-won notes from building the music + SFX engines. Audio bugs are easy to misdiagnose because
the obvious analysis tool (offline render) does not reproduce a whole class of them.

### What you can test without a browser

The audio subsystem deliberately splits **pure logic** (no Tone, no DOM) from the **Tone boundary**.
Everything pure is unit-tested with `node --test`, no browser:

- `mixer.js` (`computeMix`), `signals.js` (progress/threat derivation) — music.
- `sfx/defs.js` (cue catalog well-formed), `sfx/cues.js` (`resolveCue` mapping + exhaustiveness),
  `sfx/drones.js` (drone specs + `resolveDrone`).
- Any future `harmony.js` (scale/chord math) — same pattern.

If you can express the thing as data → data, put it in a pure module and unit-test it there. The
Tone files (`engine.js`, `sfx/engine.js`) are `@ts-nocheck` glue that should hold as little logic as possible.

### The offline-vs-realtime trap (read this before debugging an onset/envelope bug)

`Tone.Offline()` renders deterministically and is great for **synthesis content** — relative
levels, strike counts, cue mapping, "does this cue make sound." **BUT it pre-resolves signals
before rendering, so it CANNOT reproduce realtime startup transients.**

The canonical example (the drone/one-shot "onset volume spike" bug): setting level via Tone's
`source.volume` (a *dB-mapped signal*) blasts at 0 dB for ~100–200 ms in **realtime** before the
signal settles — a hard attack→decay→sustain on every voice. Offline showed perfectly clean
fade-ins and sent me down a wrong root cause (LFO timing) for a whole fix cycle. **Lesson: for any
onset / envelope / transient / "it sounds different live" bug, measure REALTIME, not offline.**

Corollary rule already baked into `sfx/engine.js`: **never use `.volume` for levels — use a linear `Gain`
(`dbToGain`)**, which has no startup transient.

### How to measure realtime audio (headless)

There is no Web Audio in Node, and the repo has no standing browser-test harness — these were
throwaway Playwright scripts against `make serve` (port 3000). Pattern that works:

1. Launch headless Chromium with `--autoplay-policy=no-user-gesture-required` (and `--mute-audio`)
   so the AudioContext actually runs without a real gesture/device. The in-app gesture-arm will NOT
   fire on a synthetic click, so also `await Tone.start()` then `await ctx.resume()` in the page.
2. Tap the output: `analyser = ctx.createAnalyser(); Tone.getDestination().output.connect(analyser)`.
3. Sample `getFloatTimeDomainData` each rAF; reduce to **RMS per ~20 ms window**, not peak.
   Per-window *peak* aliases against the oscillator period and fakes a ~1.2–1.7× overshoot on steady
   tones — use RMS for loudness/envelope shape. (Peak at fine 5 ms resolution is fine for *counting
   discrete strikes*, e.g. verifying a 3-hit chord.)
4. To compare a fix: render the same cue/drone before vs after and compare onset-window RMS vs
   steady-state RMS. ~1.0 = no spike.

`import { createSfx } from "/js/audio/sfx/engine.js"` and drive it directly, or `initSfxRenderer()` +
`emitEvent(E.*)` to exercise the event→cue path end to end.

### Ear-tuning

Synth params are rough drafts tuned by ear in the **preview harnesses** (`preview/audio.html` for
music layers, `preview/sfx.html` for cues + drones). Numbers in the score/cue/drone data are feel,
not spec — change them freely and listen.

### Don't regress the headless paths

The SFX renderer/engine are browser-only. Confirm headless game entry points never import them:
`grep -rn "audio/sfx" scripts/` must be empty. (`engine.js`/`audio-renderer.js` likewise — music is
wired only in `js/ui/main.js`.)

## Prototypes

- `audio-tone.html` — Tone.js, 4-part song, per-track mutes, tempo, global tension sweep
  (master lowpass + Q + drone). **The chosen direction.**
- `audio-elementary.html` — Elementary equivalent (same song), kept for reference/comparison.

## Deferred / fast-follows (not blocking v1)

1. **More instrument variety across scores** — teach the engine more synth voices (FM/bell,
   metal, pluck, AM) so scores can vary timbre *while keeping the cohesive "voice font"* (Les:
   the current shared palette fits together well — widen it, don't fragment it).
2. ~~**Event SFX** — one-shots on probe/xploit/dump/fetch and run start/end.~~ **Shipped (#229).**
   See "Event SFX subsystem" below.
3. **Vocal/texture one-shots** — BoC-style fragments; triggering model + original samples.
4. **Aged-media / lo-fi processing flavor** — vinyl crackle, tape wobble, band-limited EQ.
5. **Other biomes** — alien/ancient (BoC/weirder); the per-biome score pool already supports it.
6. **Hand-authored section arcs** — ordered section sequences (intro → build → drop) shuffled
   among, for more intentional arrangement than pure seeded-random (Les's idea).
7. **Hybrid generative pass** — light generative fills/variation atop the authored patterns.
8. **`setScore` mid-run rebuilds the whole graph** (brief gap) — fine for per-run selection;
   revisit if seamless live score transitions are ever wanted.
