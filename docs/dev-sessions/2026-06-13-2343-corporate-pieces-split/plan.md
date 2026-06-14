# Plan — Split `corporate-pieces.js`

Pure code-movement refactor. **TDD opt-out is appropriate** (no new behavior); the guard
is the existing suite — especially `tests/network-gen.test.js` — plus a public-surface
diff check. Verify green after each phase.

## Key facts established during research

- Sections are fully independent: **no piece references another** (no spreads, no
  identifier refs across sections). Verified by grep.
- Only module-level helpers are the three `makeScattered*` factories, all within the
  scattered section. Self-contained.
- Each new module needs its own header: `// @ts-check` + the `SetPieceDef` typedef import.
  Path deepens by one level: `../../js/...` → `../../../js/core/network/set-pieces.js`.
- Catalog placement decision:
  - `ATOMICS` lives in `atomics.js` (all its members are there).
  - `BACKBONE_PIECES` lives in `backbone.js` (all its members are there).
  - `SET_PIECES` spans puzzles + scaled + scattered, so it is **assembled in the barrel**
    (`corporate-pieces.js`), preserving current key order + grouping comments.

## Phase 1 — Create section modules

Create `data/biomes/corporate-pieces/` and move each section verbatim into its file.
Each file gets `// @ts-check` + the depth-adjusted typedef import. Move the section's
**grouping comments and per-piece doc comments** along with the code.

1. `puzzles.js` — lines ~11–1289 (15 pieces, the "Set-piece catalog" section)
2. `scaled.js` — lines ~1290–1518 (5 scaled variants)
3. `scattered.js` — lines ~1519–1819 (3 factory fns + 7 instances)
4. `atomics.js` — lines ~1856–2008 (5 atomics) **+ the `ATOMICS` catalog export**
5. `scenarios.js` — lines ~2010–2179 (3 scenario pieces)
6. `backbone.js` — lines ~2180–end (3 backbone pieces) **+ the `BACKBONE_PIECES` catalog export**

Each `export const` keeps its exact name and definition. No value edits.

## Phase 2 — Rewrite `corporate-pieces.js` as a barrel

Replace the file body with:
- Top doc comment noting it's now a barrel over `corporate-pieces/`.
- `export * from "./corporate-pieces/puzzles.js";` (and scaled, scattered, atomics, scenarios, backbone) — re-exports every named piece + `ATOMICS` + `BACKBONE_PIECES`.
- Re-import the names `SET_PIECES` needs, then `export const SET_PIECES = { ... }` reproducing the current object **exactly** (same keys, same order, same `// Scaled variants` / `// Scattered variants` comments).

## Phase 3 — Verify public surface unchanged + green

1. **Surface diff.** Before Phase 1, capture the sorted list of exported names from the
   original file. After Phase 2, capture the same from the barrel's re-export graph and
   diff — must be identical.
2. **`SET_PIECES` content diff.** Confirm the assembled `SET_PIECES` has the same keys in
   the same order as the original (compare the key list).
3. `make check` — lint clean + 1154 tests green. `tests/network-gen.test.js` is the
   load-bearing guard (it exercises the catalogs through real network generation).
4. Optionally run `make census SEEDS=10` — no-regression confirmation, not required.

## Phase 4 — Manual + PR

- No mechanic changed → `MANUAL.md` needs no update. Note "N/A — pure refactor" in `notes.md`.
- Open a PR to `main` once green (Les asked for this).

## Risks / watch-items

- **Typedef import depth.** Easy to forget the extra `../`. `make lint` (tsc) catches it.
- **Missing a piece in the barrel re-export** → consumer import breaks. The surface diff
  in Phase 3 catches it before tests even run.
- **`SET_PIECES` key drift.** Copy the original object body verbatim, changing nothing but
  location. The key-list diff guards this.
- Worktree shell cwd resets between Bash calls (observed) — always `cd` into the worktree
  at the top of each Bash command.
