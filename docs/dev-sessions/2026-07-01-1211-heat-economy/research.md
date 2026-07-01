# Session 2 (heat model) — codebase research

Integration points for collapsing Session 1's monotonic `programNoise` into a decaying **heat**
meter + alert ratchet. Off `origin/main` @ 07fe7f9 (Session 1 merged, #263).

## Heat state (extends what Session 1 shipped)
- `GameState.programNoise` (monotonic accumulator) — `js/core/types.js`, init/heal
  `js/core/state/index.js` (init ~166, heal ~389). Becomes decaying **heat**.
- Setter `addProgramNoise` in `js/core/state/flow.js` (returns new total). Rename/extend to a
  clamped `addHeat` + a `decayHeat(amount)` (floor 0). Re-exported via `js/core/state.js`.

## Alert sensor + ratchet + cooldown levers — `js/core/alert.js`
- `recordProgramNoise(amount)` (line ~173): today adds noise, steps the ladder by cumulative
  thresholds, starts trace at the top. Becomes the **heat trip-line**: add heat; on a rising-edge
  crossing of the (hidden, per-network) alarm threshold, commit ONE alert-ladder step
  (escalation-only) and discharge some heat so it must rebuild.
- `coolGrid(monitorIds, mode)` (~206), `scrubLogs(monitorId)` (~227), `lieLow(wanNodeId)` (~237):
  today both cool the *grid alert*. **Repoint `lieLow` to decay HEAT (not alert)**; keep
  `scrubLogs` (+ `corrupt`, `cancel-trace`) as the **alert**-reduction (subversion) levers.
- Ladder helpers: `GLOBAL_ALERT_ORDER`, `setGlobalAlert`, `startTraceCountdown` — reuse.

## Decay timer — `js/core/timers.js`
- `TIMER` enum (line 13), `scheduleRepeating(type, intervalMs)` (54). `TRACE_TICK` is the model
  (`alert.js:44` schedules it; `handleTraceTick` at `alert.js:48`).
- Add `TIMER.HEAT_DECAY` + `handleHeatDecay()` in alert.js; start it at run init (always running
  during a run, unlike trace which is on-demand).
- **Handler wiring is multi-site** (three entry points): `js/ui/main.js:162` registers
  `on(TIMER.TRACE_TICK, …)` inline; headless (`scripts/playtest.js`, bot) use the shared
  `wireRunHandlers` (imported at `playtest.js:17`). Register `HEAT_DECAY` in BOTH.

## Heat inputs (this session: core activity feeds heat)
- **Probe** → `resolveProbe` in `js/core/node-graph/game-ctx.js:204`.
- **Xploit** → `applyCombatResult` in `js/core/combat.js:245` (resolution `resolveExploit:69`).
  Decide heat on attempt vs. success/fail during planning (default: every attempt adds heat).
- **Programs** (SNIFF/REPLAY) → already call `recordProgramNoise` (→ becomes addHeat) in
  `js/core/programs.js`.
- Grid (exploit-failure → IDS → monitor → `recordMonitorAlert`) and ICE stay SEPARATE alert
  sensors — heat does not subsume them this session.

## Per-network heat sensitivity — `js/core/balance.js`
- Session 1 added `PROGRAM_NOISE_COST` / `PROGRAM_NOISE_THRESHOLD`. Replace with heat tables:
  per-action `HEAT_COST`, a grade-keyed `HEAT_ALARM_THRESHOLD` (low threat = high bar = absorbs
  bursts; hardened = low bar), and a `HEAT_DECAY_RATE`. All placeholders — feel + census tuned.

## Qualitative readout — `js/ui/components/starnet-hud.js`
- Session 1's numeric `NOISE: N` (hud `programNoise` prop, fed by `visual-renderer.js`). Replace
  with a stroked **heat gauge** (relative fill + cool/warm/hot zone; never the number/threshold).
  Geometry in a pure module consumed by the HUD + `preview.js` (project vector-UI + preview rules).

## Bot / census — REAL gate this time
- Session 1's noise didn't touch the bot (it ignores programs). **Heat now feeds probe/xploit,
  which the bot does every run** — so heat directly affects `successRate`/`traceFiredRate`.
  `make census` is a genuine balance gate here; tune heat so the difficulty curve doesn't regress
  vs. a same-seed run on `main`.
