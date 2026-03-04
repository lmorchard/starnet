# Plan: Node Graph Integration

## Overview

Replace the game's node-type registry, `state/node.js` setters, and procgen with
`NodeGraph` as the authoritative source of node state and behavior. Built incrementally
across 10 phases, each ending with tests passing and `make check` green.

**Estimated scope:** Large session. Phases 1-4 are standalone buildable pieces. Phase 5
is the big coordinated swap. Phases 6-10 are cleanup and polish.

## Key Design Decisions

### 1. Global action filters stay in the dispatcher

NodeDef actions define **node-local** `requires` only (accessLevel, probed, visibility,
rebooting). The dispatcher wrapper adds **global state checks** (no concurrent timed
actions, game phase, etc.) as a filter layer. This keeps NodeDefs pure and testable
while preserving the current game's "one timed action at a time" constraint.

### 2. Timer-based actions delegate to ctx

Probe/exploit/read/loot are complex multi-step processes with timers and animations.
NodeDef actions for these have `ctx-call` effects that invoke the existing timed action
infrastructure (probe-exec.js, exploit-exec.js, etc.). The timer system stays as-is.

### 3. NodeGraph gets a `setNodeAttr()` public method

Game code (timer handlers, probe/exploit resolution, ICE movement) needs to mutate node
state. Rather than modeling every state change as a graph action or message, we add a
direct `setNodeAttr(nodeId, attr, value)` method that mutates and emits
`NODE_STATE_CHANGED`.

### 4. NodeGraph gets `init()` method

Dispatches `{ type: 'init' }` to all nodes after construction. Init-time setup
(macguffin assignment, vuln generation, initial visibility) happens via operators and
ctx callbacks during this phase.

### 5. Argument resolution in ctx-call effects

`ctx-call` effects support `"$nodeId"` as a placeholder in `args` arrays, resolved to
the current target node at execution time. This lets NodeDef actions call
`ctx.startProbe("$nodeId")` without hardcoding node IDs.

### 6. Shared action templates

Common actions (probe, exploit, read, loot, cancel-*, eject, reboot) are defined once
as reusable action template objects. Node type factories compose the subset appropriate
for each type. Type-specific actions (reconfigure, cancel-trace, access-darknet) are
defined inline in their respective factory.

### 7. Network definitions replace both static and procgen

`data/network.js` (static) and `network-gen.js` (procgen) are both replaced by
hand-crafted network definitions built from set-piece instances and node type factories.
Networks are plain data modules exporting `{ nodes, edges, triggers }` compatible with
the `NodeGraph` constructor.

---

## Phase 1: Runtime Extensions

**Goal:** Extend `NodeGraph` with the public API surface needed for game integration.

**Builds on:** Existing node-graph runtime (568 tests green).

**After this phase:** NodeGraph has `setNodeAttr()`, `init()`, event emission hooks,
and `$nodeId` arg resolution. All existing tests still pass, new tests cover the
extensions.

### Prompt

Extend the `NodeGraph` runtime in `js/core/node-graph/` with three additions:

**1. `setNodeAttr(nodeId, attr, value)` public method in `runtime.js`:**
- Directly sets a node attribute (bypasses operators)
- Emits `NODE_STATE_CHANGED` event via the event callback (see below)
- Throws if nodeId not found

**2. `init()` method in `runtime.js`:**
- Sends `{ type: 'init' }` message to every node in the graph
- Called once after construction, before any tick or action
- Operators can react to init messages (e.g., a `flag` operator on `"init"` can set
  initial attributes; a `ctx-call` effect in a trigger can spawn ICE)
- Evaluates triggers after all init messages delivered

**3. Event emission callback:**
- Constructor accepts an optional `onEvent` callback: `(eventType, payload) => void`
- Called on:
  - Any attribute mutation (from operators, effects, actions, or `setNodeAttr`):
    `onEvent('node-state-changed', { nodeId, attr, value, previous })`
  - Message delivery to a node:
    `onEvent('message-delivered', { nodeId, message })`
  - Quality change:
    `onEvent('quality-changed', { name, value, previous })`
