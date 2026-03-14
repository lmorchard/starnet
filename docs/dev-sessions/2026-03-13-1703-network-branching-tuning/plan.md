# Network Branching Tuning & Completion — Plan

## Architecture

The current hierarchical path in `generate.js` calls `fillSkeleton` once for the
whole tree. This session restructures it to:

1. `generateHierarchicalSkeleton` → backbone skeleton + wing skeletons (unchanged)
2. `fillSkeleton(backbone, ...)` → fill backbone with backbone palette
3. For each wing: `fillSkeleton(wingSubtree, ...)` → fill with sub-biome palette
4. Merge all pieces + cross-edges
5. `assembleNetwork(allPieces, allCrossEdges, ...)` → apply per-wing grade offsets
6. `validate` → unchanged

The key insight: `fillSkeleton` already handles subtrees correctly — it walks from
a root slot and fills children recursively. We just need to call it multiple times
with different roots and palettes, then merge the results.

---

## Phase 1: Per-Wing Fill Restructure

### Prompt 1.1: Split fillSkeleton Calls in generate.js

Read `js/core/network/generate.js` (the hierarchical path, lines 54-67) and
`js/core/network/skeleton.js` (`generateHierarchicalSkeleton` return type).

Replace the single `fillSkeleton` call with staged filling:

```
const result = generateHierarchicalSkeleton(spec, biome, recipe, rng);
const budgets = hierarchicalBudget(spec, result.wings.length);

// 1. Extract backbone-only skeleton (root with wing entry slots as leaves)
// 2. Fill backbone with backbone palette
const backbonePalette = new Set(biome.backbonePieceIds ?? []);
// Include entry-point and spine pieces in backbone palette
backbonePalette.add("entry-point");
backbonePalette.add("single-router"); // spine piece
const backboneFill = fillSkeleton(result.root, biome, spec, rng, {
  piecePalette: backbonePalette,
  budgetOverride: budgets.backboneBudget,
});

// 3. Fill each wing with sub-biome palette
for (const wing of result.wings) {
  const sb = wing.wingSpec.subBiome;
  const wingPalette = new Set(sb.pieceIds);
  const wingFill = fillSkeleton(wing.slot, biome, wingSpec, rng, {
    piecePalette: wingPalette,
    requiredPieceIds: sb.requiredPieceIds,
    budgetOverride: budgets.perWingBudget,
  });
  // Merge wing results into backbone results
}
```

**Challenge:** `fillSkeleton` currently handles the entire tree including wiring
parent→child cross-edges. When filling a wing subtree, the wing entry slot's
parent is a backbone slot (already filled). We need to wire the backbone's
outbound port to the wing entry's inbound port as a cross-edge.

**Approach:** After filling both backbone and wing, find the backbone piece that
owns the wing entry slot's parent, consume an outbound port, and wire it to the
wing's inbound port. The wing's `fillSkeleton` call treats the wing entry slot
as a root (no parent), so no cross-edge is created internally.

Merge pieces arrays and crossEdges arrays from all fill calls into a single set
for assembly.

Write tests:
- Backbone slots only get backbone-tagged pieces
- Security-ops wing only gets security-ops palette pieces
- Server-room wing only gets server-room palette pieces
- Required pieces (ids-relay-chain) appear in security-ops wings
- Each wing's budget is independent (one wing can't starve another)

### Prompt 1.2: Handle Scatter Across Wings

`fillSkeleton` has a pass 2 that places scattered nodes in gate-free slots.
With per-wing filling, scattered nodes from a wing's pieces should scatter
across the ENTIRE network (per spec: "scatter across the whole network including
across wing boundaries").

**Approach:** Collect scatter obligations from all wing fills, then run a single
scatter placement pass across all placed pieces from all fills. This means:

1. Each `fillSkeleton` call returns scatter obligations but does NOT place them
2. After all wings are filled, merge all obligations
3. Run scatter placement once across the full piece set

This requires `fillSkeleton` to expose scatter obligations. Add a
`skipScatterPlacement` option that returns obligations without placing them.

Write tests:
- Scattered nodes from a wing can land in a different wing
- Scattered nodes from a wing can land on the backbone

---

## Phase 2: Wing Minimum Slot Count

### Prompt 2.1: Minimum Slots in generateWingSkeleton

Read `js/core/network/skeleton.js` (`generateWingSkeleton`, line ~497).

Add a `minWingSlots` function to `budget.js`:
```
C → 3, B → 4, A → 5, S → 5
```

In `generateWingSkeleton`, after building branches, count the total slots. If
below the minimum, force additional branches at the shallowest non-leaf slots
until the minimum is met.

Also: if the per-wing budget can't support the minimum slots (at ~2 cost per
slot), bump the wing budget to `minSlots * 2`.

