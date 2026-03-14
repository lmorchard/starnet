# Network Branching — Session Notes

## Session Retrospective

### Summary

Built the hierarchical network generation system: backbone + wings, biome recipes,
sub-biomes, expanded budgets, and select-and-fit camera behavior. The architecture
is complete and functional — networks generate, validate, and play through the full
game loop. Significant time was spent on camera/viewport UX during live playtesting.

**22 commits, 594 tests (52 new), 0 failures.**

### What We Built

**Core architecture (Phases 1-5):**
- Type system: SubBiomeDef, RecipeDef, GradeSpec, extended BiomeDef/NetworkSpec
- Budget utilities: LAN grade offset, wing count, hierarchical budget allocation
- 3 backbone set-pieces with alert relay operators
- 4 sub-biomes (security-ops, server-room, office-floor, executive-suite)
- 3 recipes (defense-contractor, fashion-brand, tech-company)
- Slot-filler: multi-port consumption, palette filtering, required piece placement
- Hierarchical skeleton: backbone generator, per-wing sub-skeletons, recipe resolver
- Pipeline: flat/hierarchical decision point in generateNetwork()
- Generator interface: --recipe and --lan-grade in playtest.js + browser URL params

**UX (Phase 7 + bugfixes):**
- Select-and-fit camera with 2-hop neighborhood zoom
- Debounced to avoid layout fighting
- User viewport cooldown (1s) with drag threshold detection
- Re-fit after revealed nodes settle
- Disabled cola fit:true in both main layout and incremental reveal layout

**Gameplay (out-of-scope but related):**
- Skip-to-owned exploit mechanic: rare high-quality exploits ~71% chance to jump
  locked → owned in one shot, improving pacing in larger networks

**Bug fixes discovered during playtesting:**
- Context menu click handlers targeting wrong node after selection change
  (cache optimization bug in visual-renderer.js)
- Dynamic console actions using stale selectedNodeId from registration time
  (closure capture bug in dynamic-actions.js)

### Divergences from Plan

1. **Per-wing palette filtering is incomplete.** The slot-filler supports
   `piecePalette` and `requiredPieceIds`, and `generate.js` builds the palette
   maps, but the hierarchical path doesn't thread them through to `fillSkeleton`.
   Wings get pieces from the full catalog instead of their sub-biome's curated
   palette. This means sub-biome flavor isn't enforced yet — a security-ops wing
   can get fileservers. **Must fix in the follow-up session.**

2. **Assembly grade offset (Phase 5.3) was skipped.** The plan called for per-wing
   grade offset in assembleNetwork, but the existing gradeModifier still applies
   uniformly. Lower priority than palette filtering — the offset math is correct in
   the skeleton, just not differentiated at assembly time.

3. **Select-and-fit took 7 commits** (Phases 7-8) — far more than planned. The
   camera behavior interacted with cola layout's fit:true, the incremental reveal
   layout, repeated syncSelection calls during settling, and pointer event handling.
   Each fix revealed the next layer of the problem.

4. **Skip-to-owned exploit mechanic** was added outside the plan scope, motivated by
   pacing issues discovered while playtesting larger networks.

### Known Issues for Follow-Up

1. **Per-wing palette filtering** — must thread sub-biome palettes through to
   fillSkeleton in the hierarchical path. Without this, sub-biomes don't actually
   shape wing content.
2. **High node count variance at B+ grades** — C-grade ranges from 17-31 nodes,
   A-grade from 14-54. The slot budget conversion (cost/2) is too rough. Needs
   either a better estimator or minimum node count enforcement.
3. **Wings are often too small** — a C-grade wing behind a backbone firewall was
   just a single fileserver in one playtest. Per-wing budgets need a higher floor
   or the skeleton needs minimum depth/breadth guarantees per wing.
4. **Budget tuning** — the 1.8x multiplier and backbone/wing split ratios need
   iteration based on playtesting at each grade tier.
5. **Per-wing grade offset in assembly** — node grades should reflect the wing's
   offset-adjusted spec, not a single global modifier.

### Key Insights

- **Camera behavior is deceptively complex.** fit:true on layouts, debounce timing,
  pointer event classification, and repeated state updates all interact in subtle
  ways. The iterative approach (ship → playtest → fix) was the right call — we
  couldn't have predicted these interactions upfront.
- **Pre-existing bugs surfaced by larger networks.** Both the context menu closure
  bug and the dynamic-actions stale state bug existed before this session but were
  rarely triggered on small networks. Larger networks = more node switching = more
  exposure to timing-sensitive code.
- **Playwright MCP was invaluable for debugging.** Being able to inspect zoom/pan
  values programmatically and see console.log output from the browser confirmed the
  debounce timer cancellation bug that wasn't visible from the code alone.
- **The architecture is clean and extensible.** Adding new sub-biomes, recipes, and
  backbone pieces is pure data authoring — no code changes needed. The hierarchical
  skeleton composes naturally with the existing flat generator.

### Backlog Items to Add

- Per-wing palette filtering completion (incomplete implementation)
- Budget tuning sweep across all grade tiers
- Wing minimum size enforcement
- Per-wing grade offset in assembly
- More sub-biomes and recipe variants
- Visual layout tuning for wing clustering at different scales

