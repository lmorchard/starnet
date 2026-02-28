# Emit Coalesce — Plan

## Overview

This plan breaks the refactor into 8 steps. Each step ends with `make check`
passing. Steps 1–3 build the new `state/` module with tests. Steps 4–7
migrate each caller file to use the new state functions and remove direct
mutations + `emit()` calls. Step 8 wires up the version-gated emit at cycle
boundaries and removes the old `emit()` infrastructure.

The key constraint: the game must work after every step. We never leave
dangling imports or broken wiring.

---

## Step 1: Create `state/index.js` — core infrastructure

**Goal:** Establish the `state/` directory with the core module: state object,
`initState`, `getState`, `mutate()`, `getVersion()`, and `emit()`. This is a
pure extract — move the state variable, init logic, `getState`, `emit`, and
serialization from `state.js` into `state/index.js`. Re-export everything from
a new `js/state.js` shim so existing imports don't break.

**What to do:**

1. Create `js/state/index.js` with:
   - The `state` variable, `initState()`, `getState()`
   - The `mutate(fn)` wrapper and `getVersion()` (new)
   - The `emit()` function (keep working as-is for now — we remove it in step 8)
   - A comment block documenting the convention: all state mutations must go
     through `mutate()`, no direct state access outside `state/`
   - `serializeState()` and `deserializeState()` (moved from state.js)

2. Replace `js/state.js` with a thin shim that re-exports everything from
   `./state/index.js`. This means zero import changes across the codebase for
   this step.

3. Update the Makefile lint target to include `js/state/index.js`. Update the
   test target glob to include `js/**/*.test.js`.

4. Create `js/state/index.test.js` with tests:
   - `initState()` creates valid state with nodes, adjacency, player
   - `getState()` returns the initialized state
   - `mutate()` increments version counter
   - `getVersion()` returns current version
   - Multiple `mutate()` calls increment monotonically

5. Run `make check` — all existing tests + new tests pass.

---

## Step 2: Create `state/node.js` — node mutations

**Goal:** Extract all node-related mutation functions from `state.js` into
`state/node.js`. These become pure data manipulation using `mutate()` — no
event emission, no `emit()` calls.

**What to do:**

1. Create `js/state/node.js` with these functions, each using `mutate()`:
   - `setNodeVisible(nodeId, visibility)` — sets `node.visibility`
   - `setNodeAccessLevel(nodeId, level)` — sets `node.accessLevel`
   - `setNodeProbed(nodeId)` — sets `node.probed = true`
   - `setNodeAlertState(nodeId, alertState)` — sets `node.alertState`
   - `setNodeRead(nodeId)` — sets `node.read = true`
   - `collectMacguffins(nodeId)` — marks uncollected macguffins as collected,
     returns `{ items: [...], total: cashValue }`
   - `setNodeLooted(nodeId)` — sets `node.looted = true`
   - `setNodeRebooting(nodeId, rebooting)` — sets `node.rebooting`
   - `setNodeEventForwarding(nodeId, disabled)` — sets `node.eventForwardingDisabled`
   - `setNodeVulnHidden(nodeId, vulnIndex, hidden)` — sets `vuln.hidden`

2. Keep the orchestration functions (`probeNode`, `readNode`, `lootNode`,
   `selectNode`, `revealNeighbors`, `accessNeighbors`, etc.) in `state.js`
   shim / `state/index.js` for now — they will be migrated to callers in
   later steps as their event emission is untangled.

   Actually: the orchestration functions that combine mutation + event emission
   should stay in the *caller layer* (combat.js, probe-exec.js, etc.) or move
   to a new orchestration location. For this step, keep them in `state/index.js`
   but refactor them internally to use the new `state/node.js` functions
   instead of direct mutation. This validates the new functions work correctly
   without changing any external API.

3. Re-export new functions from `js/state.js` shim.

4. Create `js/state/node.test.js`:
   - Each setter: call with valid nodeId → assert state changed, version bumped
   - `collectMacguffins`: returns correct items/total, marks collected
   - Invalid nodeId: graceful no-op (no crash)

5. Run `make check`.

---

## Step 3: Create `state/ice.js`, `state/alert.js`, `state/player.js`

**Goal:** Extract ICE, alert/trace, and player state mutations into their own
submodules. Same pattern as step 2: pure `mutate()` setters, no events.

**What to do:**

