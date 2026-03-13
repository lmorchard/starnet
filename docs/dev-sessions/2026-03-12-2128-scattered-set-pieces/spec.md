# Spec: Scattered Set-Pieces (Companion Piece System)

## Goal

Enable set-pieces whose nodes are distributed across the network rather than
co-located. A single authored puzzle (e.g., vault + 3 switches) gets "exploded"
by the generator: the core stays in one slot, while scattered nodes are placed
independently elsewhere in the LAN. Communication between scattered nodes and
the core happens via prefixed quality counters — no direct edges.

This creates a new class of puzzles: "hunt through the network to find all the
switches before you can crack the vault."

---

## Core Concepts

### Scatter Attribute

Nodes in a set-piece definition can be marked `scatter: true`:

```js
nodes: [
  { id: "switch-a", scatter: true, type: "routing-switch", ... },
  { id: "switch-b", scatter: true, type: "routing-switch", ... },
  { id: "switch-c", scatter: true, type: "routing-switch", ... },
  { id: "gate", type: "logic-gate", ... },     // core
  { id: "vault", type: "cryptovault", ... },    // core
]
```

**Core nodes** — no `scatter` flag. Connected via `internalEdges`, placed together
as a unit. Normal set-piece behavior.

**Scattered nodes** — `scatter: true`. No `internalEdges` to/from them. Communicate
with the core exclusively via qualities. Placed independently by the generator as
mini atomic pieces.

**The `scatter` attribute is generator-only.** It is only meaningful during
procedural network generation. In non-generated contexts (hand-crafted networks,
the mini-network test harness, `--piece` mode in the playtest harness),
`instantiate()` processes all nodes identically — scattered nodes will be
instantiated but have no edges, leaving them orphaned. Authors should use
co-located variants (e.g., the original `combinationLock`) for hand-crafted
networks and tests.

**Authoring invariants:**
- Every scattered piece **must have at least one core node**. Triggers and
  qualities need a host NodeGraph instantiation; a piece with zero core nodes
  has nowhere to anchor its triggers.
- `internalEdges` **must not reference scattered nodes**. The generator enforces
  this by filtering edges during core/scatter separation — any edge referencing
  a scattered node ID is dropped. This is a safety net; authors should simply
  not include such edges.

### Quality-Based Communication

Scattered nodes and core nodes share a quality namespace. The author writes
quality names without prefixes:

```js
// Scattered switch action
{ effect: "quality-delta", name: "locks-opened", delta: 1 }

// Core trigger
{ when: { type: "quality-gte", name: "locks-opened", value: 3 } }
```

During instantiation, `instantiate()` prefixes all quality names with the
instance prefix (e.g., `d3-0/locks-opened`). This already works — the existing
`instantiate()` rewrites `quality-delta`, `quality-set`, `quality-gte`,
`quality-eq`, and `tally` operator quality references.

The critical detail: **scattered nodes are instantiated with the same prefix as
the core piece**, not with a prefix derived from their placement slot. This is
what ties the qualities together.

### Instance Prefix as Player Clue

Scattered nodes keep their parent piece's prefix in their node ID. A switch
placed at depth 1 that belongs to a vault at depth 3 might be `d3-0/switch-a`.
The shared prefix is a diegetic breadcrumb — the player can reason about which
nodes belong to the same puzzle by reading the IDs.

### Placement Constraints

**Primary rule: scattered nodes must be reachable from the gateway without
traversing any gate-tagged piece.**

This prevents:
- Switches placed behind their own gate (impossible puzzle)
- Cross-deadlocks between two scattered pieces (gate A's switches behind gate B
  and vice versa)

**Important: gate-ness is a property of pieces, not skeleton slots.** The
skeleton assigns abstract tags to slots (e.g., `["puzzle", "treasure"]`), but
whether a slot contains a gate is only known after the slot filler places a
concrete piece there. A slot tagged `["puzzle"]` might get filled with a
`combinationLock` (which has `tags: ["puzzle", "treasure", "gate"]`) or a
`switchArrangement` (which has `tags: ["filler", "puzzle"]`, no gate).

This means valid scatter slot computation **cannot happen at skeleton time**.
It must happen during or after the slot-filling pass, when we know which pieces
actually occupy which slots.

