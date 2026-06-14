# Spec — Split `corporate-pieces.js`

## Problem

`data/biomes/corporate-pieces.js` is 2293 lines / ~81KB — a flat catalog of every
corporate-biome set-piece definition (puzzle, defense, treasure, atomic, scenario,
backbone, scaled, scattered). It's unwieldy to navigate and edit. The file is already
divided into clear comment-delimited sections, so the seams for a split already exist.

## Goal

Break the file into smaller, section-aligned modules **without changing the public
surface** any consumer sees. This is a pure code-movement refactor — no behavior change.

## Constraints / invariants

- **Public surface stays identical.** Consumers must not change:
  - `data/biomes/corporate.js` imports ~40 named exports
  - `data/networks/{corporate-exchange,corporate-foothold,research-station}.js` import only `SET_PIECES`
  - `tests/network-gen.test.js` references the catalog
  - The three catalog exports — `SET_PIECES`, `ATOMICS`, `BACKBONE_PIECES` — keep their names and contents.
  - Every individual named export (`idsRelayChain`, `entryPoint`, `backboneRouter`, …) stays importable from `corporate-pieces.js`.
- No set-piece definition is altered — values, operators, edges, typedefs all move verbatim.
- `make check` (lint + 1154 tests) stays green. `tests/network-gen.test.js` is the key guard.
- Don't over-split. File-per-piece (30+ files) is worse, not better. Split along the
  existing ~6 section boundaries only.

## Approach

Convert `corporate-pieces.js` into a **barrel module** that re-exports from new files
under a `corporate-pieces/` directory, and rebuilds the `SET_PIECES` / `ATOMICS` /
`BACKBONE_PIECES` catalogs from those re-exports. Because the barrel preserves every
name, zero consumer files change.

### Target file layout

`data/biomes/corporate-pieces/`:

| File | Source section (approx lines) | Contents |
|---|---|---|
| `puzzles.js` | 11–1289 | `idsRelayChain`, `nthAlarm`, `combinationLock`, `deadmanCircuit`, `switchArrangement`, `multiKeyVault`, `honeyPot`, `encryptedVault`, `cascadeShutdown`, `tripwireGauntlet`, `probeBurstAlarm`, `noisySensor`, `tamperDetect`, `serverBank`, `officeCluster` |
| `scaled.js` | 1290–1518 | `largeServerBank`, `vaultCluster`, `defensePlex`, `fortifiedGate`, `dataCenter` |
| `scattered.js` | 1519–1819 | `makeScattered*` factory fns + their instances (`scatteredLock1/3/5`, `scatteredKeyVault2/3`, `scatteredEncryptedVault2/3`) |
| `atomics.js` | 1856–2008 | `entryPoint`, `singleRouter`, `singleFirewall`, `singleWorkstation`, `singleFileserver` + `ATOMICS` catalog |
| `scenarios.js` | 2010–2179 | `workstationArray`, `luckyBreak`, `securityTheater` |
| `backbone.js` | 2180–end | `backboneRouter`, `backboneFirewall`, `backboneHub` + `BACKBONE_PIECES` catalog |

`data/biomes/corporate-pieces.js` (the barrel):
- `export * from "./corporate-pieces/<each>.js"` for all the section modules.
- Re-declare `SET_PIECES` by importing the needed names and assembling the object (preserving the existing key order + grouping comments). `ATOMICS` and `BACKBONE_PIECES` can be re-exported directly from their modules, or also re-assembled in the barrel — decide during plan for least surprise.
- Keep the shared `SetPieceDef` typedef import available to each new module (each file needs its own `@ts-check` + typedef import).

## Out of scope

- Touching `corporate.js`, the network files, or tests (beyond confirming green).
- Renaming any export or restructuring catalog contents.
- Splitting any other biome file.

## Success criteria

1. `corporate-pieces.js` is a thin barrel; the bulk lives in `corporate-pieces/*.js`.
2. No consumer file's imports changed.
3. `make check` green — particularly `tests/network-gen.test.js`.
4. Each new file ≈150–400 lines, grouped by the existing section comments.
