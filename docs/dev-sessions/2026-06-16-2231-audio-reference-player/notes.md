# Audio Reference Player — Session Notes

## What shipped

A reusable browser harness that plays a generated artifact's `score_spec` with Tone.js,
plus the data plumbing to produce it:

- **Data:** each `track` gains playable `synth` (`type` + flat `options`) and `steps`
  (`grid` + string-token `notes`) fields. A pure, tested `scorespec.build_score_spec`
  assembles `{root, mode, bpm, tracks}`; `build_sidecar` writes it as a top-level
  `score_spec` in the JSON sidecar.
- **Prompt:** extended (not replaced) to emit `synth`/`steps`; raw `score_draft` kept.
- **Harness:** `player/index.html` + `player.js` — file-picker load (works over `file://`),
  instrument factory from a whitelisted palette, flat-options → nested Tone options,
  per-type trigger adapter, `Tone.Sequence` per track, master + shared reverb, play/stop,
  per-track mute/solo. No `eval`.
- **Corpus:** 10 reference tracks analyzed (Icabod, Silent Shout, Dry Blood, Stripdown,
  Dressed For Space, Problems, Hallucination Generation, Native State, Step Forward,
  The Unreality Industry).

All built TDD via subagent-driven development; 36 unit tests green.

## Findings from the ear-check / batch (iteration log)

1. **Festive Silent Shout → perceived-mode harmony fix.** Measured key `E major` (0.69
   conf) drove major-triad harmonization though the model heard the relative `C# minor`.
   Fix: prompt now harmonizes the playable `steps` to the perceived mode/mood, not the raw
   measured label (measured key stays a reported fact). Validated: Silent Shout's arp went
   E-major-triad → C#-minor-triad.
2. **`Player` synth.type → playable-source fix.** Dressed For Space returned `synth.type:
   "Player"` (sample-based, unconstructable) → silently skipped track. Cause: the prompt
   offered the full `TONE_SOURCES` (incl. Sampler/Player/GrainPlayer) for `synth.type`. Fix:
   `scorespec.PLAYABLE_SOURCES` (the 10 synthesizable sources, == `PALETTE`) is now the
   single source of truth for `synth.type`; prose `instrument` keeps the full list.
3. **Harness code review caught 4 real bugs** (in the plan's own harness code): `file://`
   ES-module CORS, AudioContext node leak on reload, dropped `PolySynth` voice options,
   un-awaited `Reverb` IR. All fixed before the corpus listen.

## Fast-follows / backlog (not done)

- **Gemini transient-error resilience.** The batch hit a `502 Bad Gateway` (Dry Blood) and
  a truncated-JSON `JSONDecodeError` (Hallucination Generation); both succeeded on a manual
  re-run. `gemini.analyze_audio` should retry with backoff on transient `ServerError`/JSON
  decode failures (and consider raising `maxOutputTokens` for the long-response case).
- **Tone.js reference doc (decide by ear).** A curated `docs/tonejs-reference.md` (palette
  sources + key v15 options + sequencing primitives) injected into the prompt would ground
  Gemini's `synth.options`. Build it only if the corpus listen shows the options are
  wrong/generic. The generated options *look* plausible; pending Les's ears.
- **`dur == grid` step duration.** Note duration currently equals the grid step, so notes
  fill their whole step (can sound legato / blur chords). A separate `steps.duration` (or a
  gate ratio) would refine this. Deferred (YAGNI) until the listen says it matters.
- **`play` convenience command.** `audio-reference play <slug>` (serve `docs/` + open the
  browser) would sidestep file-picking the hidden worktree path. Deferred; `file://` works.

## Iteration 2 — ear-check, depth, perf (post-initial-build)

Driven by listening. All shipped + verified:

- **Mode fix.** Playable harmony follows the *perceived* mode/mood, not the raw measured
  major/minor (Silent Shout was festive E-major though it's C# minor). Prompt change.
- **Playable-source fix.** `synth.type` only offers the 10 synthesizable sources
  (`scorespec.PLAYABLE_SOURCES`); the model no longer returns `Player`/`Sampler` (which the
  harness skipped). Fixed a dead track in Dressed For Space.
- **Strict-JSON sanitization.** Gemini emitted `filterQ: Infinity`; `sanitize_numbers` +
  `allow_nan=False` coerce non-finite floats to `null` so artifacts always parse in the browser.
- **Gemini hardening.** `analyze_audio` retries 5xx / 429 / truncated-JSON with backoff and
  caps `max_output_tokens` (the earlier fast-follow — now done).
- **Depth pass.** Per-track `drive`/`chorus`/`reverbSend` in `synth.options`; harness inserts
  Distortion/Chorus + a reverb send through a master EQ3→Compressor→Limiter glue bus. Prompt
  asks for body (drive, resonance, fat osc) scaled to the song.
- **Hat taming.** MetalSynth/NoiseSynth get a deeper default trim, a forced one-shot envelope,
  and a fixed short trigger (`32n`) regardless of grid — they were brash/loud/sustained.
- **`play` / `index` + library.** `audio-reference play` serves the player (prints URL, no
  auto-open); `index.json` manifest (auto-written by `analyze`) drives a clickable library;
  file picker kept as `file://` fallback.
- **Performance bugs (the hard one).** "Horrible performance + console spam" was NOT the
  automation-timeline theory I first chased (and built a synth *recycler* + lookahead for —
  both since removed). Reproduced in a browser (Playwright): (1) `triggerAttackRelease` throwing
  `"Start time must be strictly greater…"` per note (chords→mono synths; non-monotonic times)
  → chord-to-root + monotonic guard + try/catch; (2) `InvalidAccessError` from a one-shot's
  `onended` firing after dispose on track-switch → defer node disposal ~400ms. Verified 0
  console errors; Les confirmed performance improved. See memory `tonejs-player-gotchas`.

## Open / remaining

- **`dur == grid` for pitched tracks** — percussion now uses a fixed short trigger, but pitched
  notes still fill their whole step (can sound legato / blur). A `steps.duration` or gate ratio
  would refine. Low priority.
- **Tone.js reference doc** — generated `synth.options` sound credible, so grounding Gemini with
  a curated reference is likely unnecessary; revisit only if a track's voicings come out wrong.
- PR #242 holds the analyzer + player + 10-track corpus; nothing merged to `main`.
