# Plan — Phase 1: Strudel + superdough engine (shippable slice)

Implements **issue #254 Phase 1 only** (Phases 2/3 are follow-on). Driving mode: **full-auto
express → PR** (Les's call; I pushed back re: the perf gate / drone-design / bundling all wanting
a human checkpoint — overruled, so the PR is the review point).

## Architecture decisions (locked, flagged for PR review)

- **Boot-time engine flag, no hot-swap.** A localStorage pref `starnet:audio-engine` =
  `"tone"` (default) | `"strudel"`. Read once at boot. `main.js` branches:
  - `tone` → existing `initAudioRenderer()` + `initSfxRenderer()` **completely untouched**
    (zero regression risk).
  - `strudel` → `initStrudelEngine()` — **one** self-contained module doing music + one-shot
    SFX + action drones (the faithful promotion of `strudel-spike.js`). Tone renderers are NOT
    initialized.
  - Switching engines requires a page reload (the `audio` command says so). No live teardown.
- **Pref + event ownership stays in the Tone renderer modules.** `setMusicEnabled` /
  `setSfxEnabled` (in `audio-renderer.js` / `sfx/renderer.js`) already write localStorage and
  emit `E.MUSIC_CHANGED` / `E.SFX_CHANGED` **regardless of which engine is running**. So the HUD
  buttons + `music`/`sfx` console commands keep working unchanged. The Strudel engine **subscribes
  to those events** (and reads the same `starnet:music-enabled` / `starnet:sfx-enabled` prefs at
  boot) to start/stop/mute. No HUD or console refactor needed.
- **Content as DATA inside the engine module.** Scores, cue specs, and drone specs live as plain
  data objects (no Strudel/engine imports); the engine interprets them. Keeps the AGPL-engine /
  separately-licensable-content ("wad") boundary.