1. Create `js/state/ice.js`:
   - `setIceAttention(nodeId)` — sets `ice.attentionNodeId`
   - `setIceDetectedAt(nodeId)` — sets `ice.detectedAtNode` (null to clear)
   - `setIceDwellTimer(timerId)` — sets `ice.dwellTimerId`
   - `incrementIceDetectionCount()` — increments `ice.detectionCount`
   - `setIceActive(active)` — sets `ice.active`
   - `setLastDisturbedNode(nodeId)` — sets `state.lastDisturbedNodeId`

2. Create `js/state/alert.js`:
   - `setGlobalAlert(level)` — sets `state.globalAlert`
   - `setTraceCountdown(seconds)` — sets `state.traceSecondsRemaining`
   - `setTraceTimerId(timerId)` — sets `state.traceTimerId`
   - `decrementTraceCountdown()` — decrements `state.traceSecondsRemaining`,
     returns new value

3. Create `js/state/player.js`:
   - `addCash(amount)` — adds to `state.player.cash`
   - `setCash(amount)` — sets `state.player.cash`
   - `addCardToHand(card)` — pushes card to `state.player.hand`
   - `setExecutingExploit(data)` — sets `state.executingExploit` (null to clear)
   - `incrementNoiseTick()` — increments `state.executingExploit.noiseTick`
   - `setActiveProbe(data)` — sets `state.activeProbe` (null to clear)
   - `setMissionComplete()` — sets `state.mission.complete = true`

4. Create `js/state/game.js` (general game state):
   - `setSelectedNode(nodeId)` — sets `state.selectedNodeId`
   - `setPhase(phase)` — sets `state.phase`
   - `setRunOutcome(outcome)` — sets `state.runOutcome`
   - `setCheating()` — sets `state.isCheating = true`

5. Refactor orchestration functions in `state/index.js` to use these new
   submodule setters internally. No external API changes.

6. Re-export from `js/state.js` shim.

7. Create co-located test files:
   - `js/state/ice.test.js`
   - `js/state/alert.test.js`
   - `js/state/player.test.js`
   - `js/state/game.test.js`
   Each: init state, call setter, assert field changed + version bumped.

8. Run `make check`.

---

## Step 4: Migrate `js/combat.js` — remove direct mutations

**Goal:** `combat.js` calls state submodule functions instead of reaching into
state directly. Remove its `emit()` calls.

**What to do:**

1. In `launchExploit()`:
   - Replace `exploit.usesRemaining -= 1` etc. with player-hand mutation
     functions. (Note: exploit card decay mutates objects in the hand array.
     We may need a `updateCard(cardId, updates)` or the existing card object
     reference is fine since `mutate()` just bumps version.)
   - Actually: the card objects live inside `state.player.hand`. The cleanest
     approach is to add `applyCardDecay(cardId, usesRemaining, decayState)`
     to `state/player.js`.
   - Replace `node.accessLevel = "compromised"` → `setNodeAccessLevel(nodeId, "compromised")`
   - Replace `node.alertState = "green"` → `setNodeAlertState(nodeId, "green")`
   - Replace `node.visibility = "accessible"` → `setNodeVisible(nodeId, "accessible")`
   - Replace `v.hidden = false` → `setNodeVulnHidden(nodeId, idx, false)`
   - Replace `state.lastDisturbedNodeId = ...` → `setLastDisturbedNode(...)`
   - Keep all `emitEvent()` calls for game events (E.EXPLOIT_SUCCESS, etc.)
   - Remove all `emit()` calls

2. Verify `applyCardDecay` helper still works — it operates on a card
   reference. Move the actual mutation into a state function.

3. Run `make check`.

---

## Step 5: Migrate `js/ice.js` and `js/alert.js` — remove direct mutations

**Goal:** These two files have the most direct state mutations outside
`state.js`. Replace them all with state submodule calls.

**What to do:**

1. In `js/ice.js`:
   - `handleIceDeparture()`: replace `s.ice.detectedAtNode = null` →
     `setIceDetectedAt(null)`, remove `emit()`
   - `on(E.EXPLOIT_NOISE)`: replace `s.lastDisturbedNodeId = nodeId` →
     `setLastDisturbedNode(nodeId)`, remove `emit()`
   - `on(E.PLAYER_NAVIGATED)`: replace `s.ice.detectedAtNode = null` →
     `setIceDetectedAt(null)`
   - `checkIceDetection()`: replace `s.ice.dwellTimerId = timerId` →
     `setIceDwellTimer(timerId)`, remove `emit()`
   - `teleportIce()`: replace `s.ice.detectedAtNode = null` →
     `setIceDetectedAt(null)`
   - `handleIceTick()`: replace `s.lastDisturbedNodeId = null` →
     `setLastDisturbedNode(null)`
   - Remove all `emit()` calls