**Two-pass filling approach:** The slot filler runs in two passes:
1. **Main pass** — fill all skeleton slots with concrete pieces as today. Track
   which placed pieces have the `gate` tag.
2. **Scatter pass** — for each placed piece that has scattered nodes, compute
   gate-free reachable slots and place the scattered nodes.

This avoids the ordering problem where we'd need to know gate positions before
they're placed. After the main pass, the full gate map is known.

**Eligibility during main pass:** When evaluating a candidate piece with
scattered nodes during the main pass, the filler must conservatively estimate
whether scatter placement will succeed. A simple heuristic: count unfilled
slots that aren't on paths through slots tagged with gate-compatible tags
(e.g., `["gate"]`, `["puzzle", "gate"]`). If the count is less than the
number of scattered nodes, skip the piece. This is an estimate — the actual
scatter pass may still fail if the slots get consumed by other pieces, in
which case the generation attempt retries.

**Eligibility rule: if all scattered nodes cannot be placed in valid slots,
the piece is not eligible for that network.** The generator picks a different
piece for the slot. This is the same behavior as when a piece's tags don't
match — no partial placement, no degraded puzzles.

### Piece Variants

Authors should create multiple variants of scattered puzzles with different
node counts to fit different network sizes:

- Small network (few open slots) → 1-switch vault variant
- Medium network → 3-switch vault variant
- Large network → 5-switch vault variant

Each variant is a separate `SetPieceDef` with its own `cost` grade. The
generator picks the variant that fits the available slot budget.

---

## New Effect: `log-template`

A new effect type for logging messages with dynamic value substitution:

```js
{ effect: "log-template", template: "Combination lock: ${quality:locks-opened}/3 switches activated" }
```

### Effect Handler (`effects.js`)

The handler in `applyEffect()`:
1. Parses `${quality:name}` tokens in the template string
2. Looks up the current quality value via `mutators.getQuality(name)` (already
   available in the mutators interface)
3. Substitutes the value into the string
4. Logs the result via `ctx.log()`

### Instantiation Rewriting (`set-pieces.js`)

`rewriteEffect()` needs a new case for `"log-template"`. It must parse the
template string, find all `${quality:name}` tokens, prefix each quality name,
and return the rewritten template. This is string manipulation inside a rewrite
pass — more involved than the simple field-copy pattern used by other effects:

```js
case "log-template": {
  const rewritten = effect.template.replace(
    /\$\{quality:([^}]+)\}/g,
    (_, name) => `\${quality:${pfx(name, prefix)}}`
  );
  return { ...effect, template: rewritten };
}
```

### Extensibility

This is useful beyond scattered pieces — any set-piece can use templated
logging for dynamic status messages. Future substitution types (e.g.,
`${node-attr:nodeId:attr}`) can be added by extending the regex and lookup
in `applyEffect()`.

---

## Scan Action on Core Gate

The core gate/vault node gets a "scan" action that reports puzzle progress:

```js
{
  id: "scan-lock",
  label: "Scan Lock",
  requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }],
  effects: [
    { effect: "log-template", template: "Combination lock: ${quality:locks-opened}/3 switches activated" },
  ],
}
```

This gives the player a concrete objective without revealing switch locations.
Available when the gate is owned — you know the puzzle exists and how much
progress you've made, but you still have to explore to find the remaining
switches.

---

## Generator Changes

### Slot Filler — Two-Pass Approach

The slot filler (`js/core/network/slot-filler.js`) changes from a single
depth-first pass to two passes:

**Pass 1 (main fill):** Fill all skeleton slots with concrete pieces, same as
today. Additionally:

1. **Detect scattered pieces.** When evaluating a candidate piece, check if it
   has any `scatter: true` nodes.

2. **Estimate scatter eligibility.** Count the scattered nodes. Estimate
   available scatter slots using the heuristic (unfilled slots not on
   gate-tagged paths). If insufficient, the piece is ineligible — skip it.

3. **Place core nodes only.** When a scattered piece is chosen, separate its
   nodes into core (no `scatter` flag) and scattered (`scatter: true`). Place
   core nodes, their internal edges, and triggers into the primary slot as
   today. Filter `internalEdges` to exclude any edge referencing a scattered
   node ID (safety net for authoring errors).

