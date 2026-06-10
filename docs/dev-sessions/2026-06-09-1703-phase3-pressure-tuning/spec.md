# Spec — Phase 3: Pressure Tuning

Issue: [#114](https://github.com/lmorchard/starnet/issues/114). Phase 3 of the
core-loop tuning session (`docs/dev-sessions/2026-06-05-1428-core-loop-reassessment/`).

## Goal

Make **pressure (ICE / alert / trace) the thing that decides a run.** On both
tuning networks, census **losses should be dominated by `trace` / ICE, not
`stuck` / `tick-cap`**, with `avgIceDetections > 0`, and both networks remain
winnable at sensible rates.

Phase 2 (#113, research/mine action) is merged, so we tune against the final
supply model.

## Baseline (post-#112 census fix, 30 seeds — from the issue)

| Network | success | dominant fail | owned/total | ICE detect | peak alert |
|---|---|---|---|---|---|
| corporate-foothold | 1.00 | — (no ICE) | 8.8/12 | 0 | green/yellow |
| corporate-exchange | 0.567 | `tick-cap` 11, stuck 2 | 8.1/14 | 0.5 | mostly green, 5 red |

## Current tuning surface (verified in-tree)

- **Foothold meta** (`data/networks/corporate-foothold.js`): `startCash: 1000`,
  `moneyCost: "C"` (threat grade C → trace 60s), `startHand: [common, common,
  uncommon, uncommon]`, **`ice: null`**.
- **Exchange meta** (`data/networks/corporate-exchange.js`): `startCash: 200`,
  `moneyCost: "A"` (trace 40s), `startHand: [common, uncommon, uncommon, rare,
  rare]`, **`ice: { grade: "B", startNode: "sec/monitor" }`**.
- **ICE tables** (`js/core/ice.js`, grade-keyed, **global per grade**):
  - `MOVE_INTERVALS = { S:4000, A:5000, B:6000, C:7000, D:12000, F:14000 }`
  - `DWELL_TIMES   = { S:800, A:1500, B:4500, C:5500, D:9000, F:10000 }`
  - `ICE_NOISE_THRESHOLD = { S:1, A:2, B:3, C:5, D:7, F:9 }`
- **Alert/trace** (`js/core/alert.js`): trace fires when global alert reaches
  `trace` (`redDetectors >= 2 || redMonitors >= 1`). `DETECTION_TRACE_THRESHOLD`
  grade-keyed; `TRACE_SECONDS = { S:30, A:40, B:45, C:60, D:75, F:90 }`.
- **Bot evasion** (`scripts/bot/heuristics/evasion.js`): **already ejects** when
  ICE sits on an owned, selected node (issue's "bot never ejects" is stale).
  Still lacks **reboot** and any **wait-for-ICE patience**; untargets to hide.
- **traceFired stat** (`scripts/bot/loop.js` → `stats.js`): set true on
  `E.ALERT_TRACE_STARTED`. The ~0.95-on-foothold anomaly the issue cites dates to
  the pre-#112 listener-leak era; needs re-check before "fixing."

## Work (decisions from brainstorm)

### WS1 — Foothold gentle ICE
Add `meta.ice` to `corporate-foothold`. Start with grade **F** (slowest/most
forgiving), pick a `startNode` deep enough that early nodes stay safe. Tune
grade/startNode by census to land **75–90% bot success**, with the occasional
loss attributable to ICE/trace. Leave threat grade `C` unless census forces a
change.

### WS2 — Exchange tick-cap: diagnose → minimal both
1. **Diagnose.** JSON census on exchange; pull 2–3 `tick-cap` seeds; replay via
   the playtest harness with event logging. Classify each: untarget/retarget
   oscillation, genuine ICE pin, or slow-but-progressing-past-budget.
2. **Fix the bot if it's the bot.** Add **reboot** and/or a **wait-for-ICE-to-
   move patience** heuristic to `evasion.js` (no thrashing — wait rather than
   oscillate when ICE parks on the only productive node). Update
   `docs/BOT-PLAYER.md`.
3. **Tune ICE if it's pressure.** Adjust grade-B `MOVE_INTERVALS`/`DWELL_TIMES`
   for workable windows — carefully, since these are global per grade.

### WS3 — traceFired anomaly
Reproduce first via a foothold census. If it no longer reproduces post-#112,
document that and add a regression test asserting `traceFired` stays false when
alert never reaches `trace`. If it still reproduces, trace whether stat or
mechanic is wrong and fix (failing test first, per CLAUDE.md).

## Ordering
WS3 (cheap, de-risks the stat we read all session) → WS1 (self-contained) →
WS2 (the hard one). Re-census both at the end.

## Risk flagged
ICE timing tables are **global per grade**, not per-network. Tuning grade-B for
exchange could affect future grade-B networks. If exchange needs ICE changes that
shouldn't be global, prefer choosing a different grade or surface a per-network
ICE-override proposal to Les — **don't build per-network overrides silently**;
treat that as out of scope unless diagnosis forces it.

## Acceptance criteria (from issue #114)
- [ ] `corporate-foothold` has gentle ICE; no longer a 100% walkover but stays
      winnable (75–90%); losses trace to ICE/trace.
- [ ] `corporate-exchange` `tick-cap` rate largely eliminated — outcomes are
      clean wins or clean trace/ICE losses.
- [ ] On both networks, census failure reasons dominated by `trace`/ICE, not
      `stuck`/`tick-cap`; `avgIceDetections > 0`.
- [ ] `traceFired` stat discrepancy resolved (stat or mechanic fixed, with a
      test).
- [ ] Updated bot remains a meaningful gate and completes both networks at a
      sensible rate; `BOT-PLAYER.md` updated if strategy changed.
- [ ] `MANUAL.md` updated for any ICE/alert/trace behavior changes; `make check`
      green; census deterministic.

## Validation
`node scripts/bot/census.js --seeds 30 --network <net>` on both. Watch
`failReasons`, `avgIceDetections`, `peakAlertDistribution`, `traceFiredRate`.
`make check` green.
