# Notes: Reactive Node Graph Runtime

_Running notes and retrospective_

## Design Decisions (pre-execution review)

### DFS vs BFS Message Dispatch — Deferred

The current runtime design uses **depth-first (recursive) message dispatch**:
when `sendMessage` delivers to a node and that node emits outgoing messages,
those are delivered immediately via recursive `sendMessage` calls before
returning to the caller.

**Trade-offs:**

DFS (current design):
- Simpler to implement — natural recursion, no queue data structure
- A message's full propagation chain completes before the next message starts
- Easier to reason about in simple linear relay chains
- **Ordering surprises with gates**: if two signals need to converge at an
  `all-of` gate, arrival order depends on graph topology and DFS traversal.
  Signal from A might fully propagate (reaching the gate and beyond) before
  signal from B even starts.
- **Stack depth**: a 20-node relay chain = 20 levels of recursion. Fine at
  prototype scale (our networks are 15-40 nodes), but a concern if networks
  grow or if cycles are improperly guarded.

BFS (alternative):
- Uses a message queue — process all messages at the current "wave front"
  before advancing to the next hop
- More predictable ordering: all direct neighbors receive before any second-hop
  nodes, regardless of topology
- Better mental model for "signal propagation" — matches the visual metaphor
  of a wavefront expanding outward
- Slightly more complex to implement (explicit queue, loop instead of recursion)
- Trigger evaluation timing is clearer: evaluate once after the queue drains

**Decision:** Ship with DFS for this session. The networks are small, the
cycle guard prevents infinite recursion, and gate atoms track state by origin
(not arrival order) so they converge correctly regardless of DFS/BFS. If
ordering surprises surface during integration or playtesting, migrate to BFS
in a future session — the change is internal to `runtime.js` and invisible
to atoms, triggers, and actions.

### Tick Messages and Forwarding Atoms

`relay` and `invert` explicitly drop messages with `type === 'tick'`. Ticks
are node-local signals for driving `clock` and `delay` atoms and must not
propagate through the graph. Other atoms (`latch`, `counter`) already ignore
ticks by only reacting to specific message types.

### Gate Input Filtering

`any-of` and `all-of` atoms only track signals whose `origin` is listed in
their `inputs` config. Signals from unlisted origins are silently ignored.
This prevents stray signals from unrelated parts of the graph from polluting
gate state.

### Test Runner

The project uses Node.js built-in test runner (`node:test`), not jest. Mock
functions use `mock.fn()` from `node:test`. The `mockCtx()` helper in `ctx.js`
builds spies using a simple call-recording pattern that works without any
test framework dependency (so it can be used in both test files and in the
playtest harness for debugging).

### Progressive Atom Merge

When multiple atoms are configured on a node, `applyAtoms` merges each atom's
attribute patch into the node's attributes *before* running the next atom.
Later atoms see earlier atoms' mutations. Outgoing messages are appended
across all atoms. This makes atom ordering meaningful — a `[latch, relay]`
node can have the relay react to state the latch just set.

### Implicit nodeId for Actions

Action `requires` conditions and `set-attr`/`toggle-attr` effects target the
action's own node implicitly — they don't carry a `nodeId` field. The runtime
fills in the missing nodeId before calling the shared `evaluateCondition` and
`applyEffect` functions. This avoids redundancy in action definitions (every
action already knows which node it belongs to) while keeping the shared
utilities uniform (they always receive explicit nodeIds).

The `mutators` object carries a `targetNodeId` field that `applyEffect` uses
for self-targeting effects. `set-node-attr` effects always use their own
explicit `effect.nodeId`, ignoring `targetNodeId`.

### Uniform setNodeAttr Signature

