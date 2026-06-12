# Research — Whole-project code review

**Date:** 2026-06-11
**Scope:** Code-quality / refactor review of the whole JS codebase (~32k LOC) after a
run of merged PRs. Five parallel review agents covered node-graph engine, network
generation, UI/visual layer, core game systems, and the headless tooling/bot. All
findings below were **verified by hand** (grep + reading the cited code) before being
recorded — agent line numbers and claims were not taken on faith.

Baseline at session start: `make check` green — 1020 tests, 0 failures, lint clean.

## Codebase shape

- `js/core/` — 76 src + 47 test files (pure JS engine)
- `js/ui/` — 48 src + 6 test files (Cytoscape graph + Lit components)
- `scripts/` — 21 files (playtest harness, bot, census, generators)
- `data/` — 7 files (incl. `biomes/corporate-pieces.js`, 2288 lines of hand-authored set-pieces)
- Biggest non-data src: `graph.js` (1112), `slot-filler.js` (580), `skeleton.js` (575),
  `graph-degradation.js` (525), `node-graph/runtime.js` (513), `visual-renderer.js` (490).

**Overall health is good.** The core/ui split is clean, state mutations route through
`mutate()`, the three headless entry points already share `headless-engine.js`, and the
set-piece data file is appropriately data-shaped. The opportunities are mostly
*duplication* and *dead code*, not architectural rot.

---

## Verified findings

### Tier A — trivially safe (zero behavior change) — DO THIS SESSION

1. **Unused `relayout` import in visual-renderer.js**
   `js/ui/visual-renderer.js:15` imports `relayout` from `./graph.js`; it is never
   referenced in the file body (verified). Remove from the import list. `relayout`
   stays exported for its real consumer (cheats/console).

2. **Dead `typeVulnConfig` branch in exploits.js**
   `js/core/exploits.js:396-400` — `const typeVulnConfig = null;` followed by
   `typeVulnConfig?.count?.[grade] ?? baseConfig.count` etc. The `?.` chains always
   short-circuit to `baseConfig`. A leftover from removed per-type vuln config. Collapse
   to direct `baseConfig` reads. Behavior identical.

### Tier B — behavior-preserving dedup (verified identical logic) — DO THIS SESSION

3. **Node-alert-level stepping repeated in 3 places**
   Identical "indexOf in ALERT_ORDER, bump if not at max" pattern at:
   - `js/core/combat.js:292-294`
   - `js/core/alert.js:70-72`
   - `js/core/node-graph/game-ctx.js:203-205` (has an extra `idx >= 0` guard)
   Extract `raiseNodeAlertState(nodeId, currentLevel)` (or a pure
   `nextAlertLevel(level)`) and use it in all three. The `idx >= 0` guard is a strict
   superset and safe to keep in the shared helper.

4. **Duplicated CLI scaffolding across headless entry points**
   - The 3-network dict (corporate-foothold / research-station / corporate-exchange) is
     defined identically in `scripts/playtest.js`, `scripts/bot/cli.js`,
     `scripts/bot/census.js`, and `js/ui/main.js` (verified 4 copies).
   - Grade-arg parsing (`--threat/--wealth/--complexity/--depth`) is reimplemented in
     `scripts/playtest.js:61`, `scripts/bot/cli.js:34`, `scripts/bot/census.js:31`,
     `scripts/generate-network.js:42`.
   Extract a shared `scripts/lib/networks.js` (the dict) and a `parseGradeArgs()` helper.
   `js/ui/main.js` is a browser entry — keep its copy or share via a core module; do the
   scripts first (lowest risk).

### Tier C — dedup that ALSO fixes a latent divergence (flag explicitly) — DO THIS SESSION

5. **`fillNodeId` condition-tree helper duplicated AND diverged**
   - `js/core/node-graph/actions.js:32` handles `node-attr`, `all-of/any-of`, **`not`**.
   - `js/core/node-graph/runtime.js:487` (`_fillNodeId`) handles `node-attr`,
     `all-of/any-of`, **`quality-from-attr`**.
   Each handles a case the other misses — so an action `requires` with `quality-from-attr`
   doesn't get its nodeId filled, and a trigger `when` with `not` doesn't recurse. Extract
   one `fillConditionNodeId()` in `conditions.js` covering all four cases; wire both. This
   removes the copy *and* closes both latent gaps. **Behavior change in edge cases** —
   strictly more correct, but call it out and lean on the full suite.

