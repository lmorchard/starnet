# SFX for Game Actions — Implementation Plan

**Goal:** A synthesized, event-driven SFX layer (issue #229) — one-shot cyberpunk-terminal cues
on game events, independent of the music, with its own bus + on/off control.

**Architecture:** Mirrors the music subsystem. Pure data (`sfx-defs.js` cues) + pure mapping
(`sfx-cues.js` event→cueId) + a thin Tone boundary (`sfx.js`, the only Web Audio for SFX) + a
browser-only event subscriber (`sfx-renderer.js`). Console command + HUD button mirror the music
controls. Headless entry points never import any of it.

**Tech:** Tone.js (vendored at `dist/tone.js`), `node:test`, JSDoc `@ts-check`.

**Verified event reality (from log-renderer.js + events.js):**
- `ACTION_RESOLVED {action, success?, detail}`: xploit success is top-level `success`; mine sub-case
  is `detail.outcome` (`"card"|"miss"|"trap"`); fetch honey-pot is `detail.trap`.
- `RUN_ENDED {outcome}` = `"success"|"caught"|"burned"|"bricked"`.
- Health/deck have NO damage event → diff `state.player.health.current` / `.deckIntegrity.current`
  on `STATE_CHANGED`.
- `ALERT_PROPAGATED` never emitted — skip. Store-purchase has no event — `buy` cue dropped for v1.
- Mirror: `js/audio/audio-renderer.js`, `engine.js`, `music-commands.js`, the HUD music button +
  `css/style.css`, and `MUSIC_CHANGED` in `events.js`.

---

## File structure

| File | Responsibility | Checked |
|---|---|---|
| `js/audio/sfx-defs.js` | pure: `CUES` map (cueId → sound spec) + `CUE_IDS` | `@ts-check` |
| `js/audio/sfx-cues.js` | pure: `resolveCue(type, payload)` → cueId\|null | `@ts-check` |
| `js/audio/sfx.js` | Tone boundary: primitives, `play(spec)`, `unlock`, `setEnabled` | `@ts-nocheck` |
| `js/audio/sfx-renderer.js` | browser-only: events → resolveCue → play; gesture arm; health/deck diff; pref | `@ts-check` |
| `js/audio/sfx-commands.js` | browser-only: `sfx` console command | `@ts-check` |
| `preview/sfx.html` + `js/audio/sfx-playground.js` | audition harness (button per cue) | n/a / `@ts-nocheck` |
| `tests/sfx-defs.test.js` | every cue has a valid spec; primitive kinds known | n/a |
| `tests/sfx-cues.test.js` | resolveCue returns only defined cues; key cases correct | n/a |
| modify `js/core/events.js` | add `SFX_CHANGED` | — |
| modify `js/ui/components/starnet-hud.js` | `SFX: ON/OFF` button + `sfxEnabled` prop | — |
| modify `css/style.css` | add `#sfx-btn` to shared menu-button rules | — |
| modify `js/ui/main.js` | `initSfxRenderer()`, `import sfx-commands`, hud-action + `SFX_CHANGED` wiring | — |

---

## Sound primitives (the `play(spec)` interpreter in `sfx.js`)

All specs: `{ kind, volume?, ...params }`. Engine connects each voice to the SFX master and
**disposes it after it finishes** (no lingering param accumulation). Schedule at
`ctx.currentTime + 0.02` (NOT `Tone.now()`) so SFX aren't delayed by the music's 200ms lookahead.

- **`blip`** `{ note, osc="triangle", decay=0.12 }` → `Tone.Synth({oscillator:{type:osc}, envelope:{attack:0.001, decay, sustain:0, release:0.05}})`, `triggerAttackRelease(note, decay, t)`.
- **`sweep`** `{ from, to, dur=0.18, osc="sawtooth" }` → `Tone.Synth`; set `frequency=from`, `triggerAttack(t)`, `frequency.rampTo(to, dur, t)`, `triggerRelease(t+dur)`. (rising=tension, falling=relief.)
- **`chord`** `{ notes:[...], osc="triangle", decay=0.35, strum=0 }` → `Tone.PolySynth(Tone.Synth,{...})`; if strum, offset each note by `strum`s; reward/chime.
- **`noise`** `{ dur=0.15, cutoff=4000, type="white", hp=false }` → `Tone.NoiseSynth` → `Tone.Filter`; zap/impact/static/power-down.
- **`fm`** `{ note, harmonicity=3, modIndex=12, decay=0.2 }` → `Tone.FMSynth`; metallic/glitch.

Master: `Tone.Gain(0.9)` → `Tone.Reverb({decay:1.2, wet:0.12})` → destination. Voice cap (~12);
drop new cues over cap.

---

## Cue catalog (`sfx-defs.js`) — starter specs (ear-tunable)

```
export const CUES = {
  // info / neutral
  probe:        { kind:"blip",  note:"A5", osc:"sine",     decay:0.08, volume:-16 },
  navigate:     { kind:"blip",  note:"E5", osc:"triangle", decay:0.05, volume:-22 },
  reveal:       { kind:"blip",  note:"C6", osc:"sine",     decay:0.10, volume:-18 },
  dump:         { kind:"sweep", from:300, to:1200, dur:0.22, osc:"sawtooth", volume:-18 },
  "mine.miss":  { kind:"noise", dur:0.10, cutoff:2500, volume:-20 },
  "ice.move":   { kind:"blip",  note:"F4", osc:"triangle", decay:0.05, volume:-24 },
  decay:        { kind:"blip",  note:"D4", osc:"square",   decay:0.06, volume:-22 },
  // success
  "xploit.ok":  { kind:"sweep", from:440, to:1320, dur:0.16, osc:"square", volume:-12 },
  access:       { kind:"chord", notes:["A4","E5"], decay:0.2, osc:"triangle", volume:-14 },
  "ice.down":   { kind:"sweep", from:1400, to:200, dur:0.5, osc:"sawtooth", volume:-12 },
  // reward
  fetch:        { kind:"chord", notes:["C5","E5","G5","C6"], strum:0.04, decay:0.35, volume:-11 },
  "mine.card":  { kind:"chord", notes:["E5","A5","C6"], strum:0.03, decay:0.3, volume:-12 },
  mission:      { kind:"chord", notes:["C5","G5","C6","E6","G6"], strum:0.05, decay:0.5, volume:-9 },
  // failure
  "xploit.fail":{ kind:"noise", dur:0.18, cutoff:900, volume:-12 },
  "mine.trap":  { kind:"fm",    note:"A2", harmonicity:1.5, modIndex:18, decay:0.3, volume:-11 },
  "fetch.trap": { kind:"fm",    note:"C3", harmonicity:2, modIndex:14, decay:0.25, volume:-12 },
  "hurt.health":{ kind:"noise", dur:0.2, cutoff:600, volume:-10 },
  "ice.ejected":{ kind:"sweep", from:800, to:120, dur:0.3, osc:"sawtooth", volume:-12 },
  // danger
  "alert.up":   { kind:"sweep", from:330, to:660, dur:0.25, osc:"sawtooth", volume:-13 },
  "trace.start":{ kind:"fm",    note:"A3", harmonicity:2, modIndex:20, decay:0.6, volume:-9 },
  "ice.pending":{ kind:"sweep", from:500, to:900, dur:0.35, osc:"square", volume:-14 },
  "ice.locked": { kind:"fm",    note:"E3", harmonicity:1.5, modIndex:22, decay:0.5, volume:-9 },
  // glitch
  corrupt:      { kind:"fm",    note:"G3", harmonicity:3.5, modIndex:16, decay:0.25, volume:-13 },
  "hurt.deck":  { kind:"fm",    note:"D3", harmonicity:4, modIndex:20, decay:0.3, volume:-11 },
  // relief / resolution
  "alert.down": { kind:"sweep", from:520, to:300, dur:0.3, osc:"triangle", volume:-16 },
  "trace.cancel":{ kind:"chord", notes:["E5","A5"], decay:0.4, osc:"triangle", volume:-13 },
  "ice.reboot": { kind:"blip",  note:"G4", osc:"sine", decay:0.15, volume:-16 },
  // run lifecycle
  "run.start":  { kind:"sweep", from:120, to:600, dur:0.5, osc:"sawtooth", volume:-12 },
  "run.success":{ kind:"chord", notes:["C5","E5","G5","C6"], strum:0.06, decay:0.6, volume:-9 },
  "run.caught": { kind:"fm",    note:"A2", harmonicity:1, modIndex:24, decay:0.8, volume:-9 },
  "run.burned": { kind:"noise", dur:0.6, cutoff:500, volume:-9 },
  "run.bricked":{ kind:"fm",    note:"C2", harmonicity:5, modIndex:24, decay:0.8, volume:-9 },
};
export const CUE_IDS = Object.freeze(Object.keys(CUES));
```

## Event → cue mapping (`sfx-cues.js`, pure) — `resolveCue(type, payload)` → cueId|null

- `ACTION_RESOLVED` switch on `payload.action`:
  `probe`→`probe`; `dump`→`dump`; `corrupt`→`corrupt`;
  `xploit`→ `success ? "xploit.ok" : "xploit.fail"`;
  `fetch`→ `detail?.trap ? "fetch.trap" : "fetch"`;
  `mine`→ `{card:"mine.card",trap:"mine.trap",miss:"mine.miss"}[detail?.outcome] ?? null`; else null.
- `NODE_REVEALED`→`reveal`; `NODE_ACCESSED`→`access`; `PLAYER_NAVIGATED`→ `payload.nodeId ? "navigate" : null`.
- `ALERT_GLOBAL_RAISED`→ `next==="trace" ? null : "alert.up"`; `ALERT_COOLED`→`alert.down`.
- `ALERT_TRACE_STARTED`→`trace.start`; `ALERT_TRACE_CANCELLED`→`trace.cancel`.
- `ICE_DETECT_PENDING`→`ice.pending`; `ICE_DETECTED`→`ice.locked`; `ICE_EJECTED`→`ice.ejected`;
  `ICE_REBOOTED`→`ice.reboot`; `ICE_DISABLED`→`ice.down`; `ICE_MOVED`→ `payload.toVisible ? "ice.move" : null`.
- `RUN_STARTED`→`run.start`; `RUN_ENDED`→ `"run."+payload.outcome`.
- `MISSION_COMPLETE`→`mission`; `EXPLOIT_DISCLOSED`→`decay`.
- Health/deck damage handled in the renderer (STATE_CHANGED diff), not resolveCue.
- For `alert.up`, the renderer applies a pitch multiplier by level (yellow lower / red higher) at play time.

---

## Tasks

### Task 1 — `sfx-defs.js` + test
Create the `CUES`/`CUE_IDS` module above. Test (`tests/sfx-defs.test.js`): each cue `kind` ∈
{blip,sweep,chord,noise,fm}; required params per kind present (blip/fm→`note`, chord→`notes[]`,
sweep→`from`/`to`, noise→`dur`); `volume` is a number ≤ 0. `node --test` + `make lint` pass. Commit.

### Task 2 — `sfx-cues.js` + test
Implement `resolveCue` per the mapping (import `E`). Test: key cases (xploit ok/fail; mine
card/miss/trap; fetch normal/trap; run.* per outcome; ICE_MOVED visible vs not; ALERT next=trace →
null) + exhaustiveness (every cueId resolveCue can return exists in `CUES`). Pass + lint. Commit.

### Task 3 — `sfx.js` engine
`createSfx()` → `{ unlock, setEnabled, isEnabled, play, getMasterInput }`. Lazy master bus on first
unlock/play; `play(spec)` builds the primitive, schedules at `ctx.currentTime+0.02`, disposes after
the sound; voice cap; no-op if disabled. `node --check` + lint + test clean. Commit.

### Task 4 — `SFX_CHANGED` event + `sfx-renderer.js`
Add `E.SFX_CHANGED`. `initSfxRenderer()`: create engine; load `starnet:sfx-enabled` pref; gesture
arm (unlock); subscribe mapped events → `resolveCue` → `play`; STATE_CHANGED health/deck diff →
`hurt.*` (reset prev on RUN_STARTED); exports `isSfxEnabled/setSfxEnabled/toggleSfx/playCue/listCues`
(set* persists + emits `SFX_CHANGED`). lint + test clean. Commit.

### Task 5 — `sfx-commands.js`
`sfx` command (`status|on|off|list|test <cue>`) mirroring `music-commands.js` (tab-complete cue ids
for `test`). lint + test clean. Commit.

### Task 6 — HUD button + main.js wiring
`starnet-hud.js`: `sfxEnabled` prop + `SFX: ON/OFF` button → `toggle-sfx`. `css`: `#sfx-btn` in the
shared button rules. `main.js`: import + `initSfxRenderer()` after `initAudioRenderer()`;
`hudEl.sfxEnabled = isSfxEnabled()`; `on(E.SFX_CHANGED, …)`; `case "toggle-sfx": toggleSfx()`.
`make check`; `grep -rn "audio/sfx" scripts/` empty. Commit.

### Task 7 — preview harness + smoke + listen checkpoint
`preview/sfx.html` + `js/audio/sfx-playground.js`: a button per `CUE_IDS` cue → `play(CUES[id])`;
`window._sfx` handle. Playwright smoke (click cues, run game actions → no errors; `sfx test` works).
**Listen checkpoint (Les)** to flag tuning. Commit.

### Task 8 — docs + final checks
Update `MANUAL.md` + `docs/audio-direction.md`. `make check` green; headless SFX-free; in-game smoke
clean. Commit.

---

## Notes / deferred
- Store-purchase cue dropped (no event); one-line emit in store-logic.js later if wanted.
- No music ducking in v1. Sounds are rough drafts → by-ear tuning pass follows.
- `alert.up` pitch-by-level is renderer-side parameterization, not separate cues.
