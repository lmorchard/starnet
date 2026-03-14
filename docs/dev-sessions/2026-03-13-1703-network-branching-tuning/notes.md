# Network Branching Tuning — Session Notes

## Phase 1: Per-Wing Fill Restructure ✓

- Restructured `generate.js` hierarchical path to fill in 3 stages:
  1. Backbone fill with backbone palette + `skipSubBiomeSlots: true`
  2. Per-wing fill with sub-biome palette + requiredPieceIds + per-wing budget
  3. Global scatter placement across all pieces
- Added `skipSubBiomeSlots` option to fillSlot — skips slots with subBiomeId
- Added `skipScatterPlacement` option to fillSkeleton — returns obligations
  without placing them (for cross-wing scatter)
- Exported `consumeOutboundPort` and `placeScatteredNodes` from slot-filler
- Added `gradeOffset` field to PlacedPiece typedef
- Wing pieces tagged with per-wing grade offset during filling
- Backbone → wing cross-edges wired after both are filled
- 3 new tests: security nodes in security-ops wing, backbone palette enforcement,
  independent wing budgets
- Full suite: 597 tests, 0 failures