- Default: no-op (backward compatible)
- The event callback is NOT serialized in snapshots — it's re-injected on restore
  via an optional parameter to `fromSnapshot()`

**4. `$nodeId` placeholder in ctx-call effect args:**
- In `effects.js`, when processing `ctx-call`, map args through a resolver:
  `(effect.args ?? []).map(a => a === '$nodeId' ? targetNodeId : a)`
- This lets action defs reference their target node without hardcoding IDs

**5. Re-export `onEvent` in snapshot round-trip:**
- `fromSnapshot(data, ctx, onEvent)` — accepts onEvent alongside ctx
- Existing `fromSnapshot(data, ctx)` signature remains valid (onEvent optional)

Write tests for all new functionality. Run `make check` at the end.

---

## Phase 2: Shared Action Templates + Node Type Factories

**Goal:** Define the 8 game node types as NodeDef factory functions with shared action
templates.

**Builds on:** Phase 1 (runtime extensions).

**After this phase:** `js/core/node-graph/game-types.js` exports factory functions for
all 8 types. Each produces a valid `NodeDef`. Tests verify action requires and effects.

### Prompt

Create `js/core/node-graph/game-types.js` with:

**1. Shared action templates** — reusable action objects for common player actions:

```
PROBE_ACTION:
  requires: accessLevel === "locked", probed === false, rebooting === false
  effects: ctx-call("startProbe", "$nodeId")

CANCEL_PROBE_ACTION:
  requires: probing === true  (node-local flag set by startProbe)
  effects: ctx-call("cancelProbe")

EXPLOIT_ACTION:
  requires: visibility === "accessible", rebooting === false
  effects: ctx-call("startExploit", "$nodeId")
  (note: exploitId passed as payload — see design note below)

CANCEL_EXPLOIT_ACTION:
  requires: exploiting === true
  effects: ctx-call("cancelExploit")

READ_ACTION:
  requires: accessLevel in ["compromised", "owned"] (use any-of), read === false, rebooting === false
  effects: ctx-call("startRead", "$nodeId")

CANCEL_READ_ACTION:
  requires: reading === true
  effects: ctx-call("cancelRead")

LOOT_ACTION:
  requires: accessLevel === "owned", read === true, rebooting === false, looted === false
  effects: ctx-call("startLoot", "$nodeId")

CANCEL_LOOT_ACTION:
  requires: looting === true
  effects: ctx-call("cancelLoot")

EJECT_ACTION:
  requires: accessLevel === "owned"
  effects: ctx-call("ejectIce")

REBOOT_ACTION:
  requires: accessLevel === "owned", rebooting === false
  effects: ctx-call("rebootNode", "$nodeId")
```

**Design note on exploit payload:** The exploit action needs an `exploitId` (card
selection). The node-graph action system doesn't natively pass payloads. Two options:
(a) the dispatcher extracts `exploitId` from the event payload and calls
`ctx.startExploit(nodeId, exploitId)` directly, bypassing graph.executeAction for
exploit; or (b) add a `payload` passthrough to `executeAction`. Prefer (a) for
simplicity — exploit is the only action with extra payload. Document this in the
action template as a comment.

**2. Node type factory functions:**

Each factory takes `(id, config?)` and returns a `NodeDef`:

- `createGateway(id, config)` — no operators. Actions: probe, exploit.
  Default attributes: `{ visibility: "accessible", accessLevel: "locked", ... }`

- `createRouter(id, config)` — `relay` operator (broadcasts non-tick messages).
  Actions: probe, exploit, reboot.

- `createIDS(id, config)` — `relay(filter: "alert")` + `flag(on: "alert", attr: "alerted")`.
  Actions: probe, exploit, reconfigure (requires owned, effects: set-attr
  forwardingEnabled=false + ctx-call reconfigureNode). Also cancel-probe, cancel-exploit.

