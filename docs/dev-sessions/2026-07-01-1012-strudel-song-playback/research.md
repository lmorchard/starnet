# Research — Strudel song playback (live-verified this session, 2026-06-30/07-01)

Empirically verified in-browser against the vendored `@strudel/web@1.0.3` → `dist/strudel.js`
(the Phase-1 runtime), plus prototypes in `tmp/song-player.html` + `tmp/stripdown-cover.js`.

## Runtime capabilities (work today)
- `evaluate(codeString)` runs the transpiler. Works: bare expressions, `let`, `arrange()`,
  `stack()`, `note()`, `s()`, `.lpf/.fm/.fmh/.gain/.room/.pan/.distort/.echo/.vib/.vibmod/.superimpose/.slow/.fast/.add`.
- **`signal(() => liveValue)`** — reactive; `.range(lo,hi)`. A live JS value drives pattern params
  each cycle, no re-eval. **This is the signal-injection primitive.** Verified by ear: Les's gThreat
  slider reshapes a *playing* song responsively.
- `superdough(value,t,dur)` one-shots honor `s` (incl. `white/pink/brown` noise), `note`, `cutoff`
  (static lowpass; chain is source→gain→filter), `resonance`, `fm`+`fmh` (FM confirmed), ADSR,
  `room`, `pan`. (Analyser filter measurement is unreliable — gain precedes filter in the chain.)
- `samples('github:…' | url)` works — loads custom/dirt samples at runtime.
- `.play()` uses a **single scheduler slot** (`ai.setPattern` replaces). Multiple independent
  simultaneous patterns are NOT supported via `.play()`; combine with `stack()`/`$:`.

## Gaps vs. full strudel.cc (the compat delta — small but real)
- **`$:` multi-pattern label** → `evaluate()` REJECTS it ("unexpected ast format without body
  expression"). The only pure-syntax gap. Single `$:` works by stripping the label; multiple need
  converting to a `stack(...)`.
- **`setcpm`/`setcps`** → not globals in 1.0.3 (undefined). Songs using them error. Shim, or rewrite
  to `.cpm()`.
- **GM soundfonts (`gm_*`)** → NOT vendored. `@strudel/soundfonts` (AGPL; deps `sfumato`+`soundfont2`;
  pulls `@strudel/core 1.2.6` — newer than our 1.0.x) loads `gm_*` from
  `felixroos.github.io/webaudiofontdata` (WebAudioFont). `setSoundfontUrl()` can repoint to a
  vendored copy.
- **Dirt/drum samples** (`bd/sd/hh`) → load from github at runtime; not vendored offline.

## Licensing (the "friendly" gate)
- `@strudel/soundfonts`: **AGPL-3.0-or-later** (fine — engine is AGPL).
- WebAudioFont data: `felixroos/webaudiofontdata` mirror = **MIT** (packaging only?); origin
  `surikov/webaudiofont` = **GPL-3.0**; underlying samples = mixed free soundfonts (FluidR3, …).
  Murky provenance → **not clean enough to vendor**.
- Cleaner: **GeneralUser GS** (explicit permissive, bundling-OK) or **FluidR3_GM** (MIT-style).
  Decide in spec.

## Existing structures to build on / reconcile
- `js/audio/strudel/` (Phase-1 engine, PR #262): `runtime.js` (boot/poll), `music.js` (bespoke
  score-DATA interpreter, `buildProgram`), `index.js` (music+sfx+drones wiring), `data/*`.
- `js/audio/signals.js` — `deriveProgress`/`deriveThreat` (pure). The game-signal source.
- `preview.html` + `js/ui/preview.js` — SHIPPED visual-effects preview harness. **Precedent for a
  permanent preview tool.**
- `tmp/song-player.html` — this session's prototype (load song → compat shims → play +
  gProgress/gThreat sliders). Proves the concept; to be promoted to a permanent tool.

## New framing (Les, this session) — the load-bearing goals
1. **strudel.cc is the game's music content tool.** Songs are authored there.
2. **Bidirectional sample parity.** Songs must be constrained to the game's *kosher* sample set so
   what's heard while composing in strudel.cc == what plays in-game. Requires: (a) the kosher set
   loadable in strudel.cc (a published/importable manifest) AND vendored offline in-game; (b) a way
   to constrain/validate that a song only uses in-set sounds.
3. **Fidelity / no drift** between strudel.cc and the in-game engine is the governing constraint —
   it pushes toward runtime + sample-set alignment, not a diverging bespoke interpreter.
4. **Reactive via signal injection** (already proven).
5. **Permanent preview tool** rigging songs to game variables.
