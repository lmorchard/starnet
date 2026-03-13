# Spec: Set-Piece Jigsaw for Procedural Generation

## Goal

Build a procedural network generator where **everything is a set-piece**. A biome
is a catalog of set-pieces with metadata, and the generator assembles them into
coherent LAN networks using a skeleton-first approach.

This replaces the old layer-processor procgen (documented in `docs/PROCGEN.md`,
code deleted) with a system built around the existing set-piece infrastructure.

---

## Core Concepts

### Everything Is a Set-Piece

Every element in a generated network — from a single gateway node to a multi-node
puzzle circuit — is a set-piece. There is one abstraction for all content. A biome
is defined entirely by its catalog of available set-pieces.

This keeps the system uniform: the generator has one mechanism for placing content,
one metadata schema to filter by, and one port system for connections.

### Tags (Not Classes)

Set-pieces carry **tags** describing their role. Tags are non-exclusive — a piece
can be both `puzzle` and `treasure`.

| Tag | Purpose |
|-----|---------|
| `entry` | Network entry point (gateway + WAN). Exactly one per network. |
| `spine` | Connective tissue — routers, switches. Multiple outbound ports for branching. |
| `filler` | Cheap nodes that expand the map. Workstations, single servers. |
| `treasure` | Loot clusters. Easy-to-hack groups with cash/item rewards. |
| `defense` | Security infrastructure. IDS chains, tamper detection. Must subvert. |
| `pressure` | Timed threats, alarms, watchdogs. Punish slowness. |
| `puzzle` | Require solving a circuit to access rewards. Combination locks, encrypted vaults. |
| `trap` | Punish recklessness. Honeypots, tripwires. |
| `gate` | Must be owned/solved to access deeper areas. Routers (compromise to reveal beyond), firewalls (own to reveal beyond), puzzle locks. |

### Ports with Semantics

Each set-piece exposes **ports** — connection points where other set-pieces attach.
Ports carry metadata the generator uses for assembly:

```js
{
  nodeId: "router-1",          // which internal node IS the port
  direction: "outbound",       // "inbound" | "outbound" | "lateral"
  wantsTags: ["treasure", "filler"],  // what should attach here
  required: true,              // must the generator fill this?
}
```

**Direction semantics:**
- `inbound` — connects toward gateway / parent. Every piece has at least one.
- `outbound` — connects toward deeper content / children.
- `lateral` — peer connections within the same depth layer (e.g. cross-links
  between branches).

**`wantsTags`** — tag preferences for what should connect to this port. The
generator filters the catalog by these tags when picking what to attach. An
empty array means "anything."

**`required`** — if true, the generator must fill this port or the network is
invalid. If false, the port may be left unconnected (the piece works without it).

### Network Spec (4 Budget Axes)

A network generation request specifies four budget dimensions, each as a grade
(S/A/B/C/D/F):

| Axis | Controls |
|------|----------|
| **threat** | Security/pressure/trap density. ICE grade. Defense piece count. |
| **wealth** | Reward density. Treasure piece count. Cash value of loot. |
| **complexity** | Puzzle/gate density. Intellectual challenge. |
| **depth** | Literal hop count from gateway to deepest content. |

Grades map to numeric values via a tuning table (exact values determined during
implementation). The generator uses these to decide the tag mix and skeleton shape.

Budget lives at the **network level**, not per-set-piece. Each set-piece carries
a single **cost** grade representing its overall impact/footprint. The generator
spends budget by placing pieces whose costs fit within the remaining allocation.

### Set-Piece Cost

Each set-piece has a single `cost` grade (S through F):

- `F` — trivial. Single node, no mechanics. (gateway, single workstation)
- `D` — simple. Small node cluster, no puzzle or pressure. (office cluster, server bank)
- `C` — moderate. Basic mechanic or mild pressure. (IDS relay chain, noisy sensor)
- `B` — significant. Real puzzle or meaningful pressure. (combination lock, encrypted vault)
- `A` — major. Complex mechanic or high pressure. (cascade shutdown, probe burst alarm)
- `S` — centerpiece. Would be the defining challenge of a small network.

### Long-Range Dependencies

Some set-pieces require companion pieces placed elsewhere in the network:

```js
{
  tags: ["puzzle", "treasure"],
  cost: "B",
  requires: [
    { tags: ["treasure"], role: "key-server", count: 2, placement: "deeper" }
  ]
}
```

When the generator places a piece with `requires`, it queues the companion
placements as constraints. `placement: "deeper"` means the companions should
land at greater depth than the requiring piece.