- `createSecurityMonitor(id, config)` — `flag(on: "alert", attr: "alerted")`.
  Actions: probe, exploit, cancel-trace (requires owned, effects: ctx-call cancelTrace).

- `createFileserver(id, config)` — no operators. Actions: probe, exploit, read, loot.
  Attributes include `macguffins: []` (populated at init by ctx callback).

- `createCryptovault(id, config)` — no operators. Actions: probe, exploit, read, loot
  (loot additionally requires a quality-gte condition for decryption keys or similar).
  Higher default grade.

- `createFirewall(id, config)` — no operators. Actions: probe, exploit. Higher default
  grade. `gateAccess: "owned"` as metadata.

- `createWAN(id, config)` — no operators. Actions: probe, exploit, access-darknet
  (requires owned, effects: ctx-call openDarknetsStore).

**Common factory pattern:**

```javascript
function createGateway(id, config = {}) {
  return {
    id,
    type: "gateway",
    attributes: {
      label: config.label || id,
      grade: config.grade || "D",
      visibility: "hidden",
      accessLevel: "locked",
      probed: false, read: false, looted: false,
      rebooting: false, alertState: "green",
      vulnerabilities: [], macguffins: [],
      gateAccess: "compromised",
      ...config.attributes,
    },
    operators: [],
    actions: [PROBE_ACTION, EXPLOIT_ACTION],
  };
}
```

**3. Action template for `cancel-probe` / `cancel-exploit` / `cancel-read` /
`cancel-loot`:**

These check node-local flags (`probing`, `exploiting`, `reading`, `looting`) rather
than global state. The game's ctx.startProbe etc. must set these flags on the node via
`graph.setNodeAttr()` when starting, and clear them when completing/cancelling.

This is a **new convention**: timed action state is tracked on the node itself (not just
in global state). The global state fields (`activeProbe`, `executingExploit`, etc.)
become mirrors/indexes for quick lookup, but the node-local flag is what the NodeDef
action requires check.

**4. Tests:**

- Each factory produces valid NodeDef with expected attributes and action IDs
- Shared action templates have correct requires/effects structure
- Create a NodeGraph from a factory output, verify getAvailableActions returns expected
  actions for different attribute states
- Run `make check`

---

## Phase 3: Strawman Network Definitions

**Goal:** Build 2-3 hand-crafted networks from set-pieces and type factories.

**Builds on:** Phase 2 (game-types.js).

**After this phase:** `data/networks/` contains network definitions that produce valid
`NodeGraphDef` objects. Tests verify solvability (action sequences exist to reach loot
nodes and jack out).

### Prompt

Create `data/networks/` directory with network definition modules. Each exports a
function `buildNetwork(seed?)` that returns a `NodeGraphDef` (`{ nodes, edges,
triggers }`) plus game metadata (`{ startNode, startCash, startHand, ice?, moneyCost }`).

**Network A: "Corporate Foothold" (`data/networks/corporate-foothold.js`)**

Simple 10-12 node network. Compose from:
- `createGateway("gateway")` — start node, visibility: accessible
- `createRouter("router-1")` — connects gateway to inner network
- `idsRelayChain` set-piece (instantiated as "sec") — IDS + security monitor
- `nthAlarm` set-piece (instantiated as "alarm") — probe limit sensor
- `multiKeyVault` set-piece (instantiated as "vault") — primary loot target
- `createFileserver("fs-1")`, `createFileserver("fs-2")` — early loot
- Wire edges: gateway → router-1 → {fs-1, ids, alarm-sensor, vault-key-servers}
- Metadata: startNode="gateway", startCash=0, moneyCost="C", no ICE

**Network B: "Research Station" (`data/networks/research-station.js`)**

Complex 15-18 node network, no ICE. Compose from:
- `createGateway("gateway")`
- `createRouter("spine-1")`, `createRouter("spine-2")` — backbone
- `deadmanCircuit` set-piece — heartbeat puzzle
- `combinationLock` set-piece — multi-switch vault
- `encryptedVault` set-piece — time-pressure loot
- `tamperDetect` set-piece — sequencing puzzle
- `createFileserver("archive-1")` — easy loot
- Metadata: startNode="gateway", startCash=0, moneyCost="B", no ICE

