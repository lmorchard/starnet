# Notes — Strudel + superdough audio engine, Phase 1

## What shipped (Phase 1 of issue #254)

A second audio engine under `js/audio/strudel/`, selectable at boot, with Tone still the default.
One self-contained module owns all **three** audio surfaces:

1. **Reactive music** — one corporate score (DATA, 8 synth voices) → live `stack()` driven by
   `deriveProgress`/`deriveThreat` via `signal()`.
2. **One-shot SFX** — superdough voices on the Phase-1 events.
3. **Action drones** — sustained, progress-driven, raw Web Audio (the surface Les flagged that the
   issue's Phase-1 list omitted).

Plus: **LICENSE (AGPL-3.0)** + in-game source link; `@strudel/web@1.0.3` vendored offline;
`audio engine <tone|strudel>` console command (reload to apply).

## How it was driven

Full-auto express → PR (Les's call). I pushed back first — the perf gate is a human GO/NO-GO, the
drone mapping was an open design question, and bundling had open decisions — and recommended driving
interactively with checkpoints. Overruled, so the PR is the review point. Executed inline (not
subagent-driven): the slices build one cohesive engine module where shared runtime understanding
matters and each slice needs browser verification.

7 vertical slices, one commit each, all browser-verified via Playwright with objective audio
measurement (tee'd AnalyserNode RMS) rather than "should work":

| Slice | What | Verified |
|---|---|---|
| 1 | AGPL LICENSE + source link | lint/test green; license text verbatim |
| 2 | Vendor runtime + engine flag + boot | offline bundle boots clean, ctx resumes, superdough fires, 0 errors; lazy-load confirmed |
| 3 | Reactive corporate score | CORPORATE audible (RMS 0.91), music off→silent, on→0.91 |
| 4 | One-shot SFX | all 7 cues audible (0.77–0.99), sfx off→silent |
| 5 | Action drones | all 7 drones audible+sweep+stop; full ACTION_FEEDBACK path end-to-end |
| 6 | Perf gate | 120 FPS under load (== idle, on par with Tone) |
| 7 | Docs | this + MANUAL + audio-direction |

## Key decisions made autonomously (flagged for PR review)

- **Bundling = vendor offline** (esbuild → `dist/strudel.js`), not CDN. esbuild handled
  `@strudel/web` cleanly (415KB); worklet/synthesis path works offline in-browser. The "vendor vs
  CDN" open decision is settled: **vendor**.
- **Phase-1 score is synth-only** (no drum samples) → the dirt-sample vendoring question is
  deferred to Phase 2 (no github-at-runtime dependency, perf gate stays clean).
- **Action drones → raw Web Audio**, not superdough. superdough is a one-shot trigger engine and
  can't sweep params mid-voice; the drones need live `setProgress` filter/detune/gain ramps. The
  raw-Web-Audio voice is a faithful 1:1 port of the Tone `startDrone` graph against the shared
  `getAudioContext()`. (This is the main thing I'd want Les to sanity-check.)
- **Boot-time flag, no hot-swap.** Switching engines needs a reload (the `audio` command says so).
  Avoids live Tone↔Strudel teardown complexity.
- **Tone path left 100% untouched** when the flag is `tone` (zero regression risk). Verified Tone
  still loads + 0 errors under default.

## Known issues / limitations (Phase 1)

- **Strudel engine still loads the Tone bundle** via static imports in `main.js` (the music/sfx
  command modules import the Tone renderers). It's idle (no Tone playback), harmless — but the
  415KB Tone bundle is downloaded needlessly under Strudel. Clean up in **Phase 3** when Tone is
  removed (or make those imports dynamic if we want it sooner).
- **`music off` has a ~2–3s tail** under Strudel — the Cyclist scheduler looks ahead ~1 cycle
  (2s at cpm 30) + reverb tails. Measured: 0.88 RMS @1s after hush → 0 @3s. Not a bug; could
  tighten with a faster cps or an explicit fade if it feels long.
- **Phase-1 SFX covers only the 6 named events** (issue scope). Other routed events (navigate,
  alert-cooled, ICE moved/ejected/rebooted, mining tiers, run-end variants, exploit decay, etc.)
  resolve to no cue under Strudel — they still fire under Tone. Parity for those is a follow-up.
- The reveal grade/cascade pitch nicety (Tone path) is **not** ported yet — Phase-1 reveal is flat.

## Verified objectively vs. flagged for Les's ears/eyes at PR

- **Objective (measured):** everything produces/stops audio correctly; FPS holds; lazy-load; the
  full drone event path; param-mapping unit tests.
- **Subjective (for Les at PR):** does it *sound good*? — audible progress/threat morph, the SFX
  feel/mix, drone timbres vs the Tone originals, and the real gate: **no audible dropouts/crackle**
  under dense play. The headless run measured main-thread pacing (synthesis is on the worklet
  thread); audibility is a human call.

To A/B: `audio engine strudel`, reload, click in. `audio engine tone` + reload to compare. Music
and SFX on/off work with either engine.

## Open questions for Les

1. Is the raw-Web-Audio drone approach OK as the long-term shape, or should drones eventually become
   Strudel patterns too (for consistency / livecoding authorability)?
2. Should Phase 2 keep the synth-only constraint, or is vendoring the dirt-sample subset worth it
   for the drum character (the Stripdown reference uses sample drums)?
3. Tighten the `music off` tail now, or leave it for the Phase-2 re-author?

## Deferred to Phases 2 / 3 (per spec)

- **Phase 2:** re-author the full reactive design — remaining biomes, the 8 corporate variants,
  section automation; dirt-sample vendoring if we want sample drums; remaining SFX cues at parity.
- **Phase 3:** flip the default to Strudel, remove `engine.js` / Tone scores / Tone sfx / the
  `tone` dep + importmap entry; drop the redundant Tone-bundle load.
