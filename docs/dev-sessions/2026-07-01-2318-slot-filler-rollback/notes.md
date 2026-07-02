# Notes — Fix incomplete rollback in slot-filler wire-failure path (#164)

## The bug

In `js/core/network/slot-filler.js` `fillSlot`, the orphan-prevention fallback (parent has no free
outbound port) popped the just-placed piece from `pieces` and refunded the budget, but left two
earlier side effects in place:

- `usedPieceIds.add(chosen.id)` — the discarded piece kept counting against diversity, so a later
  slot trying the same id got a 0.33× penalty for a piece that was never placed.
- `placed.set(slot.id, piece)` — the slot stayed mapped to a piece no longer in `pieces`.

## Fix

On the rollback branch, also `usedPieceIds.delete(chosen.id)` and `placed.delete(slot.id)`.

## Reproduction (TDD, honest observable)

`placed`/`usedPieceIds` are internal to `fillSkeleton`. The observable invariant of the
stale-mapping half is: **every piece referenced by `placed` is present in `pieces`.** Surfaced
`placed` on the `fillSkeleton` return (a justified test seam) and added a seed-sweep test at a dense
spec (S/S/S/S) in `tests/network-gen.test.js`.

Confirmed reproducible before fixing via a scratch sweep (300 seeds × 4 dense specs):
**1196 / 1200** configs violated the invariant pre-fix, **0 / 1200** post-fix — so the invariant
measures exactly this bug. The committed test fails on seed 1 alone without the fix.

## Verification

- `make check` green (1338 pass; +1 new test). No test-consumed snapshot changed — the
  `tests/fixtures/network-gen-*.json` files are orphaned reference dumps (no test loads them; only
  the ICE snapshot test reads `fixtures/`), so there was nothing to re-baseline.
- `make census SEEDS=50` (default grades), branch vs main (c48b3dc): successRate 0.24 = 0.24,
  traceFiredRate 0.80 = 0.80, avgNodesOwned 3.68 = 3.68, avgCash 5391 vs 5393. No difficulty
  regression — the only delta is a ~2¥ cash blip from corrected piece selection on affected seeds.
