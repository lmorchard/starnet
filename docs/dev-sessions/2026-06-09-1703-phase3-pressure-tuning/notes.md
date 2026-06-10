# Notes — Phase 3 Pressure Tuning

Issue #114. Branch `worktree-phase3-pressure-tuning`.

## Decisions (brainstorm)
- Tick-cap: **diagnose first, then minimal both** (bot evasion + ICE tuning as
  evidence dictates).
- Foothold ICE target: **75–90% bot success**, losses attributable to ICE/trace.
- Stale-issue correction: the bot **already ejects** on owned selected nodes
  (`scripts/bot/heuristics/evasion.js`); it still lacks reboot + patience.
- traceFired anomaly likely a pre-#112 listener-leak artifact — re-check before
  fixing.

## Baseline census (Task B1) — 30 seeds each, this worktree

| Network | success | failReasons | owned/total | ICE detect | ICE evasions | peak alert | traceFiredRate |
|---|---|---|---|---|---|---|---|
| corporate-foothold | 1.000 | {} | 8.8/12 | 0 | 0 | 30 green | 0 |
| corporate-exchange | 0.533 | tick-cap 12, stuck 2 | 8.0/14 | 0.47 | **55.8** | 25 green / 5 red | 0.067 |

Matches the issue table (exchange 0.533 vs 0.567 is a ~1-seed delta — trustworthy
instrument). Notes:
- **Foothold traceFiredRate is now 0**, not the ~0.95 the issue cited — the
  *foothold-specific* anomaly was a pre-#112 artifact. BUT a default-spec
  `generated` census shows `traceFiredRate 0.78` with peakAlert 46 green / 2
  yellow / 2 red and 0 ICE detections → the discrepancy persists there. The real
  contradiction: `traceFired` (≈39/50 runs) vs peakAlert (only 2 red). WS3 = live
  bug, branch C (find stat vs mechanic).
- **Exchange avgIceEvasions 55.8/run** — heavy evasion thrash; early evidence the
  tick-cap is partly the untarget/retarget oscillation (WS2 bot side).

## WS3 — traceFired anomaly → it's a STAT bug, fixed ✅

**Root cause (stat, not mechanic):** `scripts/bot/stats.js` had
`ALERT_RANK = { green:0, yellow:1, red:2 }` with **no `trace` entry**.
`updatePeakAlert` does `(ALERT_RANK[level] ?? 0) > (ALERT_RANK[peak] ?? 0)`, so a
`trace`-level raise resolved to rank 0 and could never update `peakAlert`. The
mechanic is correct: `recomputeGlobalAlert` (alert.js:98) sets `globalAlert`
straight to `"trace"` when `redMonitors>=1`/`redDetectors>=2`, emits
`ALERT_GLOBAL_RAISED{next:"trace"}` and `ALERT_TRACE_STARTED` together — so
`traceFired` was right; `peakAlert` undercounted. (Also why pre-fix runs showed
low `red`: alert jumps green/yellow→trace, skipping a distinct red raise.)

**Fix:** add `trace: 3` to `ALERT_RANK` (one line; mirrors `GLOBAL_ALERT_ORDER`).

**Regression test:** `tests/bot-stats.test.js` — `updatePeakAlert("trace")`
records trace; trace outranks red and isn't lowered by a later raise; peakAlert
and traceFired can't contradict. Failed 3/3 before, passes after.

**Validation (deterministic targets):**
- exchange: was `25 green / 5 red`, traceFired 0.067 → now `25 green / 3 red /
  2 trace`, traceFired 0.067. The 2 trace runs were the mis-bucketed reds; stat
  now reconciles exactly (0.067 = 2/30).
- foothold: all green / 0 — unchanged, consistent.

**Out-of-scope discovery (flagged, not fixed):** the `generated` census produces
`peakAlert: "unknown"` / `success: 0` for some procgen topologies (verified
identical with/without this fix at seed "phase3" — pre-existing). The bot appears
to fail to finalize stats on certain generated networks. Not a #114 target; worth
a separate issue.

## WS3 — second bug found: trace mechanic bypassed global alert ✅

