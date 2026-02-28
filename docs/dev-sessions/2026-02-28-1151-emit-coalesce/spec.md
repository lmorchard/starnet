# Emit Coalesce — Spec

## Problem

Two related architectural issues cause stale-UI bugs and make the codebase fragile:

1. **Scattered `emit()` calls.** 40+ manual `emit()` calls across 7 files. Each
   state-mutating function must remember to call `emit()` to trigger
   `STATE_CHANGED` and re-render the UI. Forgetting one causes the sidebar,
   HUD, or graph to show stale data. We've hit this bug class at least twice
   (most recently: `handleIceDeparture` cancelling a timer without emitting).

2. **Direct state mutation outside `state.js`.** Files like `ice.js`, `alert.js`,
   and `combat.js` reach into the state object directly (e.g.,
   `s.ice.detectedAtNode = null`, `s.globalAlert = "trace"`). This means those
   files also carry the burden of calling `emit()`, and there's no enforcement
   that mutations go through a controlled path.

## Solution

### 1. Break `state.js` into a `state/` module directory

The current monolithic `state.js` (~470 lines) becomes a directory of focused
submodules, each owning its slice of the state tree:

```
js/state/
  index.js        — state object, initState, getState, mutate(), version counter
  node.js         — node mutations (access, reveal, alert, probe, read, loot, reboot)
  ice.js          — ICE state (attention, dwell, detection, disturbance)
  alert.js        — global alert, trace countdown
  player.js       — hand, wallet, executing exploit state
  serialize.js    — save/restore for playtest harness
```

The central state object stays unified — one plain object. Mutation
responsibility is distributed across submodules that each own a coherent
slice.

### 2. `mutate()` wrapper with monotonic version counter

All state changes go through a `mutate(fn)` wrapper exported from
`state/index.js`:

```js
let version = 0;

export function mutate(fn) {
  fn(state);
  version++;
  return state;
}

export function getVersion() {
  return version;
}
```

Every mutation function in every submodule uses `mutate()`. This guarantees the
version counter increments on every state change — no manual `bumpVersion()`
calls to forget.

### 3. Mutation functions are minimal — no event emission

State submodules are pure data manipulation. They do not:

- Emit game events (`E.NODE_PROBED`, `E.ICE_DETECTED`, etc.)
- Call `emit()` / `emitEvent(E.STATE_CHANGED, ...)`
- Contain orchestration logic (e.g., "probe raises alert")

This makes them trivially testable: call function, assert state changed. No
event bus, no timers, no DOM.

Orchestration logic and event emission stay in the caller layer — the existing
`ice.js`, `alert.js`, `combat.js`, `probe-exec.js`, `exploit-exec.js`, etc.
These files call state mutation functions, read state before/after to determine
what changed, and emit the appropriate game events.

This separation also enables future gameplay features (e.g., a deck upgrade
that makes probes not raise alerts) without modifying the state layer.

### 4. `STATE_CHANGED` fires only at cycle boundaries

Remove all 40+ scattered `emit()` calls. `STATE_CHANGED` is emitted in exactly
two places, gated by the version counter:

- **End of `tick()`** in `timers.js` — after all timer events have fired
- **After `action.execute()`** in `initActionDispatcher` — after user actions

Pattern:

```js
const before = getVersion();
// ...fire timers / execute action...
if (getVersion() !== before) {
  emitEvent(E.STATE_CHANGED, getState());
}
```

At 100ms tick intervals, the one-render-per-cycle guarantee is imperceptible.
Changes caused within a tick are reflected in the UI at the end of that same
tick (same synchronous call stack), not the next one.

### 5. Convention: no direct state mutation outside `state/`

Enforced by documentation, not runtime checks:

- `CLAUDE.md` updated with the rule
- `state/index.js` has a comment block explaining the convention
- `getState()` returns the raw object (no freeze/proxy overhead)
- Violations caught during code review / grep

### 6. Co-located tests

Each state submodule gets a test file alongside it:

```
js/state/node.js       → js/state/node.test.js
js/state/ice.js        → js/state/ice.test.js
js/state/alert.js      → js/state/alert.test.js
js/state/player.js     → js/state/player.test.js
js/state/serialize.js  → js/state/serialize.test.js
```

Tests are pure: `initState()` with a minimal network fixture, call mutation
functions, assert state. No event bus, no DOM, no timers.

Makefile test target updated to find co-located tests:

```makefile
test:
	node --test 'tests/**/*.test.js' 'js/**/*.test.js'
```

Existing integration tests in `tests/integration.test.js` continue covering
the orchestration layer (event emission, timer interactions, end-to-end flows).

## Files affected

### New files
- `js/state/index.js` — core: state object, `initState`, `getState`, `mutate`, `getVersion`
- `js/state/node.js` — node state mutations
- `js/state/ice.js` — ICE state mutations
- `js/state/alert.js` — global alert / trace mutations
- `js/state/player.js` — hand / wallet / exploit execution mutations
- `js/state/serialize.js` — state serialization/deserialization
- `js/state/*.test.js` — co-located tests for each submodule

### Modified files
- `js/state.js` — deleted (replaced by `js/state/` directory)
- `js/ice.js` — replace direct mutations with state function calls, remove `emit()`
- `js/alert.js` — replace direct mutations with state function calls, remove `emit()`
- `js/combat.js` — replace direct mutations with state function calls, remove `emit()`
- `js/exploit-exec.js` — replace direct mutations with state function calls, remove `emit()`
- `js/probe-exec.js` — replace direct mutations with state function calls, remove `emit()`
- `js/cheats.js` — replace direct mutations with state function calls, remove `emit()`
- `js/timers.js` — add version-gated `STATE_CHANGED` emit at end of `tick()`
- `js/action-context.js` — add version-gated `STATE_CHANGED` emit after action dispatch
- `js/main.js` — update imports from `state.js` → `state/index.js`
- `js/visual-renderer.js` — update imports
- `js/console.js` — update imports
- `js/log-renderer.js` — update imports
- `js/store.js` — update imports
- `scripts/playtest.js` — update imports
- `CLAUDE.md` — document the "no direct mutation" convention
- `Makefile` — update test glob

## Verification

1. `make check` — lint + all tests pass (existing integration + new state unit tests)
2. Playtest harness: `reset` → `probe` → `exploit` → `tick` → `status` works correctly
3. Browser playtest: full run through probe → exploit → ICE encounter → jackout
4. Grep for direct state mutations outside `state/`: should find none
5. Version counter increments correctly (testable via `getVersion()`)
