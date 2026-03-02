# Procedural Network Generation

This document describes how Starnet generates LAN dungeon networks: what drives the
decisions, how the pieces fit together, and where the design points toward future work.

---

## The Big Picture

When a run starts, the game needs a LAN — a graph of nodes and edges representing a
corporate network the player will infiltrate. Rather than hand-crafting every network,
the generator takes two inputs and produces a network that is appropriate for them:

- **`timeCost`** — how much player time the network demands (ICE grade, depth, gate count)
- **`moneyCost`** — how much player money the network demands (node grades, exploit card expenditure)

Both are expressed as grade letters (`F` through `S`). The same seed with the same grades
always produces identical output, which is important for save/load and for regression
tests.

The entry point is `generateNetwork(seed, timeCost, moneyCost, options)` in
`js/network-gen.js`. It retries up to ten times with different RNG seeds if the network
fails structural validation, then returns a NETWORK-shaped object ready for `state.js`.

---

## Budget Tables

Before any nodes are placed, the generator translates grade letters into concrete
parameters via two lookup tables.

**`TIME_BUDGET`** (indexed by `timeCost`) drives the security posture:

| Grade | ICE grade | Depth budget | Gate count |
|-------|-----------|-------------|------------|
| F     | F         | 3           | 0          |
| D     | D         | 2           | 1          |
| C     | C         | 3           | 1          |
| B     | B         | 3           | 2          |
| A     | A         | 4           | 2          |
| S     | S         | 5           | 3          |

`depthBudget` controls how many layers the network has and whether you get two routers
instead of one. `gateCount` controls whether firewalls spawn. These values feed directly
into the layer behavior atoms (see below).

**`MONEY_BUDGET`** (indexed by `moneyCost`) drives node difficulty and target depth:

| Grade | pathGradeMin | pathGradeMax | targetDepth |
|-------|-------------|-------------|------------|
| F     | F           | D           | 1          |
| D     | F           | C           | 1          |
| C     | D           | B           | 2          |
| B     | C           | A           | 3          |
| A     | B           | S           | 3          |
| S     | A           | S           | 4          |

`pathGradeMin`/`pathGradeMax` define the range from which node vulnerability grades
are drawn. `targetDepth` controls how deep (and thus how protected) the primary loot
target will be placed.

Additional tables set `startCash` and `startHandSpec` (the player's starting exploit
card mix) based on `moneyCost` — the idea being that tougher networks have harder nodes,
so the player arrives better equipped.

---

## Biome Bundles

The generator has no hardcoded knowledge of node types. All topology decisions live in
a **biome bundle** — a self-contained data object imported as `options.biome` (defaulting
to `CORPORATE_BIOME`).

A bundle has five parts:

```
{
  id:         string              // "corporate"
  roles:      Record<name, type> // role names → node type strings
  nodeRules:  Record<type, rule> // per-type generation metadata
  layers:     LayerDef[]         // spawn/wiring instructions (ordered)
  validators: Function[]         // structural correctness checks
  setPieces:  Record<id, piece>  // optional sub-graphs to inject
}
```

The corporate biome lives in `js/biomes/corporate/`. Its three source files are assembled
in `index.js`:

- **`gen-rules.js`** — `ROLES`, `NODE_RULES`, `LAYERS`
- **`validators.js`** — `VALIDATORS`
- **`set-pieces.js`** — `SET_PIECES`

### Roles

The role map decouples the engine from type strings. Layer definitions refer to roles
(`"routing"`, `"sensor"`, `"target"`), and the engine looks up the actual type string
from `biome.roles`. This means a different biome can map `"target"` to `"mainframe"` or
`"biobank"` without the engine caring.

```js
export const ROLES = {
  wan:     "wan",
  gateway: "gateway",
  monitor: "security-monitor",
  sensor:  "ids",
  gate:    "firewall",
  routing: "router",
  target:  "fileserver",
  premium: "cryptovault",
  filler:  "workstation",
};
```

### Node Rules

`NODE_RULES` carries per-type metadata consumed both at generation time and at runtime.
Each entry can have:

- **Topology fields** (`singleton`, `depth`, `connectsTo`, `leaf`, `security`,
  `mustBehindGate`, `iceResident`, `minCount`, `maxCount`) — describe what the node
  type means in the game world
- **Generation fields** (`gradeRole`, `fixedGrade`, `minMoneyGrade`, `labels`) —
  tell the generator how to grade and name nodes of this type

The `labels` pool is shuffled once at the start of each `buildNetwork` call using the
generation RNG, then popped. Label pools preserve `NODE_RULES` key order across shuffles
to keep the RNG sequence stable across refactors.

