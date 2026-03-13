# Network Branching & Hierarchical Generation — Implementation Plan

## Architecture Overview

The current pipeline: `generateSkeleton → fillSkeleton → assembleNetwork → validate`

This plan preserves that pipeline but extends it:
- **Skeleton** gains a hierarchical mode (backbone + per-wing sub-skeletons)
- **Slot-filler** gains sub-biome filtering, required piece placement, and full
  multi-port consumption
- **Assembly** gains LAN grade offset application
- **Generate** gains a decision point: F/D flat (existing) vs C+ hierarchical (new)
- **New data layer:** sub-biomes, recipes, backbone pieces added to the biome definition

Each phase produces testable, integrated code — no orphaned modules.

---

## Phase 1: Foundation — Types, Budget, Grade Utilities

**Goal:** Define the new data structures and utility functions that everything else
builds on. No behavior changes — pure additions.

### Prompt 1.1: Type Definitions

Read `js/core/network/set-pieces.js` for existing typedefs (`SetPieceDef`,
`BiomeDef`, `NetworkSpec`, `Port`) and `js/core/network/budget.js` for grade
utilities.

Add the following JSDoc typedefs to `set-pieces.js` (or a new types file if
`set-pieces.js` is getting crowded):

```
SubBiomeDef {
  id: string                    // e.g. "security-ops"
  name: string                  // display name: "Security Operations"
  description: string           // flavor text
  pieceIds: string[]            // set-piece IDs from the biome catalog (filter)
  requiredPieceIds: string[]    // must-place piece IDs (always placed in this wing)
  baseGrades: {                 // before LAN offset
    threat: string,             // grade F-S
    wealth: string,
    complexity: string,
    depth: string
  }
}

RecipeDef {
  id: string                    // e.g. "defense-contractor"
  name: string                  // "Defense Contractor"
  description: string           // flavor text for mission briefing
  mandatoryWings: string[]      // sub-biome IDs, always placed
  optionalPool: Array<{         // weighted pool to pick from
    subBiomeId: string,
    weight: number              // relative probability
  }>
}
```

Extend `BiomeDef` to include:
```
  subBiomes: SubBiomeDef[]      // available sub-biomes
  recipes: RecipeDef[]          // available recipe variants
  backbonePieceIds: string[]    // piece IDs eligible for backbone slots
```

Extend `NetworkSpec` to include:
```
  recipeId?: string             // selected recipe variant (optional, for C+ only)
  lanGrade?: string             // overall LAN grade for offset (optional, defaults
                                // to avg of spec grades)
```

Write unit tests verifying the type shapes are importable and well-formed.

### Prompt 1.2: Grade Offset and Budget Scaling Utilities

In `budget.js`, add:

1. **`lanGradeOffset(lanGrade)`** — returns the offset number per the spec table:
   F→0, D→0, C→1, B→1, A→2, S→2

2. **`applyGradeOffset(baseGrades, offset)`** — takes a SubBiomeDef's baseGrades
   and an offset, returns new grades with offset applied and capped at S.

3. **`hierarchicalBudget(spec)`** — expanded budget calculation for C+ networks.
   Returns `{ backboneBudget, wingBudgets: number[] }` given the spec and wing
   count. Target ranges:
   - C/B: 15-25 total (backbone ~4-6, wings split remainder)
   - A/S: 30-40+ total (backbone ~6-10, wings split remainder)

4. **`wingCount(complexityGrade)`** — returns wing count based on complexity:
   C→2, B→3, A→4, S→5 (F/D return 0 — flat mode)

Write unit tests for each function: offset table correctness, grade capping at S,
budget division, wing counts.

---

## Phase 2: Content — Sub-Biomes, Recipes, Backbone Pieces

**Goal:** Author the data that drives the new system. Still no behavior changes —
just data definitions wired into the biome.

### Prompt 2.1: Backbone Set Pieces

Read `data/biomes/corporate-pieces.js` to understand existing piece patterns.

Create backbone-tagged set pieces. These are simple routing nodes that form the
spine between wings. Each must have relay operators that forward alert-type
messages (enabling emergent security propagation).

Pieces to author:
- **`backboneRouter`** — 1 inbound, 2-3 outbound. Router with relay operator for
  alert messages. Tag: `["backbone"]`. Cost: F.
- **`backboneFirewall`** — 1 inbound, 1-2 outbound. Firewall (higher grade gate)
  with relay operator. Tag: `["backbone"]`. Cost: C.