`setNodeAttr` in the mutators object always takes `(nodeId, attr, value)` —
same 3-arg signature whether called from trigger context or action context.
No overloading based on caller. The difference between trigger and action
contexts is only in what `targetNodeId` is set to (null for triggers, the
action's node for actions).

### Serialization

All runtime state must be JSON-serializable. Atom internal state lives in node
`attributes` (e.g. `_clock_ticks`, `_delay_queue`, `_anyof_state`). No closures,
WeakMaps, or module-level variables for state. `snapshot()` captures everything;
`fromSnapshot()` reconstitutes it. This is a hard requirement inherited from the
game's save/load contract (see CLAUDE.md).

---

## Known Gaps (for future sessions)

### No Init Lifecycle

The spec mentions atoms can receive "null for tick/init signals" but the runtime
has no init phase — there's no `init` message sent to nodes after construction.

The existing game uses `onInit` hooks for things like assigning random macguffins
to lootable nodes and setting up initial state based on type/grade. When the
reactive runtime is integrated, it will need a way to run initialization logic.

Options:
- Send a `{ type: 'init' }` message to all nodes once after `NodeGraph`
  construction (simple, consistent with message-driven design)
- A dedicated `graph.init()` method that dispatches init messages
- Set initial attributes in node definitions (handles static values but not
  dynamic generation like random macguffin assignment)

For this session (standalone, no integration) it doesn't matter — tests set
initial attributes directly. But the integration session should address this
early.

### One-Shot Triggers

Triggers fire once (false → true transition) and never re-evaluate. This is
fine for puzzle completions (vault unlocks, sequence completes, tripwire fires)
but limits repeating/cyclical behaviors. Atoms themselves can repeat (clock,
counter, delay all cycle), so repeating behaviors should be modeled with atom
composition rather than triggers. If re-armable triggers are needed later, that's
a new feature, not a change to existing triggers.

### Message Type Transformation

There's no atom that transforms one message type into another. The self-resetting
trap pattern (latch receives `set`, then needs a delayed `reset`) requires a
two-node workaround: delay(N) → counter(n:1, emits: {type:'reset'}), where the
counter acts as a type transformer. This works but is awkward. If this pattern
comes up often in puzzle design, a dedicated `transform(from, to)` atom would
be cleaner. Note: `counter` is currently "cut if time short" — if it gets cut,
this workaround breaks. Not a v1 blocker (self-resetting trap is pattern #13 of
13 in the complexity catalog).

---

## Procedural Generation Strategy

These notes capture thinking about how the reactive runtime interacts with
procgen, for reference when building a next-gen procgen system.

### Why random atom composition doesn't work

The tempting approach — procedurally pick atoms from a palette and wire them
onto nodes — produces noise. Good puzzles require authorial intent. The deadman
circuit works because someone designed the insight that blocking a heartbeat
relay *causes* the alarm rather than silencing it. An algorithm can't stumble
onto that.

### Set-pieces as lego blocks (preferred approach)

A **set-piece** is a tested, self-contained subgraph: nodes with atoms
pre-wired, internal edges, triggers, actions, and defined **external ports**
(nodes that connect to the rest of the network). The generator's job becomes
placement and wiring, not behavior design.

A set-piece definition would look like:

```js
{
  id: 'combination-vault',
  nodes: [ /* NodeDef objects with atoms, actions, attributes */ ],
  internalEdges: [ /* [fromId, toId] pairs */ ],
  triggers: [ /* TriggerDef objects */ ],
  externalPorts: ['switch-A', 'switch-B', 'switch-C'],
  params: { grade: 'C', switchCount: [2, 4] }
}
```

This is the same `{ nodes, edges, triggers }` shape the `NodeGraph` constructor
takes, plus metadata for the generator. The runtime doesn't need to know about
set-pieces — they're a layer above it.

### Procgen pipeline

1. **Pick** set-pieces from a biome palette (corporate LAN gets
   security-ops-center, combination-vault, server-farm; research lab gets
   sequenced-airlock, data-silo, deadman-perimeter)
2. **Instantiate** — prefix all node IDs to avoid collision
   (`vault-1-switch-A`, `vault-2-switch-A`), rewrite internal references
   (atom `inputs`, trigger `nodeId`s, action `destinations`)
3. **Place** in the network topology — connect external ports to bridge nodes
   or other set-pieces' ports
4. **Parameterize** — scale grade, adjust timing (clock periods, delay ticks),
   vary switch count, set loot tables

### Key properties

- **Solvability by construction.** Each set-piece is tested in isolation using
  the reactive runtime's headless test infrastructure. The generator composes
  tested pieces rather than generating novel untested configurations.
- **Narrative coherence.** Biome palettes ensure set-pieces make thematic sense
  together. A corporate data center has security checkpoints, server farms, and
  executive vaults — not random gate circuits.
- **Difficulty scaling.** A set-piece can have its node grades scaled up, IDS
  chains lengthened, or vault conditions made more complex by adjusting
  parameters, not redesigning the circuit.
- **Testable at every level.** Individual set-pieces testable in isolation.
  Generated networks testable via bot-player. Balance tunable via census.

### NodeId rewriting during instantiation

When instantiating a set-piece, every `nodeId` reference needs prefixing — in
atom configs (`inputs`), trigger conditions (`nodeId`), action effects
(`destinations`), edges. This is mechanical but pervasive. The data shapes in
the current spec keep nodeId references in well-defined fields (never buried
in opaque payload objects), which makes find-and-replace straightforward.

### Relation to current procgen

The current `network-gen.js` generates topology (node placement, edges,
biome-based type selection) and `node-types.js` maps types to behaviors. The
set-piece approach replaces both — topology comes from set-piece placement and
port wiring, behavior comes from atoms pre-wired in each piece. It's a
from-scratch system that may borrow some heuristics (depth-based difficulty
scaling, connectivity constraints) but the core generation logic is
fundamentally different.