---

## The Layer-Processor Engine

`buildNetwork` iterates `biome.layers` in order. Each layer definition is a plain object
describing one "wave" of node spawning:

```js
{
  role:           "routing",
  count:          ({ tc }) => tc.depthBudget >= 3 ? 2 : 1,
  depth:          1,
  gradeRole:      "path",
  connectTo:      "gateway",
  alsoConnectTo:  "sensor",
}
```

**`count`**, **`depth`**, and **`connectTo`** may be plain values or functions receiving
`{ tc, mc, state }`, where `tc`/`mc` are the budget objects and `state` is
`spawnedByRole` — a live map of `role → [nodeId, ...]` accumulated as each layer runs.
This lets later layers ask "how many routers exist?" or "does a gate exist?". The target
layer uses a `connectTo` function to route through the gate when one exists and the target
is deep enough, falling back to routing otherwise.

For each node spawned in a layer, the engine may create edges using four mechanisms:

| Field | Direction | When |
|-------|-----------|------|
| `connectTo` | `parent → this node` | Per spawned node; picks from `spawnedByRole[role]` using RNG if multiple |
| `connectsTo` | `this node → target` | Per spawned node; sensor reporting to monitor |
| `alsoConnectFrom` | `parent[0] → this node` | Per spawned node; wan connects to gateway |
| `alsoConnectTo` | `this[0] → target[0]` | Once after the full layer loop; routing[0] to sensor |

The distinction between `connectTo` (parent wires down to the new child) and `connectsTo`
(the new node wires out to a downstream target) exists because network topology edges and
event-flow edges point in opposite directions. Routers are children of the gateway; the
sensor _reports to_ the monitor rather than the other way around.

`alsoConnectTo` fires after all nodes in a layer finish spawning so that its edge appears
after the layer's `connectTo` edges in the edge list — which matters for snapshot
stability.

### Grade Resolution

Every layer specifies a `gradeRole` string that the engine passes to `resolveGrade()`:

| gradeRole | Result | RNG? |
|-----------|--------|------|
| `"fixed"` | `nodeRules[type].fixedGrade` | No |
| `"entry"` | `shiftGrade(pathGradeMin, -1)` | No |
| `"soft"` | `shiftGrade(pathGradeMin, -1)` | No |
| `"path"` | `randomGrade(rng, pathGradeMin, pathGradeMax)` | Yes |
| `"hard"` | `pathGradeMax` | No |
| `"above-min"` | `shiftGrade(pathGradeMin, +1)` | No |

Only `"path"` consumes RNG. The ordering of `"path"` layers in `LAYERS` is therefore
load-bearing for snapshot determinism — changing which layer runs first will shift every
subsequent `randomGrade` call.

The corporate LAYERS have two `"path"` layer definitions (routing, then target). Routing
spawns 1–2 nodes depending on `depthBudget`, so the total number of `randomGrade` calls
is 2–3 per generation (plus one more if a set piece fires, since `baseGrade` is resolved
as `"path"`). All other grade assignments are deterministic arithmetic on the budget
parameters.

---

## Set Pieces

After the main layer loop, the engine checks `biome.setPieces`. Each piece definition
has:

- **`nodes`** / **`edges`** — a small sub-graph with local IDs
- **`externalAttachments`** — how the sub-graph hooks into the main graph
- **`eligible({ mc, state })`** — whether this piece is even a candidate
- **`probability`** — chance (0–1) it actually fires if eligible

The engine iterates the registry, evaluates `eligible`, rolls against `probability`, and
calls `applySetPiece` (in `js/set-pieces.js`) for each that passes. The set piece engine
maps local IDs to real node IDs drawn from the generator's sequence, draws labels from
the same pools, and selects attachment nodes using RNG (but only consuming RNG when there
are multiple candidates of the right type).

The `careless-user` piece — the only piece in the corporate biome — injects a workstation
accidentally bridged to a fileserver, with a hardened firewall on the canonical path and
a soft workstation bypass. It only fires at `moneyCost >= C` when a gate exists, with
60% probability. Mechanically it creates an alternate route to a protected node, which is
interesting because it lets an attacker bypass the firewall entirely if they find the
workstation first.

The set piece system is designed so pieces can be **forced** via `options.forcePieces`
(an array of piece IDs). This is useful for testing and for future mission generation
that wants a specific topology guaranteed.

---

## Validators

