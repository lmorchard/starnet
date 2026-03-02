# Notes: Procgen Balance Tuning

## Session Summary

Built a network census tool for measuring procedural generator output across all
36 difficulty combinations, then used it to identify and fix a critical path
scaling bug and make targeted balance adjustments. The session also included
pre-work fixing PROCGEN.md documentation discrepancies and a real RNG bug in the
set piece engine.

---

## Key Actions

### Pre-work (before plan execution)
- Audited PROCGEN.md against implementation, found 5 discrepancies
- Fixed `applySetPiece` RNG bug (always consumed rng for single-candidate
  attachments, violating the pick() invariant)
- Removed unused GRADE_INDEX import from gen-rules.js
- Fixed PROCGEN.md: timeCost/moneyCost framing, file count, connectTo as
  function, path assignment count, RNG consumption list
- Created branch `fix-procgen-doc-and-setpiece-rng`

### Phase 1 — Topology Metrics Module
- Created `scripts/census-metrics.js` with `analyzeTopology()`
- BFS shortest path to nearest lootable target, node counts by type, gate
  detection, set piece heuristic, grade extraction
- 8 tests, Makefile updated for `scripts/*.test.js`

### Phase 2 — Resource Estimation
- Added `estimateResources()` and `weightedAvgQuality()` to census-metrics.js
- Inlined combat constants (grade modifiers, card qualities, store prices,
  hand/cash budgets) — noted as intentional trade-off for self-containment
- Deficit test initially failed: match bonus (+0.40) makes even long hard paths
  affordable. Had to use an extreme case (10 S-grade nodes with F hand) to
  trigger deficit. This was an early signal of what the census would confirm.
- 7 new tests (291 total)

### Phase 3 — Census CLI + Report Formatting
- Created `scripts/network-census.js` with summary table and detail view
- `--detail` and `--seeds` flags, `make census` target
- Report format designed for LLM readability

### Phase 4 — Set Piece Snapshot Test
- Added 3 tests: determinism, structural, and snapshot for forcePieces
- Had to find seeds where set piece doesn't fire naturally (60%→35% probability
  change later made this easier but required re-finding seeds twice)

### Phase 5 — Balance Tuning Pass
- Ran baseline census. Major findings:
  1. Critical path was always exactly 3 (every combo, every seed)
  2. timeCost had almost no effect on topology
  3. Zero deficit across the entire matrix
  4. Set piece fired 70% of the time at eligible combos
- Root cause: target always connected to depth-1 nodes (routing/gate), and BFS
  found the short path regardless of targetDepth budget value
- Fix: added "relay" role/layer — intermediate routers that chain between
  gateway-adjacent nodes and target, count based on effectiveDepth
- Hit self-loop bug: relay's connectTo checked `state.relay.length > 0` but
  the current node was already in state.relay. Fixed with `> 1` guard.
- Hit premium shortcut: cryptovault connected directly to gate, bypassing relay
  chain. BFS found gateway→gate→cryptovault (path 3) instead of the relay path.
  Fixed premium connectTo to use relay chain when available.
- Also: filler minimum bumped to max(2, routing.length), set piece probability
  reduced from 0.60 to 0.35
- Snapshots regenerated 3 times during iteration (relay addition, self-loop fix,
  premium fix). Set piece test seed changed twice.

### Census results after tuning
- Critical path now scales: 3 (F/F) → 4 (C/C) → ~4-5 (B/B) → ~4-5 (S/S)
- EstUses ranges from 4.8 (F/F) to 12.9 (S/S)
- Still zero deficit everywhere (match bonus dominates)
- Set piece frequency dropped to 20-70% range

---

## Divergences from Plan

1. **Pre-work not in plan.** The PROCGEN.md audit and RNG fix were done before
   the plan was written. This turned out to be productive — the doc review built
   understanding that directly informed the census design. Good pattern: treat
   groundwork/audit as a natural precursor to a measurement-focused session.

2. **Phase 5 was more iterative than expected.** The plan described a simple
   "run census, identify issues, tweak tables" cycle. In practice, the census
   revealed a structural topology bug (constant path length 3) that required a
   new layer definition, not just table adjustments. Two additional bugs emerged
   during the fix (self-loop, premium shortcut). This was 3 rounds of
   generate→debug→fix instead of the planned 1 round of generate→tune.

