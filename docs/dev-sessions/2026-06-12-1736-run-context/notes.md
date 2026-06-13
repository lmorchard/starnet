# Notes — RunContext per-run state owner

## Summary

Fixed a state-retention bug where starting a new run could inherit the previous
run's repeating timers, by introducing a `RunContext` that owns all genuinely
per-run state (`state`, `timers`, `nodeGraph`). `initGame` now swaps in a *fresh*
context, so a new (or restored) run begins from a clean slate by construction —
the orphan-timer leak is impossible rather than guarded against.

## Investigation (root cause)

- The timer Map (`timers.js`) was module-level and cleared **only** in `endRun`
  (`clearAllTimers`), never at run start. Any path that begins a run without the
  previous run going through `endRun` left orphaned repeating timers alive.
- Worst case: the `trace-tick` timer. Orphans accumulate, and each decrements the
  shared `state.traceSecondsRemaining` in parallel — multiplying the trace
  countdown (2×, 3×, …) → "trace already in progress" then near-instant catch.
- Confirmed live: the shipped `hub` console command returns to the overworld
  mid-run without `endRun`, so the trace-tick survived `initGame` into the next
  run. Measured 3 trace-tick timers → countdown dropped 6s in 2s (3×).

## Design

`RunContext` (`js/core/run-context.js`) owns `state` + `timers` + `nodeGraph`,
via **own + delegate**: a single active-context pointer, and the existing
accessors (`getState`, the `timers.js` functions) delegate to it. Call sites are
unchanged.

**Planning correction:** the spec originally had the context own `rng` and the
exploit id counter too. Verified during planning that both are shared services
used by the **overworld** (boot `initRng`, profile starter-hand generation, hub
store card minting) — not purely per-run. Moving them into a run-only context
would break profile bootstrap. They stay as shared services (already reseeded per
run via `initRng(seed)`; counter healed by `reconcileHandIds`). This is *more*
faithful to the run-only boundary.

Boundary is run-only: a run is initialized from an overworld hand-off
(`initGame(meta)`); save/load snapshots the run, not the hub. The design leaves
save-on-jack-out / resumable LANs un-precluded (snapshot/restore are first-class,
JACK-OUT→endRun stays loose), but that's a future overworld concern, not built.

## Changes

- New `js/core/run-context.js` — `createRunContext`/`getActiveRun`/`setActiveRun`.
- `js/core/timers.js` — timer fns read/write `getActiveRun().timers`; graph ref →
  `getActiveRun().nodeGraph`. `_pauseCount` stays module-level (session, not run).
- `js/core/state/index.js` — removed `let state`; `getState`/`mutate` delegate;
  `initGame`/`deserializeState` create+swap a fresh context; `serializeState`
  reads the context. (Renamed the NodeGraph game-ctx local to `gameCtx` to avoid
  collision with the run `ctx`.)
- `scripts/lib/headless-engine.js` — dropped the now-redundant `clearAllTimers()`
  in `resetGame` (a fresh context starts empty).
- `tests/run-context.test.js` — regression (no orphan across run-start),
  clean-slate, save/load round-trip.

## Verification

- `make check`: lint clean, **1115 tests pass** (incl. the 3 new + full
  integration/snapshot suites that exercise state access through delegation).
- `make census SEEDS=10`: summary **byte-for-byte identical** to `main`
  (1eae827) — pure behavior-preserving refactor.
- Live browser: reproduced the original `hub`-command path; Run B now starts with
  **0 orphan trace-tick timers** (was 1+), green alert, no console errors.

## Follow-ups (not done here)

- Whether returning to the hub mid-run (the `hub` console command) should be
  allowed at all, or should suspend/end the run, is a separate overworld question.
- Save-on-jack-out / resumable LANs — future overworld arc; the RunContext was
  designed to enable it without reopening this work.
