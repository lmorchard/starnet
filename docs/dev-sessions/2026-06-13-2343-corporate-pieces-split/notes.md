# Notes — Split `corporate-pieces.js`

## Outcome

`data/biomes/corporate-pieces.js` (2305 lines) → a ~110-line **barrel** + 9 section
modules under `data/biomes/corporate-pieces/`. Pure code-movement refactor; no behavior
change, no consumer touched.

### Final layout

| File | Lines | Contents |
|---|---|---|
| `corporate-pieces.js` (barrel) | ~110 | `export *` from all sections + assembles `SET_PIECES` |
| `corporate-pieces/defense.js` | 229 | `idsRelayChain`, `noisySensor`, `tamperDetect` |
| `corporate-pieces/traps.js` | 488 | `nthAlarm`, `deadmanCircuit`, `honeyPot`, `cascadeShutdown`, `tripwireGauntlet`, `probeBurstAlarm` |
| `corporate-pieces/puzzles.js` | 479 | `combinationLock`, `switchArrangement`, `multiKeyVault`, `encryptedVault` |
| `corporate-pieces/filler.js` | 130 | `serverBank`, `officeCluster` |
| `corporate-pieces/scaled.js` | 238 | `largeServerBank`, `vaultCluster`, `defensePlex`, `fortifiedGate`, `dataCenter` |
| `corporate-pieces/scattered.js` | 311 | `makeScattered*` factories + 7 instances |
| `corporate-pieces/atomics.js` | 174 | 5 `single*` pieces + `ATOMICS` catalog |
| `corporate-pieces/scenarios.js` | 180 | `workstationArray`, `luckyBreak`, `securityTheater` |
| `corporate-pieces/backbone.js` | 113 | 3 `backbone*` pieces + `BACKBONE_PIECES` catalog |

## Deviation from the planned 6-file split

The plan proposed 6 files, with one `puzzles.js` holding the whole 15-piece "Set-piece
catalog" section. That came out at 1299 lines — which doesn't actually fix the
"file is too long" complaint, it just relocates the bulk. So I sub-split that section
into 4 thematic files (`defense`, `traps`, `puzzles`, `filler`), matching the groupings
`corporate.js` already uses in its own catalog comments. Result: 9 files, all 113–488
lines, none a monster. Pieces are independent (verified: no spreads / cross-references),
so regrouping across files is safe.

## Two surprises during execution

1. **`SetPieceDef` typedef collision under `export *`.** Each section module declares its
   own `@typedef SetPieceDef`, which tsc treats as an exported type. `export *` from 9
   modules → TS2308 ambiguity. Fixed by re-declaring the typedef locally in the barrel
   (the resolution tsc itself suggests) — the local declaration wins.
2. **scattered.js had inline `import('../../js/core/node-graph/types.js')` references**
   beyond the header typedef. Moving one directory deeper required bumping those to
   `../../../`. (Header typedef paths were already handled; these inline ones were extra.)

## Verification

- `make check`: lint clean (tsc), **1154 tests pass** (== baseline). `tests/network-gen.test.js`
  is the load-bearing guard — it exercises `SET_PIECES` through real network generation.
- **Public surface diff:** the 41 exported names reachable from the barrel are identical
  to the original. (`SET_PIECES` assembled in barrel; all 40 others via `export *`.)
- **Consumers untouched:** `git diff` shows no change to `corporate.js`, the network files,
  or tests.
- **Content integrity:** line-level `comm` diff of original vs. (barrel + all sections)
  shows *only* infrastructure deltas (headers, import-path depth, barrel import/export
  lines, duplicated catalog identifiers). **Zero piece-body lines differ** — every
  set-piece definition is byte-identical.

## MANUAL.md

N/A — pure refactor, no mechanic added/changed/removed.