While tuning WS1, the foothold sweep showed runs with `traceFired=true` but
`peakAlert=green` and `det=0` *even after* the ALERT_RANK fix. Root cause #2
(mechanic, this time): set-piece alarms fire trace via `ctx.startTrace()` →
`startTraceCountdown()` (game-ctx.js:54), which **never set `globalAlert` to
"trace"** — it only set the countdown + emitted `ALERT_TRACE_STARTED`. So
alarm-triggered traces left the alert level at green/yellow (the issue's "trace
can start without a visible alert escalation"). Fix: `startTraceCountdown()` now
guarantees `globalAlert==="trace"` (+ emits `ALERT_GLOBAL_RAISED`) for ALL
callers; the escalation paths already set it first so they skip the redundant
raise. Test: integration.test.js "Trace: startTraceCountdown drives global alert
to trace". `make check` 661 green.

## WS1 — foothold ICE: BLOCKED on a shared root cause (decision needed)

ICE placement/grade sweep on foothold (30 seeds), post both WS3 fixes:

| grade @ start | succ | iceDet | iceEva | trace | fails |
|---|---|---|---|---|---|
| F @ router-1 | 100% | 0 | 0.8 | 0 | — |
| D @ router-1 | 93.3% | 0 | 1.4 | 2 | stuck 2 |
| C @ router-1 | 100% | 0 | 10.8 | 0 | — |
| B @ router-1 | 96.7% | 0.2 | 13.2 | 1 | stuck 1 |
| C @ office/fileserver | 100% | 0.1 | 9.1 | 0 | — |
| B @ vault/vault-node | 100% | 0.2 | 9.9 | 0 | — |

**Two blockers, both rooted in the bot's evasion heuristic:**

1. **ICE detections ≈ 0 at any gentle grade.** The bot abandons its action the
   instant ICE arrives (`execute` returns `interrupted` → bot deselects, cools the
   node one cycle, retries) — so ICE essentially never completes a dwell on the
   bot. The trace that *does* fire on foothold comes from the **nthAlarm
   set-piece**, not ICE. Acceptance wants `avgIceDetections > 0`; gentle ICE
   cannot produce that against this bot.

2. **Loss attribution.** When trace fires and the bot smartly jacks out to save
   loot (census-22: owned 8/12, ¥17k, then bailed), the run is tagged `stuck`
   (jackout → outcome "success" → `stats.success=false` via incomplete mission →
   failReason defaults to "stuck"). Only countdown-expiry ("caught") is tagged
   "trace". So trace-pressure losses masquerade as `stuck`.

**Same root drives WS2:** the abandon-and-retry oscillation is the exchange
`iceEvasions 55.8`/run thrash → tick-cap. Fixing the bot's evasion is the lever
for BOTH networks. → Re-sequence: do the bot-evasion work (WS2) first, then
re-tune foothold ICE against the improved bot. Surfaced to Les before changing
bot behavior (see decision below).

## WS2 — exchange tick-cap: DIAGNOSED + bot fixed ✅ (pressure tuning = open fork)

**Diagnosis:** tick-cap was the bot's abandon-and-retry thrash. `execute.js`
aborted the in-progress action the instant ICE *arrived* on the node — but
detection needs a grade-scaled *dwell* (45–90 ticks). So ICE never actually
detected the bot (toothless), yet the bot abandoned + restarted actions endlessly
(`iceEvasions 55.8/run`, ticks ~3200 → tick-cap).

**Fix (committed):** the hack and the dwell now race — the bot keeps working
through ICE arrival (ejecting on owned nodes, which is free) and bails only when
detection actually fires. Exchange: success 0.53→1.00, ticks 3200→1300,
iceEvasions 56→0.8, iceDetections 0.47→0.77. **Tick-cap eliminated.** Plus loss
attribution fix (bail-under-trace → "trace", not "stuck").

**STRUCTURAL FINDING — ICE can't drive trace on these networks.** Both have
exactly **1 IDS detector + 1 monitor**. Trace fires on `redDetectors>=2`
(impossible — 1 detector) OR `redMonitors>=1` (monitor only escalates if ICE
detects the player on a node *adjacent* to it — rare). So ICE detections peg the
alert at **red but never trace**; trace comes from set-piece alarms (nthAlarm /
probeBurst / noise / honeypot), which are play-dependent, not ICE-grade-dependent.
With the now-competent bot, both networks sit ~100%.

**Foothold sweep (new bot, 30 seeds):** F/D@router-1 → 100%/det0; C@router-1 →
100%/det0.37; B@router-1 → 100%/det1.43 (15 red peaks, still 100% — recovers);
B@vault → 96.7%/det0.73/1 trace.

**Exchange sweep (new bot, 30 seeds):**
| grade @ start | succ | det | losses |
|---|---|---|---|
| B @ sec/monitor (current) | 100% | 0.77 | — |
| B @ switch-1 | 96.7% | 0.63 | trace 1 |
| A @ switch-1 | 93.3% | 22.0 | trace 1, tick-cap 1 |
| A @ sec/monitor | 83.3% | 18.5 | trace 3, tick-cap 2 |
| S @ switch-1 | 13.3% | 217 | tick-cap 26 |

**The fork:** gentle/clean ICE → bot wins ~95–100% (no real losses); harsh ICE
(A) → 83–93% with trace losses BUT det explodes (18–22/run = oppressive) and the
flee-on-detection thrash starts creeping back (S = 13%/tick-cap 26). The
"commit-to-hack" fix is clean at *occasional* detection, not at *saturation* —
harsh ICE needs a bot patience/back-off heuristic (don't re-engage a node until
ICE leaves) to stay clean. Decision needed from Les (see below).

## ROOT CAUSE & RESOLUTION — ICE→trace never matched the manual

Stepping back (Les asked "is this even legible/fun?") surfaced the real bug:
**MANUAL.md describes ICE detection driving trace directly** ("each detection
steps the alert GREEN→YELLOW→RED→TRACE; N detections to trace, grade-scaled
S/A:1, B/C:2, D/F:3") — but the **code never implemented it**.
`DETECTION_TRACE_THRESHOLD` and `ice.detectionCount` were defined and never read
(dead code). Instead ICE detection routed through the *exploit-failure* IDS-node
coloring path, where trace needs `≥2 red detectors` (impossible on a 1-detector
network) or a red monitor (rare). So ICE could peg the alert at red but never
trace — mechanically toothless by accident, and illegible.

**Fix (matches the manual):** `recordIceDetection` now steps the global alert and
starts the trace countdown at `DETECTION_TRACE_THRESHOLD[grade]` detections;
removed the `propagateAlertEvent` conflation from `triggerDetection` (ICE = the
pursuit layer, driving global alert directly; IDS→monitor propagation stays the
separate exploit-failure puzzle layer). Grade-scaled tests in integration.test.js
(single IDS suffices). This dissolved the whole pressure-tuning problem: gentle
ICE now meaningfully threatens, and grade/placement control difficulty as
designed. **No MANUAL.md change needed — the manual was right; the code now
conforms.**

## Closeout — final census (official, this worktree)

| Network | config | success | failReasons | iceDet | peak alert | tick-cap/stuck |
|---|---|---|---|---|---|---|
| corporate-foothold | grade C @ router-1 (was `null`) | 0.94 (50s) / 0.933 (30s) | trace only | 0.34 | 36g/11y/3 trace | **0** |
| corporate-exchange | grade B @ sec/monitor (unchanged) | 0.84 (50s) | trace only | 0.76 | 19g/23r/8 trace | **0** |

Determinism re-verified (same seeds → identical summary). `make check` green
(666 tests). Foothold lands at 94% (slightly above the 75–90% band) — among
gentle grade-C placements router-1 is the only one that bites (vault 98% / office
100%); grade B drops to 50–80% but isn't "gentle". 94% with clean trace losses is
the right read for a tutorial-adjacent network. **Confirm with Les.**

## Acceptance criteria (issue #114)
- [x] foothold has gentle ICE; no longer a 100% walkover (94%); losses all trace.
- [x] exchange tick-cap eliminated; outcomes are clean wins or clean trace losses.
- [x] both networks: failure reasons dominated by trace/ICE (100% trace, 0
      stuck/tick-cap); `avgIceDetections > 0` (0.34 / 0.76).
- [x] traceFired discrepancy resolved — TWO bugs (ALERT_RANK stat + alarm-path
      mechanic), both with regression tests.
- [x] bot remains a meaningful gate (completes both at 0.94 / 0.84); BOT-PLAYER.md
      updated for the commit-to-hack evasion change.
- [x] MANUAL.md current (no change needed — code conformed to it); `make check`
      green; census deterministic.

## Out-of-scope discoveries (flagged for separate issues)
- `generated` census produces `peakAlert: "unknown"` / `success: 0` on some
  procgen topologies (pre-existing, verified independent of these fixes) — the
  bot fails to finalize stats on certain generated networks.
- A bot **patience/back-off** heuristic (don't re-engage a node until ICE leaves;
  bail early when a hack won't beat the dwell) would let *harsh* ICE (grade A/S)
  produce clean trace losses without saturation thrash — not needed for the two
  tuning networks at C/B, but the lever if future networks want grade-A pressure.
