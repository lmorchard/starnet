# Notes — Strudel song playback

## Shipped this session (committed on `strudel-song-playback`)

- **Slice A** — vendored `@strudel/web@1.3.0` (strudel.cc-parity runtime). Native `$:`/`setcpm`/
  `arrange` via `evaluate()`, no shims. Browser-verified.
- **Slice B** — expandable signal registry (`js/audio/signal-registry.js`) + injection bridge
  (`js/audio/strudel/signal-bridge.js`): `progress`/`threat` exposed as live global Strudel signals,
  refreshed on STATE_CHANGED; `setLive()` for preview sliders. Unit-tested + browser-verified
  (song reacts to a signal by ear — Les confirmed).
- **Slice C** — vendored GeneralUser GS soundfont (`audio-content/soundfonts/`, committed, clean
  license) registered as 287 distinct `gus_*` sounds (NOT aliased to `gm_*` — non-fungible by
  design). `js/audio/strudel/soundfont.js`.
- **Slice D** — permanent song preview harness (`song-preview.html` + `js/ui/song-preview.js`):
  editor, per-signal sliders, 287-instrument palette, in-set linter.

## RESOLVED: soundfont songs don't STOP + degrade over time — Firefox

**Fixed** (commit "fix STOP (Firefox + repl)"). Three causes, three fixes:
1. **Primary:** the bare global `window.hush()` does NOT clear `$:` multi-patterns (they live in
   the repl) → song looped forever + replays stacked (the "degradation"). Fix: stop via
   `window.evaluate("hush()")` (runs hush through the repl). Verified: bare hush leaves it at 0.84;
   `evaluate("hush()")` → 0.
2. Firefox lacks `cancelAndHoldAtTime` → polyfill in runtime.js (soundfont voices now release).
3. superdough bails on our soundfont handle (node undefined) → schedule the note-off ourselves in
   soundfont.js (`stop(time+value.duration)`).
Result (Firefox): STOP decays the song to silence; no replay accumulation. Residual tail = the
warm pad's natural release at the demo's slow tempo, not a bug.

Historical detail below (kept for the record):

### Original diagnosis

Les (Firefox) reported: STOP doesn't stop the audio, and playback degrades over time. Root-caused,
partially patched (uncommitted), NOT resolved. Findings:

1. **Firefox lacks `AudioParam.cancelAndHoldAtTime`.** **sfumato** (the SF2 player in
   `@strudel/soundfonts`) calls it raw in its `dahdsr` release (`sfumato/dist/sfumato.js`) → every
   soundfont **note-off throws** in Firefox → voices never release → don't stop + pile up (the
   degradation). Confirmed: Playwright Firefox 151, `cancelAndHoldAtTime` undefined; note-off threw.
   - **superdough** emulates it internally (`superdough/superdoughoutput.mjs:111`) so *synth/sample*
     voices are fine — only *soundfont* (sfumato) voices break.
   - **Why strudel.cc works in Firefox:** it runs on **`standardized-audio-context`** (implements
     `cancelAndHoldAtTime`); our boot uses the **native** Firefox AudioContext (doesn't). Les wasn't
     lucky — strudel.cc has the Firefox workaround; our bare bundle didn't.
2. **superdough bails on our soundfont handle.** `superdough.mjs` ~L574: if the sound handle's
   `node` is `undefined` (ours is), it `return`s early and never schedules the note-off. So even
   without the FF bug, our `registerSound(...)` voices wouldn't self-stop. We hand-roll registration
   instead of using `@strudel/soundfonts`'s own `registerSoundfonts()`.
3. **`hush()` may not clear `$:` multi-patterns** — UNVERIFIED hypothesis. The demo uses three `$:`
   patterns; `hush()` is the documented stop but the song kept sounding after it even with a
   `cancelAndHoldAtTime` polyfill on a fresh page. Needs isolation: `$: sound("bd*4")` (samples, no
   soundfont) → `hush()` → do hits continue? (Distinguishes hush/$: from soundfont-release.)

### Uncommitted partial patches (in the working tree — reconsider vs. the canonical fix)
- `js/audio/strudel/runtime.js`: `polyfillCancelAndHold()` at boot (standard hold-current-value
  shim). Removes the note-off throw; single soundfont note now releases. Did NOT make the full song
  stop (see #3).
- `js/audio/strudel/soundfont.js`: schedule `stop(time + value.duration)` in the trigger (because of
  superdough's early-return, #2).

## Recommended next step (Les's instinct — align to strudel.cc's well-trod code)

Rather than our polyfill + hand-rolled registration, do it the way strudel.cc does:
1. **Boot on `standardized-audio-context`** (or `initStrudel` options that select it) so
   `cancelAndHoldAtTime` exists natively in Firefox → sfumato release works, no polyfill.
2. **Register the soundfont via `@strudel/soundfonts`'s `registerSoundfonts()` / their loader**, not
   our custom `registerSound` loop → avoids the superdough early-return (#2). Keep the `gus_*`
   distinct-naming requirement (no `gm_*` alias) on top.
3. **Verify STOP** with the drums-only `$:` isolation (#3) on a FRESH page (this session's live-test
   page is contaminated with accumulated stuck voices — start clean).
4. Confirm on both Firefox and Chrome.

We ARE using @strudel/web's canonical API (`initStrudel`/`evaluate`/`hush` per its README) — the gap
is the audio-context + soundfont-registration mechanics one level down.
