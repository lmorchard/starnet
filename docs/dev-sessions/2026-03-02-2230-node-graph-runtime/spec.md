# Spec: Reactive Node Graph Runtime

## Problem

The current node system is a mix of hardcoded type behaviors, bespoke per-feature
logic (IDS → monitor alert chain, ICE resident, etc.), and scattered `if (node.type
=== 'X')` special cases. Adding new node types or puzzle mechanics requires new
engine code.

The goal is a self-contained, headless, testable runtime that expresses node
behavior as composable data-driven primitives: attribute bags, behavioral atoms,
typed message-passing, qualities, and triggers. No DOM, no Cytoscape, no game
engine integration — just the reactive core, provable by tests.

This is the foundation for eventually replacing the hardcoded node system. It is
**not** integrated into the game in this session.

## Design References

See `docs/BACKLOG.md` § "Node System Overhaul (Major Future Direction)" for the
full design rationale, precedents (Rocky's Boots, Caves of Qud, Sunless Sea), and
puzzle pattern catalog. This spec summarizes the implementable subset.

---

## Core Primitives

### 1. Nodes as Attribute Bags

Each node is a plain object with:
- `id` — unique string identifier
- `type` — human-readable label (no behavioral meaning)
- `attributes` — a free-form key/value map of typed data (`grade`, `accessLevel`,
  `alertState`, `forwardingEnabled`, arbitrary extras)
- `atoms` — ordered list of atom configurations: `[{ name, ...config }]`

### 2. Behavioral Atoms

Named, self-contained reactive functions registered by name. Each atom is a pure
function:

```
atom(nodeState, message, ctx) → { attributes?, outgoing? }
```

Where:
- `nodeState` — the node's current attributes (read-only view)
- `message` — the incoming message envelope (or `null` for tick/init signals)
- `ctx` — the game API context object
- Returns: optional attribute mutations and/or outgoing messages to emit

Atoms compose onto nodes via their atom list. Multiple atoms on one node are
applied in order.

**Core atoms to implement in this session:**

| Atom | Behavior |
|---|---|
| `relay(filter?)` | Forward matching messages to all connected nodes (or filtered by type); checks own `forwardingEnabled` attribute |
| `invert` | Flip `signal.active` on incoming signal messages before forwarding |
| `any-of(inputs)` | OR gate: emit `signal(active:true)` when any named input has sent an active signal |
| `all-of(inputs)` | AND gate: emit `signal(active:true)` only when all named inputs have sent active signals |
| `latch` | `set`/`reset` messages toggle a persistent `latched` attribute |
| `clock(period)` | Source atom: emit `signal(active:true)` every N ticks (no incoming trigger needed) |
| `delay(ticks)` | Buffer an incoming message and re-emit it after N ticks |
| `counter(n, emits)` | After N incoming triggers, emit a configured message |

Gate state (for `any-of`, `all-of`) is stored in node attributes.

### 3. Message Envelope

All messages share a common envelope:

```js
{
  type,                          // string: 'alert', 'probe-noise', 'signal', 'owned', etc.
  origin,                        // nodeId of first emitter; preserved through relays
  path: [nodeId, ...],           // forwarding history; cycle guard + audit trail
  destinations: null | [nodeId], // null = broadcast to all connected; array = multicast/unicast
  payload: {}                    // message-type-specific data
}
```

A relay that sees its own `id` in `path` drops the message (cycle detection).

**Initial message types:** `signal`, `alert`, `probe-noise`, `exploit-noise`,
`owned`, `unlock`, `heartbeat`, `timer-expired`.

### 4. Qualities

Named integer counters (or boolean flags) in a network-scoped namespace.
Atoms and triggers can read and write them.

```js
graph.getQuality('routing-panels-aligned')  // → number
graph.setQuality('routing-panels-aligned', 3)
graph.deltaQuality('routing-panels-aligned', +1)
```

### 5. Triggers

Named condition + effects pairs. Evaluated after every state mutation. Fire once
when condition transitions false → true.

```js
{
  id: 'vault-unlock',
  when: { type: 'all-of', conditions: [
    { type: 'node-attr', nodeId: 'A', attr: 'accessLevel', eq: 'owned' },
    { type: 'node-attr', nodeId: 'B', attr: 'accessLevel', eq: 'owned' },
  ]},
  then: [
    { effect: 'reveal-node', nodeId: 'hidden-vault' },
    { effect: 'log', message: 'Vault access granted.' },
  ]
}
```

Supported condition types: `node-attr`, `quality-gte`, `quality-eq`, `all-of`,
`any-of`.

Supported effects: `set-node-attr`, `reveal-node`, `enable-node`, `log`,
`ctx-call` (calls a named ctx API method).

### 6. Player Actions as Data

Player-invocable actions are first-class data definitions attached to nodes —
not bespoke handler code. An action specifies preconditions that must be true
for it to be available, and effects that execute when it is invoked.

```js
{
  id: 'flip-route',
  label: 'Reroute',
  requires: [
    { type: 'node-attr', attr: 'accessLevel', eq: 'owned' },
    { type: 'quality-gte', name: 'auth-tokens', value: 1 },
  ],
  effects: [
    { effect: 'toggle-attr', attr: 'aligned' },
    { effect: 'emit-message', message: { type: 'route-changed' } },
    { effect: 'quality-delta', name: 'routing-panels-aligned', delta: 1 },
  ]
}
```

The runtime exposes two methods for actions:

```js
graph.getAvailableActions(nodeId)   // → action[] filtered by passing requires
graph.executeAction(nodeId, actionId) // → runs effects if requires pass; throws if not
```

**Supported `requires` condition types** (same as trigger conditions):
`node-attr`, `quality-gte`, `quality-eq`.

**Supported `effects`:**
- `set-attr` — set a node attribute to a value
- `toggle-attr` — flip a boolean node attribute
- `emit-message` — inject a message into the node's atom pipeline
- `quality-set` — set a quality to a value
- `quality-delta` — increment or decrement a quality
- `ctx-call` — call a named ctx API method with optional args
- `log` — emit a log message via `ctx.log()`

Actions live in the node definition alongside atoms:

```js
{
  id: 'switch-A',
  type: 'routing-panel',
  attributes: { accessLevel: 'locked', aligned: false },
  atoms: [{ name: 'relay', filter: 'signal' }],
  actions: [{ id: 'flip-route', label: 'Reroute', requires: [...], effects: [...] }]
}
```

### 7. Game API Context

An injectable interface — the boundary between the node graph and the game engine.
The runtime accepts a ctx object; tests inject a mock; the real game will wire up
actual implementations later.

```js
ctx.startTrace()
ctx.cancelTrace()
ctx.giveReward(amount)
ctx.spawnICE(nodeId)
ctx.setGlobalAlert(level)
ctx.enableNode(nodeId)
ctx.disableNode(nodeId)
ctx.revealNode(nodeId)
ctx.log(message)
```

---

## The Runtime

`NodeGraph` is the top-level class:

```js
const graph = new NodeGraph({ nodes, edges, triggers }, ctx);

graph.sendMessage(nodeId, message);    // inject a message at a node
graph.tick(n);                         // advance N ticks (drives clock atoms, delay atoms)
graph.getNodeState(nodeId);            // → node attributes snapshot
graph.getQuality(name);               // → number
graph.setQuality(name, value);
graph.deltaQuality(name, delta);
```

Internally, each `sendMessage` call:
1. Delivers the message to the target node
2. Runs the node's atoms in order (each may mutate attributes or emit outgoing messages)
3. Delivers any outgoing messages to connected neighbors (respecting `destinations`)
4. Re-evaluates all triggers after the message wave settles

---

## File Structure

All new code under `js/core/node-graph/`:

```
js/core/node-graph/
  index.js          — re-export shim
  runtime.js        — NodeGraph class
  atoms.js          — atom registry + core atom implementations
  actions.js        — action evaluation: requires checking, effects execution
  message.js        — message factory, cycle guard
  qualities.js      — quality store
  triggers.js       — trigger evaluator
  ctx.js            — ctx interface typedef + null/mock implementations
  types.js          — JSDoc @typedef for NodeDef, AtomConfig, Message, Trigger, ActionDef, etc.
```

Tests under `tests/node-graph/`:
```
tests/node-graph/
  atoms.test.js     — unit tests for each atom in isolation
  actions.test.js   — unit tests for requires evaluation and effects execution
  runtime.test.js   — integration tests: relay chain, gate logic, triggers firing, actions
```

---

## Acceptance Criteria

The session is done when:

1. All core atoms pass isolated unit tests
2. An IDS → monitor relay chain works end-to-end:
   - `alert` message sent to IDS node → arrives at monitor node
   - IDS `forwardingEnabled = false` → message is dropped, monitor receives nothing
3. Gate atoms work:
   - `all-of` emits only when all named inputs have fired
   - `any-of` emits when any input fires
4. `latch` toggles state correctly on `set`/`reset`
5. `clock` emits on the correct tick interval via `graph.tick(n)`
6. `delay` re-emits a message after the correct tick count
7. A trigger fires once when its condition becomes true, and does not re-fire
8. Qualities read/write correctly and are testable in trigger conditions
9. The ctx mock records calls; trigger `ctx-call` effects invoke the correct method
10. Player actions:
    - `getAvailableActions(nodeId)` returns only actions whose `requires` pass
    - `executeAction(nodeId, actionId)` applies all effects correctly
    - `quality-delta` effect updates the quality store
    - `emit-message` effect feeds into the atom/trigger pipeline
    - An action with a failing `requires` condition is not returned by `getAvailableActions`
11. `make test` passes with no failures

## Out of Scope (This Session)

- Complex ICs (encapsulated subgraph nodes)
- Set-piece PCBs (prefab subgraph authoring)
- Integration with the existing game (`js/core/ice.js`, `state/`, etc.)
- Visual signal propagation in the graph UI
- `counter` atom (nice to have, cut if time is short)
