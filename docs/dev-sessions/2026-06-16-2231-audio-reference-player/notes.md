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

## Open

- The corpus listen (Les) is the remaining validation. Mode fix and playable-source fix are
  in; the batch is clean (all instruments synthesizable). Whether the *options*/voicings are
  musically right is the open ear-check question that decides the Tone.js-reference fast-follow.
