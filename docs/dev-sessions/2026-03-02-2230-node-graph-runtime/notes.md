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

---

## Session Continuation (2026-03-03): New Capabilities + Set-Pieces

### Cheating patterns eliminated

Before this continuation, several set-pieces and playtest scenarios were "cheating" —
manually calling `setQuality()` to fire triggers that the circuit didn't actually wire
to. The problem was found by tracing through the actual message flow rather than
trusting that "the tests pass." Fixes:
- `counter` atom now has a `filter` config to count only matching message types
- `flag` atom added: sets a node attribute on matching message type, with optional `on:`,
  `when:` (payload filter), `attr:`, `value:` config
- `watchdog` atom added: resets on any non-tick message, fires `set` after N silent ticks
- `nthAlarm` redesigned: counter(filter: "probe-noise") emits "set" → alarm-latch
- `deadmanCircuit` redesigned: uses watchdog atom directly (old design with clock arming
  latch via DFS couldn't be suppressed by heartbeat within the same tick)
- `idsRelayChain` redesigned: monitor uses flag(on:"alert") atom; trigger watches node-attr
- Quality isolation bug fixed: two instances of same set-piece shared quality names;
  `instantiate()` now prefixes quality names in conditions and effects

### Four new system capabilities added

1. **`tally` atom** — quality-delta on message receive. Returns `qualityDeltas` from
   `applyAtoms`; runtime `_deliver` applies them to the quality store. Config: `on:`,
   `quality:`, `delta:`.

2. **Repeating triggers** — `TriggerDef.repeating: true` skips `_fired` tracking, so
   the trigger fires every evaluation cycle while its condition is true. The trigger's
   effects can reset the condition (e.g. `quality-set 0`) to create burst-counting patterns.

3. **Atom destinations override** — any atom can specify `config.destinations` to hard-wire
   outgoing message targets, bypassing edge-based routing. `relay` and `debounce` use
   `config.destinations ?? message.destinations`. `instantiate()` prefixes destinations
   arrays alongside inputs/quality. Enables "hidden channel" circuits.

4. **`debounce` atom** — forward first matching message, suppress for N ticks. Config:
   `on:`, `ticks:`, `destinations:`. Internal state: `_debounce_cooldown`. Useful for
   rate-limited sensors, noisy channels, burst suppression.

### New set-pieces demonstrating the capabilities

- **`probeBurstAlarm`** — tally + repeating trigger: spawns ICE every 3rd probe, resets
  counter. Escalates indefinitely unlike `nthAlarm`.
- **`noisySensor`** — debounce: first probe per 4-tick window raises alert, subsequent
  probes suppressed. Gives player a "quiet window" after first contact.
- **`hiddenChannelRelay`** — destinations override: relay hard-routes to a covert monitor
  with NO visible graph edge. *(Removed in next session — see below.)*

### Bugs hit

- `noisySensor` alarm node used `latch` atom (responds to "set"/"reset" only), but
  received "probe-noise" from debounce. Fixed by using `flag(on: "probe-noise")` instead.
- TSC complained about `qualityDeltas` not in return type of `applyAtoms` — fixed by
  updating the `@returns` JSDoc annotation.
- `debounce` test for "forwards probe again after cooldown expires" failed for the same
  `flag` vs `latch` reason — the alarm-latch wasn't responding to probe-noise.

---

## Session Continuation (2026-03-03, part 2): Design Revision + Bug Fix

### Graph legibility principle — hidden channels removed

User feedback: "I want connections to be legible to the player so they can figure out how
to manipulate the system." `hiddenChannelRelay` used `destinations` override to create a
connection invisible in the graph — the player could trigger a trace without any visible
signal path. That's a gotcha, not a puzzle.

Decision: **`destinations` override is internal-only.** It's documented in `set-pieces.js`
with an explicit warning: don't use it to create connections invisible to the player. All
node-to-node relationships the player needs to reason about must appear as `internalEdges`.

**`hiddenChannelRelay` removed. `tamperDetect` added in its place.**

`tamperDetect` is a sequencing puzzle using only visible edges:
- IDS → security-monitor (alert relay, same as idsRelayChain)
- IDS → tamper-relay → tamper-flag (tamper circuit, all visible)
- Reconfiguring IDS emits a `tamper` message that propagates the tamper circuit
- Player must neutralize the tamper relay *before* reconfiguring the IDS, or the
  reconfigure itself triggers a trace
- Counterintuitive in a satisfying way: doing the right thing in the wrong order loses.
  But the circuit is legible — the player can figure it out.

### `emit-message` fundamental bug — fixed

Root cause discovered while testing `tamperDetect`: `emit-message` was calling
`sendMessage(nodeId, msg)` → `_deliver(nodeId, msg)`, which re-enters the source node's
own atoms. The IDS has `relay(filter:"alert")` — the `tamper` message emitted by the
reconfigure action was filtered out at the source before it could reach `tamper-relay`.

Fix: added `_emitFrom(sourceNodeId, message)` to `NodeGraph`. It bypasses the source
node's atoms entirely and delivers directly to adjacent nodes, with the source already
in the path for cycle-guard purposes. `emit-message` in `applyEffect` now calls
`emitFrom` from the mutators object (not `sendMessage`).

`ActionMutators`, `TriggerMutators`, and `EffectMutators` typedefs all updated to
include `emitFrom`. Test helpers in `effects.test.js` and `actions.test.js` updated.

**Semantic clarification:** `emit-message` = emit *outward* from a node to neighbors.
`sendMessage` = inject a message *at* a node, which enters that node's atoms first.

### Redundant playtest script removed

`scripts/node-graph-playtest.js` was a verbose human-readable version of the same 9
scenarios covered by `set-pieces.test.js`. Removed it and the `ng-playtest` Makefile
target. Once the node graph integrates into the game engine, `scripts/playtest.js`
serves the human-readable trace use case.

### Final state (part 2)

- 566 unit/integration tests, 0 failures
- 13 set-pieces in catalog: idsRelayChain, nthAlarm, combinationLock, deadmanCircuit,
  switchArrangement, multiKeyVault, honeyPot, encryptedVault, cascadeShutdown,
  tripwireGauntlet, probeBurstAlarm, noisySensor, tamperDetect
- `scripts/node-graph-playtest.js` removed (redundant with test suite)
- Node graph runtime is complete and ready for integration into the game engine

---

## Session Continuation (2026-03-03, part 3): Pre-merge cleanup + research

### Further set-piece test review

Third full pass over `set-pieces.test.js` with fresh eyes. One stale comment found
in `cascadeShutdown` test 3 — referenced `relay-a`'s relay operator (removed in part 2)
as the reason subvert-ping reaches the watchdog. Updated to correctly describe the
mechanism: the `subvert` action uses `emit-message` → `_emitFrom`, which sends
`subvert-ping` directly to watchdog via graph edges, bypassing relay-a's operators
entirely.

Added a "Node graph / set-piece test honesty" subsection to `CLAUDE.md` with six rules
distilled from the bugs found across this session:

1. Trace the full signal path before calling a test honest
2. Assert the observable consequence (ctx call count), not intermediate atom state
3. No manual state resets between steps of the same scenario
4. One-shot triggers on repeating behaviors are almost always bugs
5. Every node in a set-piece must be on an active signal path
6. `destinations` override is internal-only

### Concept renamed: atom → behavior → operator

"Atom" was too ambiguous given existing use of the concept elsewhere in the codebase.
"Behavior" was tried but judged equally generic (too broad for game dev contexts).
Settled on **"operator"** — congruent with reactive programming terminology (RxJS),
where operators are the pipeline processing steps that transform/filter/route signals.
Reads naturally: "relay operator", "watchdog operator".

Mechanical rename across all files in `js/core/node-graph/`:
- `atoms.js` → `behaviors.js` → `operators.js`
- `atoms.test.js` → `behaviors.test.js` → `operators.test.js`
- `AtomConfig` → `BehaviorConfig` → `OperatorConfig`
- `applyAtoms/Behaviors` → `applyOperators`
- `registerAtom/Behavior` → `registerOperator`
- `getAtom/Behavior` → `getOperator`
- `atoms:/behaviors:` node property → `operators:`

Two pre-existing TSC warnings surfaced in `operators.js` during the rename:
- `config.attr` typed as `string | undefined` rejected as computed property key → added
  `if (!config.attr) return {}` guard before the computed property expression
- Unused `attrs` parameter renamed to `_attrs`

### Final state (part 3)

- 568 unit/integration tests, 0 failures

---

## Research for integration session: Statechart concepts

Context: reviewed XState actor model and statechart documentation
(https://stately.ai/docs/actor-model, https://stately.ai/docs/state-machines-and-statecharts)
to assess applicability to the node graph system and its future GUI representation.

### What's already congruent

The node-graph is already actor-model-shaped. Each node has private state (attributes),
communicates only via messages, can't directly mutate neighbors. Operators are what
XState calls "actions" — effects that fire during transitions. `requires` conditions
on actions are guards. Triggers are "eventless transitions" that fire when a condition
becomes true rather than on a specific event. The design arrived at the same place
independently.

XState itself cannot be used directly: its operator state lives in closures and is
not serializable, which violates the game's save/load contract. The virtual tick
system (`tick(N)` advancing N steps instantaneously) is also incompatible with
XState's real-time scheduling. The concepts transfer; the library doesn't.

### The key gap: named states vs attribute bags

The biggest statechart concept absent from the current system is **explicit named
states with guarded transitions**. Currently `accessLevel: "owned"` is a string in
an attribute bag — nothing enforces that `owned` is a valid value, nothing prevents
jumping directly from `locked` to `owned`, and conditions must spell out
`node-attr: accessLevel eq "owned"` rather than `in-state: owned`.

A statechart formulation would declare valid states and legal transitions up front:

```js
states: ["locked", "compromised", "owned"],
initial: "locked",
transitions: [
  { from: "locked",      event: "exploit", to: "compromised" },
  { from: "compromised", event: "exploit", to: "owned" },
]
```

**Entry/exit actions** are a related concept: automatically fire an effect when
entering a state. "When a node is compromised, emit an alert" currently requires an
explicit trigger. Entry actions would reduce that boilerplate.

Note: several operators are already informal state machines — `latch` (latched/
unlatched), `clock` (cycling), `counter` (counting to N), `watchdog` (armed/quiet).
They'd be cleaner expressed as formal state machines, but this is a refinement for
a future session, not a blocker.

### GUI implications for the integration session

**Make state transitions first-class events on the event bus.** Rather than the
renderer watching for attribute changes and inferring meaning, emit explicit
`{ type: 'node-state-changed', nodeId, from, to }` events. The renderer subscribes
and knows exactly what to animate without diffing.

**Transitions as animation hooks.** "Node transitioned `locked → compromised`" is a
clean, semantic trigger for a purposeful animation (e.g., the "gained access" sweep),
as opposed to a generic "something changed" pulse. The renderer maps transition names
to animations directly.

**Message flow as edge animations.** The `path` field on every message already tracks
exactly which edges were traversed. This is free data for animating signal propagation
in Cytoscape — flash each edge in the path sequence as the message hops. BFS dispatch
(if ever adopted) would produce a more legible "wavefront" animation than DFS.

**Operator state as node HUD.** Operators like `clock`, `watchdog`, and `debounce`
have internal timer state that's currently invisible. A watchdog halfway through its
period is building tension the player could feel — a countdown ring, a pulsing
indicator. The statechart framing helps: "the node is in the `armed` phase of its
watchdog cycle" is a renderable fact, not just `_watchdog_ticks: 2` in an attribute
bag.

**Parallel state regions.** Nodes are simultaneously in multiple orthogonal state
spaces: `accessLevel`, `forwardingEnabled`, `triggered`. Statecharts call these
*regions*. The renderer can represent them as distinct visual layers — base color for
access level, border indicator for forwarding state, glow for triggered state — so
the player reads all three at a glance without conflation.

**The player-facing statechart as puzzle UI.** The node's statechart *is* the puzzle
description. When a player inspects a node, showing the valid states and which actions
move between them ("from `compromised`, you can `reconfigure` to disable forwarding,
or `exploit` again to reach `owned`") makes the puzzle legible. This is the most
ambitious idea — essentially Stately's editor embedded in the game's node inspector —
but it's the logical endpoint of taking statechart concepts seriously as a UI pattern.

---

## Design note: Zachtronics adjacency + fast vs. slow play

The set-piece catalog has visible Zachtronics DNA. The deadman circuit is the clearest
example: the insight that *blocking* the heartbeat relay *causes* the alarm is exactly
the counterintuitive "aha" moment Zachtronics builds toward. Cascade shutdown's
race-against-watchdog tension and tamperDetect's ordering puzzle read like Zachtronics
levels.

**The key inversion:** Zachtronics players *build* circuits. Starnet players *subvert*
pre-built ones. That's a compelling asymmetry — instead of "wire this up to solve the
puzzle," it's "figure out how this is wired and work around it." The underlying skill
(circuit literacy) is the same; the player role is different. Closer to Thief or Deus
Ex than SpaceChem, but demanding the same logical reading of systems.

**The risk:** if circuits get too complex, the logic puzzle competes with dungeon-crawl
tension rather than feeding it. Zachtronics is a pure puzzle sandbox with no ICE
chasing you. Starnet has economy, time pressure, and threat escalation layered on top.

**The opportunity — fast vs. slow play as a design axis:**

The most interesting direction is using the *LAN or mission type* to dial between two
modes of engagement:

- **Slow / thinking mode**: LANs with elaborate circuit puzzles (combination locks,
  deadman perimeters, cascade shutdowns). Low time pressure, high cognitive demand.
  The player has time to inspect nodes, read the circuit, plan the sequence. Rewards
  literacy — understanding the system pays off. Feels like Zachtronics.

- **Fast / improvisation mode**: LANs under hard time pressure (active trace, noisy
  sensors, watchdogs already counting). The player can't stop to read every node —
  they make fast calls on partial information, accept some risk, adapt when things go
  wrong. Circuit literacy still helps but improvisation and risk tolerance matter more.

A corporate research lab might be slow-mode: heavily guarded, complex circuits, but
you have time if you're careful. A hot extraction under active trace is fast-mode: same
node types, but the clock is running and you're making snap decisions.

**Procgen implication:** biome palettes should encode the intended play mode alongside
the set-piece catalog. A high-pressure biome uses simpler set-pieces (tripwire, nth-alarm)
with tighter timing. A puzzle biome uses complex set-pieces (deadman, cascadeShutdown)
with more breathing room. The difficulty dial has two independent axes: *circuit
complexity* and *time pressure* — and interesting runs mix them rather than scaling
both together.
