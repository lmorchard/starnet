# Plan: Reactive Node Graph Runtime

## Implementation Order

The primitives have natural dependencies: types → message → qualities → atoms →
conditions/effects (shared) → triggers → actions → runtime. Each step builds on
the previous and ends with passing tests.

A key structural note: **conditions and effects appear in both triggers and
actions** with the same vocabulary. They are implemented as shared utility
functions in `conditions.js` and `effects.js`, each taking a plain context
object (read accessors or write mutators) rather than importing the runtime
class. This avoids circular dependencies and keeps both modules testable in
isolation.

---

## Step 1 — Types and Message Foundation

**Context:** Nothing exists yet. This creates the type vocabulary and the
message primitive everything else builds on.

**Prompt:**

Create `js/core/node-graph/types.js` with JSDoc `@typedef` definitions for all
data shapes used by the reactive node graph runtime. Define:

- `NodeDef` — `{ id, type, attributes, atoms, actions? }`
- `AtomConfig` — `{ name, ...configParams }`
- `Message` — `{ type, origin, path, destinations, payload }`
- `TriggerDef` — `{ id, when, then, fired? }`
- `ActionDef` — `{ id, label, requires, effects }`
- `Condition` — union of `node-attr`, `quality-gte`, `quality-eq`, `all-of`,
  `any-of` condition shapes
- `Effect` — union of `set-node-attr`, `set-attr`, `toggle-attr`,
  `emit-message`, `quality-set`, `quality-delta`, `ctx-call`, `log`,
  `reveal-node`, `enable-node` effect shapes
- `CtxInterface` — the game API context shape (`startTrace`, `cancelTrace`,
  `giveReward`, `spawnICE`, `setGlobalAlert`, `enableNode`, `disableNode`,
  `revealNode`, `log`)

Create `js/core/node-graph/message.js` exporting:
- `createMessage({ type, origin, payload, destinations })` — returns a Message
  with `path: [origin]`
- `appendPath(message, nodeId)` — returns new message with nodeId appended to path
- `hasCycle(message, nodeId)` — returns true if nodeId already appears in path

Create `tests/node-graph/message.test.js` with tests for `createMessage`,
`hasCycle` (true when nodeId in path, false when not), and `appendPath`.

---

## Step 2 — Quality Store

**Context:** Types and message are done. Now add the quality store — a simple
named-counter map used by atoms, triggers, and actions.

**Prompt:**

Create `js/core/node-graph/qualities.js` exporting a `QualityStore` class with:
- `constructor(initial = {})` — accepts an optional initial values map
- `get(name)` — returns current value (default 0)
- `set(name, value)` — sets to value
- `delta(name, amount)` — increments/decrements
- `snapshot()` — returns a plain object copy of all qualities

Create `tests/node-graph/qualities.test.js` with tests covering:
- Default value is 0 for unknown names
- `set` and `get` round-trip correctly
- `delta` increments and decrements
- `snapshot` returns a copy (not a live reference)

---

## Step 3 — Atom Registry and Core Atoms

**Context:** Types, message, and qualities exist. Now implement the atom registry
and all core atoms. Atoms are pure functions; each can be tested in isolation by
calling the function directly with mock inputs.

**Prompt:**

Create `js/core/node-graph/atoms.js` exporting:

- `registerAtom(name, fn)` — registers an atom function by name
- `getAtom(name)` — returns the registered function or throws
- `applyAtoms(atomConfigs, nodeAttributes, message, ctx)` — runs each configured
  atom in order, accumulating attribute mutations and outgoing messages; returns
  `{ attributes, outgoing }`

Each atom function signature: `(config, nodeAttributes, message, ctx) →
{ attributes?, outgoing? }` where `attributes` is a partial patch (merged onto
current) and `outgoing` is an array of partial message descriptors `{ type,
payload, destinations? }`.

Implement and register these core atoms:

- **`relay`** — if `nodeAttributes.forwardingEnabled !== false`, re-emits the
  incoming message as outgoing (preserving type, payload, destinations). Supports
  optional `filter` config: only relay if `message.type === config.filter`.
  Skips if message is null.
- **`invert`** — if message type is `signal`, returns outgoing signal with
  `payload.active` flipped. Skips non-signal messages.
- **`any-of`** — config has `inputs: [nodeId, ...]`. Maintains
  `_anyof_state` attribute map (keyed by origin). On incoming signal message,
  updates the map entry for `message.origin`. If any entry is true, emits
  `signal(active:true)`; otherwise emits `signal(active:false)`.
- **`all-of`** — same structure as `any-of` but emits `signal(active:true)` only
  when all `inputs` entries are true.
- **`latch`** — on `set` message, sets `latched: true`; on `reset` message, sets
  `latched: false`. No outgoing messages.
- **`clock`** — config has `period` (in ticks). Maintains `_clock_ticks` attribute
  counter. On a tick message (type: `tick`), increments counter; when counter
  reaches period, emits `signal(active:true)` and resets counter to 0.
- **`delay`** — config has `ticks`. Maintains `_delay_queue` attribute (array of
  `{ message, remaining }`). On `tick`, decrements all remainders; emits any that
  reach 0. On other messages, enqueues `{ message, remaining: config.ticks }`.
- **`counter`** — config has `n` and `emits` (a message descriptor). Maintains
  `_counter_count`. Increments on any non-null, non-tick message. When count
  reaches `n`, emits the configured message and resets count to 0.

Create `tests/node-graph/atoms.test.js` with isolated unit tests for each atom.
Test each by calling the atom function directly with crafted inputs — no runtime
needed. Cover: relay forwarding and filtering, relay blocked when
`forwardingEnabled: false`, invert flipping active, any-of and all-of gate
logic, latch set/reset, clock period counting, delay buffering, counter threshold.

---

## Step 4 — Conditions and Effects (Shared Utilities)

**Context:** Atoms, qualities, and message are done. Conditions and effects are
the shared vocabulary used by both triggers and actions. Building them as
standalone utility functions (taking plain context objects, not the runtime)
keeps them testable and avoids circular dependencies.

**Prompt:**

Create `js/core/node-graph/conditions.js` exporting:

```js
evaluateCondition(condition, { getNodeAttr, getQuality })
```

Supports condition types:
- `node-attr` — `{ type, nodeId, attr, eq }` — true if
  `getNodeAttr(nodeId, attr) === eq`
- `quality-gte` — `{ type, name, value }` — true if `getQuality(name) >= value`
- `quality-eq` — `{ type, name, value }` — true if `getQuality(name) === value`
- `all-of` — `{ type, conditions: [...] }` — true if all sub-conditions are true
- `any-of` — `{ type, conditions: [...] }` — true if any sub-condition is true

Create `js/core/node-graph/effects.js` exporting:

```js
applyEffect(effect, { getNodeAttr, setNodeAttr, getQuality, setQuality,
                      deltaQuality, sendMessage, ctx })
```

Supports effect types:
- `set-attr` — `{ effect, attr, value }` — calls `setNodeAttr(attr, value)`
- `toggle-attr` — `{ effect, attr }` — flips boolean via `setNodeAttr`
- `set-node-attr` — `{ effect, nodeId, attr, value }` — sets attr on another
  node (for trigger effects that target a different node)
- `emit-message` — `{ effect, message }` — calls `sendMessage` with the
  partial message descriptor
- `quality-set` — `{ effect, name, value }` — calls `setQuality`
- `quality-delta` — `{ effect, name, delta }` — calls `deltaQuality`
- `ctx-call` — `{ effect, method, args? }` — calls `ctx[method](...args)`
- `log` — `{ effect, message }` — calls `ctx.log(message)`
- `reveal-node` — `{ effect, nodeId }` — calls `ctx.revealNode(nodeId)`
- `enable-node` — `{ effect, nodeId }` — calls `ctx.enableNode(nodeId)`