2. In `js/alert.js`:
   - `recomputeGlobalAlert()`: replace `s.globalAlert = newLevel` →
     `setGlobalAlert(newLevel)`, remove `emit()`
   - `raiseGlobalAlert()`: replace `s.globalAlert = ...` →
     `setGlobalAlert(...)`, remove `emit()`
   - `startTraceCountdown()`: replace `s.traceSecondsRemaining = 60`,
     `s.traceTimerId = ...` → `setTraceCountdown(60)`,
     `setTraceTimerId(timerId)`, remove `emit()`
   - `handleTraceTick()`: replace `s.traceSecondsRemaining -= 1` →
     `decrementTraceCountdown()`, remove `emit()`
   - `cancelTraceCountdown()`: replace direct mutations →
     `setTraceTimerId(null)`, `setTraceCountdown(null)`,
     `setGlobalAlert("green")`, remove `emit()`
   - `forceGlobalAlert()`: replace → `setGlobalAlert(level)`, remove `emit()`
   - `recordIceDetection()`: replace `s.ice.detectedAtNode = nodeId`,
     `s.ice.detectionCount++` → `setIceDetectedAt(nodeId)`,
     `incrementIceDetectionCount()`, replace `s.globalAlert` mutations →
     `setGlobalAlert(...)`, remove `emit()`
   - Remove all `emit()` calls

3. Run `make check`.

---

## Step 6: Migrate `js/exploit-exec.js`, `js/probe-exec.js`, `js/cheats.js`

**Goal:** Replace remaining direct mutations in these files.

**What to do:**

1. In `js/exploit-exec.js`:
   - `startExploit()`: replace `s.executingExploit = {...}` →
     `setExecutingExploit({...})`, remove `emit()`
   - `cancelExploit()`: replace `s.executingExploit = null` →
     `setExecutingExploit(null)`, remove `emit()`
   - `handleExploitExecTimer()`: replace `s.executingExploit = null` →
     `setExecutingExploit(null)`
   - `handleExploitNoiseTimer()`: replace `s.executingExploit.noiseTick++` →
     `incrementNoiseTick()`
   - Remove all `emit()` calls

2. In `js/probe-exec.js`:
   - `startProbe()`: replace `state.lastDisturbedNodeId = nodeId` →
     `setLastDisturbedNode(nodeId)`, replace `state.activeProbe = {...}` →
     `setActiveProbe({...})`, remove `emit()`
   - `cancelProbe()`: replace `state.activeProbe = null` →
     `setActiveProbe(null)`, remove `emit()`
   - `handleProbeScanTimer()`: replace `state.activeProbe = null` →
     `setActiveProbe(null)`
   - Remove all `emit()` calls

3. In `js/cheats.js`:
   - `cheatOwn()`: replace `node.accessLevel = "owned"` etc. →
     `setNodeAccessLevel()`, `setNodeAlertState()`, `setNodeVisible()`
   - `cheatGive("matching"/"card")`: replace `s.player.hand.push(card)` →
     `addCardToHand(card)`, replace card restoration → `applyCardDecay()`
   - `cheatGive("cash")`: replace `s.player.cash += amount` → `addCash(amount)`
   - `activateCheat()`: already calls `setCheating()`, just remove `emit()`
   - Remove all `emit()` calls

4. Run `make check`.

---

## Step 7: Collapse orchestration into callers, clean up `state/index.js`

**Goal:** The orchestration functions that still live in `state/index.js`
(probeNode, readNode, lootNode, selectNode, endRun, etc.) mix mutation +
event emission. Split them: pure mutations stay in state submodules,
orchestration + events move to callers.

**What to do:**

1. Move event-emitting orchestration out of `state/index.js`:
   - `probeNode()` → inline into `probe-exec.js` `handleProbeScanTimer()`.
     It becomes: call `setNodeProbed()`, `setLastDisturbedNode()`, read alert
     state, call `setNodeAlertState()` if needed, emit `E.NODE_PROBED` +
     `E.NODE_ALERT_RAISED`.
   - `readNode()` → inline into action execute handler or keep as a
     thin orchestrator in a suitable caller.
   - `lootNode()` → same pattern: decompose into `collectMacguffins()` +
     `setNodeLooted()` + `addCash()` + event emission.
   - `selectNode()` → the traversal logic (revealed→accessible) moves into
     `navigation.js` as orchestration.
   - `endRun()` → keep as a high-level function, but in `state/game.js`
     for the pure mutations (`setPhase`, `setRunOutcome`, `setCash`,
     `setIceActive`), with event emission in the caller.
   - `rebootNode()` → decompose: `setNodeRebooting()` + timer scheduling +
     event emission in caller.
   - `ejectIce()` → decompose: `setIceAttention(randomNeighbor)` +
     event emission in caller.
   - `raiseNodeAlert()` → already in `state/node.js` as `setNodeAlertState()`,
     the escalation logic (indexOf + increment) moves to the caller.

