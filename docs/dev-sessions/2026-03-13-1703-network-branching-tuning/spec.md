# Network Branching Tuning & Completion — Spec

Continuation of the network-branching session (2026-03-13-1356). That session built
the hierarchical generation architecture but left three critical pieces incomplete.
This session completes them and tunes the system through playtesting.

## 1. Per-Wing Fill Calls (Critical)

**Problem:** The slot-filler has `piecePalette` and `requiredPieceIds` support, but
the hierarchical path in `generate.js` calls `fillSkeleton` once for the entire
tree with no palette. Sub-biome definitions are inert — a security-ops wing can get
fileservers, a server-room wing can get IDS chains.

**Fix:** Restructure `generate.js` to fill in stages:

1. Fill the **backbone** first — pass backbone palette (backbone-tagged pieces only,
   strict — no fallback to full catalog). If backbone can't be filled, that's a
   content gap to fix by authoring more backbone pieces.
2. Fill each **wing** separately — pass that wing's sub-biome `pieceIds` as palette
   and `requiredPieceIds`. Each wing gets its own `fillSkeleton` call with its own
   budget slice.
3. Wire **cross-edges** between backbone outbound ports and wing inbound ports.

This also solves the per-wing budget enforcement gap — each wing's fillSkeleton
call gets its own `budgetOverride`, preventing greedy wings from starving siblings.

## 2. Wing Minimum Slot Count

**Problem:** Wings can be as small as 1 node. A single fileserver behind a backbone
firewall doesn't feel like a distinct area.

**Fix:** Enforce a minimum slot count per wing in `generateWingSkeleton`, scaling
with grade:

| Complexity grade | Min slots per wing |
|------------------|--------------------|
| C                | 3                  |
| B                | 4                  |
| A                | 5                  |
| S                | 5                  |

If the budget can't support the minimum, increase the wing budget to accommodate.
Only enforce minimum slots, not minimum depth — let the branching heuristic decide
the shape.

## 3. Per-Wing Grade Offset in Assembly

**Problem:** `assembleNetwork` applies a single global grade modifier (avg of
threat+complexity) to all node grades. A server-room wing and a security-ops wing
in the same network get identically graded nodes, undercutting sub-biome flavor.

**Fix:** Tag each placed piece with its wing's grade offset during filling. In
`assembleNetwork`, apply per-piece offsets instead of the single global modifier.
Backbone nodes use the global modifier. Wing nodes use their wing's offset-adjusted
grades.

## 4. Budget Tuning

**Problem:** High node count variance at B+ grades (C: 17-31, A: 14-54). The slot
budget conversion (`cost/2`) is too rough.

**Fix:** Iterative tuning during playtesting:
- Adjust the `hierarchicalBudget` multiplier (currently 1.8x)
- Adjust per-wing budget floors based on minimum slot count
- Verify node count ranges at each grade tier across multiple seeds
- Target: C ~20-25 nodes, B ~25-35, A ~35-45, S ~40-55

## 5. New Sub-Biomes and Recipes

**Problem:** 4 sub-biomes and 3 recipes isn't much variety. With palette filtering
working, we need more content to make each run feel distinct.

**Fix:** Author additional sub-biomes and recipe variants during implementation,
brainstorming as interesting opportunities arise from playtesting. No fixed list —
discover what's needed.

## Not In Scope

- **Lateral ports / cross-wing connections** — deferred to own session (see BACKLOG)
- **ICE changes** — defer to ICE overhaul
- **Bot census** — future tuning tool
- **Weighted budget allocation by sub-biome** — may revisit if even-split + floors
  proves insufficient

## Testing Strategy

1. Unit tests for per-wing filling, palette enforcement, required piece placement
2. Tests for wing minimum slot count enforcement
3. Tests for per-wing grade offset in assembly
4. Playtest harness smoke tests at each grade tier
5. Manual playtesting for feel and pacing