Create `tests/node-graph/conditions.test.js` testing all condition types with
mock accessor functions. Create `tests/node-graph/effects.test.js` testing all
effect types with mock mutator functions and a spy ctx.

---

## Step 5 — Trigger Evaluator

**Context:** Conditions and effects utilities exist. Now build the trigger
evaluator — evaluated after every state mutation, firing once per condition
transition.

**Prompt:**

Create `js/core/node-graph/triggers.js` exporting a `TriggerStore` class:

```js
class TriggerStore {
  constructor(triggerDefs)   // accepts array of TriggerDef
  evaluate(stateAccessors, mutators)  // check all unfired triggers; apply effects for newly true ones
  reset()                    // clear fired set (for testing)
  getFired()                 // → Set of fired trigger ids
}
```

`evaluate` calls `evaluateCondition` for each unfired trigger's `when` condition
using `stateAccessors`. If a trigger's condition is newly true (not previously
fired), it applies each `then` effect via `applyEffect` using `mutators`, then
marks the trigger as fired. A fired trigger never re-evaluates.

The `stateAccessors` and `mutators` objects are the same shape used by
`conditions.js` and `effects.js`.

Create `tests/node-graph/triggers.test.js` with tests:
- A trigger with a `node-attr` condition fires when the attribute matches
- A trigger fires only once even if the condition stays true
- A trigger with `all-of` fires only when all sub-conditions are true
- A `ctx-call` effect invokes the spy ctx method with correct args
- A `quality-delta` effect updates the quality store

---

## Step 6 — Action Evaluator

**Context:** Conditions, effects, and triggers exist. Player actions share the
same condition/effect vocabulary, so this step is mostly wiring.

**Prompt:**

Create `js/core/node-graph/actions.js` exporting:

```js
getAvailableActions(actionDefs, stateAccessors)
// → ActionDef[] filtered to only those whose requires all pass

executeAction(actionDefs, actionId, mutators, stateAccessors)
// → applies effects of the named action; throws if action not found or requires fail
```

Both functions use `evaluateCondition` (from `conditions.js`) for `requires`
checking and `applyEffect` (from `effects.js`) for executing effects. The
`requires` array is treated as an implicit `all-of`: all conditions must pass.

Create `tests/node-graph/actions.test.js` with tests:
- `getAvailableActions` returns only actions whose requires pass
- An action with a failing requires condition is excluded
- `executeAction` applies `set-attr` effect correctly
- `executeAction` applies `quality-delta` effect correctly
- `executeAction` with `emit-message` calls `sendMessage` (via spy)
- `executeAction` throws if actionId is not found
- `executeAction` throws if requires fail

---

## Step 7 — NodeGraph Runtime

**Context:** All primitives exist. The runtime wires them together: it holds
node state, manages adjacency, dispatches messages through atoms, evaluates
triggers, and exposes the public API.

**Prompt:**

Create `js/core/node-graph/runtime.js` exporting a `NodeGraph` class:

```js
class NodeGraph {
  constructor({ nodes, edges, triggers = [] }, ctx = nullCtx)
  sendMessage(nodeId, message)
  tick(n = 1)
  getNodeState(nodeId)         // → shallow copy of node attributes
  getQuality(name)
  setQuality(name, value)
  deltaQuality(name, delta)
  getAvailableActions(nodeId)  // → ActionDef[]
  executeAction(nodeId, actionId)
}
```

Internally:
- Nodes stored by id; attributes stored as mutable objects
- Adjacency: `edges` is an array of `[fromId, toId]` pairs (undirected — messages
  flow both ways unless destinations restrict them)
- On `sendMessage(nodeId, message)`:
  1. Append nodeId to message path (cycle guard: if nodeId already in path, drop)
  2. Run `applyAtoms` for the node's atom configs; merge returned attribute patches
  3. For each outgoing message descriptor, resolve destinations: if
     `destinations` is null, deliver to all adjacent nodes; otherwise deliver to
     the named nodes. Call `sendMessage` recursively for each.
  4. After the message wave completes, call `_evaluateTriggers()`
