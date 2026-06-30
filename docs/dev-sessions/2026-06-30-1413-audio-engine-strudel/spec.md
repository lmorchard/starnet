# Spec — Audio engine rebuild: Strudel + superdough (AGPL), replacing Tone

> Source: GitHub issue lmorchard/starnet#254 (carries the `<!-- dev-session:spec -->` marker).
> This file is the issue body verbatim, plus a **Session amendment** at the end capturing
> the action-drone scope gap surfaced at session start.

**Goal:** Replace the Tone.js audio engine with a **Strudel (music) + superdough (SFX)** engine — one engine, livecoding-native authoring, reactive to game state — and license the game **AGPL-3.0** so it can ship. Validated end-to-end by spikes this session (see Background); FPS held in-game.

## Background — how we got here

Terminal arc of a multi-step exploration (2026-06-29):

1. From #251 (Tone authoring friction) → pivoted to **Strudel** (livecoding fits the hacker aesthetic + authoring loop).
2. **Capability spike** (`tmp/strudel-spike/`, memory `strudel-superdough-spike`): proved reactive control (`signal()` morphs a live pattern, no restart), superdough SFX one-shots, livecoding feel. ✅
3. **Analyzer re-target** — merged **PR #253**: `tools/audio-reference` now emits idiomatic Strudel per track + a minimal Strudel player; old Tone player preserved as `tone-player.*`. Hand-translated **Stripdown** is the worked example of good Strudel (FM lead, driven bass, sample drums).
4. **In-game integration spike** — branch **`strudel-ingame-spike`** (`js/audio/strudel-spike.js`, flag-gated): superdough SFX on real `E.*` cues + a reactive Strudel stack reading the existing signals. Boots clean in-game, reactive bridge tracked real node ownership, SFX path fires, **FPS held**.
5. **Licensing cleared:** Strudel/superdough is AGPL-3.0 (viral). Decision (memory `starnet-licensing-agpl`): license the **engine AGPL-3.0**, keep future content packs as separately-licensed runtime data (**Doom model**).

## Current state (`js/audio/`, Tone-based, MIT)

- `engine.js` — Tone engine. `scores/` — 8 corporate variants + hub ambient, section automation. `sfx/` — Tone event cues. `mixer.js`/`harmony.js`/`rhythm.js`.
- `signals.js` — **pure** `deriveProgress(state)` / `deriveThreat(state)`, engine-agnostic.
- `audio-renderer.js` — bridge: arms audio on first pointer/keydown; `on(E.STATE_CHANGED) → engine.setProgress/setThreat`; `RUN_STARTED`/`RUN_ENDED` swap hub↔run; `setMusicEnabled()` persists a pref + emits `MUSIC_CHANGED`.
- `tone` bundled via esbuild (`js/tone-vendor.js → dist/tone.js`), mapped in the importmap. Music on/off is a client pref (never serialized).

## Design decisions

- **AGPL-3.0 for the engine.** Strudel/superdough are AGPL; bundling forces the whole game to AGPL. **Doom model:** open engine; future content ("wad") kept as **separately-licensed data loaded at runtime, never woven into engine source.**
- **Reuse `signals.js` unchanged** as the reactive core — pure, engine-agnostic.
- **Scores + SFX as DATA files** (the content/code boundary that keeps the "wad" separately licensable). The engine *interprets* them.
- **Cutover behind an engine-select flag.** Strudel engine lands alongside Tone, A/B-able; Tone stays default until parity, then is retired. Mirror the music on/off pref (localStorage + console command).
- **Keep the `audio-renderer` bridge shape** — the Strudel engine implements the same surface (`setProgress`/`setThreat`/enable/score-select) so the bridge barely changes.

## Phased plan

