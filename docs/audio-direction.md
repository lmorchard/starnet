# Starnet — Audio Direction

> **Status: shipped — single engine.** Starnet's audio runs on **Strudel + superdough**
> (`@strudel/web` 1.3.0), the one and only audio engine. It provides reactive music
> (strudel.cc-dialect songs with live game signals injected), one-shot event SFX, and
> sustained action drones. The legacy Tone.js engine and its two-axis score interpreter
> were **retired in #267**; the sections below describe the current engine and preserve the
> engine-agnostic design north-star. Tone-specific history is called out where relevant.

## Why this doc exists

Two reasons:

1. **Persist the design** so a future session doesn't re-litigate engine choice, references, or architecture.
2. **Bridge a hard constraint:** the AI assistant (Claude) building this *cannot hear the
   output*. Collaboration on sound therefore depends on a **shared technical + referential
   vocabulary** — precise enough that Les's ears plus Claude's parameter control converge
   without Claude ever hearing a note. That vocabulary is part of this doc on purpose.

## Engine: Strudel + superdough

The audio engine is [Strudel](https://strudel.cc/) (`@strudel/web`) with its **superdough**
Web Audio synth. One library covers **music, one-shot SFX, and drones**, and songs are authored
in the **strudel.cc dialect** — the same code runs in the browser game and in strudel.cc.

Why Strudel (the current direction):

- **Authoring parity.** A song is a standalone `.strudel` file (strudel.cc-dialect). You can
  paste it into [strudel.cc](https://strudel.cc/), tune it live, and drop it back into the game
  — no bespoke score format to hand-translate. This is the workflow the Tone engine never had.
- **One engine, three jobs.** superdough's fire-a-value-at-a-time API covers reactive songs
  (`$:`/`stack` patterns), fire-and-forget SFX one-shots, and — via raw Web Audio on the same
  `AudioContext` — sustained progress-driven drones.
- **Live signal injection.** The game's state is injected into songs as **live Strudel signals**
  (`gameProgress`, `gameThreat`, …) a song references by name (see "Signal injection" below).
  The reactivity lives in the song, not in a JS score interpreter.
- **License:** Strudel + superdough are **AGPL-3.0**. The engine ships under AGPL; song/content
  ("wad") data is kept separately licensable and loaded at runtime (the Doom model — see
  `README.md`).

**History (Tone.js, retired #267).** The first audio arc used Tone.js (MIT) with a bespoke
two-axis *score interpreter*: hand-authored layer/pattern data in `js/audio/scores/*`, a pure
`mixer.js` mapping `(progress, threat) → per-layer gains`, and a `js/audio/engine.js` Tone
wrapper. It shipped 11 Corporate scores with section-breakdown automation and a drone harmonic
wander. Strudel superseded it because authoring-in-strudel.cc beats maintaining a private score
format. The design *intent* below (two axes, layering, palette) carried over; the *implementation*
is now "a song reads the game signals" instead of "JS fades score layers."

## Design north-star (engine-agnostic)

These sections are the *intent* the music should express, independent of engine. Under Strudel
they're realized inside each song (patterns gated/shaped by the injected signals) rather than by
a JS mixer — but the target feel is unchanged.

### Intensity model: TWO AXES (progress + threat)

The music's state is driven by two **independent** axes that combine:

- **PROGRESS axis** — how deep / how much of the LAN is owned. Controls **fullness**:
  more layers as the player penetrates (drone + sparse perc → double-time perc → lead + backup).
  This is the "reward" feel. Injected as the `gameProgress` signal (0..1).
- **THREAT axis** — alert level, ICE detection, injury. Controls **aggression**:
  dissonance, filter sweep, urgent drone, darksynth color. Injected as `gameThreat` (0..1).

They're separable on purpose: a **deep-but-safe** LAN sounds rich & calm; a **shallow-but-hot**
LAN sounds sparse & menacing. (Not one combined "heat" ladder — that couldn't tell those apart.)

**Guiding principle:** *progression = reward via unfolding; threat = warning via urgency.* Progress
layers **blossom** (satisfying, melodic, additive); threat layers **alarm** (urgent, dissonant,
intrusive).

### The layering vision (Les's words)

- Start **sparse and spare** — just percussion + a subtle wandering synth drone.
- Layer in **double-time percussion** as the player progresses deeper into the LAN.
- Reward progress by layering in **lead + backup** (progress is "also a kind of tension").
- On **injury / detection / ICE discovery**, throw in more **audio urgency**.
- Music **changes setting by biome** (see palette); alien/ancient biomes get *much weirder*.
- **Texture: triggered vocal samples.** Occasional short vocal/voice fragments as atmosphere
  (Boards of Canada style) — garbled comms, numbers-station counts, corrupted system voices,
  detuned whispers. Very on-theme for a hacking game. (Deferred — see fast-follows.)

### Reference palette

A **palette**, not a single choice — assign per biome and per flavor *within* a biome. Retain all.

| Anchor | Character | Use for |
|---|---|---|
| **Mr. Robot** (Mac Quayle) | minimal, static, pulsing, glitchy, "hacking" | Corporate **base** (low threat) |
| **Perturbator / Carpenter Brut** (darksynth) | aggressive, driving, neon menace | Corporate **high-threat** |
| **Deus Ex** (Alexander Brandon) | dark ambient + trip-hop/industrial, brooding | Corporate mid / alt flavor |
| **Blade Runner / Vangelis** | lush noir saw pads, reverb-drenched | atmosphere/ambience, any biome |
| **Trip-hop / spy-jazz** (Portishead, Massive Attack; *Sneakers*, John Barry, Lalo Schifrin) | downtempo noir, swanky "infiltration cool" | "heist/infiltration" LAN flavor; swanky Corporate sub-flavor |
| **Boards of Canada** | warm, hazy, **detuned**, unsettling, *off* | **alien/ancient biomes** (future) |
| **EVE Online** (RealX, Jon Hallur & co.) | vast, cold, slow-evolving deep-space ambience | the sparse base "wandering drone"; interplanetary atmosphere |
| **Ladytron** (early — *604* / *Light & Magic*) | cold, deadpan, motorik analog synthpop | a colder, more detached Corporate flavor |
| **Ladyhawke** ("Magic") | relentless driving bass, choral-voice stabs, handclaps | propulsive Corporate flavor; concrete layer ideas |
| *(room for weirder)* | glitch/IDM (Aphex, Autechre) | truly alien LANs |

**Corporate biome (the only one built today):** Mr. Robot static dread at the base, sliding
toward Perturbator aggression as threat rises.

### Shared sound vocabulary

The grid we use to talk about sound precisely. Each maps to a **superdough value param** Claude
controls, a plain-language effect, and an anchor. (Superdough shares strudel.cc's param names:
`s`, `note`, `cutoff`, `resonance`, `attack/decay/sustain/release`, `gain`, `room`, `delay`, ….)

| Dimension | superdough param | Sonic effect | Anchor |
|---|---|---|---|
| **Timbre** | `s`: sawtooth/square/triangle/sine/`gm_*`/`gus_*` soundfont/noise | saw=bright/buzzy; square=hollow/chip; triangle=soft; sine=pure/sub; soundfont=instrument; noise=wind/perc | saw→Vangelis |
| **Brightness** | `cutoff` (filter freq), `resonance` (Q) | low=dark/muffled; high=open; high Q=whistling/acid | the tension sweep |
| **Envelope** | `attack/decay/sustain/release` | slow attack=pad; fast+low sustain=pluck/stab; long release=washy | pad vs stab |
| **Register/density** | octave choice, notes per cycle | sub-bass↔lead; sparse↔wall-of-sound | Carpenter vs Perturbator |
| **Harmony/mode** | note arrays, chord progression | major=bright; natural minor=melancholy; **Phrygian ♭2=menace**; static drone=dread | the mood engine |
| **Groove** | `setcpm`, pattern grid, syncopation | propulsive↔floating; mechanical↔human | techno vs ambient |
| **Space/grit** | `room` (reverb), `delay`, detune, distortion, crush | room size; echo; width; aggression/digital decay | BR reverb; crush="ICE hit" |

**Calibration protocol:** Claude predicts a sound *from its parameters*; Les reports what his
ears actually hear; we tune Claude's mental model from the divergence. (Already found one purely
from theory: a plain Am–F–C–G progression reads "anthemic indie," not "cyberpunk intrusion" —
fixes are harmonic: go static/modal or add the Phrygian ♭2.)

## Architecture (`js/audio/`)

Browser-only. The engine is dynamically imported from `js/ui/main.js` so the `@strudel/web`
bundle downloads lazily; the headless entry points (`scripts/playtest.js`, `scripts/bot/cli.js`)
never import any of it.

- **`audio-prefs.js`** — *`@ts-check`, engine-neutral.* The single owner of the music/SFX on/off
  preferences: `isMusicEnabled`/`setMusicEnabled`/`toggleMusic`, `isSfxEnabled`/`setSfxEnabled`/
  `toggleSfx`, their `localStorage` persistence, and the `MUSIC_CHANGED`/`SFX_CHANGED` events the
  HUD buttons + console commands listen on. Seeded from `localStorage` at module load. The engine
  and commands import from here; nobody else touches the prefs.
- **`strudel/index.js`** — *`@ts-nocheck`, the engine.* `initStrudelEngine()` arms on the first
  gesture, boots the runtime, loads the soundfont + drum samples + songs, then `wire()`s: music
  (play/stop the desired song via the repl), one-shot SFX, and action drones. Exposes
  `playSfxCue(id)` for the `sfx test` command and `window.strudelEngine` for the browser playtest API.
- **`strudel/runtime.js`** — `bootStrudel()`: dynamically imports the vendored `@strudel/web`,
  polls for the async-registered globals (`evaluate`/`superdough`/`signal`/`hush`/…), and installs
  a Firefox `cancelAndHoldAtTime` polyfill (soundfont note-offs throw without it).
- **`strudel/soundfont.js`** — loads the GeneralUser GS soundfont (`gus_*` instruments) songs use.
- **`strudel/songs/index.js`** — the **song manifest** (`SONG_MANIFEST`: hub + Corporate variants),
  `loadSongs()` (fetch each `.strudel` file), and `resolveSongQuery`/`songAlias` for the `music`
  command. Songs live under `audio-content/songs/*.strudel` (the "wad" content boundary).
- **`strudel/sfx.js`** — `createSfx(rt)`: fires a one-shot cue spec through `superdough` at
  `rt.ctx.currentTime + lookahead` (1.3.0 drops haps scheduled in the past), with a 50 ms
  per-spec dedupe.
- **`strudel/data/cues.js`** — *pure data + resolver.* `CUES` (superdough value specs) +
  `resolveCue(type, payload) → spec | null` (the event→cue mapping). Unit-tested.
- **`strudel/drones.js` + `strudel/data/drones.js`** — sustained progress-driven drones on raw
  Web Audio (`createDroneVoice(ctx, spec)`), one per timed action; `DRONES` data + `resolveDrone`.
  Unit-tested.
- **`signal-registry.js` + `signals.js`** — *pure.* `SIGNAL_REGISTRY` maps a signal name
  (`gameProgress`/`gameThreat`) to a `derive(state) → 0..1` function (`deriveProgress`/
  `deriveThreat`); `computeSignals(state)` evaluates them all. Add one entry to expose a new game
  variable to music. Unit-tested.
- **`strudel/signal-bridge.js`** — installs each registered signal as a live Strudel signal
  (`window.gameProgress = rt.signal(() => live[name])`) and refreshes the live values on
  `STATE_CHANGED`. `setLive(name, v)` lets the preview tool drive signals from sliders.
- **`music-commands.js` / `sfx-commands.js`** — the `music` and `sfx` console commands. On/off go
  through `audio-prefs`; song selection emits `MUSIC_SONG_SELECT`; `sfx test <cue>` calls
  `playSfxCue`. Imported once from `js/ui/main.js`.

### Signal injection (the reactivity model)

A song references game state **by shared signal name**. Authored in strudel.cc, the author fakes
the signals (a prelude of `let gameProgress = signal(() => ...)` or slider-driven values). In-game,
`signal-bridge.js` binds those same names to the **real** live game values, refreshed on every
`STATE_CHANGED`. So the identical song file is reactive in the game and tunable in strudel.cc —
bidirectional by naming. To expose a new variable to music, add one entry to `SIGNAL_REGISTRY`;
it becomes available to songs and appears in the preview tool automatically.

### Music / SFX / drones at a glance

- **Music.** Each run picks a random song from the manifest; the hub plays `hub.strudel`. Selection
  and on/off route through the `music` command / HUD toggle. Play = `rt.evaluate(song.code)`; stop =
  `rt.evaluate("hush()")`. The song itself reads `gameProgress`/`gameThreat` to unfold/alarm.
- **One-shot SFX.** Game events (`NODE_REVEALED`, `NODE_ACCESSED`, `ACTION_RESOLVED`,
  `ALERT_GLOBAL_RAISED`, `ICE_DETECTED`, `ALERT_TRACE_STARTED`) resolve to a `CUES` spec and fire
  through superdough. Independent of music (own on/off), and they play in the hub too.
- **Action drones.** Each timed action (probe/xploit/dump/fetch/mine/lie-low/reboot) starts a
  sustained drone keyed by `nodeId:action` from `ACTION_FEEDBACK` (`start`→build, `progress`→reshape,
  `complete`/`cancel`→stop), echoing the action's on-graph animation.

## Preview harnesses

Both are Strudel, browser-only, and load their own importmap + `@strudel/web`:

- **`preview/music.html`** (`js/ui/song-preview.js`) — audition songs with slider-driven game
  signals (progress/threat) so you can hear a song respond without playing a run.
- **`preview/sfx.html`** (`js/ui/sfx-preview.js`) — a button per one-shot cue + a toggle/slider
  per drone to audition and tune the sustained voices.

Numbers in the cue/drone/song data are **feel, not spec** — change them freely and listen.

## Testing, verifying & debugging the audio code

The subsystem splits **pure logic** (no Strudel, no DOM) from the **superdough boundary**.
Everything pure is unit-tested with `node --test`, no browser:

- `signals.js` (progress/threat derivation), `signal-registry.js` (`computeSignals`).
- `strudel/data/cues.js` (`resolveCue` mapping + cue specs well-formed).
- `strudel/data/drones.js` + `strudel/drones.js` (drone specs, `resolveDrone`, `noteToFreq`).
- `audio-prefs.js` (localStorage seeding + toggle/emit).

If you can express it as data → data, put it in a pure module and unit-test it there. The
`@ts-nocheck` files (`strudel/index.js`, `strudel/runtime.js`, `strudel/sfx.js`) are glue that
should hold as little logic as possible.

### Measure realtime, not offline

Audio bugs are easy to misdiagnose: onset/envelope/transient bugs that only appear **live** won't
reproduce in an offline render (an offline render pre-resolves signals). For any "it sounds
different live" bug, **measure realtime**. Pattern that worked for the Tone engine and still
applies: launch headless Chromium with `--autoplay-policy=no-user-gesture-required --mute-audio`,
`await ctx.resume()`, tap the destination with an `AnalyserNode`, and reduce
`getFloatTimeDomainData` to **RMS per ~20 ms window** (per-window peak aliases against the
oscillator period and fakes an overshoot). Playwright/Firefox works in this repo's environment;
arm audio via a trusted key-press.

**superdough 1.3.0 gotcha:** it **drops haps scheduled in the past** (`t < ctx.currentTime`).
Fire one-shots at `ctx.currentTime + a small lookahead`, never `0` (see `strudel/sfx.js`).

### Don't regress the headless paths

The engine is browser-only. Confirm the headless entry points never import audio:
`grep -rn "js/audio" scripts/` must be empty. Audio is wired only in `js/ui/main.js`.

## Deferred / fast-follows (not blocking)

1. **Song transitions / crossfade** — smooth hub↔run and song↔song transitions, plus a STOP tail
   instead of a hard `hush()` (#264).
2. **More / friendlier soundfonts** — vendor additional GM soundfonts for song variety (#277).
3. **Authoring workflow** — first-class parity for loading the game's `gus_*` + `gameProgress`/
   `gameThreat` inside strudel.cc (#265).
4. **Vocal/texture one-shots** — BoC-style fragments; triggering model + original samples.
5. **Aged-media / lo-fi processing flavor** — vinyl crackle, tape wobble, band-limited EQ.
6. **Other biomes** — alien/ancient (BoC/weirder); the song manifest already supports more entries.
7. **More game signals** — expose additional state variables via `SIGNAL_REGISTRY` for richer
   reactivity (e.g. per-node danger, cash momentum).

## Soundfont tooling

Large authoring soundfonts are not committed to the repo; run `make fetch-soundfonts` to download
them from their hosts (URLs come from the `host` field in `audio-content/soundfonts/manifest.js`).
If a font is distributed as a compressed `.sf3` (MuseScore format), convert it first with
`make sf3-to-sf2 IN=foo.sf3 OUT=foo.sf2`, which requires `sf3convert` from the MuseScore tools
package — our runtime SF2 parser cannot read `.sf3` directly.