- On `tick(n)`: send a `{ type: 'tick', origin: '__system__', path: [], payload:
  { n } }` message to every node n times (one tick per node per iteration),
  then evaluate triggers once after all nodes have ticked
- `_evaluateTriggers()`: build stateAccessors and mutators from `this`, call
  `triggerStore.evaluate(stateAccessors, mutators)`
- stateAccessors: `{ getNodeAttr: (nodeId, attr) => ..., getQuality: name => ... }`
- mutators for triggers: `{ setNodeAttr: (nodeId, attr, val) => ..., getQuality,
  setQuality, deltaQuality, sendMessage: (nodeId, msg) => this.sendMessage(...),
  ctx }`
- mutators for actions: same but `setNodeAttr` targets the action's own node
  (no nodeId parameter — actions mutate the node they're on)

Import `nullCtx` from `ctx.js` as the default context when none is provided.

Create `js/core/node-graph/ctx.js` exporting:
- `nullCtx` — an object implementing all ctx methods as no-ops
- `mockCtx()` — returns a ctx where every method is a `jest.fn()` spy (or a
  simple call-recording object if jest is not the test runner)

Create `js/core/node-graph/index.js` re-exporting `NodeGraph`, `createMessage`,
`QualityStore`, `nullCtx`, `mockCtx`.

---

## Step 8 — Runtime Integration Tests

**Context:** All modules exist. Write integration tests that exercise the full
pipeline end-to-end.

**Prompt:**

Create `tests/node-graph/runtime.test.js` with integration tests covering the
full pipeline:

1. **IDS relay chain** — two nodes (ids, monitor) connected by an edge; ids has
   `relay(filter: 'alert')` atom. Send `alert` to ids; assert monitor receives it
   via a spy. Set `forwardingEnabled: false` on ids; send again; assert monitor
   does not receive it.

2. **Gate: all-of** — three switch nodes and a vault node; vault has
   `all-of(inputs: ['A','B','C'])` atom. Fire signals from A and B; assert vault
   does not emit. Fire from C; assert vault emits `signal(active:true)`.

3. **Gate: any-of** — same setup; assert vault emits on first signal from any
   input.

4. **Latch** — node with `latch` atom; send `set`, assert `latched: true`; send
   `reset`, assert `latched: false`.

5. **Clock** — node with `clock(period: 3)` atom and a connected spy node; tick
   2 times, assert no signal; tick once more, assert signal received.

6. **Delay** — node with `delay(ticks: 2)` atom; send a message; tick 1 time,
   assert message not yet delivered downstream; tick 1 more, assert delivered.

7. **Trigger fires once** — trigger with `node-attr` condition and `ctx-call`
   effect; mutate node attribute to satisfy condition; assert ctx method called
   once; mutate again (condition still true); assert ctx method still called only
   once.

8. **Quality-based trigger** — trigger with `quality-gte` condition; delta quality
   until threshold reached; assert trigger fires.

9. **Player action available/unavailable** — node with an action requiring
   `accessLevel: 'owned'`; assert action not in `getAvailableActions` when
   `accessLevel: 'locked'`; set to owned; assert action appears.

10. **Player action execute — full pipeline** — execute an action with
    `quality-delta` and `emit-message` effects; assert quality updated and message
    delivered to connected node.

---

## Step 9 — Makefile and Test Runner Wiring

**Context:** All code and tests exist. Wire into the existing test runner and
confirm `make test` passes.

**Prompt:**

Check the existing `Makefile` and `tests/` directory structure to understand how
tests are currently run (likely `node --test` or a test runner config). Ensure
the new test files under `tests/node-graph/` are picked up automatically. If the
test glob needs updating, update it. Run `make test` and fix any failures. Run
`make lint` and fix any type errors surfaced by the JSDoc checker. Confirm all
acceptance criteria from the spec are green.
