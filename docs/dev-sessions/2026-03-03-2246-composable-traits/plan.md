# Session Plan: Composable Traits & Core Mechanics Migration

## Overview

This plan breaks the work into 8 phases, each building on the previous. Every phase
ends with tests passing (`make check`). No orphaned code — each step is wired in
before the next begins.

**Dependency chain:**
```
Phase 1: Trait registry + composition engine (foundation)
Phase 2: Define initial traits (vocabulary)
Phase 3: Rewrite game-types.js to use traits (factory sugar)
Phase 4: Update network definitions + set-pieces (consumers)
Phase 5: timed-action operator (graph-native lifecycle)
Phase 6: ACTION_FEEDBACK event + renderer rewire (visual plumbing)
Phase 7: Migrate executors to ctx resolve methods (the big swap)
Phase 8: Delete executor files + cleanup (finish line)
```

---

## Phase 1: Trait Registry & Composition Engine

**Goal:** Build the trait registry and the `resolveTraits()` function that merges
traits into a NodeDef. Pure infrastructure — no game behavior changes yet.

### Step 1.1: Create `js/core/node-graph/traits.js`

Create the trait registry module with:

- `_registry` Map (name → trait definition)
- `registerTrait(name, traitDef)` — register a named trait
- `getTrait(name)` — look up a trait (throws on unknown name)
- `resolveTraits(nodeDef)` → fully-resolved NodeDef

`resolveTraits` implements the composition rules from the spec:

1. Start with base attributes: `{ id: nodeDef.id, label: nodeDef.label || nodeDef.id, visibility: "hidden" }`
2. For each trait name in `nodeDef.traits` (left to right):
   - Merge trait's `attributes` (last-wins on overlap)
   - Concatenate trait's `operators`
   - Merge trait's `actions` by ID (last-wins)
3. Merge `nodeDef.attributes` on top (explicit overrides win)
4. Append `nodeDef.operators` (additional beyond traits)
5. Merge `nodeDef.actions` by ID (nodeDef-level overrides win)
6. Return the resolved NodeDef (with `traits` still present for inspection)

If `nodeDef.traits` is absent or empty, return the NodeDef unchanged (backward compat).

### Step 1.2: Update `NodeDef` typedef in `js/core/node-graph/types.js`

Add `traits?: string[]` field to the NodeDef typedef.

### Step 1.3: Wire trait resolution into `NodeGraph` constructor

In `runtime.js`, call `resolveTraits()` on each node def during construction,
before building the internal node map. Nodes without `traits` pass through unchanged.

### Step 1.4: Unit tests for trait registry

New test file `js/core/node-graph/traits.test.js`:

- Register a trait, retrieve it, verify structure
- `resolveTraits` with single trait — attributes/operators/actions merged
- `resolveTraits` with multiple traits — left-to-right merge, last-wins on conflict
- Explicit `attributes` in NodeDef override trait defaults
- Explicit `operators`/`actions` in NodeDef append/override trait versions
- Unknown trait name throws
- Empty/missing `traits` array passes through unchanged

**Checkpoint:** `make check` passes. Trait system exists but no traits are registered yet.
All existing tests still pass (no traits referenced anywhere yet).

---

## Phase 2: Define Initial Trait Vocabulary

**Goal:** Register all 7 traits from the spec. They reference existing action
templates and operator configs but don't change any game behavior yet.

### Step 2.1: Register traits in `traits.js`

Add trait registrations (after the registry functions). Each trait definition
is `{ attributes: {}, operators: [], actions: [] }`.

**`graded`:**
```js
{ attributes: { grade: "D" }, operators: [], actions: [] }
```

**`hackable`:**
```js
{
  attributes: {
    accessLevel: "locked", probed: false, vulnerabilities: [],
    probing: false, exploiting: false, alertState: "green",
  },
  operators: [],  // timed-action operators added in Phase 5
  actions: [PROBE_ACTION, CANCEL_PROBE_ACTION, EXPLOIT_ACTION, CANCEL_EXPLOIT_ACTION],
}
```

**`lootable`:**
```js
{
  attributes: {
    read: false, looted: false, macguffins: [], reading: false, looting: false,
  },
  operators: [],  // timed-action operators added in Phase 5
  actions: [READ_ACTION, CANCEL_READ_ACTION, LOOT_ACTION, CANCEL_LOOT_ACTION],
}
```