3. **Some planned tuning candidates were not addressed.** Hand size scaling
   (HAND_BUDGET at A/S) and cash budget review were identified in the spec but
   not changed — the census showed zero deficit everywhere, so these weren't
   the binding constraint. The relay layer was the real win.

4. **Set piece test seed instability.** The plan's test code assumed specific
   seeds wouldn't fire the set piece, but each RNG-sequence change (relay
   layer, probability change) shifted which seeds fire. Had to re-find valid
   seeds twice. Future approach: use a very low moneyCost (F or D) where the
   piece is ineligible, avoiding the probability lottery entirely.

---

## Key Insights

- **The census tool paid for itself immediately.** The baseline report revealed
  the critical path bug in seconds. Without it, we'd have been tuning budget
  tables that had no effect on the actual player experience.

- **"Critical path always 3" was invisible from the code.** The layer
  definitions look like they should produce varying depths. The bug was in the
  interaction between targetDepth (a budget concept) and connectTo (which always
  pointed to depth-1 nodes). The census made this structural problem visible.

- **Match bonus (+0.40) dominates resource economics.** Even at S/S with the
  longest paths, expected card uses (12.9) are well below starting uses (49).
  If we want card pressure to be a real constraint, the match bonus or starting
  hand size are the levers — not topology. This is a future tuning session.

- **Self-referential layer connections are a foot-gun.** The relay layer's
  connectTo function checked its own role in spawnedByRole, but the current
  node was already registered. The engine pushes to spawnedByRole before
  running connectTo. Any future layer that chains to its own role must use
  `length > 1` not `length > 0`.

- **Snapshot tests and RNG-consuming changes don't mix well during iteration.**
  We regenerated snapshots 3 times in Phase 5. The snapshot approach is correct
  for catching regressions between sessions, but during active tuning it's
  friction. Consider a `--update-snapshots` flag or skipping snapshot tests
  during tuning passes.

---

## Future Work Identified

Ranked by effort/value:

1. **Vuln match rate analysis** — extend census to init game state and check
   actual match coverage of starting hand vs critical path vulns
2. **ICE pressure modeling** — estimate ticks to first detection / trace based
   on ICE grade and network topology
3. **Difficulty curve visualization** — text-based charts of metrics by
   difficulty for quick visual inspection
4. **Graph structure metrics** — alternate paths, exploration surface, dead-end
   ratio
5. **Monte Carlo bot** — automated playthroughs for actual completion rates and
   resource distributions (dedicated session)
6. **Match bonus / hand size tuning** — the real card pressure lever, once we
   have better measurement (combat tuning session)

---

## Efficiency

- **Phases 1–3** (census tooling) were clean and mechanical. Each phase was
  well-scoped and completed without backtracking.
- **Phase 4** (set piece tests) was quick but revealed the seed instability
  pattern that bit again in Phase 5.
- **Phase 5** (tuning) consumed the most time due to the relay layer design,
  two bugs, and three rounds of snapshot regeneration. This was inherently
  iterative — the plan correctly flagged it as collaborative/data-driven.

Test count: 276 → 294 (18 new tests)
Branch commits: 7

---

## Process Observations

- **Groundwork audits are valuable session openers.** Reading PROCGEN.md and
  comparing it against implementation built context that made the census design
  faster and caught a real RNG bug. Consider making "audit existing docs/code"
  a standard first step for measurement-focused sessions.

- **The measure-then-tune loop works.** The baseline census immediately showed
  the critical path problem. Without measurement, we would have been adjusting
  budget tables that had no effect. Data before opinions.

- **LLM-legible reports are a force multiplier.** The census output is designed
  for Claude to read and reason about. This closes the loop: generate → report
  → Claude analyzes → suggests changes → regenerate → compare. The tooling
  becomes part of the dev workflow, not just a diagnostic.

---

## Conversation Turns

Approximately 25 exchanges from session start through retro.
Additional ~10 exchanges for the pre-work doc review and code fixes.