**Network C: "Corporate Exchange" (`data/networks/corporate-exchange.js`)**

12-15 node ICE-pressure network. Compose from:
- `createGateway("gateway")`
- `createRouter("switch-1")`
- `idsRelayChain` set-piece
- `noisySensor` set-piece — debounce detection
- `probeBurstAlarm` set-piece — escalating ICE spawns
- `honeyPot` set-piece — trap node
- `createFileserver("payroll")`, `createCryptovault("vault")` — loot targets
- `createWAN("wan")` — darknet store
- Metadata: startNode="gateway", startCash=200, moneyCost="A",
  ice={ grade:"B", startNode:"sec/monitor" }

**Each network module:**
1. Imports type factories from `../js/core/node-graph/game-types.js`
2. Imports `instantiate, SET_PIECES` from `../js/core/node-graph/set-pieces.js`
3. Creates nodes via factories, instantiates set-pieces
4. Wires inter-component edges (connecting set-piece external ports to type nodes)
5. Merges all nodes, edges, triggers into one `NodeGraphDef`
6. Returns `{ graphDef, meta }` where meta has startNode, startCash, etc.

**Tests:**
- Each network builds without error
- All nodes referenced in edges exist
- Start node exists and has `visibility: "accessible"`
- At least one lootable node reachable from start (BFS over edges)
- Set-piece prefixes don't collide
- Run `make check`

---

## Phase 4: CtxInterface Bridge

**Goal:** Implement the real `CtxInterface` that bridges NodeGraph to existing game
systems (alert, ICE, cash, timers).

**Builds on:** Phase 2 (game-types understand ctx methods).

**After this phase:** `js/core/node-graph/game-ctx.js` exports `buildGameCtx()` that
returns a `CtxInterface` wired to the real game functions. Tested with integration tests.

### Prompt

Create `js/core/node-graph/game-ctx.js`:

```javascript
export function buildGameCtx(getState, graph) {
  return {
    startTrace:   () => startTraceCountdown(),
    cancelTrace:  () => cancelTraceCountdown(),
    giveReward:   (amount) => addCash(amount),
    spawnICE:     (nodeId) => startIce(nodeId),
    setGlobalAlert: (level) => setGlobalAlertLevel(level),
    enableNode:   (nodeId) => { graph.setNodeAttr(nodeId, "visibility", "accessible"); },
    disableNode:  (nodeId) => { graph.setNodeAttr(nodeId, "visibility", "hidden"); },
    revealNode:   (nodeId) => { graph.setNodeAttr(nodeId, "visibility", "revealed"); },
    log:          (message) => emitEvent(E.LOG_ENTRY, { text: message, type: "system" }),
  };
}
```

**Import sources:**
- `startTraceCountdown`, `cancelTraceCountdown` from `../alert.js`
- `addCash` from `../state/player.js`
- `startIce` from `../ice.js`
- `setGlobalAlertLevel` from `../state/alert.js`
- `emitEvent, E` from `../events.js`

**Note:** `graph` is passed to the ctx factory so that `enableNode`/`disableNode`/
`revealNode` can mutate NodeGraph attributes directly. The graph reference is set
after construction (circular dependency: graph needs ctx, ctx needs graph). Use a
late-binding pattern: create ctx with a `null` graph reference, then assign after
graph construction.

**Tests:**
- `buildGameCtx()` returns object with all CtxInterface methods
- Each method calls the expected underlying function (use spies/mocks)
- `enableNode` / `revealNode` set the correct attribute on the graph
- Run `make check`

---

## Phase 5: Game Init Rework + Tick Wiring

**Goal:** Replace `initState()` with NodeGraph-based initialization. Wire tick.
This is the big coordinated swap — after this phase, the game runs on NodeGraph.