### Session Stats

- **Conversation turns:** ~60
- **Commits:** 22 (8 feature, 10 fix, 2 docs, 2 tweak)
- **New tests:** 52 (594 total, 0 failures)
- **Files changed:** ~15 (generator, biome data, graph.js, visual-renderer,
  combat, types, state, console commands, playtest)
- **Lines added:** ~1000+
- **Duration:** ~3 hours

## Phase-by-Phase Log

### Phase 1: Foundation — Types, Budget, Grade Utilities ✓

- Added `SubBiomeDef`, `RecipeDef`, `GradeSpec` typedefs to `set-pieces.js`
- Extended `BiomeDef` with `subBiomes`, `recipes`, `backbonePieceIds` fields
- Extended `NetworkSpec` with `recipeId`, `lanGrade` fields
- Added to `budget.js`: `lanGradeOffset()`, `applyGradeOffset()`, `wingCount()`,
  `hierarchicalBudget()`
- 17 new tests in `tests/network-gen.test.js`, all passing
- Full suite: 559 tests, 0 failures

### Phase 2: Content — Sub-Biomes, Recipes, Backbone Pieces ✓

- Created 3 backbone set-pieces in `corporate-pieces.js`: backboneRouter (1in/2out),
  backboneFirewall (1in/1out, alert relay), backboneHub (1in/3out)
- Created 4 sub-biome definitions in `corporate.js`: security-ops, server-room,
  office-floor, executive-suite — each with curated pieceIds, requiredPieceIds,
  and baseGrades
- Created 3 recipe definitions: defense-contractor, fashion-brand, tech-company
- Extended CORPORATE_BIOME with subBiomes, recipes, backbonePieceIds
- 15 new tests (32 total), all passing
- Full suite: 574 tests, 0 failures

### Phase 3: Slot-Filler Enhancements ✓

- Removed `extrasAdded < 1` cap on opportunistic filler — pieces with multiple
  outbound ports now fill all of them (budget permitting)
- Added `piecePalette` parameter to `fillSkeleton()` and `fillSlot()` — filters
  catalog to only palette-specified piece IDs
- Added `requiredPieceIds` parameter — pre-assigns required pieces to best-fit
  skeleton slots before normal filling
- Added `budgetOverride` parameter for hierarchical per-wing budgets
- Added `preAssignRequired()` and `collectSlots()` helper functions
- 5 new tests (37 total in network-gen.test.js), all passing
- Full suite: 579 tests, 0 failures

### Phase 4: Hierarchical Skeleton Generation ✓

- Added `generateHierarchicalSkeleton()` — orchestrator that resolves wings from
  recipe, applies LAN grade offset, computes budgets, and generates backbone +
  per-wing sub-skeletons
- Added `generateBackbone()` — creates entry → spine → backbone chain with wing
  entry slots
- Added `generateWingSkeleton()` — generates sub-skeleton for each wing using
  existing `buildBranches()` logic with wing-specific budget and grades
- Added `resolveWings()` — selects sub-biomes from recipe's mandatory + optional pool
- Added `WingSpec` typedef, `subBiomeId` field on SkeletonSlot
- 8 new tests (45 total), all passing
- Full suite: 587 tests, 0 failures

### Phase 5: Pipeline Integration ✓

- Updated `generateNetwork()` with flat/hierarchical decision point: F/D uses
  existing flat path, C+ uses hierarchical skeleton + expanded budget
- Recipe resolution: uses `spec.recipeId` to select recipe, falls back to first
  recipe in biome
- Hierarchical budget passed through to slot-filler via `budgetOverride`
- 7 new integration tests: flat regression, hierarchical at C/B/A grades,
  validation, gateway check, default recipe fallback
- Full suite: 594 tests, 0 failures

### Phase 6: Generator Interface & Callers ✓

- Added `--recipe` and `--lan-grade` CLI args to `playtest.js`
- Updated `status full` to show spec, recipe, LAN grade, and total node count
- Added `spec` field to GameState typedef and stored in state from meta
- Updated browser `main.js` to support `?recipe=` and `?lanGrade=` URL params
- Smoke tested: F/F=10 nodes (flat), C/C tech-company=25 nodes, A/A=26 nodes
- Full suite: 594 tests, 0 failures

### Phase 7: Layout & UX ✓

- Added select-and-fit camera behavior in `syncSelection()`
- Iterated through 7 commits to resolve interactions with cola layout, incremental
  reveal layout, pointer events, and repeated state updates
- Final behavior: pan+zoom to 2-hop neighborhood on select, debounced 150ms,
  user viewport cooldown 1s, re-fit after reveal layout settles
- Full suite: 594 tests, 0 failures

### Phase 8: Smoke Testing & Tuning ✓

- Node count observations across grades (5 seeds each):
  F: ~10-13, D: ~15-17, C: 17-31, B: 20-69, A: 14-54, S: 13-57
- High variance at B+ grades needs budget tuning
- Wings often too small — need minimum size guarantees
- Full game loop verified on hierarchical C-grade network
- Two pre-existing bugs found and fixed during playtesting
- Skip-to-owned exploit mechanic added for pacing in larger networks
