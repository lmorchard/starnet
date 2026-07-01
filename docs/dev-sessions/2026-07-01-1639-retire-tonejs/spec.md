# Spec — Retire Tone.js, consolidate on the Strudel audio engine (#267)

## Goal

Strudel/superdough is now the **default and shipped** audio engine (#276). Tone.js
is opt-in (`audio engine tone`) and carries a growing maintenance burden: a second
vendor bundle, a second set of scores/SFX/drones, and the engine-select flag. Remove
Tone.js and its resources, leaving Strudel as the single engine.

## Current state (origin/main @ 8c1128e)

- **Two engines behind a flag** (`js/audio/engine-select.js`, default `"strudel"`):
  - **Tone (opt-in, pending removal):** `engine.js`, `harmony.js`, `mixer.js`,
    `rhythm.js`, `audio-renderer.js`, `scores/*` (corporate + 10 variants + hub +
    index), `sfx/*` (engine, renderer, cues, defs, drones, commands), `js/tone-vendor.js`
    → `dist/tone.js`, the `tone` dep + importmap entries.
  - **Strudel (default, shipped):** `js/audio/strudel/**` (index, runtime, sfx, drones,
    signal-bridge, soundfont, songs/, data/cues, data/drones), `js/strudel-vendor.js`
    → `dist/strudel.js`.
- **The Tone renderer modules OWN the music/SFX prefs + events** even when Tone isn't
  running: `audio-renderer.js` (`setMusicEnabled`/`isMusicEnabled`/`toggleMusic`,
  `MUSIC_CHANGED`, module-load localStorage seeding) and `sfx/renderer.js`
  (`setSfxEnabled`/`isSfxEnabled`/`toggleSfx`/`playCue`/`listCues`, `SFX_CHANGED`).
  The Strudel engine reads those prefs (its own `loadPref`) and listens to
  `MUSIC_CHANGED`/`SFX_CHANGED`. **These prefs must survive Tone's deletion.**
- **Consumers:** `js/ui/main.js` (imports both renderers + `getAudioEngine`, branches on
  engine, wires HUD toggles), `js/audio/music-commands.js` (engine-aware; Tone branch +
  Strudel branch), `js/audio/sfx/commands.js` (the `sfx` incl. `sfx test <cue>` command),
  `js/audio/strudel/commands.js` (the `audio engine` command).

## Approach

1. **Extract prefs to a neutral module first** (`js/audio/audio-prefs.js`): music + SFX
   enabled state, localStorage keys, module-load seeding, the toggles/setters, and the
   `MUSIC_CHANGED`/`SFX_CHANGED` emits. This is the load-bearing step — do it before any
   deletion so the HUD, console commands, and Strudel engine keep working.
2. **Give the `sfx` command a Strudel-side home** (`js/audio/sfx-commands.js`, symmetric
   with `music-commands.js`): prefs from `audio-prefs`, cue list from `strudel/data/cues`,
   `sfx test <cue>` playback via a new `playSfxCue()` export on the Strudel engine.
3. **Repoint consumers** (main.js, music-commands.js, strudel/index.js) at the neutral
   module; collapse the engine-select flag (Strudel-only).
4. **Delete Tone code, vendor, dep, importmap entries, and Tone-only tests.**
5. **Docs:** rewrite `docs/audio-direction.md`, update `MANUAL.md`, `CLAUDE.md`
   "What's Shipped", `README.md`.

## Decisions

- **Engine flag collapses entirely.** With one engine, `engine-select.js` and the
  `audio engine <tone|strudel>` command are meaningless → both removed, along with
  `tests/audio-engine-select.test.js`. (The task allowed "remove or reduce to a status
  line"; removal is cleaner with a single engine.)
- **`sfx` command lands at `js/audio/sfx-commands.js`** (audio root, parallel to
  `music-commands.js`) — both are Strudel-backed now. `listCues` reads `Object.keys(CUES)`
  from `strudel/data/cues.js`; `sfx test <cue>` calls a new `playSfxCue(id)` export on
  `strudel/index.js` (module-level `_sfx` set in `wire()`).
- **Keep** `js/audio/strudel/**`, `js/audio/signal-registry.js`, `js/audio/signals.js`
  (deriveProgress/deriveThreat — used by the registry + signal tests).
- **Tone-score-specific fns** (`getNowPlayingName`/`isRunMusicLive`/`listScoreNames`/
  `setScoreByName`/`randomScore`/`getCurrentScoreName`) are only used by the Tone branch
  of `music-commands.js` → deleted with Tone.

## Non-goals

- #264 (song transitions/crossfade), #277 (more soundfonts) — out of scope.
- No new audio behavior; parity is already shipped. This is removal + consolidation.

## Verification

- `make check` green; `make bundle-vendor` no longer emits `dist/tone.js`.
- `make census SEEDS=10` — no headless crash (audio is browser-only).
- Browser (Playwright/Firefox): music + SFX + drones play with zero console errors;
  `music` and `sfx` commands work; `preview/music.html` + `preview/sfx.html` load
  without the removed `"tone"` importmap.
