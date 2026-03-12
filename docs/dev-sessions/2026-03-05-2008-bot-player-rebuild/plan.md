# Plan: Bot Player Rebuild

## Overview

8 phases, each building on the previous. The shared headless engine comes
first (prerequisite for everything), then the bot modules bottom-up
(types → perception → scoring → execute → strategies → loop → run), and
finally integration testing and playtest harness refactor.

---

## Phase 1: Shared Headless Engine Module

**Goal:** Extract common init plumbing from `scripts/playtest.js` into a
reusable module that any headless tool can import.

**Create `scripts/lib/headless-engine.js`:**
- Export `initHeadlessEngine(buildNetworkFn, opts)` that:
  - Wires timer handlers (ICE_MOVE, ICE_DETECT, TRACE_TICK)
  - Builds ActionContext via `buildActionContext()`
  - Calls `initActionDispatcher(ctx)`
  - Returns `{ ctx }` for the caller to extend
- Export `resetGame(buildNetworkFn, seed)` that:
  - Calls `initGame(buildNetworkFn, seed)`
  - Calls `initGraphBridge()`
  - Calls `initDynamicActions()`
  - Calls `startIce()`
  - Returns `getState()`
- Import all the modules that `playtest.js` currently imports for wiring
  (ice.js handlers, alert.js handlers, timers, graph-bridge, dynamic-actions)

**Do NOT refactor playtest.js yet** — just extract. Playtest refactor is
Phase 8 after the bot is working, so we have a known-good reference during
development.

**Test:** Import the module in a throwaway script, call `initHeadlessEngine`
+ `resetGame`, verify a game initializes and `tick()` advances state.

---

## Phase 2: Bot Types and Stats

**Goal:** Define the data shapes the bot modules pass around.

**Create `scripts/bot/types.js`:**
- `WorldModel` typedef — the perception snapshot:
  - `nodes`: categorized node lists (accessible, owned, needsProbe,
    needsExploit, lootable, security, hasDisarmActions)
  - `adjacency`: graph edges for BFS
  - `ice`: `{ nodeId, lastSeenNodeId, isOnSelectedNode, isActive }`
  - `player`: `{ selectedNodeId, cash, alertLevel, traceActive,
    traceCountdown }`
  - `hand`: cards with `{ id, name, vulnType, quality, usesLeft,
    matchesForNode: Map<nodeId, boolean> }`
  - `availableActions`: `Map<nodeId, ActionDef[]>`
  - `mission`: `{ targetNodeId, targetName, found, looted }`
  - `gamePhase`: "playing" | "ended"
  - `ticks`: current tick count
- `ScoredAction` typedef:
  - `action`: string (action ID)
  - `nodeId`: string | null
  - `score`: number
  - `reason`: string
  - `payload`: object (optional, e.g. `{ exploitId }`)
- `Strategy` typedef: `(world: WorldModel) => ScoredAction[]`
- `BotRunStats` typedef — outcome + metrics:
  - `success`: boolean
  - `failReason`: string | null
  - `ticksElapsed`: number
  - `nodesOwned`: number
  - `nodesTotal`: number
  - `cardsUsed`: number
  - `cardsBurned`: number
  - `storeVisits`: number
  - `cashSpent`: number
  - `cashRemaining`: number
  - `peakAlert`: string
  - `traceFired`: boolean
  - `iceDetections`: number
  - `iceEvasions`: number
  - `disarmActionsUsed`: number
  - `strategyCounts`: `Record<string, number>` (strategy name → times chosen)

**Create `scripts/bot/stats.js`:**
- Export `createStats()` — returns a fresh stats object with zeroed counters
- Export `recordAction(stats, scoredAction)` — increments relevant counters
- Export `finalizeStats(stats, state)` — fills in end-of-run values
  (nodesOwned, cashRemaining, etc.)

**Test:** Unit tests for stats creation and recording.

---

## Phase 3: Perception Layer

**Goal:** Build the world model from game state.

**Create `scripts/bot/perception.js`:**
- Export `perceive(getState, getAvailableActions) → WorldModel`
- Reads `state.nodes`, `state.adjacency`, `state.ice`, `state.player`,
  `state.mission`, `state.globalAlert`, `state.traceSecondsRemaining`
