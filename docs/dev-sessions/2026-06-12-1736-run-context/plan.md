# RunContext Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encapsulate all genuinely per-run state (`state`, `timers`, `nodeGraph`) in a single `RunContext` owner so a new run begins clean by construction — fixing the orphan-trace-timer bug where starting a run without `endRun` leaks repeating timers.

**Architecture:** Own + delegate. A new `run-context.js` holds the one active `RunContext` and a factory. `initGame` builds a *fresh* context and swaps it in, so a new run can never inherit the previous run's timers. The existing accessors (`getState`, the `timers.js` functions) delegate to the active context; call sites are unchanged. RNG and the exploit-id counter remain shared module services (used by the overworld too).

**Tech Stack:** Vanilla JS ES modules, JSDoc `@ts-check`, `node:test` (run via `make test`), `tsc` (`make lint`).

See `spec.md` in this directory for the full design and the planning correction (why rng/counter stay outside the context).

---

## File structure

- **Create** `js/core/run-context.js` — `RunContext` typedef, `createRunContext()`, `getActiveRun()`, `setActiveRun()`. One responsibility: own and hand out the active per-run context.
- **Modify** `js/core/timers.js` — the timer functions read/write `getActiveRun().timers` instead of module-level `currentTick`/`nextId`/`timers`; `_graphRef` becomes `getActiveRun().nodeGraph`. `_pauseCount` stays module-level (session pause, not run state).
- **Modify** `js/core/state/index.js` — remove `let state`; `getState`/`mutate` delegate to the active context; `initGame` creates+swaps a fresh context; `endRun` keeps emptying timers; `serializeState`/`deserializeState` route the per-run core through the context.
- **Modify** `scripts/lib/headless-engine.js` — drop the now-redundant `clearAllTimers()` in `resetGame` (a fresh context already starts empty).
- **Create** `tests/run-context.test.js` — regression + clean-slate + save/load round-trip.

`rng.js`, `exploits.js`, `save-load.js`, `run-control.js`, `hub.js`, `scripts/playtest.js`, `scripts/bot/*` are **not modified** (they go through `initGame`/`resetGame`).

---

### Task 1: RunContext owner + failing regression test

**Files:**
- Create: `js/core/run-context.js`
- Test: `tests/run-context.test.js`

- [ ] **Step 1: Create `js/core/run-context.js`**

```js
// @ts-check
// RunContext — the single owner of all genuinely per-run state: the GameState
// object, the timer set, and the live NodeGraph. A run begins by swapping in a
// FRESH context (see initGame), so starting a new run can never inherit the
// previous run's timers — which is the orphan-trace-timer bug this fixes.
//
// Shared deterministic services (rng.js streams, the exploits.js id counter) are
// used by the overworld as well as runs, so they live OUTSIDE the context. See
// docs/dev-sessions/2026-06-12-1736-run-context/spec.md (Planning correction).

/** @typedef {import('./types.js').GameState} GameState */
/** @typedef {import('./node-graph/runtime.js').NodeGraph} NodeGraph */

/**
 * @typedef {Object} TimerSet
 * @property {number} currentTick
 * @property {number} nextId
 * @property {Map<number, any>} entries
 */

/**
 * @typedef {Object} RunContext
 * @property {GameState|null} state
 * @property {TimerSet} timers
 * @property {NodeGraph|null} nodeGraph
 */

/** @type {RunContext|null} */
let active = null;

/** @returns {RunContext} a fresh, empty per-run context */
export function createRunContext() {
  return {
    state: null,
    timers: { currentTick: 0, nextId: 1, entries: new Map() },
    nodeGraph: null,
  };
}

/** @returns {RunContext|null} the active run context, or null before any run */
export function getActiveRun() {
  return active;
}

/**
 * Make `ctx` the active run context. Called by initGame (fresh run) and
 * deserializeState (restored run).
 * @param {RunContext} ctx
 */
export function setActiveRun(ctx) {
  active = ctx;
}
```

- [ ] **Step 2: Write the failing regression test**

Create `tests/run-context.test.js`:

```js
// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { initGame } from "../js/core/state/index.js";
import { scheduleRepeating, serializeTimers, TIMER } from "../js/core/timers.js";
import { buildNetwork as buildGenerated } from "../data/networks/generated.js";

function buildNetworkFn(seed) {
  return () => buildGenerated({ seed, spec: { threat: "C", wealth: "B", complexity: "C", depth: "C" } });
}

test("starting a new run does not inherit the previous run's timers", () => {
  // Run A: start a run and schedule a repeating trace-tick (as a live trace would).
  initGame(buildNetworkFn("run-a"), "run-a");
  scheduleRepeating(TIMER.TRACE_TICK, 1000);
  const aTraceTicks = serializeTimers().entries.filter((e) => e.type === TIMER.TRACE_TICK).length;
  assert.equal(aTraceTicks, 1, "run A should have its trace-tick timer");

  // Run B: start a new run WITHOUT ending run A (no endRun / clearAllTimers).
  initGame(buildNetworkFn("run-b"), "run-b");
  const bTraceTicks = serializeTimers().entries.filter((e) => e.type === TIMER.TRACE_TICK).length;

  // The orphan must NOT survive into run B.
  assert.equal(bTraceTicks, 0, "run B must start with no orphaned trace-tick timer");
});
```

- [ ] **Step 3: Run the test to verify it FAILS**