- **Drones → raw Web Audio** against the shared `getAudioContext()` (superdough's one-shot model
  can't do live mid-voice param sweeps). Faithful to the existing `startDrone(spec)→{setProgress,stop}`
  contract and the `drones.js` spec shape.
- **Phase-1 score = synth voices only** (sawtooth/square/triangle/sine — register immediately).
  **No drum samples** → defers the dirt-sample vendoring question to Phase 2, and keeps the perf
  gate free of github-streamed assets.
- **Lazy runtime load.** The vendored Strudel bundle (`dist/strudel.js`) is imported only inside
  `initStrudelEngine()` (dynamic `import()`), so Tone-default users never download it.

## Module layout (new files, all under the AGPL engine)

```
LICENSE                         — AGPL-3.0 (top level)
js/strudel-vendor.js            — re-exports @strudel/web for esbuild → dist/strudel.js
js/audio/engine-select.js       — pref read/set/list (pure, unit-tested)
js/audio/strudel/
  index.js                      — initStrudelEngine(): boot + wire music/sfx/drones + event subs
  runtime.js                    — boot @strudel/web, poll globals, resume AudioContext (browser)
  music.js                      — score-DATA interpreter → reactive stack() driven by signal()
  sfx.js                        — superdough one-shot play(spec) + event→cue wiring
  drones.js                     — raw-WebAudio startDrone(spec)→{setProgress,stop}
  data/
    cues.js                     — one-shot cue DATA (superdough specs) + event→cue resolver
    drones.js                   — action drone DATA (per timed action)
    corporate.js                — ONE reactive score as layer DATA
```

`docs/dev-sessions/.../perf/strudel-perf.mjs` — Playwright perf-gate script (gitignored or kept).

---

## Slice 1 — Licensing & repo hygiene

Independently valuable; unblocks shipping. Docs/infra — **no TDD** (no behavior).

### Files
- `LICENSE` (new) — full GNU AGPL-3.0 text (verbatim from the canonical SPDX/GNU source).
- `README.md` — add a "License" section: engine is AGPL-3.0; future content packs ("wad" model)
  are separately-licensed runtime data. Link the LICENSE.
- `index.html` — add an in-game **source link** in the footer/hub chrome: a small anchor to the
  public repo (`https://github.com/lmorchard/starnet`), satisfying AGPL §13's "offer the source"
  spirit. Style with existing phosphene chrome tokens (stroke/glow, no new fills).

### Key changes
- `LICENSE`: standard AGPL-3.0 (the unmodified license text — not summarized).
- Source link: `<a class="source-link" href="https://github.com/lmorchard/starnet" target="_blank" rel="noopener">source</a>` placed in an existing chrome area; minimal CSS reusing `--glow-sm`.

### Verification — automated
- [x] `make lint` (no JS touched beyond HTML; lint still green)
- [x] `make test` (1483 pass / 0 fail)
- [x] `head -3 LICENSE` shows "GNU AFFERO GENERAL PUBLIC LICENSE" + "Version 3"

### Verification — manual
- [ ] Source link renders in-game and opens the repo
- [ ] README license section reads correctly

---

## Slice 2 — Strudel runtime vendored + engine flag + booting (no-op) engine

Establishes the foundation: the runtime loads offline, the flag selects it, and a minimal Strudel
engine boots clean in-game. Proves boot/poll/resume under real game load before any audio content.

### Files
- `package.json` — add `"@strudel/web": "1.0.3"` to `dependencies`.
- `js/strudel-vendor.js` (new) — `export { initStrudel, ... } from "@strudel/web";` (re-export the
  named exports the runtime needs) OR `import "@strudel/web";` if it self-registers. Mirrors
  `js/tone-vendor.js`.
- `Makefile` — add `dist/strudel.js` target + add it to `all`, `bundle-vendor`, and `lint`'s
  excluded-files list (vendor file, like `tone-vendor.js`):
  ```make
  dist/strudel.js: js/strudel-vendor.js node_modules
  	npx esbuild js/strudel-vendor.js --bundle --outfile=dist/strudel.js --format=esm --platform=browser --minify
  ```
  Fallback if esbuild chokes on superdough's AudioWorklet asset resolution: copy the package's
  prebuilt bundle into `dist/strudel.js` via a `cp` recipe instead (documented in notes.md).
- `index.html` — add importmap entry `"@strudel/web": "./dist/strudel.js"`.
- `js/audio/engine-select.js` (new) — pure pref module:
  ```js
  export const AUDIO_ENGINES = ["tone", "strudel"];
  export function getAudioEngine();      // localStorage "starnet:audio-engine", default "tone"
  export function setAudioEngine(name);  // validate against AUDIO_ENGINES, persist, return it
  ```
- `js/audio/strudel/runtime.js` (new) — `async function bootStrudel()`: dynamic-import
  `@strudel/web`, call `initStrudel()`, **poll** for globals (`evaluate`/`superdough`/`stack`/
  `signal`/`note`/`sound`/`getAudioContext`) with a 10s timeout, then return a handle object
  `{ ctx, evaluate, superdough, stack, note, sound, signal, hush, samples }`. Does NOT resume the
  ctx (that needs a gesture — done in index on unlock).
- `js/audio/strudel/index.js` (new, minimal this slice) — `initStrudelEngine()`: arm on first
  gesture → `bootStrudel()` → `ctx.resume()`. Logs "[strudel] engine booted". No audio yet.
- `js/audio/strudel/commands.js` (new) — register the `audio` console command:
  `audio` / `audio status` → print active engine + "(reload to apply changes)";
  `audio engine <tone|strudel>` → `setAudioEngine`, log "switched to X — reload to apply".
- `js/ui/main.js` — branch the audio init:
  ```js
  import { getAudioEngine } from "../audio/engine-select.js";
  ...
  if (getAudioEngine() === "strudel") {
    import("../audio/strudel/index.js").then((m) => m.initStrudelEngine());
  } else {
    const audioEngine = initAudioRenderer();
    initSfxRenderer();
  }
  ```
  (Keep `audioEngine` usage downstream guarded — check current uses of the return value.)
  Add `import "../audio/strudel/commands.js";`

### Key changes
- The pref module is the only **pure** unit here → TDD it.
- Everything else (runtime boot, esbuild bundling, importmap) is infra verified in-browser.

### Verification — automated
- [x] `tests/audio-engine-select.test.js` written test-first (RED: import error), then implemented
      `engine-select.js` (GREEN: 5 pass) — defaults to tone, persists, rejects invalid, storage-safe.
- [x] `make bundle-vendor` produces `dist/strudel.js` (415KB, esbuild clean — vendor-offline feasible)
- [x] `make lint` (clean)
- [x] `make test`
- [x] `make check` (1488 pass / 0 fail)

### Verification — manual (Playwright, port 3017)
- [x] Default boot (tone pref) loads Tone path; `dist/strudel.js` NOT fetched (lazy confirmed via
      resource timing) — 0 console errors
- [x] `audio engine strudel` + reload + click → "[strudel] engine booted", 0 errors, `ctx.state`
      "running", superdough one-shot synthesizes (full offline audio path works)
- [~] Strudel selected: Tone renderers NOT initialized → no Tone playback. (Known minor: the Tone
      *bundle* still loads via static imports in main.js, idle/no audio — clean up in Phase 3.)

---

## Slice 3 — Reactive corporate score (music)

The reactive music slice: one score as DATA, interpreted into a live `stack()` whose params are
driven by `deriveProgress`/`deriveThreat` through `signal()`.

### Files
- `js/audio/strudel/data/corporate.js` (new) — score DATA:
  ```js
  export const CORPORATE = {
    name: "Corporate — Strudel",
    bpm: 120,
    layers: [
      // axis: "base" | "progress" | "threat"; params name signal-driven ranges
      { sound: "sawtooth", note: "c2 c2 c2 c2 g1 g1 g1 g1", axis: "threat",
        lpf: [300, 3500], gain: [0.35, 0.85] },
      { sound: "triangle", note: "c4 eb4 g4 bb4", axis: "progress",
        addNote: [0, 12], fast: [1, 2], gain: 0.28, room: 0.4 },
      { sound: "square", note: "c5 ~ ~ c5 ~ c5 ~ ~", axis: "threat", gain: [0, 0.4], lpf: 4000 },
      // ...a few more synth-only layers to reach ~6-8 voices for the perf gate
    ],
  };
  ```
- `js/audio/strudel/music.js` (new) — interpreter:
  ```js
  // buildProgram(score, { progressSignal, threatSignal, stack, note, sound, signal })
  //   → a Strudel pattern (stack of per-layer patterns). For each layer, start from
  //     note(layer.note).s(layer.sound); apply axis-driven params:
  //       number      → constant (.gain(x), .lpf(x), .room(x))
  //       [lo,hi]     → axisSignal.range(lo,hi) (.gain/.lpf), or .add(note(sig.range)) for addNote,
  //                     .fast(sig.range) for fast
  //     axis selects which signal (progress vs threat) drives the [lo,hi] params.
  //   Returns pattern.cpm(score.bpm/4).
  export function buildProgram(score, ctx);
  export function createMusic(rt);  // { start(), stop(), setProgress(p), setThreat(t), isStarted() }
  ```
  `createMusic` holds live `gProgress`/`gThreat` numbers; `signal(() => gProgress)` re-samples each
  cycle (no re-eval needed on setProgress/setThreat). `start()` calls `program.play()`; `stop()`
  calls `rt.hush()`.
- `js/audio/strudel/index.js` — wire music: on boot, build `createMusic`; subscribe
  `on(E.STATE_CHANGED, s => { music.setProgress(deriveProgress(s)); music.setThreat(deriveThreat(s)); })`;
  honor music pref at boot + `on(E.MUSIC_CHANGED, ({enabled}) => enabled ? music.start() : music.stop())`;
  `on(E.RUN_STARTED/RUN_ENDED)` if we want run-vs-idle gating (Phase 1: start music on first
  gesture if music-enabled, keep simple — one score, no hub/run swap).

### Key changes
- `buildProgram` is **pure** given an injected `ctx` of strudel fns → unit-test the param-mapping
  logic with stub fns (assert which builder methods get called with which ranges). Real audio is
  browser-verified.
- Reuse `signals.js` unchanged (import `deriveProgress`/`deriveThreat`).

### Verification — automated
- [x] `tests/strudel-music.test.js` test-first (RED: module missing) → implemented (GREEN: 6 pass).
      Covers threat/progress signal routing, constant pass-through, addNote, cpm(bpm/4), layer count.
- [x] `make check` (1494 pass / 0 fail)

### Verification — manual (Playwright, objective audio measurement via tee'd AnalyserNode)
- [x] Strudel selected: CORPORATE (8 synth voices) plays from boot — peak RMS 0.91, 0 errors
- [x] `music off` → silences (decays to 0 within ~3s: Strudel scheduler look-ahead ~1 cycle +
      reverb tails — measured 0.88@1s → 0@3s); `music on` → restarts (0.91) via MUSIC_CHANGED
- [~] Audible progress/threat *morph*: param mapping is unit-tested + wired to STATE_CHANGED;
      audible reactivity is for Les at PR (flagged).

---

## Slice 4 — One-shot SFX (superdough)

### Files
- `js/audio/strudel/data/cues.js` (new) — cue DATA + resolver:
  ```js
  // CUES: event/id → superdough value spec (note, s, cutoff, attack, decay, sustain, release,
  //   gain, room, resonance). Ported + extended from strudel-spike.js's known-good CUES.
  // resolveCue(eventType, payload) → spec | null  (handles ACTION_RESOLVED success/fail split,
  //   the alert-trace suppression at trace, etc. — mirroring the Tone resolveCue's branching for
  //   the Phase-1 event set).
  export const CUES; export function resolveCue(type, payload);
  ```
  Phase-1 event coverage (per spec): `NODE_REVEALED`, `NODE_ACCESSED`, `ACTION_RESOLVED`
  (success/fail), `ALERT_GLOBAL_RAISED`, `ICE_DETECTED`, `ALERT_TRACE_STARTED`. (Other routed
  events degrade gracefully to no cue — extend in a follow-up.)
- `js/audio/strudel/sfx.js` (new) — `createSfx(rt)`:
  ```js
  // play(spec, dur?) → rt.superdough(spec, 0, dur ?? spec._dur ?? 0.2)   (try/catch, drop on fail)
  // setEnabled(on); a small dedupe (50ms, like the Tone renderer) to avoid machine-gunning.
  export function createSfx(rt);
  ```
- `js/audio/strudel/index.js` — wire one-shots: for the Phase-1 events, `on(type, p => { if (!sfxEnabled) return; const spec = resolveCue(type, p); if (spec) sfx.play(spec); })`. Port the
  reveal grade/cascade pitch nicety if cheap (detune via note offset); else flat reveal for Phase 1.
  Honor sfx pref at boot + `on(E.SFX_CHANGED, ({enabled}) => sfxEnabled = enabled)`.

### Verification — automated
- [x] `tests/strudel-sfx.test.js` test-first (RED) → implemented (GREEN: 5 pass). Covers
      success/fail split, the named-event mappings, trace suppression, unmapped→null, spec shape.
- [x] `make check` (1499 pass / 0 fail)

### Verification — manual (Playwright, objective audio measurement)
- [x] All 7 Phase-1 cues audible when fired via the engine handle (peak RMS 0.77–0.99), 0 errors
- [x] `sfx off` silences (playCue → peak 0) via SFX_CHANGED
- [~] Real in-game event firing (probe/xploit/reveal/...) + dedupe feel: wiring is
      on(type)→resolveCue→play with a 50ms dedupe; verified by parts — confirm in the PR playthrough.

---

## Slice 5 — Action drones (raw Web Audio)

The third surface (the gap Les flagged). Faithful port of `sfx/drones.js` behavior to raw Web
Audio against the shared AudioContext, wired to `E.ACTION_FEEDBACK`.

### Files
- `js/audio/strudel/data/drones.js` (new) — drone DATA per timed action + resolver, ported from
  `js/audio/sfx/drones.js` (same spec fields: `source` osc/noise/fm/dual, `note`, `cutoff`
  number|`{from,to}`, `detune`, `q`, `lfo {rate,depth,target}`, `gain {from,to}`, `volume`, `fade`,
  `loop`). Same 7 actions: probe/xploit/dump/fetch/mine/lie-low/reboot.
  ```js
  export const DRONES; export function resolveDrone(action); // action if in DRONES else null
  ```
- `js/audio/strudel/drones.js` (new) — `createDroneVoice(ctx, spec) → { setProgress(p), stop() }`:
  build `OscillatorNode`(s)/`AudioBufferSourceNode`(noise)/FM via osc→gain→osc.frequency →
  `BiquadFilterNode` → ampGain (LFO or progress) → fadeGain → ctx.destination. `setProgress(p)`
  ramps filter.frequency / detune / gain `{from,to}` via `linearRampToValueAtTime(lerp(from,to,p), now+0.12)`.
  `stop()` ramps fadeGain to 0 over `fade`, then disconnects. Reboot loops (ignores progress).
  Direct translation of `sfx/engine.js` lines ~129-227 from Tone nodes to vanilla Web Audio nodes.
- `js/audio/strudel/index.js` — wire drones: a `Map("<nodeId>:<action>" → voice)`,
  `on(E.ACTION_FEEDBACK, ({nodeId, action, phase, progress}) => ...)` start/setProgress/stop, plus
  `stopAllDrones()` on RUN_ENDED + when SFX disabled (port from the Tone renderer's
  `handleActionFeedback` / `stopAllDrones`).

### Key changes
- The `lerp(range, p)` / `clamp01` helpers are **pure** → unit-test them. The Web Audio graph is
  browser-verified.

### Verification — automated
- [x] `tests/strudel-drones.test.js` test-first (RED) → implemented (GREEN: 5 pass). Covers
      resolveDrone (7 actions + unknown→null), noteToFreq, droneRange interpolation/clamp, and the
      amp-LFO/progress-gain mutual-exclusion invariant.
- [x] `make check` (1504 pass / 0 fail)

### Verification — manual (Playwright, objective audio measurement)
- [x] All 7 drone voices audible via createDroneVoice (peak 0.55–0.98), setProgress sweeps without
      error, stop() → silence (0). 0 errors.
- [x] Full ACTION_FEEDBACK path via the real event bus: start → drone created + audible,
      progress → sweeps, complete → drone cleared + faded to 0; unknown action → no drone.
- [~] Reboot-loop feel + cancel-during-action feel: verified by parts (loop spec ignores progress;
      cancel uses the same stop path as complete) — confirm in the PR playthrough.

---

## Slice 6 — Perf gate (GO/NO-GO)

The spec's gate: dense music (~8 tracks) + rapid SFX/drones, watch FPS / audio dropouts. Automated
proxy (FPS) since dropout-audibility needs human ears — flagged for PR review.

### Files
- `docs/dev-sessions/2026-06-30-1413-audio-engine-strudel/perf/strudel-perf.mjs` — Playwright
  script: set `localStorage["starnet:audio-engine"]="strudel"`, load the game, click-in, start a
  generated run, drive a burst of actions + repeatedly fire SFX cues, sample `requestAnimationFrame`
  deltas for ~15s, report median/p95 FPS and AudioContext state. Compare against a Tone-engine
  baseline run of the same script.

### Verification — automated (Playwright main-thread pacing proxy)
- [x] `perf/strudel-perf.js` snippet written; measured on port 3017. Results:
      - **Strudel** — idle: median 120 FPS / p95 9.2ms / max 25.8ms; **under full load**
        (8 voices + ~9 SFX/s + 4 rolling drones): median **120 FPS** / p95 9.2ms / max 24.3ms.
        Load == idle — no main-thread regression. 0 console errors.
      - **Tone** (baseline, same harness) — idle: 120 / 9.3ms / 66.4ms; load: 120 / 9.3ms / 75ms.
      → Strudel matches Tone on median FPS and has *tighter* worst-frame pacing. Gate PASSED.

### Verification — manual
- [~] **Les listens** (the real gate): no audible dropouts/crackle with dense music + rapid SFX.
      Flagged for PR — the autonomous run measured frame pacing only (synthesis is on the worklet
      thread; audibility needs human ears).

---

## Slice 7 — Docs

### Files
- `docs/audio-direction.md` — add a "Strudel + superdough engine (Phase 1)" section: the flag,
  the three ported surfaces, the content-as-data boundary, what's deferred to Phase 2/3.
- `MANUAL.md` — document the `audio engine <tone|strudel>` console command + that it needs a reload.
- `notes.md` — session retro: decisions, perf numbers, what's deferred, open questions for Les.

### Verification — automated
- [ ] `make check` (final green)

### Verification — manual
- [ ] Docs accurately describe shipped behavior; MANUAL `audio` command matches the implementation

---

## Plan self-review

- **Spec coverage:** LICENSE + source link (Slice 1) ✓; bundle Strudel runtime (Slice 2) ✓;
  superdough SFX at parity on the named events (Slice 4) ✓; one reactive corporate score driven by
  derive*/signal() (Slice 3) ✓; engine flag, Tone default, A/B (Slice 2) ✓; perf gate (Slice 6) ✓.
  **Plus** the session-amendment action-drone surface (Slice 5) ✓.
- **Deferred (correctly, per spec):** dirt-sample vendoring, remaining cues/scores, 8 corporate
  variants, section automation, flipping default + retiring Tone (Phases 2/3).
- **Placeholder scan:** no TBDs; each phase names files, signatures, and concrete test assertions.
- **Type/name consistency:** `getAudioEngine`/`setAudioEngine`, `bootStrudel`, `createMusic`/
  `buildProgram`, `createSfx`/`resolveCue`/`CUES`, `createDroneVoice`/`resolveDrone`/`DRONES`,
  `initStrudelEngine` — used consistently across phases.
- **TDD opt-outs (explicit):** Slice 1 (docs), and the Strudel/superdough/Web-Audio *runtime*
  integration in Slices 2-6 (can't run @strudel/web or AudioContext in node) → browser-verified via
  Playwright. The **pure** pieces (engine-select pref, buildProgram param-mapping, resolveCue,
  resolveDrone, lerp/clamp) get node unit tests written test-first.