**`rebootable`:**
```js
{
  attributes: { rebooting: false },
  operators: [],  // timed-action operator added in Phase 5
  actions: [EJECT_ACTION, REBOOT_ACTION],
}
```

**`relay`:**
```js
{ attributes: {}, operators: [{ name: "relay" }], actions: [] }
```

**`detectable`:**
```js
{
  attributes: { forwardingEnabled: true, alerted: false, alertState: "green" },
  operators: [
    { name: "relay", filter: "alert" },
    { name: "flag", on: "alert", attr: "alerted", value: true },
  ],
  actions: [RECONFIGURE_ACTION],  // extract from createIDS
}
```

**`security`:**
```js
{
  attributes: { alerted: false, alertState: "green" },
  operators: [
    { name: "flag", on: "alert", attr: "alerted", value: true },
  ],
  actions: [CANCEL_TRACE_ACTION],  // extract from createSecurityMonitor
}
```

**`gate`:**
```js
{ attributes: { gateAccess: "probed" }, operators: [], actions: [] }
```

### Step 2.2: Extract RECONFIGURE_ACTION and CANCEL_TRACE_ACTION

These are currently inline in `createIDS` and `createSecurityMonitor`. Extract
them to module-level constants alongside the other shared action templates.

### Step 2.3: Tests for trait definitions

Extend `traits.test.js`:

- Each registered trait can be retrieved by name
- Each trait has the expected attributes, operators, actions
- Build a minimal NodeDef with `traits: ["graded", "hackable", "gate"]`, resolve,
  verify merged attributes include grade + accessLevel + gateAccess

**Checkpoint:** `make check` passes. Traits are registered and resolvable.
No existing code uses them yet — factories still work as before.

---

## Phase 3: Rewrite Game-Types.js to Use Traits

**Goal:** Factory functions become thin wrappers that produce trait-based NodeDefs.
`createGameNode()` delegates to trait resolution. Existing network definitions
continue working unchanged.

### Step 3.1: Rewrite factory functions

Each factory becomes a function that returns a NodeDef with `traits` instead of
hardcoded operators/actions. Examples:

```js
export function createGateway(id, config = {}) {
  return {
    id,
    type: "gateway",
    traits: ["graded", "hackable", "gate"],
    attributes: {
      label: config.label || id,
      grade: config.grade || "D",
      gateAccess: "probed",
      ...config.attributes,
    },
  };
}

export function createFileserver(id, config = {}) {
  return {
    id,
    type: "fileserver",
    traits: ["graded", "hackable", "lootable", "rebootable", "gate"],
    attributes: {
      label: config.label || id,
      grade: config.grade || "D",
      lootCount: config.lootCount || [1, 2],
      ...config.attributes,
    },
  };
}
```

Type-specific extras (IDS `reconfigure`, security-monitor `cancel-trace`) are now
provided by traits (`detectable`, `security`), not inline in the factory.

Trait mappings for each factory:

| Factory | Traits |
|---------|--------|
| `createGateway` | graded, hackable, gate |
| `createRouter` | graded, hackable, relay, gate |
| `createIDS` | graded, hackable, detectable, gate |
| `createSecurityMonitor` | graded, hackable, security, gate |
| `createFileserver` | graded, hackable, lootable, rebootable, gate |
| `createCryptovault` | graded, hackable, lootable, rebootable, gate |
| `createFirewall` | graded, hackable, gate |
| `createWAN` | (special — no hackable, own actions) |

### Step 3.2: Rewrite `createGameNode()`

`createGameNode()` is used by set-pieces. It currently does type-based factory
lookup + operator/action merging. Rewrite it to:

1. If the set-piece node has a `traits` field, use it directly (trait resolution
   happens in the runtime constructor).
2. If the set-piece node matches a known type, look up the default trait list for
   that type and attach it. Merge any set-piece-specific operators/actions on top.
3. If unknown type, apply a minimal default trait list (`["graded", "hackable", "gate"]`).

### Step 3.3: Verify all existing tests pass

No new tests needed — the factory outputs should be equivalent to before after
trait resolution. Run `make check` and fix any discrepancies in resolved attributes,
operators, or actions.

**Checkpoint:** `make check` passes. Factories produce trait-based NodeDefs. The
runtime resolves traits at construction time. All downstream behavior identical.

---

## Phase 4: Update Network Definitions & Set-Pieces

**Goal:** Network definitions and set-piece nodes use trait-based NodeDefs natively.
`createGameNode()` usage simplified where possible.