After `buildNetwork` produces a candidate, `validate()` runs each function in
`biome.validators`. Each validator receives `(network, biome)` and returns `null` on
pass or a failure string. If any validator fails, `generateNetwork` discards the candidate
and retries with the next seed.

The corporate validators check:

1. **`hasAnchors`** — wan, gateway, and security-monitor all present
2. **`sensorAdjacentToMonitor`** — at least one IDS node adjacent to the monitor
3. **`missionTargetExists`** — at least one fileserver or cryptovault present
4. **`noOrphanNodes`** — every node has at least one edge
5. **`gatewayReachesTarget`** — BFS from the start node reaches at least one lootable node

Using `biome.roles` in validators rather than type strings means a different biome's
validators can run the same structural checks against its own role map. The checks
themselves are general graph-theoretic predicates; only the role names change.

---

## RNG Design

The generator uses an independent RNG that does **not** touch the named gameplay streams
(`exploit`, `combat`, `ice`, `loot`, `world`). The `makeSeededRng(seedString)` factory in
`js/rng.js` creates a Mulberry32 instance seeded via djb2 hash. The generation seed is
derived as `"${seed}-network-${attempt}"` so each retry gets a distinct but reproducible
sequence.

Because generation is isolated from gameplay RNG, the same run seed produces the same
network regardless of what happened in prior runs — and the same network generates
regardless of which exploit cards were drawn during play.

RNG consumption within the generator is intentionally minimal. The only calls are:

1. Label pool shuffles (one per type with labels, at the start)
2. `randomGrade` for `"path"` layers (2–3 calls, plus 1 if a set piece fires)
3. `pick()` for `connectTo` when multiple candidates exist (typically just filler→routing)
4. `pick()` for `connectsTo` when multiple candidates exist (currently no corporate layer
   triggers this — sensor→monitor has a singleton target — but the engine path exists)
5. Set piece `probability` rolls and external attachment picks (attachment picks only
   consume RNG when there are multiple candidates of the target type)

The `pick(rng, arr)` helper skips the RNG call entirely when `arr.length === 1`. This
is not an optimization — it's a correctness requirement. Consuming RNG for a
deterministic choice would shift the sequence for everything that follows.

---

## Adding a New Biome

The engine is biome-agnostic. Adding a second biome is a matter of creating a new bundle
directory and implementing the same five-part shape (`roles`, `nodeRules`, `layers`,
`validators`, `setPieces`). The only engine constraint is that `layers` must be ordered
so that:

- `connectTo`, `connectsTo`, and `alsoConnectFrom` references refer to already-spawned roles
- `"path"` grade assignments appear in the correct position relative to other RNG calls

A residential network might have roles like `modem`, `router`, `nas`, `smart-device`,
`gaming-rig` and simpler topology rules. A military network might have stricter
validators and a wider `pathGradeMin`/`pathGradeMax` spread. Neither requires touching
the engine.

Passing `{ biome: MY_BIOME }` to `generateNetwork` is all it takes.

---

## Future Directions

A few areas where the current design leaves obvious room to grow:

**Per-run biome selection.** Right now the biome is always corporate. The natural next
step is a world map or mission system that associates biomes with locations — a research
station uses a different bundle than a street-level criminal LAN, which differs from a
government facility. `generateNetwork`'s `options.biome` is already the right hook.

**Procedural mission injection.** The `forcePieces` option exists but missions don't use
it yet. A mission generator could express objectives as set pieces — force a
`"backdoor-account"` piece into a network, and the mission becomes "find and delete the
backdoor account." The validator system could even include a mission-specific check that
ensures the forced piece is reachable.

**More set pieces.** The careless-user piece demonstrates the concept but one piece is a
thin library. Candidates: honeypot (appears to be a juicy target but triggers silent
alert), network tap (hidden router branch, suggests a second party is already inside),
air-gap bridge (isolated subnet accessible only through a specific compromised node).

**Biome blending.** The layer-processor is strictly sequential, but nothing prevents a
layer from referencing roles defined in a "mixin" bundle. A corporate network with a
`"contractor-segment"` sub-bundle could be expressed by composing layers from two bundles.
This is speculative but the architecture doesn't resist it.

**Weighted label pools.** Currently all labels in a pool are equally likely. A weighted
pool (repeated entries, or a `{ label, weight }` shape) would let common names appear
more often than exotic ones without adding engine complexity.

**Depth as a graph property, not a layer constant.** Currently `_depth` is assigned
per-layer and drives the Y-axis layout. A future layout pass might compute depth as
longest path from the gateway, which would handle set pieces more naturally — right now
set pieces inherit hardcoded depth values that may not reflect their actual position in
the graph.