**Builds on:** Phases 1-4 (all pieces built).

**After this phase:** Game starts up with NodeGraph as node state authority. Nodes are
created from network definitions. Tick advances the graph. Old `state.nodes` still
exists as a read-cache (populated from graph events) for backward compatibility with
renderer and harness code that hasn't migrated yet.

### Prompt

This is the main integration phase. Modify the game initialization and tick loop:

**1. New `initGame()` function (in `js/core/game-init.js` or modify `state/index.js`):**

```
initGame(networkModule, seed):
  1. Init RNG with seed
  2. Call networkModule.buildNetwork(seed) → { graphDef, meta }
  3. Build game ctx (buildGameCtx with late-binding graph ref)
  4. Build onEvent callback that bridges to the event bus:
     - 'node-state-changed' → emitEvent(E.NODE_STATE_CHANGED, payload)
     - 'message-delivered' → emitEvent(E.MESSAGE_PROPAGATED, payload)
     - 'quality-changed' → emitEvent(E.QUALITY_CHANGED, payload)
  5. Construct NodeGraph(graphDef, ctx, onEvent)
  6. Set graph reference on ctx (late-binding)
  7. Call graph.init() — init operators run, macguffins assigned, etc.
  8. Generate vulnerabilities for each node (using seeded RNG, based on grade)
     — store as node attributes via graph.setNodeAttr()
  9. Init remaining state: player (cash, hand), ice, globalAlert, phase, etc.
     — these stay in the existing state system
  10. Set start node visible: graph.setNodeAttr(meta.startNode, "visibility", "accessible")
  11. Populate state.nodes from graph state (backward-compat cache):
      for each node in graph: state.nodes[nodeId] = graph.getNodeState(nodeId)
  12. Build adjacency from graph edges → state.adjacency
  13. Store graph reference on state (or module-level): state.nodeGraph = graph
  14. Emit RUN_STARTED, STATE_CHANGED
```

**2. Tick wiring in `timers.js`:**

Add `graph.tick(1)` call inside the existing `tick()` function, after processing
timers and before emitting `STATE_CHANGED`. The graph's internal clock operators
advance in lockstep with the game timer.

**3. State sync bridge (temporary):**

After any `graph.setNodeAttr()` or graph action that mutates node state, sync the
changed attributes back to `state.nodes[nodeId]`. This can happen in the `onEvent`
callback:

```javascript
on 'node-state-changed': ({ nodeId, attr, value }) => {
  if (state.nodes[nodeId]) state.nodes[nodeId][attr] = value;
  emitEvent(E.NODE_STATE_CHANGED, { nodeId, attr, value });
}
```

This keeps the old state.nodes cache in sync while renderer/harness code still reads
from it. We'll remove this bridge in the cleanup phase.

**4. Modify `js/ui/main.js` startup:**

Replace the current `initState(network)` call with `initGame(networkModule, seed)`.
Select network module based on URL params or default to corporate-foothold.
Keep all timer handler registrations and action dispatcher wiring — those still work.

**5. Modify timer handlers to write through graph:**

Timer handlers that mutate node state (probe complete, exploit success, read complete,
loot complete, reboot) must now call `graph.setNodeAttr()` instead of the old
`state/node.js` setters. Specifically:

- `handleProbeScanTimer` → `graph.setNodeAttr(nodeId, "probed", true)` +
  `graph.setNodeAttr(nodeId, "probing", false)`
- `handleExploitExecTimer` (success) → `graph.setNodeAttr(nodeId, "accessLevel", level)` +
  `graph.setNodeAttr(nodeId, "exploiting", false)`
- `handleReadScanTimer` → `graph.setNodeAttr(nodeId, "read", true)` +
  `graph.setNodeAttr(nodeId, "reading", false)`
- `handleLootExtractTimer` → `graph.setNodeAttr(nodeId, "looted", true)` +
  `graph.setNodeAttr(nodeId, "looting", false)`
- `completeReboot` → `graph.setNodeAttr(nodeId, "rebooting", false)` etc.