### Step 4.1: Update set-pieces.js

Set-piece internal nodes that go through `createGameNode()` should have `traits`
in their NodeDefs. For nodes with known types (ids, security-monitor, fileserver),
the set-piece definition can include `traits` directly. `createGameNode()` then
just passes them through.

Audit each set-piece in `set-pieces.js`:
- `idsRelayChain` — IDS nodes should have `traits: ["graded", "hackable", "detectable", "gate"]`
- `nthAlarm`, `probeBurstAlarm`, `deadmanCircuit`, `honeyPot` — internal circuit
  nodes (alarm-latch, counter, etc.) keep their existing operator definitions;
  `createGameNode` gives them the minimal default traits

### Step 4.2: Update network definitions

The three network files (`corporate-foothold.js`, `research-station.js`,
`corporate-exchange.js`) use factory functions for standalone nodes and
`createGameNode()` for set-piece nodes. Verify they still build correctly
with the trait-based factories. No changes needed if Step 3 was done correctly,
but run `data/networks/networks.test.js` to confirm.

### Step 4.3: Run full test suite

`make check` — all network tests, set-piece tests, integration tests.

**Checkpoint:** All network definitions build, all set-pieces instantiate, all
tests pass. The trait system is fully wired end-to-end for node construction.

---

## Phase 5: Generic Timed-Action Operator

**Goal:** Register a `timed-action` operator in the operator registry that handles
start/progress/cancel/complete lifecycle for any timed action. Does not replace
executors yet — this phase just builds and tests the operator in isolation.

### Step 5.1: Register the `timed-action` operator

In `operators.js`, register a new operator:

**Config shape:**
```js
{
  name: "timed-action",
  action: "probe",           // action name (matches activeAttr convention)
  activeAttr: "probing",     // boolean attribute: true while action in progress
  progressAttr: "actionProgress",  // numeric attribute: 0..duration ticks elapsed
  durationAttr: "actionDuration",  // numeric attribute: total ticks for this action
  durationTable: { S: 50, ... },   // grade → ticks (optional; ctx can set duration directly)
  onComplete: [              // effects to fire on completion
    { effect: "ctx-call", method: "resolveProbe", args: ["$nodeId"] }
  ],
  onCancel: [],              // effects to fire on cancel (optional)
}
```

**Operator logic:**

On receiving a `tick` message when `activeAttr` is true:
1. Read `progressAttr` and `durationAttr`
2. Increment progress by 1
3. If progress < duration: emit `action-feedback` event via `ctx.emitEvent()` (or
   the onEvent callback) with progress ratio
4. If progress >= duration: fire `onComplete` effects, reset `activeAttr` to false,
   reset `progressAttr` to 0, emit `action-feedback` with phase "complete"

On receiving a `tick` message when `activeAttr` is false: no-op.

The `action-feedback` event emission can go through `ctx.emitEvent(E.ACTION_FEEDBACK, payload)`
as a ctx-call effect, or the operator can return a special event descriptor. Since
operators currently return `{ attributes, outgoing, qualityDeltas }`, we may need
to extend the return type to include `events` — or have the operator call
`ctx.emitEvent()` directly.

**Design decision:** Extend the operator return type to include an optional `events`
array: `{ attributes?, outgoing?, qualityDeltas?, events?: Array<{type, payload}> }`.
The runtime delivers these via `onEvent()`. This keeps operators pure (they return
data, not call functions) while enabling event emission.

### Step 5.2: Extend operator return type

In `runtime.js`, update `applyOperators()` to check for `events` in the operator
result and call `this._onEvent()` for each.

In `types.js`, update the operator result typedef to include `events?`.

### Step 5.3: Action start/cancel effects

The timed-action lifecycle needs a way to **start**: when the action's `execute`
fires, it needs to set `activeAttr: true` and `durationAttr` to the right value.

This is already handled by the action's `effects` list:
```js
// probe action effects (updated):
effects: [
  { effect: "set-attr", attr: "probing", value: true },
  { effect: "set-attr", attr: "actionProgress", value: 0 },
  { effect: "set-attr", attr: "actionDuration", value: "$gradeDuration" },
  // Note: $gradeDuration is a placeholder — we need a way to compute it
]
```

**Problem:** The action effect system doesn't currently support computed values
(grade-keyed lookup). Options:

**A)** The `timed-action` operator itself handles start detection: when it sees
`activeAttr` transition from false→true (comparing current vs patched attributes),
it sets the duration from `durationTable[grade]`. The action effect just sets
`activeAttr: true` and `actionProgress: 0`.

**B)** Add a new effect type `set-attr-from-table` that does the grade lookup.

Option A is simpler and keeps effects dumb. The operator watches for the
`activeAttr` transition and initializes duration + emits the start event.

**Go with Option A**: action effects just set `activeAttr: true` + `actionProgress: 0`.
The timed-action operator detects the transition on the next tick and sets
`actionDuration` from the grade table + emits the start feedback event.

Actually, even better: the operator can detect the transition **on the same tick
delivery cycle**, since operators run against accumulated attribute patches. If
the action sets `probing: true` as an effect, and the timed-action operator runs
on the same node during message processing, it can see the transition immediately.

Wait — action effects and tick-driven operators run at different times. Actions
execute outside the tick cycle. The operator only runs on message delivery (tick).
So: action sets `activeAttr: true` → on the next tick → operator sees it for the
first time, sets duration, emits start event. There's a 1-tick delay. That's
acceptable (100ms).

For **cancel**: cancel action effect sets `activeAttr: false`. On the next tick,
the operator sees `activeAttr` is false and `progressAttr > 0` (was in progress),
resets progress, emits cancel feedback. Alternatively, the cancel action effects
can handle the reset directly and emit the cancel event via a ctx-call.

**Simpler approach for cancel:** cancel action effects do the cleanup directly:
```js
effects: [
  { effect: "set-attr", attr: "probing", value: false },
  { effect: "set-attr", attr: "actionProgress", value: 0 },
  { effect: "ctx-call", method: "emitActionFeedback",
    args: ["$nodeId", "probe", "cancel"] },
]
```

### Step 5.4: Update trait definitions with timed-action operators

Add the `timed-action` operator configs to `hackable`, `lootable`, and
`rebootable` traits:

**hackable** gets:
```js
operators: [
  { name: "timed-action", action: "probe", activeAttr: "probing",
    durationTable: { S: 50, A: 40, B: 30, C: 20, D: 20, F: 10 },
    onComplete: [{ effect: "ctx-call", method: "resolveProbe", args: ["$nodeId"] }] },
  { name: "timed-action", action: "exploit", activeAttr: "exploiting",
    // no durationTable — ctx sets duration from card quality
    onComplete: [{ effect: "ctx-call", method: "resolveExploit", args: ["$nodeId"] }] },
]
```

**lootable** gets:
```js
operators: [
  { name: "timed-action", action: "read", activeAttr: "reading",
    durationTable: { S: 40, A: 35, B: 25, C: 15, D: 15, F: 8 },
    onComplete: [{ effect: "ctx-call", method: "resolveRead", args: ["$nodeId"] }] },
  { name: "timed-action", action: "loot", activeAttr: "looting",
    durationTable: { S: 30, A: 25, B: 20, C: 12, D: 10, F: 6 },
    onComplete: [{ effect: "ctx-call", method: "resolveLoot", args: ["$nodeId"] }] },
]
```

**rebootable** gets:
```js
operators: [
  { name: "timed-action", action: "reboot", activeAttr: "rebooting",
    durationTable: { S: 30, A: 25, B: 20, C: 15, D: 10, F: 10 },
    onComplete: [{ effect: "ctx-call", method: "resolveReboot", args: ["$nodeId"] }] },
]
```

### Step 5.5: Unit tests for timed-action operator

Test file `js/core/node-graph/timed-action.test.js`:

- Create a minimal graph with one node that has a `timed-action` operator
- Set `activeAttr` true, tick repeatedly, verify progress increments
- Verify `action-feedback` events emitted with correct progress ratios
- Verify completion fires `onComplete` effects when progress reaches duration
- Verify cancel (set `activeAttr` false mid-progress) emits cancel event and resets
- Verify no-op when `activeAttr` is false (no progress, no events)
- Verify duration computed from grade table when `durationTable` present
- Verify external duration (no `durationTable`) uses `durationAttr` value set by ctx

**Checkpoint:** `make check` passes. The timed-action operator works in isolation.
Traits have operator configs but executors still handle the actual game mechanics.

---

## Phase 6: ACTION_FEEDBACK Event & Renderer Rewire

**Goal:** Add `E.ACTION_FEEDBACK` to the event catalog. Rewire visual-renderer.js
and log-renderer.js to subscribe to the unified event instead of per-action events.
Old event types remain temporarily (removed in Phase 8).

