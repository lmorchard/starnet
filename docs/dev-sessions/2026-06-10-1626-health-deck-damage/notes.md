# Notes — Health + Deck loss clocks (#133)

## Summary

Made the player **HEALTH** and **DECK INTEGRITY** pools real in play. ICE-reinvention
session 1 had already shipped the data layer (the pools, clamped mutators, the
`burned`/`bricked` run-end wrappers, and the `damage-health`/`damage-deck` effect atoms)
— but nothing fired the atoms in a live tick, no ICE dealt damage, and the pools were
invisible. This session wired the effect dispatch at the detection trigger, added two
damaging ICE presets, made the pools spawn-selectable, and surfaced them in the HUD,
`status`, the log, and the end screen.

Branch `worktree-health-deck-damage` off `main`, in a worktree. `make check` green
throughout (793 tests, lint clean).

## What shipped (10 tasks, TDD, subagent-driven)

1. **Atoms register in the live app** — `ice/effects.js`/`triggers.js` were imported only
   by tests; added side-effect imports to `ice/index.js`. (Prerequisite discovered during
   planning — without it the registry is empty at runtime.)
2. **Sentinel + Spike presets** + pure `pickIceTypeId(grade, roll)` (reuses canonical
   `GRADE_INDEX`). Sentinel = `damage-health 20`, Spike = `damage-deck 20`, **neither
   raises alert**.
3. **Effect dispatch at detection** — `triggerDetection` now sets the detection lock and
   calls `applyIceEffects`, which applies the instance type's `effects[]` via a ctx
   (`raise-alert` → `recordIceDetection`; `damage-*` → `player-orchestration` wrappers),
   emits `ICE_ACTIVATED`/`ICE_EFFECT_APPLIED`, and logs damage readouts. Classic ICE
   behavior is provably unchanged (regression test + existing snapshot test green).
4. **Registry-driven typed spawn** — replaced hardcoded `standard-ice`; the single ICE's
   type is rolled at spawn (weighted, B+). Spawn also derives `behaviorPattern`/`focus`
   from the registry type so the serialized instance is honest.
5. **HUD meters** — HEALTH/DECK color-ramping meters (green→yellow→red).
6. **`status` lines** — HEALTH/DECK in `status` summary + full.
7. **End-screen** — `burned` → "FLATLINED", `bricked` → "DECK FRIED" (cash zeroed).
8. **Harness** — `ICE_EFFECT_APPLIED` surfaced in `scripts/playtest.js`.
9. **MANUAL.md** — loss clocks, Sentinel/Spike, outcomes, `status`.
10. **Verification** — `make check`, bot census, browser smoke.

## Key design decision: alert-raise is an orthogonal effect type

At Les's call, alert-raising is **not** auto-bundled onto damaging ICE. The three loss
vectors are independent: classic ICE pursue the **trace**, Sentinel pursues **health**,
Spike pursues the **deck**. Consequence (intentional): on a Sentinel/Spike run, ICE no
longer feeds the trace clock — trace pressure there comes only from exploit-failure IDS
detections. Which ICE you face changes which clock you're racing.

## Tuning values (as shipped — all easily adjustable)

- Pools: **100 / 100**. Damage per detection: **20** (≈5 detections to deplete).
- Sentinel/Spike gated to threat **B+**; at B+ the roll is classic 50% / sentinel 25% /
  spike 25%. Below B, always classic.

## Census finding — the mechanic is currently very gentle under bot play

`node scripts/bot/census.js --seeds 20 --threat B`: 30% success, **all 14 failures are
trace-driven, zero burned/bricked**, avg **0.4** ICE detections/run. The bot evades
detection so well that damaging ICE almost never lands a hit, and 5 hits are needed to
deplete a pool. At threat D (no ICE spawns at all — provably identical to baseline) the
no-ICE path is unchanged.

**No difficulty regression** (classic path test-proven identical; damaging path only
*removes* alert pressure + adds rare damage). But the mechanic barely bites in automated
play. Follow-up tuning options if we want it to matter: lower pools, higher per-hit
damage, or repeat/cooldown damage on sustained dwell. Deferred — #133 was "make it real,"
and it is; balancing its teeth is a separate pass (do it by hand or extend the bot to
react to health, per the mine-balance precedent).

## Browser smoke caught a real bug

The HUD meters collapsed to **2px** because the header is a flex row and the
`inline-block` meter had default `flex-shrink:1`. Fixed with `flex: 0 0 auto`. Verified
afterward: 64px width, HEALTH 12 → red @12%, DECK 50 → yellow @50%; end-screen titles
correct for all four outcomes. (Gotcha for next time: a stale `make serve` on :3000 was
serving the *main* checkout — had to serve the worktree on :3101 to see the real build.)

## Follow-ups / known caveats

- **Stale `state` to multi-effect atoms**: `applyIceEffects` passes the pre-effect `state`
  snapshot to every atom in a list; the loop's phase-break guard re-reads live state, and
  current damage atoms ignore `state`, so it's harmless today. A future atom that reads
  `state.player.*` to compute a value would see stale data — re-read inside the loop then.
- **Biome-biasing** the type roll is a deferred seam in `pickIceTypeId` (grade-gating only
  for MVP).
- **Bloom-driven-by-deck-integrity** (the `setBloomIntensity` seam on `main`) belongs to
  the #134 plasma visual pass, not #133.
- **#134 (plasma overlay)** reads the now-live `health` pool — unblocked.