Also: when starting a timed action, set the node-local flag:
- `startProbe` → `graph.setNodeAttr(nodeId, "probing", true)`
- etc.

**6. Navigation (node access gating):**

The current `navigateTo()` reveals neighbor nodes based on `gateAccess` from
node-types.js. Replace with reading `gateAccess` from the node's own attributes
(set by the type factory).

**Tests:**
- `initGame` with corporate-foothold produces a valid game state
- Graph has correct number of nodes
- Start node is accessible
- `graph.tick(1)` doesn't throw
- Timer handlers correctly update graph state
- State sync bridge keeps state.nodes in sync
- Run `make check` — existing tests may need updates if they depend on old init flow

---

## Phase 6: Action Dispatch Migration

**Goal:** Route player actions through NodeGraph instead of the old action registries.

**Builds on:** Phase 5 (graph running, node state in graph).

**After this phase:** `initActionDispatcher` uses `graph.getAvailableActions()` for
node-local checks, wrapped with global state filters. Old `node-actions.js` and
`node-types.js` action registries are bypassed.

### Prompt

Modify `js/core/actions/action-context.js` to route actions through NodeGraph:

**1. New `getAvailableActions` that wraps graph:**

```javascript
export function getAvailableActions(node, state) {
  const global = getGlobalActions(node, state);  // keep as-is
  if (!node) return global;

  const graph = state.nodeGraph;
  const graphActions = graph.getAvailableActions(node.id);

  // Apply global filters: no concurrent timed actions
  const busy = !!(state.activeProbe || state.executingExploit ||
                   state.activeRead || state.activeLoot);
  const filtered = graphActions.filter(action => {
    if (busy && TIMED_ACTION_IDS.has(action.id)) return false;
    // exploit also blocked if node already has active exploit
    if (action.id === "exploit" && state.executingExploit?.nodeId === node.id) return false;
    // eject requires ICE at this node (global state check)
    if (action.id === "eject" && !(state.ice?.active && state.ice.attentionNodeId === node.id)) return false;
    return true;
  });

  return [...global, ...filtered];
}

const TIMED_ACTION_IDS = new Set(["probe", "exploit", "read", "loot"]);
```

**2. Modify dispatcher to use graph.executeAction for most actions:**

For most actions, call `graph.executeAction(nodeId, actionId)` which applies the
NodeDef's effects (including ctx-call effects that trigger timed actions).

**Exception:** `exploit` action needs `exploitId` from the event payload. Handle this
specially in the dispatcher — call `ctx.startExploit(nodeId, exploitId)` directly
instead of going through graph.executeAction.

**Exception:** Global actions (select, deselect, jackout) don't go through the graph.
They continue using the existing `ActionContext` methods.

**3. Action label and desc:**

The renderer needs `label` and `desc` for action buttons. NodeDef actions have `label`
but not `desc`. Add an optional `desc` field to NodeDef ActionDef (in types.js) and
populate it in the shared action templates. If missing, use label as fallback.

**4. Remove imports of old action registries:**

Stop importing `getNodeActions` from `node-actions.js` and `getActions` from
`node-types.js` in the unified `getAvailableActions`. The graph is now the sole source.

**Tests:**
- getAvailableActions returns probe for a locked, unprobed node
- getAvailableActions excludes probe when another timed action is active
- Dispatcher routes probe → graph.executeAction → ctx.startProbe called
- Exploit goes through special path with exploitId
- Global actions still work
- Run `make check`

---

## Phase 7: Visual Renderer Migration

**Goal:** Renderer subscribes to semantic events from NodeGraph rather than reading
`getState().nodes` directly.

**Builds on:** Phase 5 (event emission), Phase 6 (actions working).

**After this phase:** Renderer updates node visuals based on `NODE_STATE_CHANGED`
events. It maintains its own lightweight view-model built from events, not from
the state object.

### Prompt

Modify `js/ui/visual-renderer.js`:

**1. Subscribe to `E.NODE_STATE_CHANGED`:**

```javascript
on(E.NODE_STATE_CHANGED, ({ nodeId, attr, value }) => {
  updateNodeStyle(nodeId, attr, value);
});
```

Replace the current `syncGraph(state)` approach (which iterates all nodes on every
STATE_CHANGED) with targeted updates on specific attribute changes:
- `visibility` changed → show/hide node in Cytoscape
- `accessLevel` changed → update node color/class
- `alertState` changed → update alert glow
- `probed` changed → update label/icon
- `rebooting` changed → update opacity/animation

**2. Keep `STATE_CHANGED` for non-node state:**

The renderer still needs `STATE_CHANGED` for:
- Player cash/hand display (HUD)
- ICE position/state (HUD + graph)
- Global alert level (HUD)
- Selection state (graph highlight)
- Trace countdown (HUD)

These are NOT node attributes and aren't migrated to NodeGraph. Keep the existing
`STATE_CHANGED` handler but strip out the node-iteration logic.

**3. `syncContextMenu` reads from graph:**

When building the context menu for a selected node, read node state from graph
(`state.nodeGraph.getNodeState(nodeId)`) instead of `state.nodes[nodeId]`.

**4. Add `E.NODE_STATE_CHANGED`, `E.MESSAGE_PROPAGATED`, `E.QUALITY_CHANGED` to
event catalog:**

In `js/core/events.js`, add the three new event types. These are emitted by the
`onEvent` bridge callback in Phase 5.

**Tests:**
- Attribute change event triggers node style update
- HUD still renders from STATE_CHANGED
- Context menu shows correct actions from graph
- Run `make check`

---

## Phase 8: Save/Load Integration

**Goal:** Wire `graph.snapshot()` / `fromSnapshot()` into save-load.

**Builds on:** Phase 5 (graph running).

**After this phase:** Saving and loading a game preserves full NodeGraph state.

### Prompt

Modify `js/ui/save-load.js`:

**1. Save:**

When serializing game state, include the graph snapshot:

```javascript
const saveData = {
  ...existingStateFields,
  nodeGraph: state.nodeGraph.snapshot(),
};
```

**2. Load:**

When restoring, reconstruct the graph:

```javascript
const ctx = buildGameCtx(getState, null);  // late-bind graph
const onEvent = buildOnEventBridge();
const graph = NodeGraph.fromSnapshot(saveData.nodeGraph, ctx, onEvent);
ctx.graph = graph;  // late-bind
state.nodeGraph = graph;
```

**3. Remove old node serialization:**

The old save/load serialized `state.nodes` and `state.adjacency`. These are now
derived from the graph. On load, repopulate `state.nodes` from `graph.getNodeState()`
for each node (backward-compat cache).

**4. State file format:**

The playtest harness state file (`playtest-state.json`) also needs the nodeGraph
snapshot. Update `scripts/playtest.js` to serialize/deserialize it.

**Tests:**
- Save + load round-trip preserves node attributes
- Save + load round-trip preserves operator internal state (clocks, counters)
- Save + load round-trip preserves trigger fired state
- Save + load round-trip preserves qualities
- Playtest harness state file includes nodeGraph
- Run `make check`

---

## Phase 9: Harness Updates

**Goal:** Update playtest.js and bot-player.js to use NodeGraph.

**Builds on:** Phases 5-8 (graph integrated, save/load working).

**After this phase:** Headless playtest and bot-census work with new network definitions.

### Prompt

**1. `scripts/playtest.js`:**

- Replace network selection: instead of `generateNetwork()` or static `NETWORK`,
  import the strawman network modules. Default to corporate-foothold. Add `--network`
  CLI flag to select (corporate-foothold, research-station, corporate-exchange).
- Replace `initState()` call with `initGame(networkModule, seed)`.
- `status` subcommands read from graph: `state.nodeGraph.getNodeState(nodeId)`
  instead of `state.nodes[nodeId]`.
