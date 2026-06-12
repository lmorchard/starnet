# `cheat fps` — dev-only frame-time meter

**Goal:** Implement #190 — a toggleable in-game FPS / frame-time readout so we can profile a
busy moment on real hardware (automated/headless browsers rAF-throttle even an idle tab, so they
can't give trustworthy numbers).

## The premise (why it works without a single render loop)

The game has no central render pass — it's many independent rAF loops (overlays, waveform,
graph-degradation), Cytoscape's own on-demand renderer, CSS-composited animations, and a 10fps
state tick. But they all share **one main thread, one compositor, one display refresh**. A
standalone rAF that times the gap between its own callbacks therefore measures the **effective
frame cadence**, and any main-thread stall (Cytoscape restyle, a heavy loop, GC) stretches those
gaps. This is the stats.js approach: don't hook anyone's loop, just run your own rAF and measure
spacing.

## Scope (v1)

- **Cadence meter:** rolling FPS (over a ~500ms window) + worst-frame ms, plus a frame-time
  sparkline (last ~90 frames) so hitches are visible.
- **Toggle:** `cheat fps` (dev/playtesting only), mirroring how `cheat relayout`/`restore` are
  intercepted in `js/ui/console.js` (the meter is DOM/rAF, so it lives in the UI layer and is
  lazy-imported; core stays DOM-free).
- **Aesthetic:** vector-CRT — stroked sparkline (no fill) + monospace glowing number, green→amber
  →red by FPS, in a small bordered corner panel.
- **Preview demo** per the project's visual-effect convention.

## Out of scope (noted in #190 as future)

- **Attribution** (`PerformanceObserver` longtask / per-loop instrumentation to say *who* janks) —
  v1 is cadence-only.
- Player-facing chrome; cross-device benchmarking.

## Design decisions

- **Ephemeral, not game state.** The meter is a diagnostic overlay (like graph-degradation's cy
  positions, explicitly "not saved state"). Module-level singleton in `js/ui/fps-meter.js`; it
  does NOT touch the serializable state object and does NOT set `isCheating` (observation only,
  changes no outcome).
- **Pure core, thin shell.** Frame math (`FrameStats`) and sparkline geometry (`frameSparkline`)
  go in a pure, unit-tested `js/ui/frame-stats.js`; `fps-meter.js` is the rAF + DOM shell.
- **Observer effect acknowledged.** The meter forces continuous painting while on (it requests a
  frame every frame), so it only runs while toggled — fine for measuring under load, not idle.

## Files

- `js/ui/frame-stats.js` (+ test) — `FrameStats` (record→fps/worstMs), `frameSparkline`.
- `js/ui/fps-meter.js` — start/stop/toggle + rAF loop + DOM/SVG readout.
- `js/ui/console.js` — intercept `cheat fps` → lazy-import + toggle + log.
- `js/core/cheats.js` — add `cheat fps` to the help listing.
- `js/core/console-commands/commands.js` — add `fps` to `CHEAT_SUBS` (tab-completion).
- `preview.html` / `js/ui/preview.js` — a toggle control demo.
- `MANUAL.md` — **not** updated: cheats are dev-only and not part of the
  player-facing manual, so `cheat fps` is intentionally undocumented there.

## Verification

- `make check` green; `frame-stats.test.js` (fps math, worst-frame, sparkline geometry) passing.
- Browser: `cheat fps` toggles a stroked readout that updates live; numbers move under load
  (deck degradation); toggling off removes it and stops the rAF (no leak). No console errors.