### Step 6.1: Add `E.ACTION_FEEDBACK` to events.js

```js
ACTION_FEEDBACK: "starnet:action-feedback",
```

### Step 6.2: Rewire visual-renderer.js

Replace the individual event subscriptions:
- `E.PROBE_SCAN_STARTED` / `E.PROBE_SCAN_CANCELLED` / `E.NODE_PROBED`
- `E.EXPLOIT_STARTED` / `E.EXPLOIT_INTERRUPTED` / `E.EXPLOIT_SUCCESS` / `E.EXPLOIT_FAILURE`
- `E.READ_SCAN_STARTED` / `E.READ_SCAN_CANCELLED` / `E.NODE_READ`
- `E.LOOT_EXTRACT_STARTED` / `E.LOOT_EXTRACT_CANCELLED` / `E.NODE_LOOTED`

With a single `E.ACTION_FEEDBACK` subscription that dispatches by `action` + `phase`:

```js
on(E.ACTION_FEEDBACK, ({ action, phase, nodeId, progress, result }) => {
  const handler = ACTION_ANIMATION_MAP[action];
  if (handler) handler(phase, nodeId, progress, result);
  else defaultAnimation(phase, nodeId, progress);
});
```

**Animation map:**
- `probe` → `handleProbeAnimation(phase, nodeId, progress)`
  - start: record timing for sweep
  - progress: `syncProbeSweep(nodeId, progress)`
  - complete: `clearProbeSweep()`
  - cancel: `clearProbeSweep()`
- `exploit` → `handleExploitAnimation(phase, nodeId, progress, result)`
  - start: record timing for brackets
  - progress: `syncExploitBrackets(nodeId, progress)` + `updateExploitProgress(progress)`
  - complete: `clearExploitBrackets()` + `flashNode(nodeId, result.success ? "success" : "failure")`
  - cancel: `clearExploitBrackets()`
- `read` → `handleReadAnimation(phase, nodeId, progress)`
  - start/progress/complete/cancel → sector scan
- `loot` → `handleLootAnimation(phase, nodeId, progress)`
  - start/progress/complete/cancel → ripple rings

**Remove TIMERS_UPDATED progress handling** for these actions — the timed-action
operator now emits progress events directly. (TIMERS_UPDATED still used for ICE
detection sweep, which is not migrated in this session.)

### Step 6.3: Rewire log-renderer.js

Replace per-action log subscriptions with `E.ACTION_FEEDBACK` dispatch:

```js
on(E.ACTION_FEEDBACK, ({ action, phase, nodeId, result }) => {
  const label = getNodeLabel(nodeId);
  const formatter = LOG_FORMAT_MAP[action];
  if (formatter) formatter(phase, label, result);
});
```

Each action gets a format function that produces the same log messages as before.

### Step 6.4: Add `emitActionFeedback` to ctx interface

The timed-action operator needs a way to emit `ACTION_FEEDBACK` events to the
game event bus. Add `emitActionFeedback(nodeId, action, phase, progress, result)`
to the ctx interface. In `game-ctx.js`, wire it to
`emitEvent(E.ACTION_FEEDBACK, { nodeId, action, phase, progress, result })`.

Alternatively, use the operator `events` return channel from Step 5.2 — the
runtime calls `onEvent("action-feedback", payload)` and the graph bridge
translates to `emitEvent(E.ACTION_FEEDBACK, ...)`.

### Step 6.5: Dual-emit for backward compatibility during migration

During Phases 6-7, both old and new events may be in flight. The renderers are
rewired to ACTION_FEEDBACK in this phase. In Phase 7, executors are replaced and
only ACTION_FEEDBACK is emitted. In Phase 8, old event types are deleted.

**Checkpoint:** `make check` passes. Renderers subscribe to `ACTION_FEEDBACK`.
Old executors still emit old events (renderers no longer listen). The visual
experience may be temporarily broken until Phase 7 wires the timed-action
operator to emit ACTION_FEEDBACK.

---

## Phase 7: Migrate Executors to Ctx Resolve Methods

**Goal:** Replace executor-driven action lifecycle with graph-native timed-action
operators. Resolution logic moves to ctx methods. This is the big swap.

### Step 7.1: Add resolve methods to ctx interface

In `game-ctx.js` (and the CtxInterface typedef), add:

- `resolveProbe(nodeId)` — generate vulns, set probed=true, raise local alert,
  reveal neighbors. Logic extracted from `probe-exec.js:handleProbeScanTimer`.
- `resolveExploit(nodeId)` — call `launchExploit()` from combat.js, handle
  success/failure result. Logic extracted from `exploit-exec.js:handleExploitExecTimer`.
  The exploitId is read from node state (set when exploit started).
- `resolveRead(nodeId)` — mark read, count macguffins. Logic extracted from
  `read-exec.js:handleReadScanTimer`.
- `resolveLoot(nodeId)` — collect macguffins, add cash, check mission. Logic
  extracted from `loot-exec.js:handleLootExtractTimer`.
- `resolveReboot(nodeId)` — already exists partially; consolidate.

Each resolve method also emits `ACTION_FEEDBACK` with phase `"complete"` and
any result data.

### Step 7.2: Rewire action start effects

Update the action definitions in traits to **not** call the old executor start
functions. Instead, effects just set state:

**Probe action effects:**
```js
effects: [
  { effect: "set-attr", attr: "probing", value: true },
  { effect: "set-attr", attr: "actionProgress", value: 0 },
]
```

The timed-action operator picks up `probing: true` on the next tick, computes
duration from grade table, and drives the lifecycle.

**Exploit action effects:**
```js
effects: [
  { effect: "set-attr", attr: "exploiting", value: true },
  { effect: "set-attr", attr: "actionProgress", value: 0 },
  { effect: "ctx-call", method: "setExploitDuration", args: ["$nodeId"] },
]
```

The `setExploitDuration` ctx method computes `2s + quality * 5s` from the
selected card and sets `actionDuration` on the node. The operator reads it
on the next tick.

