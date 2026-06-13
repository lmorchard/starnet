# Spec — RunContext: a per-run state owner with clean-slate lifecycle

**Date:** 2026-06-12
**Branch:** `worktree-per-run-state-reset`
**Status:** design approved, pending spec review

## Problem

Starting a new run does not reliably begin from a clean slate. Per-run state is
spread across the central `state` object *and* several sibling module
singletons that are not reset in lockstep with it:

- `js/core/timers.js` — the module-level `timers` Map. Cleared **only** in
  `endRun()` (`clearAllTimers`), never at run start.
- `js/core/rng.js` — module-level `streams` / `_seed`. Reset via `initRng()`
  inside `initGame`, so currently fine, but the same shape of risk.
- `js/core/exploits.js` — the module-level exploit id counter.
- UI flags (`end-screen.open`, overlays) — reset ad hoc; the end screen only
  closes via its own button.

Because timers are torn down only at run *end*, any path that begins a new run
without the previous run going through `endRun` leaves the prior run's repeating
timers alive in the global Map. The repeating `trace-tick` timer is the worst
case: orphans accumulate across runs and each one decrements the *shared*
`state.traceSecondsRemaining` in parallel, multiplying the trace countdown speed
(2×, 3×, …) and producing a spurious "trace already in progress" and a near-instant
"RUN COMPLETE".

### Confirmed reproduction (live evidence)

The `hub` console command calls `openHub()` mid-run **without** ending the run —
a concrete no-`endRun` path. Reproduced in-browser:

1. Launch a run, trigger a trace → one `trace-tick` timer.
2. `hub` (returns to overworld, run still `phase:"playing"`, timer still alive).
3. Launch the next run → fresh `state`, but the **orphan `trace-tick` survives
   `initGame`** (it doesn't clear timers).
4. Repeat → orphans accumulate (run B: 1, run C: 2). With the new run's own
   trace, three `trace-tick` timers drop the countdown **6s in 2s (3×)**.

### Root cause

Correctness depends on the *previous* run tearing itself down (`endRun`), rather
than on the *new* run establishing a clean world. This contradicts the project
invariant that game state be fully reconstructable at any instant
(`CLAUDE.md` → State Management). The same split is why the bug was easy to miss:
the timer Map is correctly *serialized* (it's in `serializeState`'s bundle) but
the *reset* path is maintained separately and forgot it.

## Goal

Make a run begin from a clean slate **by construction**, and unify the three
operations that must agree on "what is per-run state" — reset, save, and load —
so completeness is structural, not remembered.

Encapsulate all per-run state in a single owner, `RunContext`, using an
**own + delegate** strategy that requires no call-site churn.

## Planning correction (2026-06-12)

The original design (above, §1) had `RunContext` own `rng` and `exploitIdCounter`
as well. Verified during planning that **both are shared services used by the
overworld, not purely per-run state**:

- `initRng()` runs at boot (`main.js:56`) before any run.
- `generateStartingHand()` (uses `RNG.EXPLOIT` + the exploit id counter) is called
  from `profile-store.js:79` to bootstrap a fresh profile — no run active.
- `getStoreCatalog()` and store purchases mint cards (RNG + counter) from the hub.

Moving them into a *run-only* context would break profile bootstrap and the hub
store. So they **stay as shared module-level services** — already reseeded per run
(`initRng(seed)` in `initGame`) and healed by `reconcileHandIds`. They were never
the bug. This is *more* faithful to the run-only boundary: overworld-spanning
services live outside the run context. The sections below reflect the corrected
ownership.

## Design

### 1. The container

`RunContext` is the single, exclusive owner of all genuinely per-run state:

| Field | Today lives in | Moves to |
|---|---|---|
| `state` (GameState: nodes, ICE, alert, trace, selection, phase, player, mission) | `state/index.js` module var | `ctx.state` |
| `timers` (`currentTick`, `nextId`, entries) | `timers.js` module Map | `ctx.timers` |
| `nodeGraph` (live object) | `state.nodeGraph` | `ctx.nodeGraph` |

These three are also exactly the bug surface: the timer Map's reset was decoupled
from the state's reset. Owning them together makes reset atomic.

**Stays as shared services (not owned by the context):**
- `rng.js` (`streams` + `_seed`) — used by overworld + run; reseeded per run via
  `initRng(seed)`.
- `exploits.js` exploit id counter — used by overworld profile/store card minting;
  per-run collisions healed by `reconcileHandIds`.

Invariant going forward: **per-run state lives in the context or it does not
exist.** Overworld/persistent state (profile bank, inventory, hub) and shared
deterministic services (rng, card-id counter) stay outside, exactly as today.

### 2. Active pointer + delegation (no call-site churn)

A new `js/core/run-context.js` holds the one active context. The accessors for
the owned state become thin delegates to it:

- `getState()` → `active?.state ?? null` (preserves "null before any run", which
  the master tick loop relies on)
- timer fns (`scheduleEvent` / `tick` / `cancelEvent` / `clearAll` /
  `serializeTimers` / …) → `active.timers`
- the timer system's graph ref (`_graphRef`) → `active.nodeGraph`

Every `getState()`, `scheduleEvent()` call site stays exactly as written. `rng.js`
and the exploit counter are untouched (shared services). Only the *mutable*
per-run state moves into the context; the functions read it from `active`.

### 3. Lifecycle — reset is structural

- **`beginRun(handoff)`** builds a *fresh* `RunContext` and swaps it in
  atomically. A new run is a new context, so there is **nothing to clear** —
  orphan timers are impossible by construction. This is the actual bug fix; the
  rest of the design is the structure that prevents reintroducing it. `initGame`
  becomes the RunContext builder that `beginRun` invokes.
- **`endRun(outcome)`** sets `phase: "ended"` and empties the active context's
  timers so the dead run stops ticking while the end screen is up. Correctness no
  longer *depends* on this — it is tidying, not the safety net. (Today it is the
  only safety net, which is why bypassing it is catastrophic.)

### 4. The overworld hand-off (run-only boundary)

`beginRun(handoff)` is the single seam where overworld → run crosses. `handoff`
carries exactly what a run needs and nothing else:

- the network (`graphDef` + `meta`: threat/wealth/complexity/depth, `startNode`,
  ICE config, `moneyCost`)
- the starting loadout (hand cards from profile inventory)
- carried cash
- seed

This is already what `prepareLaunch → startRun → initGame(meta)` passes. The
RunContext formalizes the boundary: nothing crosses except `handoff`. A future
"selectively retain X across runs" becomes a `carryOver` argument to `beginRun`
— designed-for, not built.

### 5. Save / load = snapshot the owner (run-only)

- `snapshotRun()` serializes the active context (`state` minus the live graph,
  `timers`, `nodeGraph.snapshot()`) plus a copy of the shared services' current
  state needed to reproduce the run (`serializeRng()`, `_exploitIdCounter`).
- `restoreRun(snap)` builds a context from the snapshot, restores the shared
  services (`deserializeRng`, `setExploitIdCounter`), rebuilds the graph via
  `NodeGraph.fromSnapshot` with a fresh game-ctx, and sets it active.

This is today's `serializeState`/`deserializeState`, reorganized so the per-run
core (`state`+`timers`+`graph`) is snapshotted from its single owner instead of a
hand-assembled bundle — the forget-a-field failure mode for *those* disappears.
The boundary is **run-only**: loading drops the player into a run, not the hub.
(`snapshotRun` is not a naive `JSON.stringify` — the live `nodeGraph` still needs
its custom `snapshot()`/`fromSnapshot()`.)

### 6. Decisions (settled)

1. **`endRun` keeps the context alive** and empties its timers; the master tick
   loop guards on `phase`. (Rejected: nulling the context and capturing
   end-screen stats at end time.)
2. **`exploitIdCounter` stays a shared service** (not owned by the context). It
   is already reset/healed per run by `reconcileHandIds` in `initGame`, and the
   overworld needs it for profile/store card minting. (Revised from the original
   "fresh per run, owned by context" — see Planning correction.)
3. **`timers.nextId` resets to 1 per run** (it now lives in `ctx.timers`, so a
   fresh context starts it at 1). Ids only need uniqueness within a run's timer set.

## Scope

**In scope**

- New `js/core/run-context.js` (RunContext factory, active pointer, `beginRun`,
  `snapshotRun`/`restoreRun`).
- Modify `state/index.js` and `timers.js` to own-and-delegate against the active
  context. (`rng.js` and `exploits.js` are untouched — shared services.)
- Update `serializeState`/`deserializeState` (in `state/index.js`) to route the
  per-run core through the context while still bundling rng + exploit counter.
- Route run start through `beginRun` in all three entry points: `js/ui/main.js`
  (via `run-control.js`/`hub.js`), `scripts/playtest.js`, `scripts/bot/cli.js`.
- Tests (see below).

**Out of scope (explicitly)**

- Save-on-JACK-OUT / persistent resumable LANs (see "Future-enabled" below).
- Reworking JACK-OUT economy or the overworld.
- The `hub` console command's mid-run behavior. The clean-slate-at-start fix
  makes it harmless for this bug; whether mid-run "return to hub" should be
  allowed at all is a separate question.
- Threading RunContext as an explicit parameter through call sites (rejected in
  favor of own + delegate).

## Future-enabled (not built)

The run-only RunContext is designed so a future overworld can persist runs
without reopening this work:

- JACK OUT could call `snapshotRun()` and hand the blob to the overworld to stash
  keyed by target; re-entering that LAN calls `restoreRun(snap)` instead of
  `beginRun`. Both paths produce an active context — same machinery.
- The virtual-tick clock means a suspended LAN is *frozen*: it resumes at the
  exact tick it left, with no wall-clock catch-up.

To keep this un-precluded **now** (no new scope):

- `snapshotRun()`/`restoreRun()` are first-class context operations.
- The JACK-OUT → `endRun` coupling stays loose — `endRun` is a policy the caller
  invokes at one call site, not hardwired into the action.
- The snapshot is self-describing (carries its `seed`) so the overworld can key
  it.

The jack-out economy question (bank loot *and* keep progress, vs. collect only on
clear) is a game-design decision deferred to the overworld arc.

## Testing

1. **Regression (write first, must fail before the fix):** begin a run, schedule
   a `trace-tick`, begin a second run *without* calling `endRun`, assert zero
   orphan `trace-tick` timers in the active context.
2. **Clean-slate sweep:** after `beginRun`, assert `globalAlert: "green"`,
   `traceSecondsRemaining: null`, empty timer set, fresh `exploitIdCounter`,
   `nextId === 1`.
3. **Save/load round-trip:** `snapshotRun()` → mutate → `restoreRun()` reproduces
   the snapshot exactly (state, timers, rng stream states, graph).
4. **Entry-point parity:** `playtest.js` and the bot start runs via `beginRun`
   and behave identically to today (existing suites pass).

Per project practice, run `make check` and `make census SEEDS=10` (compare
against a same-seed `main` run) after the change.