4. **Record scatter obligations.** Track which placed pieces have pending
   scattered nodes, along with their prefix and the scattered node definitions.

**Pass 2 (scatter fill):** After all skeleton slots are filled:

1. **Compute gate-free slots.** Walk the filled skeleton. Mark each slot as
   "gate-free reachable" if the path from the entry slot to that slot does not
   pass through any placed piece with the `gate` tag. This uses the **actual
   placed pieces**, not skeleton tags.

2. **Identify available attachment points.** Within gate-free slots, find placed
   pieces with unused outbound ports (or any accessible node the scattered node
   can wire to as a neighbor).

3. **Place scattered nodes.** For each scatter obligation:
   - The scattered node was already instantiated with the parent piece's prefix
     during pass 1 (sharing the same `instantiate()` call).
   - The generator synthesizes an implicit inbound port for the scattered node:
     `{ nodeId: "<prefix>/<nodeId>", direction: "inbound", required: true }`.
     This is not authored in the piece definition — scattered nodes have no
     ports since they have no edges in the authored piece. The generator
     creates the port to match the mini-atomic-piece placement pattern.
   - Wire the scattered node to an available attachment point in a gate-free slot.
   - Add the node and its edge to the output.

4. **Validate scatter success.** If any scatter obligation couldn't be fully
   placed (not enough gate-free attachment points), the generation attempt
   fails and retries with a different seed.

### Instantiation

`instantiate()` itself doesn't change — it already prefixes everything
correctly. The change is in **how the generator uses the result**: after
calling `instantiate()`, the generator separates core nodes from scattered
nodes. Both share the same prefix. Core nodes go into the primary slot
immediately; scattered nodes are held for pass 2.

### Cost Accounting

The **entire piece's `cost` grade is charged during pass 1** when the core
is placed. Scattered nodes do not incur additional budget cost — their
complexity is included in the piece's overall cost. A `scatteredLock3`
with cost `"B"` charges B-points once, regardless of how many scattered
nodes it has.

This is the right behavior: the piece cost reflects total puzzle complexity
(3 switches + gate + vault = B), not the physical node count. Do not charge
per-scattered-node during pass 2.

### Type Changes

The `NodeDef` typedef in `js/core/node-graph/types.js` needs a new optional
field:

```js
@property {boolean} [scatter] - node is placed independently by the generator
```

This is read by the generator during core/scatter separation. The NodeGraph
runtime ignores it — it's purely a generator hint.

### Biome Catalog Update

New scattered piece variants must be added to `CORPORATE_BIOME.catalog` in
`data/biomes/corporate.js`. The existing co-located versions (combinationLock,
multiKeyVault, encryptedVault) remain in the catalog for networks where
scattering isn't possible or appropriate.

### Legacy `Dependency` Typedef

The existing `Dependency` typedef and `requires` field on `SetPieceDef` in
`js/core/network/set-pieces.js` were designed for an earlier approach where
pieces referenced external companion pieces by tag/role. The `scatter`
attribute replaces this — the piece is self-contained, with scattered nodes
defined inline rather than referencing external pieces.

The `Dependency` typedef and `requires` field should be removed from
`SetPieceDef` to avoid confusion between the two systems. No existing piece
uses `requires`.

---

## Bot Player

The bot player (`scripts/bot/`) doesn't currently know about set-piece puzzle
actions (`activate`, `align`, `crack-vault`, `scan-lock`, etc.). These actions
default to instant execution (the `isInstant()` fallback in `execute.js`
returns `true` for unknown action IDs), so the bot won't crash — but it also
won't use them.

### In Scope

- **Add `activate` and `scan-lock` to the bot's action vocabulary.** The bot
  should activate switches when it owns them and scan locks when it owns a
  gate. These are instant, zero-risk actions — the bot should always take them
  when available.

- **Add `crack-vault` to the bot's loot heuristic.** When the bot owns a vault
  node and `crack-vault` is available, it should execute it (same priority as
  the existing `loot` action).

### Implementation

