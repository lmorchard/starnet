# Notes — Whole-project code review & refactor

## Execution log

(filled in as work proceeds)

### Setup
- Worktree: `.claude/worktrees/code-review-refactor` on `worktree-code-review-refactor`.
- Baseline `make check`: 1020 tests pass, lint clean.
- Five parallel review agents → findings hand-verified → `research.md`.

### Executed edits (Tier A/B/C) — all merged on branch, `make check` green after each
1. [x] Remove unused `relayout` import — visual-renderer.js (+ dead `typeVulnConfig`
       branch and unused `nodeType` param in exploits.js). Commit `refactor: remove dead code`.
2. [x] (folded into #1)
3. [x] Extract pure `nextAlertLevel()` in state/index.js; used in combat.js, alert.js,
       game-ctx.js. Behavior-preserving. Commit `refactor: extract nextAlertLevel()`.
4. [x] Shared `data/networks/index.js` (NAMED_NETWORKS/DEFAULT_NETWORK/buildGenerated) +
       `scripts/lib/grade-args.js` (parseGradeArgs). Wired main.js + all 3 scripts.
       Exercised all CLI entry points. Commit `refactor: share network registry...`.
5. [x] Unify `fillNodeId` → `fillConditionNodeId` in conditions.js (superset; closed two
       diverged latent gaps). Added 6 unit tests. Commit `refactor: unify fillNodeId...`.
6. [x] Filed deferred items as GitHub issues (#164–#172). Moving away from BACKLOG.md for
       this kind of tracking, so the temporary BACKLOG section was reverted.

### Outcome
- 1020 → 1026 tests, 0 failures, lint clean throughout.
- No behavior change except #5's strictly-more-correct edge cases (now covered by tests).
- Deferred work filed as issues (NOT done this session):
  - #164 slot-filler rollback bug (bug, P2) — needs repro test + census re-baseline
  - #165 graph.js dedup (pulse animator + BFS)
  - #166 graph-degradation.js split
  - #167 visual-renderer ↔ preview shared overlay init
  - #168 combat.js resolve/apply split
  - #169 centralize balance constants
  - #170 node-graph timed-action registry
  - #171 network-gen cleanups (tree-utils + fillSlot options)
  - #172 enable @ts-check on remaining UI entry files
- **Waveform tip filled circle: NOT a bug** — Les clarified the filled dot deliberately
  simulates the electron-gun beam painting the trace. Diegetic exception to the no-fills
  rule; no issue filed.

### Deep audit (second pass — Les asked to go deeper)
Two agents deep-read the node-graph runtime + alert/ICE flow and their tests, traced full
signal paths, ran reproductions; all high/medium findings hand-verified. Write-up:
`deep-audit.md`. Three confirmed bugs fixed in this PR (TDD, failing test first):
- **B3** owned-cancel-trace one-shot → `repeating:true` (security trait kill-switch).
- **B1** sendMessage dropped origin==target messages → un-suppressed dead graph-bridge
  exploit/alert circuits. Census (20 seeds, main vs branch): successRate/traceFiredRate
  identical → no difficulty regression; avgCash +14% from now-live loot circuits.
- **B2** DUMP/FETCH timed-action progress attr desync. Grep sweep caught a 3rd site the
  audit missed (encrypted trait DUMP). All fixed.

Root theme (legacy vs graph-mode alert regime drift; two-layer ladder vestigial in graph
mode) filed as **#173 (P1)** — design decision for the immediate next session.

**Process miss to remember:** while census-comparing main vs branch I ran
`git checkout HEAD -- js` to restore, which silently reverted the *uncommitted* B1 fix.
Commit each fix BEFORE doing file-swap comparisons, or use a stash. Caught it via grep
and re-applied.

### Notes for next time
- The `fillNodeId` divergence + the B2 phantom-attr triplet are the same disease:
  stringly-typed duplication that drifts. Issue #170 (timed-action registry) is the
  structural cure. A broader grep sweep for hand-coded `_ta_*` / duplicated helpers is warranted.
- #173 (alert layer) is the highest-value next session — it's why the manual's headline
  mechanic doesn't actually work in play.