### Tier D — real but out of scope for a "safe refactor" pass — DOCUMENT ONLY

6. **slot-filler wire-failure rollback is incomplete (genuine generation bug)**
   `js/core/network/slot-filler.js:193-209` — on the "can't wire to parent" path the code
   pops the piece from `pieces` and refunds budget, but does **not** roll back
   `usedPieceIds.add(chosen.id)` (line 194) or `placed.set(slot.id, piece)` (line 193).
   The stale `usedPieceIds` entry applies a diversity penalty to a piece that was never
   placed; the stale `placed` entry maps a slot to a discarded piece. Minor, but real.
   *Deferred:* per CLAUDE.md, generation bugs need a reproducing test first, and a fix
   shifts generated networks for existing seeds → must re-baseline snapshots + run
   `make census`. Its own session.

7. **Waveform tip uses filled canvas circles (CRT-vocabulary violation)**
   `js/ui/components/starnet-waveform.js:213-219` — `ctx.arc(...); ctx.fill()` draws
   filled dots at the trace tip. CLAUDE.md's vector-CRT vocabulary bans fills/filled
   circles. *Deferred:* the waveform is recently hand-tuned feel-work (PR #159); changing
   its render is a feel decision for Les, not an autonomous edit. Flagged for his call.

### Tier E — larger refactors worth a dedicated session — DOCUMENT ONLY

- **`graph.js` (1112 LOC) decomposition.** Three near-identical pulse animators
  (red/yellow/reboot, ~90 LOC) → one `createPulseAnimator`. Two copies of BFS pathfinding
  (`flashIcePath` ~807, `drawIceTrace` ~861) → one `findPath(cy, from, to)`. MEDIUM.
- **`graph-degradation.js` (525 LOC) split** into health-plasma / deck-perturbation /
  wiring. MEDIUM.
- **`visual-renderer.js` ↔ `preview.js` shared overlay init.** Both repeat
  initGraph→mountOverlays→onViewport wiring. MEDIUM/LARGE.
- **`combat.js launchExploit` (220-316)** mixes resolution + mutation + emission; split
  into pure `resolveCombat` + `applyCombatResult` for testability. LARGE.
- **Centralize balance constants** (alert thresholds, trace seconds, combat modifiers,
  ICE timings) into one `balance.js`. MEDIUM. Currently scattered but all UPPER_SNAKE.
- **Timed-action coupling in node-graph.** game-ctx builds magic `_ta_<action>_progress`
  attribute names by hand (`game-ctx.js`); a shared `getTimedActionAttrNames(action)` in
  runtime + a `TIMED_ACTIONS` registry would centralize the list now spread across
  traits.js / game-types.js (ABORT requires) / game-ctx.js. MEDIUM/LARGE.
- **Network tree-traversal helpers** (`collectAll/collectLeaves/collectExpandable/
  collectSlots`) duplicated across skeleton.js + slot-filler.js → `tree-utils.js`. SMALL/MED.
- **`fillSlot` 14 positional params** (slot-filler.js:120) → options object. MEDIUM (touches gen).
- **Enable `@ts-check`** on `preview.js`, `main.js`, `run-control.js` (graph.js can keep
  `@ts-nocheck` for the untyped Cytoscape API but add JSDoc typedefs for its own shapes). LARGE.

### Confirmed clean (no action)

- State module: all mutations via `mutate()`, submodules pure data, no leaks. ✓
- Event bus, seeded RNG named streams, set-piece honesty (internalEdges, no hidden
  `destinations`), Lit light-DOM component pattern — all consistent. ✓
- `corporate-pieces.js` (2288 LOC) is hand-authored data; factories already dedupe the
  scattered-puzzle variants. Maintainable as-is. ✓
- Headless entry points already share `headless-engine.js` — no wiring drift found
  (the duplication is only in CLI arg/network scaffolding, not engine wiring). ✓

---

## Execution plan for THIS session

Do Tier A + B + C (items 1-5). All behavior-preserving except #5's edge-case
correctness extension, which the test suite guards. Run `make check` after each change.
Document Tiers D + E in `docs/BACKLOG.md` for future sessions. Keep changes small and
isolated; one logical change per commit where practical.