For exploit specifically: the exploitId (card selection) needs to be stored
on the node or in action state so `resolveExploit` can find it. Options:
- Set `exploitId` as a node attribute when exploit starts
- Read it from `s.executingExploit` (but we're removing that state)

**Go with node attribute:** add `activeExploitId` to hackable trait attributes.
Set it in the exploit action effects. `resolveExploit` reads it from the node.

**Exploit noise:** currently emitted by a repeating timer. With the timed-action
operator, noise can be emitted at progress milestones (every 10%). The operator
config gets an optional `noiseInterval` or the resolve method can check progress
percentage and emit noise at thresholds.

Simpler: add `onProgress` callback config to the timed-action operator, fired
at configurable intervals. For exploit: emit `exploit-noise` graph message
every 10% progress so set-pieces (nthAlarm, probeBurstAlarm) still react.

### Step 7.3: Rewire cancel actions

Cancel action effects reset state directly:

```js
// cancel-probe effects:
effects: [
  { effect: "set-attr", attr: "probing", value: false },
  { effect: "set-attr", attr: "actionProgress", value: 0 },
  { effect: "ctx-call", method: "emitActionFeedback",
    args: ["$nodeId", "probe", "cancel", "0", "null"] },
]
```

### Step 7.4: Rewire action-context.js

Remove executor imports from `buildActionContext()`:
- `startProbe`, `cancelProbe`, `handleProbeScanTimer`
- `startExploit`, `cancelExploit`, `handleExploitExecTimer`
- `startRead`, `cancelRead`, `handleReadScanTimer`
- `startLoot`, `cancelLoot`, `handleLootExtractTimer`

The action context no longer needs these — actions execute through the graph's
action system, which sets attributes and fires effects. The ctx resolve methods
handle completion.

Update `game-ctx.js` to wire the new resolve methods instead of executor start
functions.

### Step 7.5: Rewire timer handlers in main.js and playtest.js

Remove timer handler registrations for `TIMER.PROBE_SCAN`, `TIMER.EXPLOIT_EXEC`,
`TIMER.EXPLOIT_NOISE`, `TIMER.READ_SCAN`, `TIMER.LOOT_EXTRACT`. These timers
are no longer scheduled — the timed-action operator uses graph ticks instead.

`TIMER.REBOOT_COMPLETE` may also be replaced if reboot uses the timed-action
operator.

### Step 7.6: Update graph-bridge.js

The graph bridge currently listens for `E.NODE_PROBED`, `E.NODE_ALERT_RAISED`,
`E.EXPLOIT_SUCCESS`, `E.EXPLOIT_FAILURE` and converts them to graph messages.

With the new system, some of these events are no longer emitted by executors.
The resolve methods need to either:
- Emit the same events so the bridge still works, OR
- Send graph messages directly (since they already have access to the graph)

**Go with direct graph messages:** resolve methods call `graph.sendMessage()`
directly for probe-noise, alert, and exploit messages. The bridge listeners
for these specific events can be removed.

### Step 7.7: Integration tests

Update `tests/integration.test.js`:
- Probe test: set `probing: true` on node, tick until complete, verify vulns
  generated and node probed
- Exploit test: set `exploiting: true` + `activeExploitId`, tick until complete,
  verify combat resolution
- Read test: set `reading: true`, tick until complete, verify node read
- Loot test: set `looting: true`, tick until complete, verify macguffins collected
- Cancel tests: start action, cancel mid-progress, verify reset
- Exploit noise: verify graph messages emitted at progress intervals
- Full gameplay loop: probe → exploit → read → loot via timed-action operators

**Checkpoint:** `make check` passes. All game mechanics run through the
timed-action operator. Executors are no longer called. Visual feedback works
via ACTION_FEEDBACK.

---

## Phase 8: Delete Executor Files & Cleanup

**Goal:** Remove dead code, delete old event types, clean up imports.

### Step 8.1: Delete executor files

- `js/core/actions/probe-exec.js`
- `js/core/actions/exploit-exec.js`
- `js/core/actions/read-exec.js`
- `js/core/actions/loot-exec.js`

### Step 8.2: Remove old event types from events.js

Delete the per-action event constants that are no longer emitted or subscribed to:
- `PROBE_SCAN_STARTED`, `PROBE_SCAN_CANCELLED`
- `EXPLOIT_STARTED`, `EXPLOIT_NOISE`, `EXPLOIT_INTERRUPTED`
- `READ_SCAN_STARTED`, `READ_SCAN_CANCELLED`
- `LOOT_EXTRACT_STARTED`, `LOOT_EXTRACT_CANCELLED`

Keep `NODE_PROBED`, `NODE_READ`, `NODE_LOOTED`, `EXPLOIT_SUCCESS`,
`EXPLOIT_FAILURE` etc. if they're still emitted by resolve methods for
other subscribers (graph-bridge, state sync). Audit each usage.

### Step 8.3: Remove old timer types from timers.js

Delete `TIMER.PROBE_SCAN`, `TIMER.EXPLOIT_EXEC`, `TIMER.EXPLOIT_NOISE`,
`TIMER.READ_SCAN`, `TIMER.LOOT_EXTRACT` if no longer scheduled.

### Step 8.4: Clean up imports across all files

Grep for imports of deleted modules and event types. Fix all broken references.

### Step 8.5: Remove `enrichWithGameActions` alias

The legacy alias in `game-types.js` can be deleted.

### Step 8.6: Remove old state fields

`s.activeProbe`, `s.executingExploit`, `s.activeRead`, `s.activeLoot` — these
tracked active timed actions in the old system. They may still be read by
renderers or other code. Audit and remove if fully replaced by node attributes
(`probing`, `exploiting`, `reading`, `looting`).

### Step 8.7: Final test sweep

`make check` — all tests pass, no dead imports, no references to deleted files.

**Checkpoint:** Clean codebase. Executor files deleted. Old event types removed.
Trait system is the canonical way to define node behavior. Timed-action operator
drives all action lifecycles. Resolve methods handle completion logic.

---

## Cross-Cutting: Dynamic Actions Console Commands

`js/core/console-commands/dynamic-actions.js` maintains a `STATIC_ACTION_IDS` set
of actions that have hardcoded console commands (probe, exploit, read, loot, etc.).
Any graph actions *not* in this set are dynamically registered as console commands
when a node is selected.

This file needs attention in two phases:

- **Phase 3**: Verify `STATIC_ACTION_IDS` still matches the action IDs produced by
  trait-based factories. If action IDs don't change (and they shouldn't), no update
  needed.
- **Phase 7**: When executors are replaced, action dispatch still flows through
  `starnet:action` events — dynamic-actions.js emits those. The dispatch chain
  remains the same. But verify the action execution path still works end-to-end
  for both static and dynamic commands.
- **Future**: As new traits add new action types, consider whether `STATIC_ACTION_IDS`
  should be derived from the trait registry rather than hardcoded.

---

## Risk Notes

- **Phase 7 is the big-bang swap.** If it gets too large, split into sub-phases:
  migrate probe first (simplest), then read, then loot, then exploit (most complex).
  Each sub-phase: wire one resolve method, update one action's effects, run tests.

