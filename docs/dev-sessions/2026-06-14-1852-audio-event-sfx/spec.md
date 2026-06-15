# SFX for Game Actions — Spec

Issue: **#229 — Audio: event SFX for game actions**
Branch/worktree: `audio-event-sfx`

## Goal

A synthesized **sound-effects layer** that makes game happenings audible — short one-shot cues
fired on discrete game events across the whole game, in the cyberpunk-terminal aesthetic,
**independent of the music**. The aural landscape should become much richer and clearly
indicative of what's happening (per the issue).

This complements the reactive **music** (already shipped): music sets mood by axis; SFX are the
discrete *punctuation* of events. (Aligns with the project rule that every visible game event
should have audible/loggable feedback.)

## Decisions (from brainstorm)

- **Coverage: comprehensive** — core loop, alerts, ICE, run lifecycle, and misc events.
- **Character: cyberpunk terminal UI** — clean synth bleeps / zaps / filtered sweeps / chimes,
  no samples. Organized into **semantic sound families** so events read by ear:
  - **info / neutral** — soft blip/tick (probe, navigate, reveal)
  - **success** — bright, rising (xploit success, access)
  - **reward** — chime / quick arpeggio (fetch loot, mine card, mission complete)
  - **failure** — dark buzz / thud (xploit fail, mine trap)
  - **danger** — harsh rising alarm (alert escalation, ICE detect/lock, trace)
  - **relief / resolution** — settled descending tone (alert cooled, trace cancelled, clean jack-out)
- **Synthesis only** (Tone.js), matching the music palette. Samples are out of scope (that's #230).
- **Independent of music:** SFX have their **own persisted on/off** (menu button + `sfx` console
  command) and run on a **separate, always-available audio bus** (not torn down between hub and
  runs, unlike the music engine). You can have SFX with music off, or in the hub.

## Architecture (`js/audio/`)

Mirrors the music subsystem's split (pure data + pure logic + a thin Tone boundary + a
browser-only event subscriber):

- **`sfx-defs.js`** — *pure data.* `CUES`: a map of `cueId → sound spec` (a synth primitive +
  params), grouped by family. `@ts-check`, unit-tested.
- **`sfx.js`** — *`@ts-nocheck`, the only Web Audio boundary for SFX.* Owns its own master
  `Gain` (+ a light shared reverb) → destination, persistent for the session. `play(spec)`
  synthesizes a one-shot from a small set of **primitives**; `unlock()` (Tone.start on gesture);
  `setEnabled()`. Voice cap + per-cue throttle to avoid spam.
- **`sfx-renderer.js`** — *`@ts-check`, browser-only.* Subscribes to `E.*` events, maps each to a
  `cueId`, and calls `sfx.play(CUES[cueId])`. Arms the AudioContext on first gesture. Tracks
  prev `player.health`/`deckIntegrity` to fire damage cues (no dedicated event — diff on
  `STATE_CHANGED`, like the music's injury term).
- **`sfx-commands.js`** — *browser-only.* `sfx` console command: `status | on | off | list |
  test <cue>` (mirrors the `music` command; `test` auditions a cue).
- **Wiring:** `initSfxRenderer()` called from `js/ui/main.js` (browser entry only). Headless
  entry points (`scripts/`) never import it.
- **HUD:** a **`SFX: ON / OFF`** menu button mirroring the Music button; an `SFX_CHANGED` event
  (like `MUSIC_CHANGED`) keeps the button in sync with the console command.
- **Harness:** an SFX section in the preview harness with a button per cue to audition/tune
  (per the project rule that new audio effects get a preview).

## Sound primitives (in `sfx.js`)

A small interpreter so cues are data, not bespoke code:

- **`blip`** — single pitched osc (sine/triangle/square/sawtooth) with a fast pluck envelope.
- **`tone`/`chord`** — one or more held notes (stab/chime), optional quick arpeggio.
- **`sweep`** — pitch and/or filter glide over a short duration (rising = tension, falling = relief).
- **`noise`** — filtered noise burst (zap / impact / static / power-down).
- **`fm`** — FM blip for metallic/glitchy cues (corrupt, deck damage).

Spec shape: `{ kind, ...params, volume, decay }`. The engine routes all through the SFX master
(+ a touch of reverb) so cues sit in the same space as the music.

## Cue catalog (event → cue → family)

Comprehensive. Exact event names/payloads to be confirmed against `js/core/events.js` and
`js/ui/log-renderer.js` (which already maps these events) during planning.

| Event (condition) | cue | family |
|---|---|---|
| `ACTION_RESOLVED` probe | `probe` | info |
| `ACTION_RESOLVED` xploit (success) / (fail) | `xploit.ok` / `xploit.fail` | success / failure |
| `ACTION_RESOLVED` dump | `dump` | info (data sweep) |
| `ACTION_RESOLVED` fetch | `fetch` | reward |
| `ACTION_RESOLVED` mine (card) / (trap) | `mine.card` / `mine.trap` | reward / failure |
| `ACTION_RESOLVED` corrupt | `corrupt` | glitch (fm/sweep) |
| `PLAYER_NAVIGATED` | `navigate` | info (soft move tick) |
| `NODE_REVEALED` / `NODE_ACCESSED` | `reveal` / `access` | info / success |
| `ALERT_GLOBAL_RAISED` (→yellow/→red) | `alert.up` (pitch by level) | danger |
| `ALERT_COOLED` | `alert.down` | relief |
| `ALERT_TRACE_STARTED` / `ALERT_TRACE_CANCELLED` | `trace.start` / `trace.cancel` | danger / relief |
| `ICE_DETECT_PENDING` / `ICE_DETECTED` | `ice.pending` / `ice.locked` | danger (rising / harsh) |
| `ICE_MOVED` (visible) / `ICE_REBOOTED` / `ICE_DISABLED` | `ice.move` / `ice.reboot` / `ice.down` | info / info / success |
| `RUN_STARTED` | `run.start` | info (jack-in) |
| `RUN_ENDED` (success/caught/burned/bricked) | `run.<outcome>` | resolution / failure variants |
| `MISSION_COMPLETE` | `mission` | reward (fanfare) |
| health damage / deck damage (STATE diff) | `hurt.health` / `hurt.deck` | failure / glitch |
| `EXPLOIT_DISCLOSED` | `decay` | info (subtle degrade) |
| store purchase (hub) | `buy` | reward (if a suitable event/hook exists) |

(Some low-value or noisy events may be dropped during tuning; the catalog is the upper bound.)

## Behavior details

- **Dispose-after-play:** each one-shot creates its synth, triggers, and is disposed shortly
  after it finishes. SFX therefore add **no long-lived AudioParam accumulation** — the unbounded
  per-note automation growth that caused the music engine's over-time stutter. (Cues are
  infrequent, so create/dispose churn is negligible.)
