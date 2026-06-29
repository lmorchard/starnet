# In-game Strudel + superdough spike

Throwaway de-risk before any audio-engine rebuild. Proves Strudel (music) + superdough (SFX) can
run **inside the actual game**, driven by the real event bus + state — and lets us watch perf.

Follows the `audio-strudel-analyzer` work (merged #253) that proved Strudel+superdough in isolation.

## What it is

- `js/audio/strudel-spike.js` — flag-gated module. Subscribes to real `E.*` events for superdough
  one-shot SFX, and runs a reactive Strudel stack whose params read the existing `deriveProgress`/
  `deriveThreat` signals (the same ones the Tone music engine uses) via `signal()`.
- `index.html` — adds `@strudel/web@1.0.3` (global script) + the module. **Idle until started.**
- **Does NOT touch the shipped Tone audio.** Runs alongside; gated behind `window.strudelSpike`.

## How to run

```
make bundle-vendor          # build dist/ (vendor + tone + lit)
make serve                  # (or any static server) → http://localhost:3000
```
In the browser: start a run, then in the devtools console:
```js
strudelSpike.start()        // boots Strudel, starts reactive music + SFX-on-events
strudelSpike.testSfx()      // fire one cue on demand (confirm SFX without a game event)
strudelSpike.stop()         // hush + unsubscribe
```
**For a clean A/B + perf read, toggle the Tone music OFF first** (the music button / control), so
you're hearing only Strudel.

What to judge (the bits that need ears + eyes):
- **SFX** fire tight and clean on probe / exploit (success vs fail) / alert raise / ICE detect / trace.
- **Music** audibly intensifies as threat/progress climb (filter opens, level + density rise, arp
  climbs an octave and speeds up as you own more of the LAN).
- **Performance** — play a full run with devtools Performance/FPS open alongside Cytoscape; watch for
  frame drops or audio dropouts.

## Verified headlessly (Playwright)

- Boots in-game, 0 console errors, runs alongside the loaded game.
- Reactive bridge works on REAL state: jacking into a run set `gProgress` to 0.083 (1/12 owned) via
  `deriveProgress` — the Strudel `signal()` reads it live.
- superdough SFX path fires (`testSfx()` → 2 one-shots, clean).
- Cue handlers subscribe to the real `E.*` events without error.

NOT verifiable headlessly (your call): audible SFX-on-real-events, audible reactive morph, CPU/FPS.

## Cues wired (event → superdough one-shot)

`NODE_REVEALED`, `NODE_ACCESSED`, `ACTION_RESOLVED` (success/fail pitch), `ALERT_GLOBAL_RAISED`,
`ICE_DETECTED`, `ALERT_TRACE_STARTED`. Easy to add/tune in `CUES` in `strudel-spike.js`.

## If green → the real rebuild

This proves integration + (pending your perf read) footprint. The actual engine rebuild — replacing
the Tone music + SFX with a Strudel/superdough engine, re-authoring the reactive music design — is the
larger follow-on arc, its own dev-session.
