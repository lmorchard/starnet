# Lab B loader

Lab B injects butterchurn into the **live game** and drives it with the hybrid signal
(live audio + damage-triggered shocks + game-state severity). It's a reference artifact —
loaded at runtime, it changes no game source.

## Prereqs
- Vendor bundle built in this worktree: `make bundle-vendor` (gitignored `dist/vendor.js`).
- Dev server running (this session uses port **3007** to avoid clobbering a parallel `:3000`):
  `npx serve . -l 3007`

## Load it (devtools import)

1. Open the game: `http://localhost:3007/`
2. Start a run and **arm audio** — press a key / click so the AudioContext resumes and the
   Strudel runtime sets `window.getAudioContext`. (Lab B warns if the context isn't up yet.)
3. Open devtools console and import the module **from the same origin**:
   ```js
   import("/docs/dev-sessions/2026-07-08-1347-butterchurn-brain-damage/lab-b.js")
   ```
   ⚠ **Load it early** (right after arming audio). The audio tap wraps
   `AudioNode.prototype.connect`, so it only catches connections made *after* import. The
   reactive score schedules new source nodes continuously, so it'll pick up the music within
   a beat or two; long-lived drones connected before import may be missed.
4. A **LAB B** control panel appears top-right: preset / blend / bed-weight / test-shock, plus
   a live readout of health & deck severity and which pool last took damage.

## Take damage (to see the shock flares)

Damage has no discrete event — Lab B watches health/deck values for drops. Trigger some via
the cheat console (see `js/core/cheats.js`), e.g. damage health / deck, or just play into ICE
and let it hit you. Each drop fires a synthetic bass-impulse shock scaled to the hit size.

## What we're evaluating (checkpoint)
- Does the bed thicken convincingly as health/deck fall during a real run?
- Do damage drops read as *wetware shocks* over the live, moving graph?
- Does it hold up vs. the static-screenshot Lab A?
- **Perf:** fps with the overlay active vs. off; pan/zoom stutter (continuous WebGL2 + feedback
  over `#cy` — the pattern CLAUDE.md warns tanked fps before). Try half-res `setRendererSize`
  if needed.

## Productionization notes (deferred)
- Clean audio tap would add a single master `GainNode` in `js/audio/` (one-line game change)
  instead of the `connect` shim.
- Preset curation + categorization by damage type (health vs deck vs ICE) — see notes.md.
- Vendor butterchurn into `dist/` via esbuild; port the tuned drive into `graph-degradation/`.
- Preset **licensing** decision (separable content / permissive subset).