Write tests:
- C-grade wing has at least 3 slots
- B-grade wing has at least 4 slots
- A-grade wing has at least 5 slots
- Budget is bumped when too low for minimum slots

---

## Phase 3: Per-Wing Grade Offset in Assembly

### Prompt 3.1: Tag Pieces with Wing Grade Offset

The `PlacedPiece` typedef needs a new optional field: `gradeOffset: number`.

During the per-wing fill in `generate.js`, compute each wing's grade offset
(from the wing's offset-adjusted spec vs the base spec) and tag each piece
returned by that wing's `fillSkeleton` with it. Backbone pieces get offset 0
(they use the global modifier).

### Prompt 3.2: Apply Per-Piece Grade Offsets in Assembly

Read `js/core/network/assemble.js` (grade scaling, lines 50-59).

Replace the global `gradeModifier(spec)` application with per-piece offsets:

```
for (const piece of pieces) {
  const offset = piece.gradeOffset ?? gradeModifier(spec);
  if (offset !== 0) {
    for (const node of piece.nodes) {
      if (node.attributes?.grade) {
        node.attributes.grade = shiftGrade(node.attributes.grade, offset);
      }
    }
  }
}
```

Backbone pieces (offset 0 or undefined) fall back to the global modifier.
Wing pieces use their wing-specific offset.

Write tests:
- Security-ops wing nodes have higher threat-influenced grades
- Server-room wing nodes have lower threat grades
- Backbone nodes use the global modifier
- No node grade exceeds S

---

## Phase 4: Budget Tuning

### Prompt 4.1: Tune Budget Numbers

Run generation across all grade tiers with multiple seeds. Check node counts
against targets: C ~20-25, B ~25-35, A ~35-45, S ~40-55.

Adjust:
- `hierarchicalBudget` multiplier (currently 1.8x)
- Per-wing budget floors based on minimum slot counts
- `costBudget` base formula if needed

This is iterative — generate, count, tune, repeat.

### Prompt 4.2: Verify Across Recipes

Test all 3 recipes at C/B/A grades. Verify:
- Defense contractor produces security-heavy networks
- Fashion brand produces loot-heavy networks
- Tech company produces server-heavy networks
- Node counts are within target ranges for all recipes

---

## Phase 5: New Sub-Biomes and Recipes

### Prompt 5.1: Playtest and Identify Content Gaps

With palette filtering working, playtest at various grades and recipes.
Observe:
- Do wings feel distinct? (different node types, different challenges)
- Are any wings consistently boring? (too many filler pieces)
- Do recipes feel different from each other?

Based on observations, brainstorm and author new sub-biomes and recipes.
Possible directions:
- R&D lab (high complexity puzzles, encrypted vaults)
- Communications hub (routers, relays, network infrastructure)
- Warehouse/logistics (bulk fileservers, low security)
- Different corporation types with distinct recipes

### Prompt 5.2: Author New Content

Create new sub-biome definitions and recipe variants based on playtesting
observations. Wire into CORPORATE_BIOME. Test that new sub-biomes reference
valid piece IDs and recipes reference valid sub-biome IDs.

---

## Phase 6: Smoke Testing & Final Tuning

### Prompt 6.1: End-to-End Verification

Playtest harness smoke tests at F/D/C/B/A/S grades with all recipes.
Verify:
- Networks generate without errors across 10+ seeds per grade
- Wing sub-biome flavor is visible (security wings have IDS, server wings
  have fileservers, etc.)
- Budget targets are met
- Full game loop works at each grade
- Select-and-fit camera works with the new generation

### Prompt 6.2: Playwright Visual Verification

Use Playwright MCP to generate networks at different grades, take screenshots,
verify visual layout looks good with distinct wing clusters.

---

## Phase Summary

| Phase | What Changes | Risk |
|-------|-------------|------|
| 1. Per-wing fill | generate.js restructure, scatter handling | High — core pipeline change |
| 2. Min slots | skeleton.js, budget.js | Low — additive |
| 3. Grade offset | PlacedPiece typedef, assemble.js | Medium — touches assembly |
| 4. Budget tuning | budget.js numbers | Low — parameter changes |
| 5. New content | biome data files | Low — pure data |
| 6. Smoke testing | verification only | Low |

**Critical path:** Phase 1 must be solid before anything else works correctly.
Phases 2-3 can proceed in parallel after Phase 1. Phases 4-6 are iterative
tuning that depend on 1-3 being complete.