Companions are linked to the parent piece via shared state (quality counters),
the same mechanism used by `multiKeyVault` today. The generator wires the
quality counter name during instantiation.

If the generator cannot place all required companions (ran out of room/budget),
the generation attempt fails and retries with a different seed.

---

## Biome

A biome is:

1. **A catalog of set-pieces** — each with tags, cost, ports, and flavor baked in.
   Node labels, types, and aesthetics live in the set-pieces themselves (e.g. a
   corporate biome has "enterprise firewall" nodes, a residential biome has
   "consumer router" nodes).

2. **Default budget profile** — metadata suggesting typical threat/wealth/complexity/depth
   grades for this biome. The overworld (future) can override these.

A biome does NOT contain generation logic — the generator algorithm is universal.
Biomes differ only in what pieces are available and what flavor they carry.

```js
{
  id: "corporate",
  defaultBudget: { threat: "C", wealth: "B", complexity: "C", depth: "C" },
  catalog: [ ...setPieces ],
}
```

---

## Generation Algorithm: Skeleton-First

Two-pass approach: first generate an abstract skeleton (tree of tag slots), then
fill each slot with a concrete set-piece from the biome catalog.

### Why Skeleton-First (vs Frontier Growth)

We considered two approaches:

**Frontier growth**: Organic, bottom-up. Start at entry, grow outward one piece
at a time. Each placement is local ("what fits this port?"). Shape emerges from
accumulated decisions.

- Pro: Simple single loop. High variety.
- Con: Hard to control overall shape. Budget management is tricky (overspend
  early, starve later). Long-range dependencies are awkward — must queue
  requirements and hope they fit later.

**Skeleton-first**: Top-down. Generate a blueprint of tag sequences first, then
fill with concrete pieces.

- Pro: Deliberate shape control. Budget allocated across branches upfront.
  Long-range dependencies are natural — place vault in branch A, keys in
  branch C by design. No backtracking.
- Con: Two passes. Skeleton templates could repeat.

**Decision: skeleton-first.** It handles distributed dependencies and budget
management better, which are the hard problems.

### Pass 1: Skeleton Generation

Input: network spec (4 budget grades).

Output: a tree where each node is a **slot** with assigned tags, at a specific
depth.

Algorithm:
1. Convert depth grade to a target max-hop count.
2. Create root slot: tags `[entry]`, depth 0.
3. At each depth layer, decide branching factor (1-3 branches) based on
   remaining wealth/complexity/threat budget to distribute.
4. Assign tag sequences to branches based on budget priorities:
   - High threat → more `defense`, `pressure`, `trap` tags in the path
   - High wealth → more `treasure` tags, especially at leaves
   - High complexity → more `puzzle`, `gate` tags
5. Explicitly place long-range dependency pairs: vault in one branch, its
   required key-servers in other branches.
6. Cap leaf slots with terminal tags (`treasure`, `filler`).

The skeleton is a lightweight planning structure — no concrete nodes or edges
yet. Just "depth 2, branch B, slot wants `[gate, puzzle]`."

### Pass 2: Slot Filling

Walk the skeleton. For each slot:

1. Filter the biome catalog by: slot's required tags (primary constraint),
   parent port's `wantsTags` (compatibility filter), cost fits remaining
   budget, piece has an inbound port.
2. If multiple candidates, pick one (weighted by cost fit, randomized by RNG).
3. Instantiate the piece (prefix-rewrite IDs, same as today).
4. Connect the piece's inbound port to the parent piece's outbound port.
5. If the piece has more outbound ports than the skeleton expects,
   opportunistically fill extras with `filler`/`treasure` pieces if budget
   remains. Otherwise leave them as unconnected optional ports.
6. If the piece has `requires`, verify the skeleton already has slots for the
   companions, or add them.

After all slots are filled, wire lateral edges for any `lateral` ports.

### Pass 3: Validation

Verify the assembled network:
- **Reachability** — gateway can reach at least one treasure node.
- **Mission target exists** — at least one high-value treasure piece was placed.
- **Defense coverage** — if threat budget is C+, at least one defense piece exists.
- **No dangling requirements** — all long-range dependencies were placed.
- **Budget adherence** — total cost doesn't wildly exceed spec.

If validation fails, retry with a different seed (same as old procgen — up to
10 attempts).

---

## Set-Piece Metadata Schema

The full metadata shape for a set-piece definition:

```js
{
  // Existing fields (unchanged)
  id: string,
  description: string,
  nodes: NodeDef[],
  internalEdges: [string, string][],
  triggers?: TriggerDef[],
  externalPorts: string[],          // kept for backward compat

  // New metadata for procgen
  tags: string[],                   // e.g. ["puzzle", "treasure"]
  cost: string,                     // grade: "F" through "S"
  ports: Port[],                    // replaces externalPorts for generation
  requires?: Dependency[],          // long-range companion requirements
}
```

Where:
```js
// Port definition
{
  nodeId: string,                   // which internal node is the port
  direction: "inbound" | "outbound" | "lateral",
  wantsTags: string[],              // what should attach here (empty = anything)
  required: boolean,                // must this be filled?
}

// Long-range dependency
{
  role: string,                     // identifier for linking (quality counter name)
  tags: string[],                   // what tags the companion piece should have
  count: number,                    // how many companions needed
  placement: "deeper" | "shallower" | "any",
}
```

---

## Existing Set-Pieces: Tag + Cost Assignments

Preliminary classification of the 16 existing set-pieces:

| Set-Piece | Tags | Cost | Notes |
|-----------|------|------|-------|
| (gateway+wan) | `entry` | F | Need to create as a set-piece |
| (single router) | `spine`, `gate` | F | Need to create. Gate: compromise to reveal beyond. |
| (single firewall) | `gate` | D | Need to create. Own to reveal beyond. Higher grade than router. |
| (single workstation) | `filler` | F | Need to create |
| serverBank | `filler`, `treasure` | D | Hub + 3 fileservers, no defenses |
| officeCluster | `filler`, `treasure` | D | Fileserver + 2 workstations |
| switchArrangement | `filler`, `puzzle` | D | Align 3 panels to reveal subnet |
| multiKeyVault | `puzzle`, `treasure` | D | 2 key-servers + vault (long-range candidate) |
| idsRelayChain | `defense` | C | IDS + monitor, subversion mechanic |
| noisySensor | `defense`, `pressure` | C | Debounced probe detector |
| nthAlarm | `pressure`, `trap` | C | Counter-based trace trigger |
| tamperDetect | `defense`, `puzzle` | B | Sequencing puzzle (neutralize relay first) |
| combinationLock | `puzzle`, `treasure`, `gate` | B | 3 switches + gate + vault |
| encryptedVault | `puzzle`, `treasure` | B | Timed key expiration |
| deadmanCircuit | `pressure`, `trap` | B | Heartbeat inversion puzzle |
| tripwireGauntlet | `pressure` | B | Delayed alarm, narrow timing window |
| honeyPot | `trap` | A | Looks lootable, triggers trace |
| probeBurstAlarm | `pressure`, `defense` | A | Escalating ICE spawner |
| cascadeShutdown | `pressure`, `puzzle` | A | Extreme time pressure multi-subvert |

Atomic set-pieces (gateway, single router, single workstation, single firewall)
need to be created to complete the "everything is a set-piece" model.

---

## Scope

### In Scope

- Set-piece metadata schema (tags, cost, ports, requires)
- Annotate all existing set-pieces with metadata
- Create atomic set-pieces (gateway, router, workstation, firewall)
- Biome catalog shape
- Skeleton generator (pass 1)
- Slot filler (pass 2)
- Validation (pass 3)
- At least one biome catalog (corporate) with enough pieces for generation
- Generated networks playable in the game
- Bot player works against generated networks

### Out of Scope

- Multiple biomes (only corporate for now; schema supports future biomes)
- Overworld / mission system (budget profiles hardcoded for now)
- Biome blending / mixing
- Visual layout optimization (use existing Cytoscape layout)
- New set-piece designs (use existing 16 + new atomics)
- Census / balance testing (separate session)

---

## ICE Placement

For v1: ICE is placed at the `security-monitor` node (from a `defense`-tagged
set-piece) when the network's threat grade is B or better. ICE grade matches
the threat grade. If no security-monitor exists (low-threat network), no ICE.

This is a simplification — future iterations may support multiple ICE, ICE on
non-monitor nodes, or ICE grade scaling independently of threat.

---

## Node Grade Scaling

Set-piece nodes declare **base grades** (e.g. a combination lock's switches are
grade C). The network spec applies a **grade modifier** that shifts all node
grades up or down:

- Low threat/complexity → grades shift down (easier nodes)
- High threat/complexity → grades shift up (harder nodes)

The modifier is a simple offset (e.g. +1 or -1 on the grade scale) applied
during instantiation. This means the same set-piece plays differently in a
D-threat vs A-threat network.

