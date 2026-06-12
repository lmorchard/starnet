# Spec — Whole-project code review & refactor

## Goal

Step back after a run of merged PRs, review the whole JS codebase for code-quality and
refactor opportunities, write up findings, and execute the obvious safe wins.

## Approach

Parallel review agents across the five subsystems → hand-verify every finding → record in
`research.md` → execute only the behavior-preserving / verified-safe items this session →
document larger refactors in `docs/BACKLOG.md`.

## In scope (this session)

- Tier A: dead-code removal (unused import, dead branch)
- Tier B: behavior-preserving dedup (alert-stepping helper, shared CLI scaffolding)
- Tier C: `fillNodeId` consolidation (also closes a latent divergence)

## Out of scope (documented, deferred)

- slot-filler rollback bug (needs reproducing test + census re-baseline)
- waveform CRT-vocabulary fix (feel-work; Les's call)
- Large decompositions: graph.js, graph-degradation.js, combat.js, balance-constants,
  timed-action registry, ts-check enablement (each its own session)

## Success criteria

`make check` green after every change; no behavior change except #5's strictly-more-correct
edge cases; session docs + backlog updated; PR opened.
