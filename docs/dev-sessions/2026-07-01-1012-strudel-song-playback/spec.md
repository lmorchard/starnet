# Spec — Reactive Strudel song playback (strudel.cc as the content tool)

## Goal

Make the Strudel audio engine play & automate **real strudel.cc-authored songs** as game content,
with **game signals injected** for reactivity, and **bidirectional sample parity** (what you hear
composing in strudel.cc is what plays in-game). Establish **strudel.cc as the game's music
content-authoring tool**, and ship a **permanent song-preview harness**. Keep licensing clean
(AGPL engine; friendly-licensed sample set; songs as separately-licensed "wad" content).

## Background / current state

- **Phase 1 (PR #262):** vendored `@strudel/web@1.0.3` engine behind an engine-select flag; a
  bespoke score-DATA interpreter (`js/audio/strudel/music.js` `buildProgram`) driving ONE reactive
  corporate score; superdough SFX + action drones; `js/audio/signals.js`
  (`deriveProgress`/`deriveThreat`).
- **Proven this session (see `research.md`):** signal injection works — a `gThreat` slider reshapes
  a *playing* song by ear; Les's own "Stripdown intro" cover plays via `tmp/song-player.html` with
  compat shims; the gaps are small and enumerated.

## Desired end state

- The engine runs full strudel.cc songs faithfully — **no drift** between strudel.cc and in-game.
- Songs are content files authored in strudel.cc against the game's **kosher sample set**.
- A **published sample manifest** = the same sounds in strudel.cc (authoring) and in-game (offline
  vendored), guaranteeing the sound carries both ways.
- Game signals exposed as **named, expandable** Strudel signals (progress/threat now) that a
  composer can wire into any pattern param.
- A **permanent standalone preview/authoring harness** (like `preview.html`): load a song, a slider
  per exposed signal, play/stop, and an in-set linter.

## Design decisions (with reasoning)

1. **Upgrade the game runtime to `@strudel/web@1.3.0`.** The browser/esbuild bundle builds clean
   (verified — 644KB) and brings native `$:` (via the newer transpiler) + `setcpm`, so strudel.cc
   songs run unmodified → *no drift*, the governing constraint. The node-ESM breakage is precisely
   `@strudel/core@1.2.6` → `@kabelsalat/web@0.4.1` (no `SalatRepl` named export under node ESM); it
   affects only **node-side tooling**, not the browser game. Isolate any node validator via
   pin-`1.2.5` / pre-bundle / headless-browser.
2. **Songs are raw strudel.cc code, run via `evaluate()`** — no bespoke DSL. The engine interprets
   real Strudel. (`let`/`arrange`/`stack`/expressions already work; the upgrade adds `$:`/`setcpm`.)
3. **Bidirectional sample parity via a published manifest.** The kosher set is hosted as a
   Strudel-loadable sample manifest (`samples('<game-set-url>')`, one import line authors add in
   strudel.cc) AND vendored offline in-game as the identical files → parity by construction. An
   **in-set linter** flags any sound outside the set so an authored song is guaranteed to carry.
4. **Signals as an expandable registry.** A single registry maps `name → derive(state)`; the engine
   exposes each as a global Strudel signal (`signal(() => value)`). Ship `progress` + `threat`;
   adding a variable later = one registry entry. Reuses `signals.js`; the STATE_CHANGED bridge
   updates the live values.
5. **Permanent standalone preview harness**, sibling to `preview.html`: load/paste a song, a slider
   per registered signal, play/stop, in-set linter. Usable without a running game; grows with the
   signal registry. (Promotes `tmp/song-player.html`.)
6. **Instrument source — clean-licensed, bidirectional (OPEN, recommend at plan).** Options:
   GeneralUser GS (permissive) or FluidR3_GM (MIT-style) as SF2 via `@strudel/soundfonts`+`sfumato`
   (adds a version-reconcile), OR export the needed instruments as **superdough sample-maps**
   loaded via `samples()` (fits the manifest path, no SF2 loader, no extra version conflict). **Lean:
   sample-map via `samples()` for the first instruments** (bidirectional-native); evaluate SF2 if
   breadth is needed. Decide at plan time with size/fidelity data.

## Patterns to follow

- `js/audio/strudel/runtime.js` — boot/poll; extend for the upgraded runtime + manifest load.
- `js/audio/signals.js` — `derive*` fns feed the signal registry.
- `js/audio/audio-renderer.js` — the STATE_CHANGED → live-signal bridge.
- `preview.html` + `js/ui/preview.js` — structural precedent for the preview harness (CLAUDE.md
  already mandates a preview harness for new visual effects; this is the audio analog).
- `tmp/song-player.html` — working prototype to promote (compat + per-signal sliders).
- `Makefile` `dist/*.js` vendor targets + `index.html` importmap — the vendoring pattern.

## What we're NOT doing (scope lock)

- **Not** replacing the game's run/hub music-selection wiring in the first slices — target the engine
  capability + preview tool + one authored song first; wiring songs as actual in-game run music is a
  later slice.
- **Not** retiring the Phase-1 bespoke score interpreter in this arc (coexists; its fate is a later
  call once songs are the primary path). **PR #262 lands first.**
- **Not** building an in-app song editor — strudel.cc IS the editor.
- **Not** vendoring full GM breadth up front — only the instruments the first songs need.
- **Not** solving simultaneous multi-song scheduling — one song at a time (+ SFX/drones on their own
  path, unaffected).

## Phasing (proposed)

- **A. Runtime upgrade** — `@strudel/web@1.3.0` behind the existing engine flag; re-verify Phase-1
  music/SFX/drones; confirm `$:`/`setcpm`/`arrange` work natively.
- **B. Signal registry** — expandable registry; expose `progress`/`threat` as named globals; wire the
  STATE_CHANGED bridge.
- **C. Kosher sample set** — pick + vendor a friendly-licensed set; publish the manifest; load offline
  in-game; document the strudel.cc import line.
- **D. Preview harness** — permanent standalone tool: load song + per-signal sliders + play + in-set
  linter.
- **E. Acceptance demo** — Les's Stripdown cover plays faithfully end-to-end (real instruments via the
  kosher set + reactive signals).

## Open decisions (resolve at plan)

- Instrument source + mechanism (SF2 via sfumato vs sample-map via `samples()`) + which friendly license.
- Manifest hosting (repo GitHub Pages? an `/audio-content/` path served with the game?).
- Node validator/linter approach (pin 1.2.5 / pre-bundle / headless).
- **Sequencing vs. finishing #262's superdough-drone rework** (still pending Les's lab tuning).

## Readiness notes

- **Feel/authoring-driven:** the preview harness is the iteration vehicle (per the "feel-driven →
  prototype" rule); song authoring itself is Les's creative work in strudel.cc.
- Acceptance is concrete (Slice E: the cover plays faithfully + reacts), so the arc has a clear "done".