The grade modifier affects the effective cost of the network — harder nodes
consume more player resources. This is intentional: the budget axes control
the recipe, the grade modifier controls the difficulty of each ingredient.

---

## Vulnerability and Loot Assignment

After grade scaling, nodes receive vulnerabilities and macguffins based on
their final grade:

- **Vulnerabilities**: assigned from the existing vulnerability pool, filtered
  by grade. Higher-grade nodes get rarer/harder vulnerability types and fewer
  of them. Lower-grade nodes get more common vulnerabilities.
- **Macguffins**: assigned to lootable nodes (`treasure`-tagged set-pieces).
  Cash values scale with node grade and depth — deeper, harder nodes are worth
  more.

Exact tables are implementation details, but the principle is: grade drives
both difficulty and reward.

---

## Starting Hand

The generator does NOT control the starting hand directly. Instead, it can
emit a **recommended starting hand** as part of its output — a list of
vulnerability types that would give the player a fighting chance against
early-network nodes.

In the browser game, the starting hand will eventually be determined by
overworld preparation (not yet implemented). For now, hand-crafted networks
continue to use their existing starting hand logic.

The bot player may optionally use the recommendation to self-award matching
cards (a form of allowed cheating for balance testing). This keeps the
generator decoupled from hand management while ensuring the bot can actually
play generated networks.

---

## Determinism

**Same seed + same network spec = identical network.** This is a hard
requirement for:

- Save/load (network must reconstruct identically)
- Regression testing
- Bot determinism (same seed = same stats)

The generator uses an isolated RNG instance (not the gameplay streams),
seeded from the run seed. RNG consumption order must be stable — same
catalog iteration order, same skeleton decisions, same slot-filling picks.

---

## Coexistence with Hand-Crafted Networks

The three existing hand-crafted networks (corporate-foothold, research-station,
corporate-exchange) remain as-is. They are valuable for:

- Testing (known topology, deterministic)
- Bot benchmarking (established baselines)
- Fallback if generated networks have issues

The generator produces networks in the same shape (`buildNetwork()` →
`{ graphDef, meta }`) so both hand-crafted and generated networks are
interchangeable from the game's perspective. The level-select UI can offer
both.

Generated networks may eventually replace hand-crafted ones if they prove
equal or better in quality. Until then, both coexist.

---

## Output Format

The generator returns the same shape as hand-crafted networks:

```js
{
  graphDef: { nodes, edges },   // NodeGraphDef for the NodeGraph constructor
  meta: {
    networkName: string,        // e.g. "corporate-gen-abc123"
    networkType: "generated",   // distinguishes from hand-crafted
    biome: string,              // biome ID used (e.g. "corporate")
    seed: string,               // generation seed for reproducibility
    spec: { threat, wealth, complexity, depth },  // the budget grades used
    startCash: number,          // derived from wealth/complexity budget
    moneyCost: string,          // grade — derived from spec for compatibility
    iceConfig: {                // null if no ICE, otherwise placement info
      residentNodeId: string,
      grade: string,
    } | null,
    recommendedHand: string[],  // vuln IDs matching early-network nodes
    missionTarget: string|null, // explicit target node ID if injected (see below)
  }
}
```

The `meta` shape must be compatible with the existing game init pipeline —
`initGame()` reads `meta` to configure starting cash, ICE, and mission.

---

## Mission Target

By default, the existing mission system picks a random macguffin from lootable
nodes after network generation. The generator ensures at least one treasure
node with macguffins exists (enforced by validation).

The generator also supports an **injected mission target** via the network spec:

```js
{ threat: "B", wealth: "A", complexity: "C", depth: "B",
  missionTarget: { tags: ["puzzle", "treasure"], placement: "deepest" } }
```

When `missionTarget` is specified, the generator:
1. Ensures a piece matching the requested tags is placed at the requested depth.
2. Marks that piece's primary loot node in `meta.missionTarget`.
3. The game init pipeline uses this to set the mission target deterministically
   instead of picking randomly.

This supports future overworld/quest integration — a quest can demand "the
target is in an encrypted vault at the deepest point" and the generator
guarantees it. For now, `missionTarget` is optional and defaults to null
(random selection).

---

## Open Questions

- Exact grade-to-number mapping for budget axes (tuning table — iterate during impl)
- Branching heuristics for skeleton generation (how to decide 1 vs 2 vs 3 branches at each depth)
- Grade modifier formula (linear offset? multiplicative? per-axis?)
- Whether lateral ports are needed in v1 or can be deferred