### Phase 1 — Foundation + SFX + one reactive score (shippable slice)
- Add top-level **`LICENSE` (AGPL-3.0)** + an in-game "source" link; confirm repo stays public.
- Bundle the **Strudel runtime** (open decision: vendor vs CDN).
- **superdough SFX layer** at parity with current Tone cues, on the same `E.*` events: `NODE_REVEALED`, `NODE_ACCESSED`, `ACTION_RESOLVED` (success/fail), `ALERT_GLOBAL_RAISED`, `ICE_DETECTED`, `ALERT_TRACE_STARTED` (port from `strudel-spike.js`'s `CUES`).
- **One** reactive Strudel score (corporate biome) as a data file, driven by `deriveProgress`/`deriveThreat` via `signal()`.
- Behind the **engine flag** (Tone default). A/B-able with the music toggle.
- **Perf gate:** stress test — dense tracks (~8) + rapid SFX, watch FPS/audio dropouts. The spike proved the floor; this proves the ceiling.

### Phase 2 — Re-author the reactive music design
- Port the two-axis reactive design, the remaining biome scores + the 8 corporate variants, and section automation to **Strudel pattern data**. Composition, not wiring. Stripdown is the reference for patch quality.

### Phase 3 — Flip default + retire Tone
- Default to the Strudel engine once at parity; remove `engine.js`/Tone `scores`/`sfx` + the `tone` dependency + importmap entry. Update `docs/audio-direction.md` + `MANUAL.md`.

## Implementation notes — findings carried from the spikes

`@strudel/web@1.0.3` (the runtime the player + spike use):
- `initStrudel()` returns **undefined** and registers globals **asynchronously** — **poll** for readiness, don't `await`/`.then()` it. AudioContext needs a user-gesture to `resume()`.
- Run string patterns through **`evaluate(code)`** (the transpiler); for JS-API-built patterns use **`.play()`**. **Not** `new Function`.
- **Tempo:** no global `setcps`/`setcpm` in 1.0.3 — set it on the pattern with **`.cpm(bpm/4)`** or `.cps()`.
- **Reactive:** `signal(() => liveValue)` re-samples each cycle; `.range(lo,hi)` maps 0..1.
- **Timbre:** FM via `.fm(index)` + `.fmh(harmonicity)` + `.fmattack/.fmdecay/.fmsustain`. `.distort(x)` = drive; `.shape`/`.crush`/`.coarse`; `.lpf`/`.cutoff`/`.hpf`/`.resonance`; `.room`/`.delay`/`.pan`; ADSR. **`.rev()` needs parens** in 1.0.3. Mini-notation `< > [ ] * / ! ,` are **string-only** — for whole-pattern alternation use `cat(...)`, to layer use `stack(...)`.
- Drum samples (`bd`/`sd`/`hh`/…) stream from github via `samples('github:tidalcycles/dirt-samples')` after boot — for a shipped engine, **vendor the sample set** (don't depend on github at runtime). Synth voices register immediately.
- If a headless Strudel **validator** is reused: node `@strudel/core`+`mini`+`transpiler` **pinned to 1.2.5** — `1.2.6` breaks under node ESM.
- **MIR octave-tempo:** detected tempos often half the felt rate.

Reference module: `js/audio/strudel-spike.js` on branch `strudel-ingame-spike`.

## What we're NOT doing

- Changing the event bus or `signals.js` (reuse as-is).
- Gameplay changes.
- The audio-reference analyzer (separate; shipped in #253).
- Re-authoring tooling for scores beyond what Phase 2 needs.

## Open decisions (with defaults)

- **Strudel runtime bundling:** vendor into `dist/` via esbuild like `tone.js` (default — offline, shippable sample set), or CDN `@strudel/web` if bundling proves impractical. Phase 1 settles it (incl. how to vendor the dirt-sample subset).
- **Phase-1 score count:** one (corporate); expand in Phase 2.
- **Engine flag mechanism:** localStorage pref + console command, mirroring music on/off.

## References

- PR #253 (analyzer → Strudel, merged). Branch `strudel-ingame-spike` (in-game spike).
- Session docs: `docs/dev-sessions/2026-06-29-1125-audio-strudel-analyzer/`, `docs/dev-sessions/2026-06-29-1550-strudel-ingame-spike/notes.md`.
- `docs/audio-direction.md`. Stripdown worked example: `tools/audio-reference/docs/agent-side-grinder-stripdown.json`.

---

## Session amendment (2026-06-30) — action-drone scope

Codebase research at session start found **three** audio surfaces in the Tone engine, not two.
The issue's Phase-1 SFX list names only (a) discrete one-shot cues and (b) the reactive music.
It does **not** name the third:

**(c) Progress-driven action drones** (`js/audio/sfx/drones.js`): sustained, evolving tones
that play *during* a timed node action (probe/xploit/dump/fetch/mine/lie-low/reboot), driven by
`E.ACTION_FEEDBACK { phase, progress: 0..1 }` with live filter/detune/gain sweeps. This is a
distinct mechanism with its own `startDrone(spec) → {setProgress, stop}` engine surface.

**Decision (Les, session start):** action drones are **in scope for Phase 1** — both the one-shot
cues AND the progress drones must port to the new engine. See `notes.md` for the open design
question (drones are not superdough's native one-shot idiom) and the chosen approach.