- `actions` command uses the new `getAvailableActions` (which reads from graph).
- Timer handler registration stays the same.
- State serialization includes nodeGraph snapshot (Phase 8).

**2. `scripts/bot-player.js`:**

- Replace network selection with strawman network module import.
- Replace `initState()` with `initGame()`.
- Bot reads node state from `state.nodeGraph.getNodeState(nodeId)` — update
  `pickNextNode()`, `SECURITY_TYPES` / `LOOTABLE_TYPES` checks, etc.
- Bot dispatches actions as before (`emitEvent("starnet:action", ...)`).
- Verify bot can complete a run on corporate-foothold (simple network).

**3. `scripts/bot-census.js`:**

- Update to use `--network` flag passthrough.
- Default to corporate-foothold for census runs.

**Tests:**
- `node scripts/playtest.js reset && node scripts/playtest.js "status"` works
- Bot completes a run on corporate-foothold without errors
- `make bot-census --seeds 5` completes without errors
- Run `make check`

---

## Phase 10: Cleanup

**Goal:** Remove old systems, dead code, and backward-compat bridges.

**Builds on:** All previous phases.

**After this phase:** Codebase is clean. Old node-types, procgen, and state/node.js
setters are gone. No dual-state bridge. All reads go through NodeGraph.

### Prompt

Delete or retire the following:

**1. Delete `js/core/actions/node-types.js`** — behavior atoms, NODE_TYPES registry,
   getNodeType, resolveNode, getBehaviors, getActions, getStateFields, getGateAccess.
   All behavior is now in NodeDef operators.

**2. Delete `js/core/network/network-gen.js`** and biome modules (`js/biomes/`).
   Procgen is out of scope; strawman networks replace it.

**3. Retire `js/core/state/node.js` setters** — setNodeVisible, setNodeAccessLevel,
   setNodeProbed, setNodeAlertState, setNodeRead, setNodeLooted, setNodeRebooting,
   setNodeEventForwarding. All mutations go through `graph.setNodeAttr()`. Keep
   `state/node.js` as a minimal module if other parts still import NodeState type
   definitions from it.

**4. Remove the state sync bridge** from Phase 5 — the `onEvent` callback no longer
   needs to mirror changes to `state.nodes`. Renderer reads from graph directly.
   Remove `state.nodes` from the state object entirely (or leave as empty object
   for type compatibility).

**5. Remove `data/network.js`** (old static network) — replaced by strawman networks.

**6. Remove `js/core/node-orchestration.js`** if all its functions have been absorbed
   by NodeGraph actions/effects.

**7. Update `MANUAL.md`** with any gameplay changes (new network names, removed
   network generation params, etc.).

**8. Update `CLAUDE.md`** file structure documentation to reflect new layout.

**9. Run full test suite, fix any broken imports or references.**

- `make check` green
- `make bot-census --seeds 10` passes
- Manual playtest in browser: start game, probe, exploit, read, loot, jack out

---

## Risk Notes

- **Phase 5 is the riskiest** — it's the coordinated swap where many things change at
  once. If it gets unwieldy, split into sub-phases: (5a) init rework only, (5b) tick
  wiring, (5c) timer handler migration.

- **Exploit action payload** is a known special case. The node-graph action system
  doesn't have a payload passthrough mechanism. The dispatcher handles this specially.

- **Cancel actions** depend on node-local flags (`probing`, `reading`, etc.) that don't
  exist in the current system. These flags must be set by the timed action starters
  (startProbe sets `probing=true` on the graph node) and cleared by completers.

- **ICE state stays in state.ice** — ICE position, detection, attention are not node
  attributes. The ICE system reads node state from the graph but writes ICE state to
  the existing state module.

- **Vulnerability generation** currently happens in `initState()`. It needs to move to
  either `initGame()` (after graph construction) or an init operator. The seeded RNG
  stream for vulns must be preserved for determinism.

- **Tests may break in Phase 5** due to init flow changes. Budget time for test updates.
  Integration tests that set up state via `initState()` will need reworking.