- Categorizes nodes by walking `state.nodes`:
  - `accessible`: visible, not owned, not WAN
  - `owned`: accessLevel === "owned"
  - `needsProbe`: accessible + not probed
  - `needsExploit`: accessible + probed + not owned
  - `lootable`: owned + (not read, or has uncollected macguffins)
  - `security`: type is "ids" or "security-monitor"
  - `hasDisarmActions`: owned nodes where `getAvailableActions()` returns
    actions with IDs matching `/^disarm/`
- Builds card-to-node match map: for each card in hand, for each node with
  vulns, does the card's vulnType match any vuln?
- Exposes BFS helper: `shortestPath(fromNodeId, toNodeId)` using adjacency
  through owned/accessible nodes

**Test:** Build a minimal game state fixture, run `perceive()`, verify
node categorization and card matching.

---

## Phase 4: Scoring Engine

**Goal:** Collect proposals from strategies, pick the winner.

**Create `scripts/bot/scoring.js`:**
- Export `score(world, strategies) → ScoredAction | null`
- Runs each strategy function, collects all returned `ScoredAction[]` into
  a flat array
- Sorts by `score` descending
- Returns the top result, or null if no proposals
- For debugging: optionally log all proposals (controlled by a `verbose` flag)

This module is tiny — it's the glue between perception and strategies.

**Test:** Mock strategies that return fixed proposals, verify winner selection
and null handling.

---

## Phase 5: Execute Layer

**Goal:** Dispatch actions and tick the game forward.

**Create `scripts/bot/execute.js`:**
- Export `execute(choice, world, opts) → { completed, interrupted }`
- Handles two action categories:
  1. **Instant actions** (select, deselect, reconfigure, disarm-*, eject,
     jackout, cancel-*, buy): dispatch via `emitEvent("starnet:action", ...)`
     and return immediately
  2. **Timed actions** (probe, exploit, read, loot, reboot): dispatch the
     start event, then tick forward incrementally until an `ACTION_RESOLVED`
     or `ACTION_FEEDBACK` cancel event fires for this node+action
- Timed action tick loop:
  - Register temporary event listeners for ACTION_RESOLVED, ACTION_FEEDBACK
    (cancel), ICE_MOVED, RUN_ENDED
  - Tick 1 at a time
  - Between ticks, check:
    - Did the action resolve? → return `{ completed: true }`
    - Did ICE arrive at player's node? → return `{ interrupted: true }`
      (the main loop will re-score)
    - Did the run end (trace caught)? → return `{ completed: true }`
  - Tick budget cap (e.g. 500 per action) to prevent infinite loops
  - Clean up temporary listeners on exit
- The execute layer also needs to handle navigation: if the target node
  isn't currently selected, dispatch a `select` action first

**Test:** Init a game, dispatch probe via execute, verify it ticks to
completion. Test ICE interruption with a mock ICE_MOVED event.

---

## Phase 6: Strategy Heuristics

**Goal:** Implement the 6 strategy functions. Each in its own file.

### `scripts/bot/heuristics/explore.js`
- Proposes `select` + `probe` for unprobed accessible nodes
- Proposes `exploit` for probed unowned nodes (with best matching card)
- Card selection: prefer exact vuln match, then highest quality, then most
  uses remaining. Include `exploitId` in payload.
- Score: base 50, +10 for mission-relevant path, -5 per BFS hop distance
- If no cards match any visible vuln, propose nothing (cards.js handles store)

### `scripts/bot/heuristics/loot.js`
- Proposes `read` for owned unread nodes
- Proposes `loot` for owned read nodes with macguffins
- Score: base 60, +20 if node contains mission target macguffin
- Prefer closer nodes (BFS distance penalty)

### `scripts/bot/heuristics/security.js`
- Proposes `exploit` (then `reconfigure`) for IDS nodes not yet subverted
- Proposes `cancel-trace` for owned security monitors when trace is active
- Score: reconfigure = 70, cancel-trace = 900 (emergency)

### `scripts/bot/heuristics/traps.js`
- Scans owned nodes for available disarm actions (action ID matches `/^disarm/`)
- Proposes the disarm action
- Score: 65 (higher than explore, lower than security — disarm before
  pushing deeper)

