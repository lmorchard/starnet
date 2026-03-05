# Session Notes: New Traits

## Phase 1: durationMultiplier + noiseInterval ✓
- timed-action operator now checks durationMultiplier, noiseInterval, durationAttrSource
- 3 new tests, all 508 pass

## Phase 2: Per-node triggers ✓
- TraitDef and NodeDef now support triggers field
- resolveTraits merges trait triggers (concatenate)
- Runtime pre-fills nodeId in conditions and $nodeId in effects
- Per-node triggers merged into main trigger pool
- 2 new tests, all 510 pass

## Phase 3: quality-from-attr condition ✓
- New condition type reads quality name from node attribute
- Added to Condition union typedef
- All 510 tests pass

## Phases 4-8: 5 New Traits ✓
- hardened: durationMultiplier: 2.0
- audited: noiseInterval: 0.1
- trapped: per-node trigger fires startTrace on probe
- encrypted: read action gated by quality-from-attr condition
- volatile: per-node trigger arms timed-action countdown, volatileDetonate ctx method
  with reset/disable/corrupt modes
- 6 new trait tests, all 516 pass
