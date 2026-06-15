# SFX for Game Actions — Session Notes

Issue **#229 — Audio: event SFX for game actions**. Branch/worktree: `audio-event-sfx`.

## Recap

Built a synthesized, event-driven SFX layer mirroring the music subsystem's split, independent of
the music and on its own always-available bus. Executed the 8-task plan; this session resumed an
interrupted run where Tasks 1–7 were already committed and finished Task 8 + verification.

### What shipped (per task)

1. `sfx-defs.js` — `CUES` (32 cues, 6 families) + `CUE_IDS`; structural test.
2. `sfx-cues.js` — pure `resolveCue(type, payload) → cueId|null`; mapping test (key cases + exhaustiveness).
3. `sfx.js` — Tone boundary: 5 primitives (`blip`/`sweep`/`chord`/`noise`/`fm`), own master Gain →
   reverb → destination, schedule at `ctx.currentTime+0.02`, dispose-after-play, voice cap.
4. `SFX_CHANGED` event + `sfx-renderer.js` — event subscriber, gesture-arm, `alert.up` pitch-by-level,
   health/deck `STATE_CHANGED` diff for `hurt.*`, persisted `starnet:sfx-enabled` pref.
5. `sfx-commands.js` — `sfx status|on|off|list|test <cue>` console command.
6. HUD `SFX: ON/OFF` button + `main.js` wiring (`initSfxRenderer()`, `SFX_CHANGED`, `toggle-sfx`).
7. `preview/sfx.html` + `sfx-playground.js` audition harness.
8. Docs: MANUAL.md SFX section; audio-direction.md "Event SFX subsystem" (shipped) + deferred-list
   update; CLAUDE.md moved SFX from Out of Scope → What's Shipped.

## Verification

- `make check` green: 1356 tests pass, lint clean.
- All 6 new `js/audio/sfx*.js` modules `node --check` clean.
- Headless SFX-free confirmed: `grep -rn "audio/sfx" scripts/` empty.
- **Browser smoke (headless Chromium via Playwright):** SFX button present in HUD; all 32 cues
  synthesize via `playCue` with zero console errors; `toggleSfx` flips; `sfx` console command
  registered (`getCommand("sfx")` truthy). Only console output was Tone's banner + the expected
  "AudioContext needs a gesture" warnings (headless synthetic clicks aren't trusted gestures).

## Diverged from plan

- **Plan said "Playwright smoke" as a test artifact; the repo has no Playwright/browser-test infra.**
  Did the smoke as a throwaway script against `npx serve` rather than introducing a new test
  dependency. Pure logic is covered by the two committed unit suites.
- Couldn't drive the in-game console input in the smoke — the overworld hub overlay intercepts
  pointer events at app start. Confirmed command registration + the underlying renderer API instead
  (the command is a thin wrapper over those functions).

## Still needs Les

- **Listen / by-ear tuning checkpoint (Task 7).** Cue specs in `sfx-defs.js` are ear-tunable rough
  drafts. Audition via `preview/sfx.html` (button per cue) or in-game `sfx test <cue>`; flag any
  cues to retune. This is the one step that genuinely needs ears, not automation.

## Open / deferred

- Store-purchase `buy` cue dropped for v1 (no event exists; one-line emit in store-logic.js later).
- No music ducking under SFX in v1.
