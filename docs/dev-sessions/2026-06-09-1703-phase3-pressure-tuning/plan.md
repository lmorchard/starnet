# Phase 3 Pressure Tuning — Implementation Plan

**Goal:** Make census losses on both tuning networks dominated by `trace`/ICE
(not `stuck`/`tick-cap`), `avgIceDetections > 0`, both winnable at sensible
rates.

**Architecture:** A balance-tuning session, not a feature build. Most tasks are
**diagnose → change → census → read distribution → repeat** loops with explicit
measurement gates, plus one genuine code/test task (the `traceFired` regression).
Three workstreams executed WS3 → WS1 → WS2, re-censused at the end.

**Tech Stack:** Vanilla JS game engine; `scripts/bot/census.js` (deterministic
post-#112), `scripts/playtest.js` (replay harness), Node test runner (`make
check`).

---

## Establish honest baseline first (gate for the whole session)

- [ ] **B1.** Re-confirm the issue's baseline in this worktree (the branch is
      fresh from origin/main; verify #113 is present):
      `node scripts/bot/census.js --seeds 30 --network corporate-foothold`
      `node scripts/bot/census.js --seeds 30 --network corporate-exchange`
      Record `success`, `failReasons`, `avgIceDetections`, `peakAlertDistribution`,
      `traceFiredRate` for both in `notes.md`. **If these diverge materially from
      the issue table, stop and reconcile before tuning** (the measurement
      instrument must be trustworthy — lesson from #112).

---

## WS3 — `traceFired` anomaly (first; cheap, de-risks the stat)

### Task 3a: Reproduce / characterize
**Files:** read only — `scripts/bot/loop.js`, `scripts/bot/stats.js`,
`js/core/alert.js`.

- [ ] **Step 1.** From B1's foothold census (no ICE → alert can't reach `trace`),
      read `traceFiredRate`. Expected if healthy: `0`. If high (~0.95), the
      anomaly still reproduces post-#112.
- [ ] **Step 2.** Record the observed rate and the verdict (reproduces / does
      not) in `notes.md`.

### Task 3b (branch A — does NOT reproduce): lock it down with a regression test
**Files:** Test: `tests/integration.test.js` (new focused case) or a new
`tests/trace-fired-stat.test.js`.

- [ ] **Step 1: Write the test.** Drive a headless run on a no-ICE network (or
      assemble state where alert never escalates past `yellow`), advance ticks,
      assert the bot stats `traceFired === false` and that `E.ALERT_TRACE_STARTED`
      never emits.

```js
// Pseudocode shape — match existing integration-test harness helpers:
// 1. reset to corporate-foothold (ice: null) with a fixed seed
// 2. run the bot / tick to completion capturing events
// 3. assert no E.ALERT_TRACE_STARTED was emitted
// 4. assert stats.traceFired === false
```

- [ ] **Step 2: Run it, confirm PASS** (documents current correct behavior):
      `make test` (or the focused file). Expected: PASS.
- [ ] **Step 3.** Note in `notes.md` that the anomaly was a pre-#112 listener-leak
      artifact, now covered by a regression test. **Commit.**

### Task 3c (branch B — DOES still reproduce): find stat-vs-mechanic, fix
**Files:** `scripts/bot/loop.js` / `scripts/bot/stats.js` (stat side) **or**
`js/core/alert.js` (mechanic side).

- [ ] **Step 1: Failing test.** Same shape as 3b Step 1 but it will FAIL against
      current behavior — confirm it fails for the right reason (trace event fires,
      or stat set, when it shouldn't).
- [ ] **Step 2: Diagnose.** Determine whether `E.ALERT_TRACE_STARTED` is genuinely
      emitting without a visible escalation (mechanic bug in `alert.js`) or the
      stat is being set by a stale/leaked listener / wrong event (stat bug in
      `loop.js`/`stats.js`).
- [ ] **Step 3: Fix the wrong one only.** Smallest change.
- [ ] **Step 4: Run test, confirm PASS.** `make test`. **Commit.**

---

## WS1 — Foothold gentle ICE (target 75–90% bot success)

### Task 1a: Add forgiving ICE, start at the gentlest knob
**Files:** Modify `data/networks/corporate-foothold.js` (`meta.ice`).

- [ ] **Step 1.** Inspect foothold topology to pick a `startNode` deep enough that
      gateway + first-hop nodes are safe early:
      `node scripts/playtest.js --network corporate-foothold reset`
      then `node scripts/playtest.js "status full"` (read node ids / adjacency).
- [ ] **Step 2.** Set `ice: { grade: "F", startNode: "<deep-node-id>" }`
      (grade F = MOVE 14000 / DWELL 10000 / NOISE 9 — gentlest available).
- [ ] **Step 3.** `make check` to confirm types/tests still green (ICE now active
      on a network that had none).

### Task 1b: Census-tune to the 75–90% band
- [ ] **Step 1.** `node scripts/bot/census.js --seeds 30 --network corporate-foothold`
- [ ] **Step 2.** Read `success`, `failReasons`, `avgIceDetections`. Decision:
      - success **> 90%** and detections ≈ 0 → ICE too gentle / startNode too deep.
        Move startNode nearer the action or step grade F→D. Re-census.
      - success **< 75%** → too harsh for a gentle intro. Soften (grade up toward F,
        startNode deeper). Re-census.
      - **75–90% with losses tagged `trace`/ICE and `avgIceDetections > 0`** → done.
- [ ] **Step 3.** Record the final `meta.ice` and the census line in `notes.md`.
      **Commit** the network change.

> Tuning constraint: prefer moving `startNode` / picking grade over editing the
> global `js/core/ice.js` tables for foothold — table edits ripple to every
> network of that grade.

---

## WS2 — Exchange tick-cap (diagnose → minimal both)

### Task 2a: Diagnose why tick-cap happens
**Files:** read only + scratch transcripts.

- [ ] **Step 1.** `node scripts/bot/census.js --json --seeds 30 --network corporate-exchange`
      Capture per-run outcomes; list the seeds that ended `tick-cap`.
- [ ] **Step 2.** Replay 2–3 of those seeds with event logging:
      `node scripts/bot/census.js --json --seeds 1 --seed "<seed>" --network corporate-exchange`
      (or via `scripts/playtest.js --seed`), and inspect the tail event stream.
- [ ] **Step 3.** Classify each seed in `notes.md`:
      - **oscillation** — bot repeats untarget→retarget→untarget around ICE;
      - **ICE pin** — ICE parks on the only productive node, bot has no progress path;
      - **slow-but-progressing** — bot was winning, just ran past the tick budget.
- [ ] **Step 4.** Decide the minimal fix mix from the evidence (bot, ICE, or both).
      Record the decision + rationale before changing anything.

### Task 2b (if bot is a factor): teach reboot + patience
**Files:** Modify `scripts/bot/heuristics/evasion.js`; check action ids in
`js/core/action-ids.js`; Test: `tests/integration.test.js` (or bot-focused test);
Docs: `docs/BOT-PLAYER.md`.

- [ ] **Step 1: Failing/characterizing test.** Construct a state reproducing the
      diagnosed pathology (e.g. ICE on the bot's only productive owned node) and
      assert the bot's chosen action is the new sane one (reboot, or wait) rather
      than the oscillation. Confirm it fails against current `evasion.js`.
- [ ] **Step 2: Implement.** Add a `REBOOT` proposal and/or a wait/patience
      proposal in `evasionStrategy` — guarded so it does not thrash (e.g. wait out
      ICE rather than untarget→retarget when no other productive node exists).
      Use the existing scored-proposal pattern; pick scores relative to the
      existing `ICE_ON_NODE_*` constants.
- [ ] **Step 3: Run test, confirm PASS.** `make test`.
- [ ] **Step 4.** Update `docs/BOT-PLAYER.md` ("What the bot does NOT do" → moves
      reboot/patience into the does-do list). **Commit.**

### Task 2c (if ICE pressure is a factor): tune grade-B windows
**Files:** Modify `js/core/ice.js` (`MOVE_INTERVALS`/`DWELL_TIMES` for `B`).

- [ ] **Step 1.** Make the smallest grade-B adjustment the diagnosis implies
      (e.g. longer move interval or shorter dwell so the player gets a workable
      window). **Flag in `notes.md` that this is a global per-grade change** — list
      any other grade-B networks affected (`grep -rn "grade: \"B\"" data/networks`).
- [ ] **Step 2.** `make check` (snapshot ICE-detection tests may shift — review,
      don't blindly re-baseline).
- [ ] **Step 3.** If the change shouldn't be global, **stop and surface the
      per-network-ICE-override question to Les** rather than building it. (Out of
      scope unless approved.)

### Task 2d: Census-confirm tick-cap is gone
- [ ] **Step 1.** `node scripts/bot/census.js --seeds 30 --network corporate-exchange`
- [ ] **Step 2.** Confirm `tick-cap` is no longer a dominant fail reason; outcomes
      are clean wins or clean `trace`/ICE losses; `avgIceDetections > 0`; success
      at a sensible rate. Iterate 2b/2c minimally if not. Record in `notes.md`.
      **Commit.**

---

## Closeout

- [ ] **C1.** Final census, both networks, 30 seeds. Paste the two summary lines
      into `notes.md`. Confirm all acceptance criteria from `spec.md` are met.
- [ ] **C2.** Update `MANUAL.md` for any ICE/alert/trace behavior change (foothold
      now has ICE; any bot/trace mechanic change). Per CLAUDE.md the manual is the
      canonical behavior reference.
- [ ] **C3.** `make check` green; confirm census determinism (same seed → same
      result across two runs).
- [ ] **C4.** Write the session summary in `notes.md`. Open PR to `main`.

## Self-review notes
- Spec coverage: WS1↔AC1, WS2↔AC2/AC3, WS3↔AC4, bot/docs↔AC5, manual/check↔AC6 —
  all four acceptance criteria map to tasks. ✔
- The plan is branch-structured (3b/3c, 2b/2c) because the fix depends on a
  diagnosis we haven't run yet — each branch has concrete steps, no placeholders.
- Global-table risk is gated explicitly in 2c with a stop-and-ask.
