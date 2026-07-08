# Spec — Butterchurn brain-damage overlay (exploration)

**Session:** 2026-07-08-1347-butterchurn-brain-damage
**Status:** exploration spike (explore-first, possible path to replacing the plasma)

## The idea

The game's visual language is a strict retro **vector CRT** — stroke-only geometry,
no fills, no curves, no bitmap. The in-fiction conceit is that this vector rendering is
a *consensual hallucination projected into the player's brain*. When the player's
**wetware takes damage** (health/deck loss during a run), the meat should bleed through:
organic, psychedelic, warping visuals that are the deliberate **aesthetic opposite** of
the clean vector signal. It should read as a **shock** — the brain itself misfiring.

[Butterchurn](https://github.com/jberg/butterchurn) (a WebGL Milkdrop 2 implementation)
is a natural fit for that organic-psychedelic layer. This session evaluates whether it
works, without committing to shipping it.

## The one question this session answers

**Does butterchurn's psychedelia, composited over the vector graph, read as intentional
brain-damage — or as garbage bolted on?** Everything downstream (vendoring, game
integration, licensing, perf hardening) is gated on the labs answering "yes."

## What exists today

`js/ui/graph-degradation/` already implements a brain-damage layer:
- `health-plasma.js` — a hand-written GLSL "timelapse mold growth" plasma on a transparent
  WebGL canvas over `#graph-container`, gated by health severity, heartbeat-warped flow +
  per-beat luminance pulse. Fully driven by `degradationParams(state)`.
- `deck-perturbation.js` — perturbs the *real* Cytoscape graph, scales with deck damage.

Butterchurn, if it lands, is a candidate **replacement** for the health-plasma layer
(not the deck perturbation).

## Design decisions (settled in brainstorming)

- **Manifestation:** ambient bed **+** shock-flares. A low corruption bed that scales with
  accumulated health-damage severity, *plus* sharp flares on discrete damage events.
- **Drive signal (hybrid):**
  1. **Game audio** feeds butterchurn's analyser → the ambient reactive texture (it breathes
     with the reactive Strudel/superdough score + SFX).
  2. **Synthetic audio impulses** injected on damage events → a hit literally *punches*
     butterchurn with a bass-drop warp (mixed into the analysed signal, so butterchurn
     reacts natively rather than us faking the warp).
  3. **Game state** controls compositing (opacity/blend ramp with severity) and **preset
     selection** for severity tiers.
- **Aesthetic clash is intentional.** Not to be softened into "on-brand."

## Deliverables — two checked-in reference labs

Both live in this session dir and are **kept** as reference artifacts (butterchurn/GLSL is
likely to be revisited). They do **not** modify game source.

### Lab A — standalone aesthetic proof

Self-contained HTML. Fastest path to *seeing it*; this is the visual companion for the
core question.

- Butterchurn + a handful of presets loaded from **CDN** (no vendoring yet).
- Composited over a **static screenshot of the game graph** (captured into the session dir
  so the lab is self-contained).
- Audio: a **placeholder** loop — `lab-audio.mp3` (a ~20s clip trimmed from
  `stripdown-intro(1).wav`) — just to give butterchurn something to move to.
  Faithful game audio is Lab B's job.
- **Controls:** preset dropdown · blend-mode dropdown (`screen` / `lighten` / `overlay` /
  `normal`) · base-opacity slider · "severity" slider (→ opacity + preset intensity) ·
  "shock" button (transient opacity/warp flare).
- **Success:** find blend-mode + opacity ranges where the composite reads as *the meat
  bleeding through the vector signal*, and confirm the shock flare startles.

### Lab B — live-game integration proof

The faithful version: butterchurn against a **running game** at `localhost:3000`,
composited over the live `#cy`. Exposed via a **`?dev` URL flag or a cheat command**
(exact form decided in the plan).

Opening task (locate the real seams — grounded but not yet confirmed):
- **Audio tap:** the shared `AudioContext` is reachable via `window.getAudioContext()`
  (`js/audio/strudel/runtime.js`). *Open:* superdough may connect straight to
  `ctx.destination`, so a master analyser tap may require inserting an analyser node —
  confirm the routing before wiring.
- **Shock triggers:** health/deck damage is **not** a single named event. Strong candidate
  events on the bus (`js/core/events.js`): `ICE_EFFECT_APPLIED`, `ICE_DETECTED`,
  `ALERT_TRACE_STARTED`. Confirm which fire on actual wetware damage; may instead hook a
  `degradationParams` severity **delta** frame-to-frame.

Then:
- Ambient bed tracks `degradationParams(state)` severity (same source the plasma uses).
- Shock-flare = a short **synthetic bass burst** mixed into the analysed signal on a damage
  event, on top of a game-state opacity/blend ramp.
- Composited over live `#cy` (canvas over `#graph-container`, above the plasma layer).
- **Success:** the hybrid drive feels alive against real gameplay, and it survives a first
  **perf** sanity check (framerate during a run).

## Explicitly deferred (carried forward, NOT solved this session)

- **Perf hardening** — Lab B is the *viability* test for continuous full-screen WebGL +
  feedback buffers over `#cy` (CLAUDE.md documents this exact pattern tanking FPS before).
  This session only sanity-checks framerate; it does not harden.
- **Licensing** — butterchurn-presets are community MilkDrop presets with murky per-preset
  authorship. If this ships, presets become runtime-loaded **content** (a wad) under the
  AGPL-engine / separable-content model — a curated permissive subset or original presets.
  Not resolved for a spike that never ships.
- **Production port** — into `preview.html` + the real game with proper esbuild vendoring
  (`dist/`, like Cytoscape/Lit). A *future* session, gated on these labs.

## Out of scope

- Any change to `js/` game source.
- Vendoring butterchurn into `dist/`.
- Retiring or altering the existing `health-plasma.js`.
- Preset licensing resolution.