- **`backboneHub`** — 1 inbound, 3-4 outbound. Hub router, more connection points.
  Tag: `["backbone"]`. Cost: D.

Add these to the corporate-pieces catalog. Add `"backbone"` to the tag coverage
system (it's just another tag — the skeleton will use it for backbone slots).

Write tests verifying: pieces instantiate correctly, relay operators are present,
port counts match declarations.

### Prompt 2.2: Sub-Biome Definitions

Create sub-biome definitions in a new file `data/biomes/corporate-sub-biomes.js`
(or add to `corporate.js`).

For each sub-biome, curate a `pieceIds` list by reviewing the full catalog in
`corporate-pieces.js` and selecting appropriate pieces. Also specify
`requiredPieceIds` and `baseGrades`.

**Security Ops:**
- pieceIds: ids-relay-chain, noisy-sensor, nth-alarm, deadman-circuit,
  probe-burst-alarm, cascade-shutdown, honey-pot, tripwire-gauntlet,
  single-firewall, single-router (+ other defense/pressure/trap pieces)
- requiredPieceIds: ["ids-relay-chain"] (guarantees IDS + monitor)
- baseGrades: { threat: "B", wealth: "F", complexity: "D", depth: "C" }

**Server Room:**
- pieceIds: server-bank, large-server-bank, data-center, vault-cluster,
  single-fileserver, single-router, encrypted-vault, multi-key-vault
- requiredPieceIds: []
- baseGrades: { threat: "F", wealth: "B", complexity: "D", depth: "C" }

**Office Floor:**
- pieceIds: office-cluster, single-workstation, single-fileserver,
  single-router, switch-arrangement
- requiredPieceIds: []
- baseGrades: { threat: "F", wealth: "D", complexity: "F", depth: "D" }

**Executive Suite:**
- pieceIds: fortified-gate, combination-lock, encrypted-vault, vault-cluster,
  single-firewall, single-workstation, multi-key-vault
- requiredPieceIds: []
- baseGrades: { threat: "C", wealth: "A", complexity: "B", depth: "C" }

These are starting points — tune piece lists during playtesting.

Write tests: each sub-biome's pieceIds all exist in the corporate catalog,
requiredPieceIds are a subset of pieceIds, baseGrades are valid grade strings.

### Prompt 2.3: Recipe Definitions

Create recipe definitions in `data/biomes/corporate-sub-biomes.js` (same file as
sub-biomes, or in `corporate.js`).

**Recipes:**

- **Defense Contractor** — id: "defense-contractor"
  - mandatoryWings: ["security-ops", "security-ops"]
  - optionalPool: [{ subBiomeId: "server-room", weight: 3 }, { subBiomeId: "office-floor", weight: 1 }]

- **Fashion Brand** — id: "fashion-brand"
  - mandatoryWings: ["security-ops"]
  - optionalPool: [{ subBiomeId: "office-floor", weight: 3 }, { subBiomeId: "executive-suite", weight: 2 }, { subBiomeId: "server-room", weight: 1 }]

- **Tech Company** — id: "tech-company"
  - mandatoryWings: ["security-ops"]
  - optionalPool: [{ subBiomeId: "server-room", weight: 3 }, { subBiomeId: "office-floor", weight: 2 }, { subBiomeId: "executive-suite", weight: 1 }]

Wire sub-biomes and recipes into the `CORPORATE_BIOME` definition (extend the
export with `subBiomes` and `recipes` fields).

Write tests: recipes reference valid sub-biome IDs, mandatory wings are non-empty,
optional pool weights are positive.

---

## Phase 3: Slot-Filler Enhancements

**Goal:** Extend the slot-filler with capabilities the hierarchical system needs.
Each change is independently testable against the existing flat skeleton.

### Prompt 3.1: Multi-Port Slot Consumption

Read `js/core/network/slot-filler.js`, specifically the `fillSlot()` function and
the opportunistic filler pass (the `while (piece.outboundNodeIds.length > 0 ...)`
block near the end).

Current behavior: the filler pass caps at `extrasAdded < 1`, so pieces with 3
outbound ports only get 1 extra branch (2 total: 1 skeleton child + 1 filler).

Change: remove the `extrasAdded < 1` cap. Let the filler pass consume ALL
remaining outbound ports, attaching filler/treasure pieces to each. Keep the
budget check (don't overspend). This means a router with 3 outbound ports will
naturally create 3 branches: 1 skeleton child + up to 2 filler extensions.

Also update skeleton children consumption: if a slot has multiple children AND the
piece has multiple outbound ports, wire them 1:1 instead of always consuming just
the first port.

Write tests:
- A piece with 3 outbound ports gets 3 branches filled (budget permitting)
- Budget exhaustion still prevents over-filling
- Existing single-port pieces behave identically (regression)

### Prompt 3.2: Sub-Biome Piece Filtering

Add a `subBiomeFilter` option to `fillSkeleton()` (or thread it through
`fillSlot()`). When present, the candidate selection step filters the catalog to
only pieces whose IDs appear in the sub-biome's `pieceIds` list.

Implementation:
1. Add an optional `piecePalette` parameter to `fillSlot()` — a `Set<string>` of
   eligible piece IDs. When null/undefined, use the full catalog (backward
   compatible).
2. In the candidate filtering step, add: `if (piecePalette && !piecePalette.has(piece.id)) continue`
3. The fallback to F-cost pieces should also respect the palette filter.

Write tests:
- With a palette of ["single-router", "single-workstation"], only those pieces are
  placed
- With no palette (null), full catalog is used (regression)
- Required piece IDs + palette interaction (next prompt)

### Prompt 3.3: Required Piece Placement

Add support for `requiredPieceIds` in the slot-filling process. Required pieces
must be placed in the wing before optional pieces fill remaining slots.

Implementation approach:
1. Before the main `fillSlot()` recursion, pre-assign required pieces to skeleton
   slots. For each required piece ID, find the piece in the catalog, find a
   compatible skeleton slot (matching tags or best-fit), and mark that slot as
   pre-assigned.
2. During `fillSlot()`, if a slot has a pre-assigned piece, use it instead of
   picking from candidates.
3. If required pieces can't be placed (no compatible slots), the generation attempt
   fails and retries.

Write tests:
- A sub-biome with requiredPieceIds: ["ids-relay-chain"] always produces a network
  containing an IDS + monitor
- Required pieces consume budget correctly
- A required piece that doesn't fit any slot triggers a retry

---

## Phase 4: Hierarchical Skeleton Generation

**Goal:** Build the backbone + wing skeleton generator. This is the core
architectural change.

### Prompt 4.1: Backbone Skeleton Generator

Read `js/core/network/skeleton.js` to understand the current `generateSkeleton()`
and `buildBranches()` functions.

Create a new function `generateBackbone(spec, biome, wingSpecs, rng)` that
produces a backbone skeleton:

1. Start with the entry slot (depth 0, tag: "entry") — same as current
2. Add a spine slot (depth 1, tag: "spine") — same as current
3. For each wing in `wingSpecs`, add a backbone slot (tag: "backbone") chained
   along the spine. Each backbone slot gets one child slot that will be the wing's
   entry point.
4. Backbone length = number of wings. Each backbone node connects to the next and
   to a wing entry.

The backbone skeleton is a linear chain (entry → spine → backbone-1 → backbone-2
→ ...) where each backbone node has a child slot reserved for a wing.

Return: `{ backbone: SkeletonSlot, wingEntrySlots: SkeletonSlot[] }`

Write tests:
- Backbone with 3 wings produces entry + spine + 3 backbone nodes
- Each backbone node has exactly 1 child (wing entry point)
- Backbone slots all have tag "backbone"

### Prompt 4.2: Per-Wing Skeleton Generation

Create a function `generateWingSkeleton(wingSpec, biome, wingEntrySlot, rng)` that
generates a sub-skeleton for a single wing.

This reuses the existing `buildBranches()` logic but:
1. Starts from the wing entry slot (not a new entry node)
2. Uses the wing's sub-biome grades (after LAN offset) for budget and branching
3. Uses the wing's budget slice (from `hierarchicalBudget`)
4. Tags are assigned based on the wing's sub-biome grade profile

The wing skeleton is attached as children of the wing entry slot in the backbone.

Return: the modified wingEntrySlot with children populated.

Write tests:
- A high-wealth wing skeleton has more "treasure" tagged slots
- A high-threat wing skeleton has more "defense" tagged slots
- Wing depth respects the wing's depth grade
- Wing budget is consumed correctly

### Prompt 4.3: Hierarchical Skeleton Orchestrator

Create `generateHierarchicalSkeleton(spec, biome, recipe, rng)` that ties it all
together:

1. Resolve which sub-biomes to use:
   - Start with recipe's mandatoryWings
   - Add optional wings from the weighted pool until wing count is reached
     (from `wingCount(spec.complexity)`)
2. Compute LAN grade offset from `spec.lanGrade` (or avg of spec grades)
3. For each wing, apply grade offset to sub-biome base grades → wing spec
4. Compute budget: `hierarchicalBudget(spec)` → backbone + per-wing budgets
5. Call `generateBackbone(spec, biome, wingSpecs, rng)`
6. For each wing, call `generateWingSkeleton(wingSpec, biome, wingEntrySlot, rng)`
7. Return the complete skeleton tree (backbone is root, wings are subtrees)

Write tests:
- Defense contractor recipe with complexity C produces 2 mandatory + 0-1 optional
  wings
- Grade offset is applied correctly (F base + A LAN = C wing grades)
- Total skeleton slot count is within budget
- The skeleton is a valid tree (no cycles, all slots reachable)

---

## Phase 5: Pipeline Integration

**Goal:** Wire the hierarchical system into the generate → fill → assemble →
validate pipeline.

### Prompt 5.1: Slot-Filler Per-Wing Filtering

Update `fillSkeleton()` to support per-wing sub-biome filtering.

The hierarchical skeleton has wing entry slots that know which sub-biome they
belong to. During filling:

1. When entering a wing subtree, look up the sub-biome for that wing
2. Build a piece palette from the sub-biome's pieceIds
3. Pre-assign required pieces for the wing
4. Pass the palette and pre-assignments through `fillSlot()` recursion
5. When filling backbone slots, use the biome's `backbonePieceIds` as the palette

Implementation: tag wing entry slots with metadata (sub-biome ID) during skeleton
generation. The slot-filler reads this metadata to switch palettes.

Write tests:
- A security-ops wing only places pieces from the security-ops palette
- A server-room wing only places server/loot pieces
- Backbone slots only use backbone-tagged pieces
- Required pieces are placed in their respective wings

### Prompt 5.2: Generate Pipeline Decision Point

Update `generateNetwork()` in `generate.js` to choose between flat and
hierarchical generation:

```
if (wingCount(spec.complexity) === 0 || spec grades are F/D) {
  // Existing flat path — generateSkeleton + fillSkeleton as today
} else {
  // Hierarchical path:
  // 1. Resolve recipe (from spec.recipeId or default)
  // 2. generateHierarchicalSkeleton(spec, biome, recipe, rng)
  // 3. fillSkeleton(skeleton, biome, spec, rng) with per-wing filtering
}
```

Both paths feed into the same assembleNetwork + validate pipeline.

Write tests:
- F/D spec produces a flat network (same as before, regression test)
- C spec with recipe produces a hierarchical network with wings
- A spec produces a larger network with more wings
- Generated networks pass validation

### Prompt 5.3: Assembly Grade Offset

Update `assembleNetwork()` to apply the LAN grade offset to wing node grades.

Currently, `gradeModifier()` shifts all node grades uniformly based on
threat+complexity average. The new system should:

1. Keep the existing gradeModifier for F/D flat networks (backward compatible)
2. For hierarchical networks, each wing's nodes get their offset-adjusted grades
   from the sub-biome (this was computed during skeleton generation and passed
   through). The assembly step should use the per-wing grades rather than a
   single global modifier.

Write tests:
- F/D networks use existing grade modifier (regression)
- A wing with base threat F in a B-grade LAN has its nodes shifted up by 1
- No node grade exceeds S after offset

---

## Phase 6: Generator Interface & Callers

**Goal:** Update the public API and all callers to support recipe selection.

### Prompt 6.1: Generator Interface Update

Update `NetworkSpec` to accept the new optional fields (`recipeId`, `lanGrade`).
Update `buildNetwork()` in `data/networks/generated.js` to pass through recipe
selection.

Update `scripts/playtest.js`:
- Add `--recipe` CLI argument (e.g., `--recipe defense-contractor`)
- Add `--lan-grade` CLI argument (e.g., `--lan-grade A`)
- Default to no recipe (flat generation) for backward compatibility
- `status full` should display recipe and wing info when present

Update the browser entry point (`js/ui/main.js` or wherever the generator is
called) to support recipe selection. For now, this can be a simple dropdown or
use the existing difficulty controls.

Write tests:
- playtest.js with `--recipe defense-contractor --lan-grade B` produces a
  hierarchical network
- playtest.js without recipe flags produces a flat network (regression)

---

## Phase 7: Layout & UX

**Goal:** Make the larger networks look and feel good in the browser.

### Prompt 7.1: Select-and-Fit Camera Behavior

Read `js/ui/graph.js` to understand how node selection works with Cytoscape.

When the player selects a node, animate the camera to:
1. Center on the selected node
2. Zoom to fit the selected node + its revealed neighbors (1-2 hops)
3. Use Cytoscape's `animate()` for smooth transitions

This should only trigger on player-initiated selection (clicking a node, using
the `select` command), not on programmatic state updates.

Write a Playwright test:
- Select a node → camera centers on it
- Selected node and neighbors are visible in viewport

### Prompt 7.2: Layout Tuning for Wing Clustering

Read the current layout configuration in `js/ui/graph.js`.

Adjust the layout algorithm to produce better wing clustering:
1. Try the existing layout engine with hierarchical networks — it may naturally
   cluster wings due to the chokepoint topology
2. If wings overlap or don't separate well, tune layout parameters:
   - Increase edge length for backbone edges (push wings apart)
   - Decrease edge length for intra-wing edges (pull wing nodes together)
   - Consider using `fcose` layout which handles clusters well
3. Allow networks to spread in all directions (not just depth-layered column)

This is iterative — generate several networks at C/B/A grades, visually inspect,
and tune parameters. Use Playwright MCP for screenshots at different grades.

---

## Phase 8: Smoke Testing & Tuning

**Goal:** Verify the system works end-to-end and tune parameters.

### Prompt 8.1: Playtest Harness Smoke Tests

Run through the full game loop via playtest.js at each grade tier:

```bash
# F/D — flat, should be identical to old behavior
node scripts/playtest.js --lan-grade F reset
node scripts/playtest.js "status full"

# C — hierarchical, 2 wings
node scripts/playtest.js --lan-grade C --recipe tech-company reset
node scripts/playtest.js "status full"

# A — large, 4 wings
node scripts/playtest.js --lan-grade A --recipe defense-contractor reset
node scripts/playtest.js "status full"
```

Verify at each tier:
- Network generates without errors
- Node count is in expected range
- Wings are present (for C+)
- All nodes are reachable from gateway
- Lootable nodes exist in wings
- Security infrastructure is present when recipe includes security-ops
- ICE spawns and patrols correctly across the larger network
- Scattered nodes appear across wings
- Full game loop works: probe → exploit → read → loot → jackout

### Prompt 8.2: Budget & Branching Tuning

After smoke tests, tune the numbers:
- Adjust `hierarchicalBudget()` ranges if networks feel too sparse or too dense
- Adjust `wingCount()` if too many or too few wings
- Adjust `branchCount()` for better intra-wing branching
- Adjust backbone piece probabilities
- Adjust sub-biome piece palettes based on what networks actually look like

This is iterative — generate, inspect, tune, repeat.

---

## Phase Summary

| Phase | Steps | What Changes | Risk |
|-------|-------|-------------|------|
| 1. Foundation | 1.1-1.2 | Types, budget utils | Low — pure additions |
| 2. Content | 2.1-2.3 | Backbone pieces, sub-biomes, recipes | Low — data only |
| 3. Slot-filler | 3.1-3.3 | Multi-port, filtering, required pieces | Medium — behavior changes |
| 4. Skeleton | 4.1-4.3 | Hierarchical generation | High — core architecture |
| 5. Pipeline | 5.1-5.3 | Wire it together | High — integration |
| 6. Interface | 6.1 | CLI/browser recipe selection | Low — API surface |
| 7. UX | 7.1-7.2 | Camera, layout | Medium — visual tuning |
| 8. Testing | 8.1-8.2 | Smoke tests, tuning | Low — verification |

**Critical path:** Phases 1-5 are sequential (each builds on the previous).
Phases 6-8 can partially overlap.

**Biggest risk:** Phase 4-5 integration. The hierarchical skeleton must produce
valid trees that the slot-filler can consume. Test each sub-function in isolation
before wiring together.

**Regression safety:** F/D networks must remain identical to current behavior.
The decision point in Phase 5.2 ensures the old path is preserved.
