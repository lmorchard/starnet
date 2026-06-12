# Overlay progress smoothing — decouple render cadence from tick-fed progress

**Goal:** Node-anchored overlay animations whose geometry is a continuous function of
`progress` look choppy in-game because they only re-render when `sync()` is called — and
in game that happens once per game tick (~10 fps via `ACTION_FEEDBACK`). In the preview
harness `sync()` is driven by a 60 fps rAF, so the same effects look smooth there. Give the
overlays an internal rAF that renders at display rate, easing a *displayed* progress toward
the tick-fed *target* progress, so the motion is smooth without changing how progress is fed.

**Source:** User report — the MINE scan overlay is choppier in normal gameplay than in
preview. Diagnosed as a cadence (not performance) issue. τ tuned to 120 ms by eye in the lab
(`lab/mine-smoothing-lab.html`).

## Current state

`NodeOverlay` (`js/ui/overlays/node-overlay.js`) re-renders only inside `sync()`/`reposition()`.
Effects that own their own rAF/interval (`loot-rings`, `exploit-brackets` zaps) are smooth;
effects whose geometry is purely a function of `this.progress` freeze between ticks.

## Audit (which overlays benefit)

Smoothing helps **continuous progress→geometry** motion; it's wrong or pointless elsewhere.

- ✅ **mine-scan** — continuous Lissajous roam + reticle spin.
- ✅ **probe-sweep** — rotating radar "hand" + sweep-front cross-fade.
- ✅ **exploit-brackets** — brackets converge + rotate `p*360` (zap flicker already self-runs).
- ➖ **ice-detect**, **read-sectors** — discrete segment fills, chunky *by design*.
- ➖ **selection-reticle** — spin is CSS (already decoupled); progress unused.
- ➖ **loot-rings** — already time-driven (per-ring rAF).

## Desired end state

- A pure, testable easing helper: `easeToward(current, target, dtMs, tauMs)` =
  `current + (target-current) * (1 - exp(-dtMs/tauMs))` (frame-rate-independent low-pass).
- `NodeOverlay` gains opt-in smoothing: `enableProgressSmoothing(tauMs = 120)`, a
  `displayProgress` getter, and an internal rAF loop that eases `displayProgress` toward
  `this.progress` each frame and calls `_render()`. The loop self-stops on convergence and is
  cancelled in `clear()`; a new target node snaps `displayProgress` (no stale ease-in).
  When smoothing is **off**, behavior is byte-identical to today (`displayProgress` === `progress`,
  render on `sync()`).
- `mine-scan`, `probe-sweep`, `exploit-brackets` opt in and read `this.displayProgress` in
  `_render()` (exploit-brackets' zap origin too) instead of `this.progress`.

## Design decisions

- **Opt-in, not automatic** — discrete-fill and CSS-spin overlays must NOT be smoothed; the
  helper defaults off so each overlay declares intent.
- **τ = 120 ms** — locked by eye in the lab (snappy but no lock-on lag at 10 fps feed).
- **Time-based low-pass** (not velocity extrapolation) — simplest robustly-smooth approach;
  ~τ of imperceptible lag, handles scrub/pause/variable rate for free.
- **Cost** — one rAF per *active* smoothed overlay (a handful of `setAttribute`s/frame); stops on
  convergence + on `clear()`. Not a perf concern; this is a cadence fix.

## What we're NOT doing

- Not changing how progress is produced/fed (still tick-driven `ACTION_FEEDBACK`).
- Not smoothing the discrete/CSS/time-driven overlays.
- Not touching preview's 60 fps driver (it already feeds fine; the helper just adds harmless
  sub-frame easing there).

## Open questions

- None — τ locked, audit complete.