The simplest approach: in the bot's action scoring loop, check
`getAvailableActions()` for each owned node. If any action isn't in the bot's
known set (probe/exploit/read/loot/reconfigure/etc.), execute it as an instant
action with moderate priority. This covers `activate`, `align`, `crack-vault`,
`scan-lock`, and any future set-piece actions without hardcoding each one.

This is a generic "do available things on owned nodes" heuristic — the bot
doesn't need to understand the puzzle, just that there's a button to press.

---

## Set-Pieces to Build / Convert

### Scattered Combination Lock (from `combinationLock`)

Replace message-based `all-of` gate with quality-based communication:
- Each switch: `activate` action does `quality-delta: "locks-opened", 1`
- Core trigger: `quality-gte: "locks-opened", N` → reveal vault
- Gate node: `scan-lock` action reports `${quality:locks-opened}/N`

Variants:
- `scatteredLock1` — 1 switch, cost D
- `scatteredLock3` — 3 switches, cost B
- `scatteredLock5` — 5 switches, cost A

### Scattered Multi-Key Vault (from `multiKeyVault`)

Replace co-located key-servers with scattered key nodes:
- Each key-server: loot/own action does `quality-delta: "keys-collected", 1`
- Core trigger: `quality-gte: "keys-collected", N` → unlock vault action
- Gate node: scan action reports key progress

Variants:
- `scatteredKeyVault2` — 2 keys, cost C
- `scatteredKeyVault3` — 3 keys, cost B

### Scattered Encrypted Vault (from `encryptedVault`)

Scatter the key-gen nodes:
- Each key-gen: own action does `quality-delta: "decryption-keys", 1`
- Core trigger: `quality-gte: "decryption-keys", N` → enable timed loot
- Gate node: scan action reports key progress

Variants:
- `scatteredEncryptedVault2` — 2 key-gens, cost C
- `scatteredEncryptedVault3` — 3 key-gens, cost B

---

## Scope

### In Scope

- `scatter: true` attribute on set-piece nodes
- `NodeDef` typedef update: add optional `scatter` boolean field
- Generator support: two-pass filling, scatter eligibility, gate-free slot
  computation, scatter placement, synthetic inbound ports for scattered nodes
- Cost accounting: whole piece cost charged at pass 1, no per-node charge at pass 2
- Quality prefixing (already works via `instantiate()`)
- `log-template` effect with `${quality:name}` substitution
  - New case in `rewriteEffect()` for template string quality prefixing
  - New case in `applyEffect()` for quality lookup and substitution
- Scan action pattern for core gate nodes
- 3 scattered piece families (combination lock, multi-key vault, encrypted vault)
  with size variants
- Biome catalog update (`data/biomes/corporate.js`)
- Remove legacy `Dependency` typedef and `requires` field from `SetPieceDef`
- Bot player: generic "execute available actions on owned nodes" heuristic
- Edge filtering: drop `internalEdges` referencing scattered node IDs
- Authoring invariant: at least one core node per scattered piece
- Document that `scatter` is generator-only (ignored in hand-crafted networks)
- Playtest generated networks with scattered pieces
- Tests for the generator scatter placement logic
- Tests for `log-template` effect (rewriting + runtime)

### Out of Scope

- Scatter groups (pairs of nodes scattered as a unit) — future direction
- Placement preferences beyond "reachable without gates" (deeper/shallower/
  near-core) — future direction
- Visual indicators for scattered node relationships (beyond ID prefix)
- New puzzle types designed from scratch for scattering

---

## Future Directions

- **Scatter groups**: mark multiple nodes as a scatter unit that stays together
  (e.g., key-server + guard node placed as a pair). Requires a `scatterGroup`
  field instead of a boolean `scatter`.

- **Placement preferences**: author-specified hints like `placement: "shallow"`
  or `placement: "far-from-core"` for fine-grained control over where scattered
  nodes land.

- **Gate-behind-gate**: allowing scattered nodes behind *other* gates (not their
  own) for more complex puzzle layering. Requires dependency graph analysis to
  prevent deadlocks.

- **Dynamic scatter count**: the generator picks how many scattered nodes to
  place based on network size, rather than fixed variants. The trigger threshold
  adjusts automatically.
