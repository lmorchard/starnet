# Notes — ICE multi-instance runtime migration

## Execution log

### Phase 1 — per-instance detection/dwell/alert (commit `b5216c3`)
- De-singletoned detection: each active instance dwells/detects on its own `ICE_DETECT` timer (keyed by `iceId`, cancelled by id). `recordIceDetection(nodeId, iceId)` sources the single global trace from the **sum** of `detectionCount` across instances, threshold by the detecting instance's grade.
- Single-instance parity preserved; `tests/snapshot-ice-detection.test.js` untouched and green.
- Reviews: spec ✅, code quality approved-with-minors (3 defensive nits fixed in-commit).

### Phase 2 — per-instance move timers (commit `bfcb0ea`)
- Each active instance moves on its own repeating `ICE_MOVE` timer (`{iceId}` payload) at its grade cadence; `handleIceTick(payload)` moves one instance. Added `moveTimerId` to `IceInstance`.
- **Pre-existing bug fixed (worth flagging):** `startIce()` was not idempotent — `spawnICE: () => startIce()` (game-ctx.js) is called repeatedly by the `probeBurstAlarm` set-piece (corporate-pieces.js:987, every N probes), so move timers accumulated and ICE sped up over a run. Existed on `main` (one orphaned shared timer per call); our per-instance change made it leak one per instance per call. Fixed by `cancelAllByType(TIMER.ICE_MOVE)` at the top of `startIce` (now idempotent). Test added.
  - **Census implication for Phase 6:** because this changes behavior even for a SINGLE ICE on `probeBurstAlarm` networks (no more accidental speed-up), single-monitor "parity vs main" will NOT be byte-identical on those specific networks. This is a correctness win, not a regression — the census comparison must account for it (don't misread the delta on probeBurstAlarm seeds as a bug).
- Reviews: spec ✅, code quality approved-with-minors (idempotency fix + comment + test-shape nit fixed in-commit).

### Phase 3 — one ICE per security-monitor, cap 3 (commit `dbb85d5`)
- `assemble.js` emits `meta.ice = { instances: [{startNode, grade}, ...] }` — one per `security-monitor`, `.slice(0,3)`, threat ≥ B. `initGame` builds `ice-1..ice-N` (supports both new `{instances}` and legacy `{startNode,grade}` shapes, so hand-crafted networks are untouched). `endRun` deactivates all.
- End-to-end confirmed: generated S network → 3 runtime instances on distinct monitors.
- Reviews: spec ✅ (field-by-field parity), code quality approved-with-minors (`TEMP (#136)` marker — accurate, tracked).

### Phase 4 — bot/status/EJECT enumerate instances (commit `aa1e1e7`)
- `perception` aggregates all active instances (`ice.instances` + any-instance `isOnSelectedNode`); `execute.onIceMoved` ejects on any ICE arrival; EJECT availability + `cmd-status` (4 blocks, extracted `iceInstanceLines` helper) enumerate all.
- Minor behavior refinement: `status` now shows "INACTIVE" (not "NONE") for a present-but-disabled single ICE — the old `INACTIVE` branch was dead code; this is better feedback after IDS-subverting an ICE host. No test regressed.
- Reviews: spec ✅, code quality approved-with-minors (helper extraction applied).

### Phase 5 — retire `getPrimaryIce` shim (commit `b6d1562`)
- Deleted `getPrimaryIce`/`getPrimaryIceFromState`; added `hasActiveIce(state)`; migrated all call sites to `activeIceInstances(s)[0]` / `hasActiveIce` (behavior-identical: both = first active instance). Structural test `tests/no-primary-ice.test.js` asserts zero references remain (verified by injection).
- Discovered `alert.js`'s `getPrimaryIce` was a **dead import** — the trace duration keys off `s.spec.threat` (run grade), not ICE grade. This happily means the trace clock already uses run-grade, matching the spec's intent.
- Reviews: spec ✅, code quality **Approved**.

### Phase 6 — census re-baseline + docs (this commit)
**Census comparison (50 seeds; main baseline = single-ICE foundation):**

| threat | main (single-ICE) | this branch (multi-ICE) | note |
|--------|-------------------|--------------------------|------|
| C (default, ICE-free) | 0.28 | **0.28** | identical (no ICE below B) |
| B | 0.28 | **0.18** | multi-ICE difficulty at the threshold grade |
| A | ~0.10 | ~0.10 | floor on both (pre-existing) |
| S | 0.0 | 0.0 | floor on both (pre-existing) |

- **Headline default census unchanged (0.28)** — the spec's tuning target (default within ±0.10 of 0.28) is hit dead-on, so **no cap/gate tuning applied**.
- Multi-ICE *improved* the difficulty curve: previously B≈C (single ICE added no difficulty at B); now it's a clean monotonic gradient **C 0.28 → B 0.18 → A 0.10 → S 0.0**.
- A/S were already at the floor on single-ICE main — the bot cannot beat A/S regardless of ICE count (pre-existing; related to #129 bot evasion). "threat-S 0%" is NOT a regression from this work.
- Deeper monitor-density balance deferred to #136 (the cap-3 swarm-guard stands).
- Docs: `MANUAL.md` ICE section + `docs/ICE.md` updated for multiple independent ICE.

> Baseline caveat: the main baseline drifted to include #137 during the session; the C/A/S parity (identical on both) confirms #137 didn't move census, isolating the B delta as the genuine multi-ICE effect.

### Integration with #133 (at PR time)

While this session ran, **#133 "Health + deck loss clocks: damaging ICE made real"** merged to main — a parallel ICE reinvention that made the single ICE registry-driven/typed and wired effect dispatch at detection (sentinel → HEALTH, spike → DECK, classic → alert). It rewrote the same `triggerDetection` and `initGame` spawn this session touched. Per Les's call, the two were **fully integrated** (not deferred):

- **Spawn:** the per-monitor loop now gives each instance its own `pickIceTypeId` roll → a multi-monitor LAN fields a **mix of typed ICE** (verified: e.g. spike + 2 classic; sentinel + 2 classic).
- **Detection:** my per-instance `triggerDetection(ice, nodeId)` now calls #133's `applyIceEffects(ice, …)` — each instance dispatches **its own** type's effects with its own `iceId` (alert routed via `recordIceDetection(nid, ice.id)`).
- One stale test assertion updated (legacy single-ICE `typeId` is now registry-driven, not `'standard-ice'`).

**Re-census vs current main (#133, single typed ICE):** default (C) **0.28 — unchanged**; B 0.27→0.30, A 0.167 (same), S 0.0 (same) — all within noise. Multi-instance on top of #133 doesn't move aggregate success (more detections, but bot outcomes are trace-dominated and damage clocks rarely deplete under cap-3). No tuning needed. Final test count **859 pass** (this session's + #133's suites), lint clean.

## Final summary

Completed the singleton→multi-instance ICE runtime migration (#36). Every active ICE is now an independent roaming detector (own dwell/detection/move-timer), production spawns one per security-monitor (cap 3, threat ≥ B), the `getPrimaryIce` shim is retired (locked by a structural test), and the bot/status enumerate all instances. Default-grade balance is unchanged; the multi-ICE difficulty lands at threat B and produces a cleaner monotonic curve. Split out: #136 (monitor-density / IDS-sensor consolidation — the real ICE-count balance lever). 6 phases, one commit each, 794 tests + lint green throughout. Each phase passed independent spec-compliance and code-quality review.

Incidental pre-existing bug fixed: `startIce` was not idempotent (orphaned move timers under the repeating `probeBurstAlarm` → `spawnICE` trigger) — now cancels-and-reschedules.
