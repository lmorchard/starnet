# Notes — Retire Tone.js (#267)

## Outcome

Removed the legacy opt-in Tone.js audio engine now that Strudel/superdough is the default
(#276). Strudel is the single audio engine. Extracted the shared audio prefs to a neutral
module first, then deleted all Tone code, vendor, dep, importmap entries, and Tone-only tests.

## What shipped

- **New `js/audio/audio-prefs.js`** — engine-neutral owner of the music/SFX on/off prefs
  (`is/set/toggle` × music/sfx), localStorage persistence + module-load seeding, and the
  `MUSIC_CHANGED`/`SFX_CHANGED` emits. Unit-tested (`tests/audio-prefs.test.js`).
- **`sfx` command relocated** from the deleted `js/audio/sfx/commands.js` to a new
  `js/audio/sfx-commands.js` (symmetric with `music-commands.js`). `listCues` reads
  `Object.keys(CUES)` from `strudel/data/cues.js`; `sfx test <cue>` fires via a new
  `playSfxCue(id)` export on `strudel/index.js` (module-level `_sfx`).
- **Consumers repointed** at `audio-prefs`: `main.js` (init just calls `initStrudelEngine()`),
  `music-commands.js` (Strudel-only, dropped the engine branch), `strudel/index.js` (reads
  initial prefs from `audio-prefs`).
- **Engine flag collapsed:** deleted `engine-select.js`, `strudel/commands.js` (the `audio
  engine` command), and `tests/audio-engine-select.test.js`.
- **Deleted Tone code:** `engine.js`, `harmony.js`, `mixer.js`, `rhythm.js`,
  `audio-renderer.js`, `scores/` (13), `sfx/` (6), `js/tone-vendor.js`.
- **Deleted Tone tests:** audio-harmony/mixer/rhythm/score/score-harmony/scores-all,
  sfx-cues/defs/drones (9 files).
- **Vendor/dep:** dropped `dist/tone.js` from the Makefile (`all`, build rule, deploy line,
  lint find), removed the `tone` dep from `package.json`, and removed the `"tone"` importmap
  entry from `index.html`, `preview.html`, `playground.html`, `preview/sfx.html`,
  `preview/music.html` (preview.html + playground.html only had a dead `tone` entry — they
  don't import audio).
- **Docs:** rewrote `docs/audio-direction.md` for the single Strudel engine (kept the
  engine-agnostic design north-star: two-axis model, palette, sound vocabulary, calibration);
  updated `CLAUDE.md` "What's Shipped" (Tone → Strudel) and `MANUAL.md` ("scores" → "songs").

## Verification

- `make check` — green (1333 pass; down from 1540 = 9 deleted Tone test files, +5 new prefs).
- `make bundle-vendor` — no longer emits `dist/tone.js`; `dist/` = vendor.js, lit.js, strudel.js.
- `make census SEEDS=10` — no headless crash (audio is browser-only).
- **Browser (headless Chromium, Playwright):** Strudel engine boots (songs + sfx + drones),
  music plays (`[cyclist] start`), and `music` / `music list` / `music neon` / `sfx` /
  `sfx test reveal` all produce correct output. `preview/music.html` + `preview/sfx.html`
  load with **zero** console errors. No same-origin 404 (importmap + tone.js removal broke
  nothing). The only console errors are pre-existing environmental 404s: `favicon.ico` (no
  favicon on the dev server; fires before audio boots) and the external
  `github:tidalcycles/dirt-samples` drum fetch (already in `strudel/index.js`, guarded by
  try/catch "offline: drums silent").

## Gotchas encountered

- **Worktree vs stale main checkout.** The first `ls js/audio/strudel/` (run against the
  main checkout, which was on an older commit) showed only 3 files and looked like the task
  prompt's file list was wrong. Running against the worktree (origin/main) showed the full
  engine — the task prompt was accurate. Lesson: always inspect from the worktree cwd.
- **Playwright firefox MCP wouldn't launch** (downloaded a plain Nightly lacking juggler →
  exits on `-juggler-pipe`, even after clearing Gatekeeper quarantine). Worked around it with
  a standalone Chromium script using a bundled `playwright-core` + an installed
  `chromium-1223` executablePath and `--autoplay-policy=no-user-gesture-required`.
