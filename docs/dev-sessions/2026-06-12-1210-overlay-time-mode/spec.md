# Overlay time mode — managed, disconnect-safe cadence loop (jank sweep A)

**Goal:** First slice of the jank-elimination sweep (#179, part A — driver consolidation).
`NodeOverlay` already owns a managed **progress-smoothing** rAF (from #178, PR #178). The
**time-driven** half is still hand-rolled per overlay: `loot-rings` runs a self-rescheduling
`setTimeout` spawn chain, `exploit-brackets` runs a `setInterval` zap loop. Both duplicate
lifecycle bookkeeping and — like the smoothing rAF before its fix — **neither is cancelled on
`disconnectedCallback`**, so a removed element keeps its cadence loop firing. Give `NodeOverlay`
a managed, disconnect-safe **time loop** and convert both onto it.

**Source:** #179 part A. No visible behavior change intended — same spawn cadence, same zaps;
this is code-health + latent-leak prevention + foundation for the (B) particle emitter.

## Current state

- `loot-rings`: `sync()` → `_tick()` self-reschedules via `setTimeout(_tick, SPAWN_MIN_MS +
  progress*SPAWN_PROGRESS_MS)`; each `_tick` spawns a ring that self-animates on its own rAF.
  `clear()` clears the timer.
- `exploit-brackets`: `_startZaps()` sets `setInterval(_tickZaps, ZAP_TICK_MS=30)`; `_tickZaps`
  counts ticks and fires a zap when due. `_stopZaps()` clears.
- Neither `setTimeout`/`setInterval` is stopped in `disconnectedCallback`.

## Desired end state

- `NodeOverlay` gains: `startTimeLoop()` / `stopTimeLoop()` (idempotent) and a per-frame hook
  `_timeFrame(now, dtMs)` driven by a managed `requestAnimationFrame`. The loop is auto-stopped
  by `clear()` **and** `disconnectedCallback()` (alongside the existing smoothing stop).
- `loot-rings` expresses its spawn cadence inside `_timeFrame` (accumulate `dtMs`; spawn when the
  accumulator reaches the progress-scaled delay; reset). No `setTimeout`.
- `exploit-brackets` expresses its zap cadence inside `_timeFrame` (accumulate `dtMs`; fire when
  due; pick next 30–90 ms delay). No `setInterval`. (It also keeps the smoothing loop for the
  brackets — the two managed loops coexist; both stopped on clear/disconnect.)
- The per-ring expansion rAF and per-zap one-frame fade are **unchanged** (that's (B)).

## Design decisions

- **One managed time loop, separate from the smoothing loop.** They model different concerns
  (ease progress vs drive cadence) and an overlay may use both (exploit-brackets). Keeping them
  separate is clearer than merging; both are lifecycle-managed by the base.
- **rAF, not setTimeout/setInterval.** Display-rate frame loop with internal time accumulation —
  consistent with the smoothing loop, naturally throttles in a backgrounded tab, and is trivially
  disconnect-safe via one cancel path.
- **No behavior change.** Cadence values (`SPAWN_MIN_MS`, `SPAWN_PROGRESS_MS`, 30–90 ms zap gap)
  are preserved; verification is "still looks/behaves the same, and now stops on disconnect."

## What we're NOT doing

- Not unifying the per-particle animations into a shared emitter (that's #179 part B).
- Not touching the progress-smoothing path, or any overlay that isn't time-driven.

## Verification

- `make check` green (no regression; these overlays have no node unit tests — DOM/cy-coupled).
- Browser: rings still spawn at the same cadence, zaps still fire; removing the element stops
  the loop (no orphaned rAF) — the latent-leak fix; no console errors.

## Open questions
- None.