2. `state/index.js` should now only contain:
   - `initState()` (state construction — no event emission)
   - `getState()`, `mutate()`, `getVersion()`
   - `emit()` (still present, removed in step 8)
   - `isIceVisible()` (pure helper, no mutation)
   - Re-exports from submodules

3. Move `initState()` event emissions (`E.RUN_STARTED`, `E.MISSION_STARTED`,
   `E.NODE_REVEALED`) to the caller (`main.js` and `playtest.js`), or keep
   them in `initState()` for now since initialization is a special case.
   Preference: keep in `initState()` — it's called once and the events are
   part of the init contract.

4. Update `js/state.js` shim to re-export any newly exposed functions.

5. Update existing integration tests if import paths changed.

6. Run `make check`.

---

## Step 8: Version-gated emit at cycle boundaries

**Goal:** Remove `emit()` from `state/index.js`. Wire up version-gated
`STATE_CHANGED` emission at the end of `tick()` and after action dispatch.
This is the payoff — no more scattered `emit()` calls anywhere.

**What to do:**

1. In `js/timers.js`:
   - Import `getVersion`, `getState` from `./state/index.js` and
     `emitEvent`, `E` from `./events.js`
   - At end of `tick()`, after all timers have fired:
     ```js
     const before = getVersion();
     // ... existing timer firing loop ...
     if (getVersion() !== before) {
       emitEvent(E.STATE_CHANGED, getState());
     }
     ```
   - Actually: capture `before` *above* the loop, check *after* the loop.

2. In `js/action-context.js`:
   - Import `getVersion`, `getState` from state module
   - Wrap `action.execute()` with version check:
     ```js
     const before = getVersion();
     action.execute(node, state, ctx, { nodeId, ...payload });
     if (getVersion() !== before) {
       emitEvent(E.STATE_CHANGED, getState());
     }
     ```

3. In `state/index.js`:
   - Remove `emit()` function entirely
   - Remove `emit()` from `initState()` — the caller (`main.js` /
     `playtest.js`) should emit `STATE_CHANGED` after init if needed, or
     `initState()` can call `emitEvent(E.STATE_CHANGED, state)` directly
     as a one-time special case.
   - Remove `emit` from all exports and the `js/state.js` shim.

4. Remove any remaining `emit()` imports across the codebase. Grep for
   `emit()` — should find zero hits outside of `emitEvent()`.

5. Update `CLAUDE.md`:
   - Add state mutation convention documentation
   - Document that `STATE_CHANGED` fires at cycle boundaries only

6. Update `js/state/index.js` comment block with the full convention.

7. Run `make check`.

8. Run playtest harness: `reset` → full game flow → verify.

9. Browser playtest: visual verification.

10. Grep audit: `grep -rn 'emit()' js/` — should return zero results
    (only `emitEvent()` calls remain).

---

## Risk Notes

- **Step 7 is the largest and riskiest.** Moving orchestration out of
  `state/index.js` into callers touches many files simultaneously. If this
  proves too large, it can be split: do one orchestration function at a time
  (probeNode first, then readNode, etc.), running `make check` after each.

- **Event ordering.** Currently some event handlers trigger other events
  synchronously (e.g., `NODE_ALERT_RAISED` triggers `recomputeGlobalAlert`
  which may emit `ALERT_GLOBAL_RAISED`). This cascading still works fine
  with version-gated emit — all cascades complete within the same tick, and
  `STATE_CHANGED` fires once at the end.

- **`initState()` is a special case.** It happens outside the tick/action
  cycle. It should emit `STATE_CHANGED` directly after construction, or
  the caller should. Either way, it's a one-time call.

- **Playtest harness** (`scripts/playtest.js`) is a parallel entry point
  that wires timers the same way as `main.js`. Its tick/action cycle must
  also get the version-gated emit. Ensure both entry points are updated
  in step 8.
