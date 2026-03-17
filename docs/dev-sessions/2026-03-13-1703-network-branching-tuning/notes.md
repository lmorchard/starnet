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

## Phase 2: Wing Minimum Slot Count ✓

- Added `minWingSlots()` to budget.js: C→3, B→4, A→5, S→5
- Skeleton enforces minimum by adding filler branches at expandable slots
- Budget bumped to support minimum slots if needed
- 2 new tests, 599 total passing

## Phase 3: Per-Wing Grade Offset in Assembly ✓

- Replaced global gradeModifier with per-piece offsets in assembleNetwork
- Wing pieces use their wing-specific offset, backbone/flat uses global modifier
- 1 new test, 600 total passing

## Phase 4: Budget Tuning ✓

- Fixed wing entry slot tag from "filler" to "spine" — wing entries need outbound
  ports to branch into the wing interior, not leaf filler nodes
- Added single-router to executive-suite palette (was missing spine pieces)
- Increased hierarchical budget multiplier to 2.2x (from 1.8x) — sub-biome
  palette filtering rejects many candidates, needs extra headroom
- Per-wing budget floor based on minWingSlots * 3

### Node count ranges (5 seeds each):
- F: 8-14, D: 12-15 (flat, good)
- C: 17-34, B: 28-64, A: 50-81, S: 52-93 (hierarchical)
- Variance still high but floor is reasonable. Further tuning iterative.

## Phase 5: New Sub-Biomes and Recipes ✓

- Added 2 new sub-biomes:
  - **R&D Lab** (rd-lab): puzzle-heavy with combination locks, encrypted vaults,
    key exchanges. High complexity, moderate wealth.
  - **Data Center** (data-center-wing): bulk servers, minimal security. Very high
    wealth, easy loot wing.
- Added 2 new recipes:
  - **Research Firm**: security-ops + rd-lab mandatory, optional rd-lab/server-room
  - **Cloud Provider**: security-ops mandatory, heavy data-center-wing optional pool
- Fixed name collision: sub-biome renamed to `dataCenterWing` to avoid conflict
  with `dataCenter` set-piece import
- Added single-router to executive-suite palette (spine piece needed for wing entry)
- Playtested all 5 recipes at B-grade — distinct flavors confirmed:
  - Defense contractor: security-heavy
  - Fashion brand: office/workstation-heavy
  - Tech company: server-heavy
  - Research firm: puzzle-heavy (routing panels, combination locks)
  - Cloud provider: loot-dense (23 fileservers in one run)
- Full suite: 600 tests, 0 failures
