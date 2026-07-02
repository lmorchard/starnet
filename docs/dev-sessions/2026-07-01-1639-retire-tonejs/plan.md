# Plan — Retire Tone.js (#267)

Ordered so the game stays runnable after each phase. Extraction before deletion.

## Phase 1 — Extract engine-neutral prefs (`js/audio/audio-prefs.js`)

- New module owns: `MUSIC_PREF_KEY`/`SFX_PREF_KEY`, module-load localStorage seeding,
  `isMusicEnabled`/`setMusicEnabled`/`toggleMusic` (+ `MUSIC_CHANGED` emit),
  `isSfxEnabled`/`setSfxEnabled`/`toggleSfx` (+ `SFX_CHANGED` emit).
- Preserve module-load seeding behavior (HUD reflects prefs without an init call).
- **Test:** `tests/audio-prefs.test.js` — localStorage seeding, toggle flips + persists
  + emits the right event. (New unit test; TDD.)

## Phase 2 — `sfx` command Strudel-side home

- Add `playSfxCue(id)` (+ module-level `_sfx`) export to `js/audio/strudel/index.js`.
- New `js/audio/sfx-commands.js` (moved from `js/audio/sfx/commands.js`): prefs from
  `audio-prefs`, `listCues` from `Object.keys(CUES)` (`strudel/data/cues.js`),
  `sfx test <cue>` via `playSfxCue`.
- Repoint main.js import `../audio/sfx/commands.js` → `../audio/sfx-commands.js`.

## Phase 3 — Repoint consumers + collapse the flag

- **main.js:** import `isMusicEnabled/toggleMusic/isSfxEnabled/toggleSfx` from
  `audio-prefs`; drop `getAudioEngine` + `initAudioRenderer`/`initSfxRenderer` imports;
  init unconditionally `import("../audio/strudel/index.js").then(m => m.initStrudelEngine())`;
  drop the `../audio/strudel/commands.js` import (audio-engine command removed).
- **music-commands.js:** import prefs from `audio-prefs`; drop Tone-only imports +
  `getAudioEngine` + `isStrudel()` branching → Strudel-only helpers.
- **strudel/index.js:** read initial prefs via `audio-prefs` (`isMusicEnabled`/
  `isSfxEnabled`) instead of its private `loadPref`. Keep the `MUSIC_CHANGED`/
  `SFX_CHANGED`/`MUSIC_SONG_SELECT` listeners.
- Delete `js/audio/engine-select.js` + `js/audio/strudel/commands.js`.
- **Checkpoint:** `make lint` (types) — repoints resolve.

## Phase 4 — Delete Tone code + tests

- Delete: `engine.js`, `harmony.js`, `mixer.js`, `rhythm.js`, `audio-renderer.js`,
  `scores/` (all), `sfx/` (all — after Phase 2 moved the command).
- Delete tests: `audio-harmony`, `audio-mixer`, `audio-rhythm`, `audio-score`,
  `audio-score-harmony`, `audio-scores-all`, `sfx-cues`, `sfx-defs`, `sfx-drones`,
  `audio-engine-select`. (Keep `strudel-*`, `signal-registry`, `audio-signals`.)
- **Checkpoint:** `make check` green.

## Phase 5 — Vendor / dep / importmap

- Delete `js/tone-vendor.js`.
- Makefile: drop `dist/tone.js` from `all`, its build rule, the deploy build line, and
  the `tone-vendor.js` exclusion in the lint find.
- `package.json`: remove `"tone"` dep. `npm install` to update lockfile.
- Remove `"tone"` importmap entry from `index.html`, `preview.html`, `playground.html`,
  `preview/sfx.html`, `preview/music.html`.
- **Checkpoint:** `make bundle-vendor` — no `dist/tone.js` emitted; `rm -f dist/tone.js`
  if a stale artifact lingers.

## Phase 6 — Docs

- Rewrite `docs/audio-direction.md` for Strudel (single engine).
- `MANUAL.md`: music/sfx commands stay; drop any `audio engine` / Tone mention.
- `CLAUDE.md` "What's Shipped": Tone.js → Strudel for music + SFX.
- `README.md`: update if it names Tone (grep first).

## Phase 7 — Verify + PR

- `make check`, `make bundle-vendor` (no tone.js), `make census SEEDS=10`.
- Browser: Strudel default — arm audio, confirm music/SFX/drones + `music`/`sfx`
  commands, zero console errors; load `preview/music.html` + `preview/sfx.html`.
- Squash, push, PR to `main`, Copilot review.