Run: `node --test tests/run-context.test.js`
Expected: FAIL — the orphan survives (`bTraceTicks` is 1), because `initGame` does not yet swap contexts. (If it instead errors on import, that's also a fail — proceed to wire delegation in Tasks 2–3, then this passes.)

- [ ] **Step 4: Commit**

```bash
git add js/core/run-context.js tests/run-context.test.js
git commit -m 'Add RunContext owner + failing regression test for run-start timer leak'
```

---

### Task 2: `timers.js` delegates to the active context

**Files:**
- Modify: `js/core/timers.js`

- [ ] **Step 1: Add the import and remove the per-run module vars**

At the top of `timers.js`, add to the imports:

```js
import { getActiveRun } from "./run-context.js";
```

Delete these module-level declarations (lines ~19–34):

```js
let currentTick = 0;
let nextId = 1;
...
let _graphRef = null;
...
const timers = new Map();
```

Keep `let _pauseCount = 0;` (session pause state, not per-run).

- [ ] **Step 2: Replace the body to read/write the active context's timer set**

Replace the affected functions so they operate on `getActiveRun().timers` (and `getActiveRun().nodeGraph` for the tick graph). Full replacements:

```js
/** Register NodeGraph for tick advancement. */
export function setGraphForTick(graph) {
  const ctx = getActiveRun();
  if (ctx) ctx.nodeGraph = graph;
}

export function pauseTimers()  { _pauseCount++; }
export function resumeTimers() { if (_pauseCount > 0) _pauseCount--; }
export function isPaused()     { return _pauseCount > 0; }

export function scheduleEvent(type, delayMs, payload = {}, visibility = null) {
  const t = getActiveRun().timers;
  const id = t.nextId++;
  const durationTicks = Math.max(1, Math.round(delayMs / TICK_MS));
  t.entries.set(id, {
    id, type, payload,
    fireAt: t.currentTick + durationTicks,
    intervalTicks: null,
    visible: !!visibility,
    label: visibility?.label ?? null,
    startedAt: t.currentTick,
    durationTicks,
  });
  return id;
}

export function scheduleRepeating(type, intervalMs, payload = {}) {
  const t = getActiveRun().timers;
  const id = t.nextId++;
  const intervalTicks = Math.max(1, Math.round(intervalMs / TICK_MS));
  t.entries.set(id, {
    id, type, payload,
    fireAt: t.currentTick + intervalTicks,
    intervalTicks,
    visible: false,
    label: null,
    startedAt: t.currentTick,
    durationTicks: intervalTicks,
  });
  return id;
}

export function tick(n = 1) {
  if (_pauseCount > 0) return;
  const ctx = getActiveRun();
  if (!ctx) return;
  const t = ctx.timers;
  const versionBefore = getVersion();
  t.currentTick += n;
  for (const [id, entry] of t.entries) {
    while (t.currentTick >= entry.fireAt) {
      emitEvent(entry.type, { ...entry.payload, timerId: id });
      if (entry.intervalTicks !== null) {
        entry.fireAt += entry.intervalTicks;
      } else {
        t.entries.delete(id);
        break;
      }
    }
  }
  if (ctx.nodeGraph) {
    for (let i = 0; i < n; i++) ctx.nodeGraph.tick(1);
  }
  if (getVersion() !== versionBefore) {
    emitEvent(E.STATE_CHANGED, getState());
  }
}

export function cancelEvent(id) {
  getActiveRun()?.timers.entries.delete(id);
}

export function cancelAllByType(type) {
  const t = getActiveRun()?.timers;
  if (!t) return;
  for (const [id, entry] of t.entries) {
    if (entry.type === type) t.entries.delete(id);
  }
}

export function clearAll() {
  const ctx = getActiveRun();
  if (!ctx) return;
  ctx.timers.entries.clear();
  ctx.timers.currentTick = 0;
}

export function getVisibleTimers() {
  const t = getActiveRun()?.timers;
  if (!t) return [];
  return [...t.entries.values()]
    .filter((x) => x.visible)
    .map((x) => ({
      label: x.label,
      remaining: Math.max(0, Math.ceil((x.fireAt - t.currentTick) * TICK_MS / 1000)),
      progress: Math.min(1, (t.currentTick - x.startedAt) / x.durationTicks),
    }));
}

export function serializeTimers() {
  const t = getActiveRun().timers;
  return { currentTick: t.currentTick, nextId: t.nextId, entries: [...t.entries.values()] };
}

export function deserializeTimers({ currentTick: ct, nextId: ni, entries }) {
  const t = getActiveRun().timers;
  t.currentTick = ct;
  t.nextId = ni;
  t.entries.clear();
  for (const entry of entries) t.entries.set(entry.id, entry);
}
```

Leave `TICK_MS`, `TIMER`, the `import` of `getVersion`/`getState`, and `emitEvent`/`E` imports as-is.

- [ ] **Step 3: Run lint to catch reference errors**

Run: `make lint`
Expected: PASS (no `currentTick is not defined` etc.). Fix any missed reference.

- [ ] **Step 4: Commit**

```bash
git add js/core/timers.js
git commit -m 'timers: read/write the active RunContext timer set (delegate)'
```

---

### Task 3: `state/index.js` owns `state` via the context

**Files:**
- Modify: `js/core/state/index.js`

- [ ] **Step 1: Import the context helpers and remove the module `state` var**

Add to the imports near the top of `state/index.js`:

```js
import { createRunContext, getActiveRun, setActiveRun } from "../run-context.js";
```

Delete:

```js
/** @type {GameState|null} */
let state = null;
```

Keep `let version = 0;` (render-gating counter, not run state).

- [ ] **Step 2: Delegate `getState`/`mutate`**

Replace:

```js
export function mutate(fn) {
  fn(/** @type {GameState} */ (state));
  version++;
  return /** @type {GameState} */ (state);
}
```

with:

```js
export function mutate(fn) {
  const state = /** @type {GameState} */ (getActiveRun().state);
  fn(state);
  version++;
  return state;
}
```

Replace:

```js
export function getState() {
  return /** @type {GameState} */ (state);
}
```

with:

```js
export function getState() {
  return /** @type {GameState} */ (getActiveRun()?.state ?? null);
}
```

- [ ] **Step 3: `initGame` builds and swaps a fresh context**

In `initGame`, immediately after `initRng(seedString);` (currently the first line of the body), insert:

```js
  // A new run is a brand-new context — fresh timers, fresh state. The previous
  // run's context (and any of its timers) is dropped here, so nothing leaks in.
  const ctx = createRunContext();
  setActiveRun(ctx);
```

Then, where the code currently builds the graph, register it on the context before any tick wiring. Change the existing `const graph = new NodeGraph(graphDef, ctx, onEvent);` line — note it already shadows nothing problematic, but rename the NodeGraph's game-ctx local to avoid confusion with the run context. The NodeGraph's ctx is built earlier as `const ctx = buildGameCtx(...)`. **Rename that game-ctx local from `ctx` to `gameCtx`** throughout `initGame` (it is used as `buildGameCtx(...)`, `new NodeGraph(graphDef, ctx, onEvent)`, and `ctx._graph = graph`). After:

```js
  const gameCtx = buildGameCtx({ openDarknetsStore: opts.openDarknetsStore });
  ...
  const graph = new NodeGraph(graphDef, gameCtx, onEvent);
  gameCtx._graph = graph;
  ctx.nodeGraph = graph;   // register the run's graph on the run context
```

In the `onEvent` bridge inside `initGame`, the line `if (!isSyncingToGraph() && state?.nodes[payload.nodeId])` references the (now-removed) module `state`. Replace `state?.nodes[payload.nodeId]` with `getState()?.nodes?.[payload.nodeId]` (two occurrences — initGame and deserializeState both have this bridge).

Replace the big `state = { ... };` assignment (the GameState literal) with:

```js
  ctx.state = {
    // ...unchanged literal contents (seed, spec, nodes, adjacency, nodeGraph: graph, player, ...)...
  };
  const state = ctx.state;   // local alias so the rest of initGame reads unchanged
```

Everything after that in `initGame` (`reconcileHandIds(state.player.hand)`, `state.mission = ...`, `state.ice = ...`, `window._starnetState = state`, etc.) is unchanged because `state` is now a local `const` alias.

- [ ] **Step 4: `endRun` stays as-is (it already empties the active context's timers)**

No change: `endRun` calls `clearAllTimers()` (now empties `getActiveRun().timers`) then `setPhase("ended")`. Add `const state = getState();` at the top of `endRun` so its `state.ice` reference resolves:

```js
export function endRun(outcome) {
  const state = getState();
  clearAllTimers();
  setPhase("ended");
  setRunOutcome(outcome);
  if (outcome === "caught") setCash(0);
  Object.values(state.ice?.instances ?? {}).forEach((i) => {
    if (i?.active) setIceActive(false, i.id);
  });
  emitEvent(E.RUN_ENDED, { outcome });
}
```

- [ ] **Step 5: Add `const state = getState();` to the other state-reading helpers**

`revealNeighbors`, `accessNeighbors`, and `buyExploit` reference the module `state`. Add `const state = getState();` as the first line of each. Their bodies are otherwise unchanged. (`isIceVisible` takes `nodes` as a parameter and does not reference module state — leave it.)

- [ ] **Step 6: Run lint + the regression test**

Run: `make lint && node --test tests/run-context.test.js`
Expected: lint PASS; the Task 1 regression test now PASSES (run B has 0 orphan trace-ticks).

- [ ] **Step 7: Commit**

```bash
git add js/core/state/index.js
git commit -m 'state: own GameState via the active RunContext; fresh context per run'
```

---

### Task 4: save/load routes the per-run core through the context

**Files:**
- Modify: `js/core/state/index.js` (`serializeState`, `deserializeState`)

- [ ] **Step 1: `serializeState` reads the active context**

Replace:

```js
export function serializeState() {
  const { nodeGraph, ...rest } = /** @type {any} */ (state);
  return {
    ...rest,
    _timers: serializeTimers(),
    _rng: serializeRng(),
    _exploitIdCounter,
    _nodeGraph: nodeGraph ? nodeGraph.snapshot() : null,
  };
}
```

with:

```js
export function serializeState() {
  const state = /** @type {any} */ (getState());
  const { nodeGraph, ...rest } = state;
  return {
    ...rest,
    _timers: serializeTimers(),       // active context's timer set
    _rng: serializeRng(),             // shared service
    _exploitIdCounter,                // shared service
    _nodeGraph: nodeGraph ? nodeGraph.snapshot() : null,
  };
}
```

- [ ] **Step 2: `deserializeState` builds and swaps a fresh context**

Replace the head of `deserializeState`:

```js
export function deserializeState(snapshot, opts = {}) {
  const { _timers, _rng, _exploitIdCounter: exploitId, _nodeGraph, ...gameState } = snapshot;
  state = gameState;
  deserializeTimers(_timers);
  ...
```

with:

```js
export function deserializeState(snapshot, opts = {}) {
  const { _timers, _rng, _exploitIdCounter: exploitId, _nodeGraph, ...gameState } = snapshot;
  const ctx = createRunContext();
  setActiveRun(ctx);
  ctx.state = gameState;
  deserializeTimers(_timers);   // writes into ctx.timers
  ...
```

Further down in `deserializeState`, where it currently does `state.nodeGraph = graph; setNodeGraph(graph); setGraphForTick(graph);`, also set the context graph. Replace that block:

```js
    const graph = NodeGraph.fromSnapshot(_nodeGraph, ctx, onEvent);
    ctx._graph = graph;
    state.nodeGraph = graph;
    setNodeGraph(graph);
    setGraphForTick(graph);
```

with (note the game-ctx local here is the `buildGameCtx` result; rename it `gameCtx` for clarity, mirroring Task 3):

```js
    const gameCtx = buildGameCtx(opts);
    const onEvent = (type, payload) => { /* ...unchanged bridge, using getState()?.nodes?.[payload.nodeId]... */ };
    const graph = NodeGraph.fromSnapshot(_nodeGraph, gameCtx, onEvent);
    gameCtx._graph = graph;
    ctx.state.nodeGraph = graph;
    ctx.nodeGraph = graph;
    setNodeGraph(graph);
    setGraphForTick(graph);
```

The remaining lines (`if (_rng) deserializeRng(_rng); else initRng(...)`, `if (exploitId != null) setExploitIdCounter(exploitId);`, `reconcileHandIds(ctx.state.player.hand)`) stay — they restore the shared services. Replace any `state?.player?.hand` reference with `ctx.state?.player?.hand`.

- [ ] **Step 3: Run lint**

Run: `make lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add js/core/state/index.js
git commit -m 'save/load: route per-run core through the RunContext'
```

---

### Task 5: drop redundant timer clear in the harness + add coverage

**Files:**
- Modify: `scripts/lib/headless-engine.js`
- Test: `tests/run-context.test.js`

- [ ] **Step 1: Remove the now-redundant `clearAllTimers()` in `resetGame`**

In `scripts/lib/headless-engine.js`, `resetGame` currently calls `clearAllTimers()` then `initGame(...)`. Since `initGame` now swaps in a fresh context, the pre-clear is redundant. Remove the `clearAllTimers();` line (line ~85). Leave the `initGame(...)` call. If `clearAllTimers` becomes an unused import, remove it from the import list too.

- [ ] **Step 2: Add clean-slate + round-trip tests**

Append to `tests/run-context.test.js`:

```js
import { getState, serializeState, deserializeState, endRun } from "../js/core/state/index.js";
import { scheduleEvent } from "../js/core/timers.js";

test("a fresh run starts from a clean slate", () => {
  initGame(buildNetworkFn("clean-a"), "clean-a");
  scheduleRepeating(TIMER.TRACE_TICK, 1000);
  endRun("success");           // leaves stale-ish state on the dying context
  initGame(buildNetworkFn("clean-b"), "clean-b");
  const s = getState();
  assert.equal(s.globalAlert, "green");
  assert.equal(s.traceSecondsRemaining, null);
  assert.equal(s.phase, "playing");
  const t = serializeTimers();
  assert.equal(t.entries.filter((e) => e.type === TIMER.TRACE_TICK).length, 0);
  assert.equal(t.nextId, 1, "nextId resets with a fresh context");
});

test("save/load round-trips the per-run core", () => {
  initGame(buildNetworkFn("rt"), "rt");
  scheduleEvent(TIMER.ICE_MOVE, 2000);
  const snap = serializeState();
  // mutate after snapshot, then restore — restored state must match the snapshot.
  initGame(buildNetworkFn("other"), "other");
  deserializeState(snap);
  const after = serializeState();
  assert.equal(after.seed, snap.seed);
  assert.equal(after._timers.entries.length, snap._timers.entries.length);
  assert.deepEqual(after._timers.entries.map((e) => e.type), snap._timers.entries.map((e) => e.type));
});
```

- [ ] **Step 3: Run the full new suite**

Run: `node --test tests/run-context.test.js`
Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add scripts/lib/headless-engine.js tests/run-context.test.js
git commit -m 'harness: drop redundant timer clear; add clean-slate + round-trip tests'
```

---

### Task 6: full verification

- [ ] **Step 1: Lint + full test suite**

Run: `make check`
Expected: lint PASS, all tests PASS (including the existing integration suite — confirms delegation didn't break state access).

- [ ] **Step 2: Census smoke test (no balance regression)**

Run: `make census SEEDS=10`
Expected: completes; `successRate` / `traceFiredRate` comparable to a same-seed run on `main`. (Pure-refactor — numbers should be identical given identical seeds, since RNG behavior is unchanged.)

- [ ] **Step 3: Manual browser re-verification of the original bug**

Run `make serve`, open the game, and reproduce the original repro path with the fix in place: start a run, force a trace (`cheat alert set trace`), return to the hub via the `hub` console command (no jack-out), launch another run, and confirm via `window.__timers`/`serializeTimers()` that **no orphan `trace-tick` timer** is present in the new run, and the trace countdown runs at 1×.

- [ ] **Step 4: Update notes + final commit**

Record the outcome (tests, census comparison, manual check) in `notes.md` in this session directory, then commit.

```bash
git add docs/dev-sessions/2026-06-12-1736-run-context/notes.md
git commit -m 'Record RunContext session notes + verification results'
```