- **Throttle / dedupe:** collapse identical cues fired within ~50 ms; cap simultaneous SFX voices
  so a burst of events can't overwhelm the mix.
- **No music ducking** in v1 (SFX simply mixed to cut through) — ducking is a future tuning item.
- **AudioContext** is shared (Tone global); SFX arm on first gesture independently of music, so
  SFX work even if music is disabled.
- **Persisted pref** `starnet:sfx-enabled` (default on).

## Testing

- **Pure tests:** `sfx-defs` structural validation (every `cueId` has a well-formed spec with a
  known `kind`); and a test that the renderer's event→cue mapping references only defined cues.
- **Engine/wiring:** Playwright smoke (events fire cues with no errors; `sfx test <cue>` works;
  the SFX toggle + button stay in sync) and ear-tuning via the preview harness.
- `make check` green; headless paths confirmed SFX-free.

## Out of scope (future)

- Music ducking under SFX.
- Sample-based vocal/texture one-shots (#230).
- Positional / per-node spatial audio.
- Per-cue volume mixing UI beyond the master SFX toggle.

---

## v2 — Dark retone + per-action sustained drones (post-first-listen)

First listen feedback (Les): the one-shots are "too blippy, bouncy, and happy" — want them
**colder / more technical / darker**; and we want **extended drone-y sounds for every timed action
in progress** (mirroring how each timed action has its own animation). Same branch / PR #237
(within issue #229).

### Part 1 — Retone one-shots → "cold machine telemetry"

No structural change (same cue ids / families / event mapping). Re-spec `sfx-defs.js` values:

- Kill cheerful arpeggios (`fetch`, `mission`, `run.success`, `mine.card`, `trace.cancel`) → terse
  low data-bursts / single sober resolved tones.
- Detune + darken pitched cues (`xploit.ok` → short detuned minor two-note; `probe`/`reveal`/
  `navigate` → dry filtered ticks, minimal pitch bounce).
- Push danger cues lower into FM growl / dissonant clusters (`alert.up`, `trace.start`, `ice.locked`).
- **Reverb becomes per-cue (default dry)** instead of a global always-on bed — the wet tail was a
  big part of the "bounce". Engine gains a `detune` param on `blip`/`sweep` and an optional per-cue
  `reverb` flag. Still ear-tuned afterward.

### Part 2 — Per-action sustained drones (new engine capability)

- **`sfx.js` gains a sustained voice:** `startDrone(spec) → { setProgress(p), stop() }` — a held
  synth graph (osc/noise/fm + filter + optional LFO + fade-in/out gain) tracked separately from the
  one-shot voice cap. Fades in on start, re-shapes on progress 0→1, fades out on stop (click-free).
- **New pure data `sfx-drones.js`:** `DRONES` (one spec per timed action) + `DRONE_IDS` +
  `resolveDrone(action) → droneId|null`. Each drone echoes its action's animation:
  - probe → thin scanning pulse, filter brightens as the sweep fills
  - xploit → grinding low FM that tightens (pitch/filter close in) as brackets converge
  - dump → chunky low data-churn
  - fetch → flowing filtered-noise that thins as it drains (gain down with progress)
  - mine → two detuned tones beating, converging to a stable pitch (lock-on) at p→1
  - lie-low → hushed sub hum + soft rhythmic tick, very quiet
  - reboot → adversarial slow pulsing low drone, loops (no progress sweep — system, not player)
- **`sfx-renderer.js`** subscribes to `ACTION_FEEDBACK`: `phase:"start"` → `startDrone` keyed by
  `${nodeId}:${action}`; `"progress"` → `setProgress(p)`; `"complete"`/`"cancel"` → `stop()`.
  `RUN_ENDED` stops all live drones. The existing completion one-shot (`ACTION_RESOLVED`) still
  fires — timed action = drone *during* + telemetry blip *at end*.
- **Harness:** `preview/sfx.html` gets a play/stop + progress-slider row per drone.
- **Tests:** `sfx-drones.test.js` (every drone is a well-formed spec) + drone-mapping cases.

### v2 scope calls (confirmed)

- **Reboot** gets a drone, but a distinctly *adversarial* looping one (involuntary system state).
- **Trace countdown** is NOT a timed action → no sustained "trace bed" this pass (it keeps the
  `trace.start` one-shot).

---

## v3 — One-shot enrichment: state-reflective motifs (post-listen)

Feedback (Les): the one-shots are all "little ticks and boops" — want **variety and meaning**,
e.g. an access-level change as a double/triple chord hit reflecting the level. Broad enrichment
pass (his call), still on PR #237 / issue #229.

### Sound vocabulary (encoding language)

- **More control / value / rarity / progress** → more hits or notes, ascending pitch, a touch
  brighter. **Loss / wear / danger** → lower, dissonant, FM/noise, descending.
- All stays cold/technical (the v2 palette); "richer" = a short *motif*, never a cheerful chime.

### Engine (`sfx.js`)

- Add `hits` + `hitGap` to the `chord` primitive — strike the chord N times in succession (the
  "double/triple hit"). Lifetime/track adjusted for the extra strikes.

### Enriched cues

| Event | State used | Cue |
|---|---|---|
| `NODE_ACCESSED` | `next` | `access.open` (chord ×2 hits, ascending) / `access.owned` (×3, fuller/higher) |
| `ACTION_RESOLVED` mine | `detail.rarity` | `mine.common` / `mine.uncommon` (2-note) / `mine.rare` (3-note ascending); miss/trap unchanged |
| `ACTION_RESOLVED` fetch | `detail.total` | `fetch` (small) / `fetch.big` (over a value threshold); trap unchanged |
| `NODE_REVEALED` | node `grade`/`type` (renderer `getState()` lookup) | **"discovery rush"** — brighter rising motif; pitch by grade; **NO dedupe**; **burst cascade**: reveals within ~250 ms step pitch up (ascending run), reset after a gap. Single reveal brighter than the old tick; mass reveal brighter still. |
| `EXPLOIT_PARTIAL_BURN` | `usesRemaining` | new `burn` wear-chirp; pitch drops as the card wears |
| `NODE_ALERT_RAISED` | `next` | new subtle `node.alert` tick, pitch by tier; low vol, hard-deduped (tuning risk — may pull back) |
| health/deck damage | (existing diff) | sharpen `hurt.health` (body thud) vs `hurt.deck` (glitch) |

**Stays terse** (frequent telemetry): `probe`, `navigate`, `dump`, `ice.move`, `decay`, `mine.miss`.

### Architecture

- access/mine/fetch/burn/node-alert carry their state in the payload → `resolveCue` stays pure
  (extends the `mine.*`/`run.*` pattern). `ROUTED` gains `EXPLOIT_PARTIAL_BURN` + `NODE_ALERT_RAISED`.
- `NODE_REVEALED` grade/type + cascade + per-burn pitch are **renderer-side** (browser-only, uses
  `getState()` and short-lived non-game cascade state, like the health/deck diff). Reveal is
  exempted from the 50 ms dedupe so bursts cascade.

### Testing

- `sfx-defs` test: new cues well-formed; `chord.hits` numeric when present.
- `sfx-cues` test: access-by-level, mine-by-rarity, fetch-by-tier, burn, node-alert branches.
- Browser realtime smoke: enriched cues fire error-free; reveal cascade ascends; levels sane.
- `make check` green.