- **Exploit is the most complex migration** due to: card-dependent duration, noise
  emission, combat resolution (probability + card decay + disclosure). Migrate it
  last.

- **TIMERS_UPDATED removal is risky.** The visual renderer's progress animations
  currently key off `TIMERS_UPDATED` for continuous updates. If we remove those
  subscriptions before the timed-action operator emits progress events at a
  sufficient rate, animations will stutter. Ensure the operator emits progress
  on every tick (10 events/second at 100ms ticks).

- **Playtest harness and bot-player.** Both `scripts/playtest.js` and
  `scripts/bot-player.js` wire timer handlers directly. Phase 7.5 must update
  playtest.js. Bot-player is out of scope but may break — document this.

- **Save/load round-trip.** Node attributes now include action state (probing,
  actionProgress, etc.). Verify save/load snapshot still works with the new
  attribute set. The timed-action operator should resume correctly from a
  loaded state where an action was in progress.

---

## Audit Findings (post-plan review)

Codebase audit revealed additional items the plan must account for:

### ICE noise detection depends on E.EXPLOIT_NOISE

`js/core/ice.js` (line ~73) subscribes to `E.EXPLOIT_NOISE` to detect active
exploits and set `lastDisturbedNodeId`. The timed-action operator must emit
exploit-noise graph messages at progress milestones (every 10%) so ICE detection
continues to work. These should be graph messages (not game events) so set-pieces
(nthAlarm, probeBurstAlarm) also react.

The timed-action operator config needs an `onProgressInterval` option:
```js
{
  name: "timed-action", action: "exploit", ...,
  onProgressInterval: 0.1,  // fire every 10% of duration
  onProgressEffects: [
    { effect: "emit-message", type: "exploit-noise", payload: { nodeId: "$nodeId" } }
  ]
}
```

ICE noise detection must then either:
- Subscribe to `E.ACTION_FEEDBACK` for exploit progress and check thresholds, OR
- Listen for `exploit-noise` graph messages via the graph bridge (preferred — keeps
  ICE reacting to graph events, not game events)

### playtest-graph.js is a second entry point

`scripts/playtest-graph.js` has identical executor imports and timer wiring as
`playtest.js`. Phase 7.5 must update **both** files. Same four timer handler
imports, same four `on(TIMER.*)` registrations.

### game-ctx.js has executor imports too

`js/core/node-graph/game-ctx.js` imports executor start/cancel functions (same
as `action-context.js`). Phase 7.4 must update **both** files — not just
action-context.js.

### Visual renderer reads state fields for progress bars

`visual-renderer.js` checks `state.executingExploit`, `state.activeProbe`,
`state.activeRead`, `state.activeLoot` in the `TIMERS_UPDATED` handler to drive
continuous animation. When these state fields are removed (Phase 8.6), the
renderer must track its own timing state internally — recording start time and
duration from the `ACTION_FEEDBACK` "start" phase event, then driving animation
from elapsed time.

This means the Phase 6 renderer rewire must:
1. Add local timing state (per-action start time + duration)
2. Set timing state on ACTION_FEEDBACK "start"
3. Drive animation from ACTION_FEEDBACK "progress" events (preferred) or from
   TIMERS_UPDATED with local state (fallback if per-tick progress events are
   sufficient)
4. Clear timing state on "complete" or "cancel"

### Integration tests assert on removed state fields (~60 assertions)

`tests/integration.test.js` directly asserts on `s.activeProbe`, `s.executingExploit`,
`s.activeRead`, `s.activeLoot`. These are removed in Phase 8.6. Tests must be
rewritten to check node attributes instead:
- `s.activeProbe` → `graph.getNodeState(nodeId).probing === true`
- `s.executingExploit` → `graph.getNodeState(nodeId).exploiting === true`
- etc.

This is a significant test rewrite — flag it explicitly in Phase 7.7.

### Save/load compatibility with old saves

Old saves may contain `activeProbe`, `executingExploit`, `activeRead`, `activeLoot`.
After Phase 8.6 removes these state fields, loading an old save mid-action will
silently discard the in-progress action. Options:
- Accept the break (saves are a dev/playtest tool, not production)
- Add a migration shim in `deserializeState` that strips old fields cleanly
- If an old save had an action in progress, it was already unresumable (timers
  don't serialize), so this is not a regression

Go with "accept the break" — document it in release notes if needed.