### `scripts/bot/heuristics/evasion.js`
- When ICE is on the player's selected node:
  - Proposes `cancel-probe` / `cancel-exploit` + `deselect` with score 800
- When ICE is on an adjacent node (one hop away):
  - Lowers scores of actions at the player's current node (return negative
    score modifier? or just propose `deselect` at score 40)
- After any timed action completes: proposes `deselect` at low score (15)
  to clear presence
- Note: evasion's mid-action cancel is handled by the execute layer's
  interrupt mechanism, not by this heuristic. This heuristic handles the
  decision at the top of the loop.

### `scripts/bot/heuristics/cards.js`
- When hand has no cards matching any visible node's vulns:
  - Proposes navigating to WAN node + `access-darknet` (store visit)
  - Score: 55
- When hand is completely empty:
  - If can't afford store: triggers jackout proposal (score 10)

**Test:** For each heuristic, build a targeted world model fixture and
verify the proposals (action IDs, scores, reasons). These are pure
functions — easy to test in isolation.

---

## Phase 7: Main Loop and Run Entry Point

**Goal:** Wire everything together into a runnable bot.

### `scripts/bot/loop.js`
- Export `runLoop(engine, strategies, opts) → BotRunStats`
- The core loop:
  ```
  while (state.phase === "playing") {
    world = perceive(...)
    choice = score(world, strategies)
    if (!choice) { jackout; break }
    recordAction(stats, choice)
    result = execute(choice, world)
    if (result.interrupted) {
      // ICE arrived mid-action — re-score immediately
      world = perceive(...)
      choice = score(world, strategies)
      if (choice) execute(choice, world)
    }
    if (tickBudget exceeded) break
  }
  ```
- Tick budget: 5000 ticks total per run
- On exit: finalize stats, return them

### `scripts/bot/run.js`
- Export `runBot(buildNetworkFn, opts) → BotRunStats`
- `opts`: `{ seed, strategies, tickBudget, verbose }`
- Calls `initHeadlessEngine()` + `resetGame()`
- Assembles default strategy set (all 6 heuristics)
- Calls `runLoop()`
- Returns stats

### CLI entry point: `scripts/bot/cli.js`
- Parses args: `--network`, `--seed`, `--verbose`
- Imports network builder, calls `runBot()`, prints stats as JSON
- Usage: `node scripts/bot/cli.js --network corporate-foothold --seed test-1`

**Test:** Run the bot against corporate-foothold with a fixed seed. Verify:
- Bot completes (doesn't hang or infinite loop)
- Stats are populated
- Deterministic: same seed → same stats

---

## Phase 8: Playtest Harness Refactor + Cleanup

**Goal:** Refactor `scripts/playtest.js` to use the shared headless engine.
Update Makefile. Clean up.

**Refactor `scripts/playtest.js`:**
- Replace inline init code with `initHeadlessEngine()` + `resetGame()`
- Keep all playtest-specific logic (command dispatch, state file persistence,
  event→output formatting, --piece/--graph flags)
- The external CLI interface stays identical

**Update Makefile:**
- Update `bot-census` target (or remove it, since census is a future session)
- Add `bot-run` target: `node scripts/bot/cli.js --network corporate-foothold`
- Verify `make test` still excludes bot tests if needed, or includes them

**Verify:**
- `node scripts/playtest.js reset` still works
- `node scripts/playtest.js "status"` still works
- `node scripts/bot/cli.js --network corporate-foothold --seed test-1` works
- `make check` passes

---

## Execution Order Summary

| Phase | Module | Depends On | Key Output |
|-------|--------|-----------|------------|
| 1 | headless-engine.js | — | Shared init plumbing |
| 2 | types.js, stats.js | — | Data shapes |
| 3 | perception.js | types | World model builder |
| 4 | scoring.js | types | Strategy aggregator |
| 5 | execute.js | headless-engine | Action dispatch + tick loop |
| 6 | heuristics/*.js | types, perception | 6 strategy functions |
| 7 | loop.js, run.js, cli.js | all above | Working bot |
| 8 | playtest.js refactor | headless-engine | Cleanup |

Phases 2-4 can be developed in parallel (no dependencies between them).
Phase 5 depends on Phase 1. Phase 6 depends on Phases 2-3. Phase 7 wires
everything. Phase 8 is cleanup.
