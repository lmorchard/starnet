# Heat Model (anti-tedium arc pt.1) Implementation Plan

**Goal:** Collapse Session 1's monotonic `programNoise` into a decaying **heat** meter feeding the
alert ladder as a rising-edge **trip-line ratchet**; heat fed by probe/xploit/programs; hidden
per-network thresholds; lie-low → heat cooling; alert-down via subversion only; qualitative gauge.

**Approach:** Rename the field to `heat`; add a `HEAT_DECAY` repeating timer (mirrors `TRACE_TICK`);
turn `recordProgramNoise` into `recordHeat` (trip-line: cross hidden threshold → one alert step +
heat discharge); feed heat from `resolveProbe` / `applyCombatResult` / programs; repoint `lieLow` to
heat; replace the numeric HUD readout with a stroked gauge. Numbers are placeholders → feel + census.

**Tech stack:** Vanilla ES modules, JSDoc `@ts-check`, node:test, Lit HUD, esbuild vendor.

**Naming:** the serializable field `state.programNoise` → **`state.heat`** (+ heal). Event
`E.PROGRAM_NOISE` → `E.HEAT_CHANGED`. `recordProgramNoise` → `recordHeat`.

---

## Phase 1: Heat state + decay timer (foundation, no ratchet yet)

Rename the field, make it decay on a repeating timer. Pure plumbing.

**Files:**
- Modify: `js/core/types.js` — `GameState.programNoise` → `heat: number`; add `heatDecayTimerId: number|null`.
- Modify: `js/core/state/index.js` — init `heat: 0`, `heatDecayTimerId: null`; heal both.
- Modify: `js/core/state/flow.js` — `addProgramNoise` → `addHeat(amount)` (clamp ≥0, return total) + `decayHeat(amount)` (floor 0) + `setHeatDecayTimerId`.
- Modify: `js/core/state.js` — re-export the renamed setters.
- Modify: `js/core/balance.js` — replace `PROGRAM_NOISE_*` with heat tables (below).
- Modify: `js/core/timers.js` — add `TIMER.HEAT_DECAY`.
- Modify: `js/core/alert.js` — `startHeatDecay()` (schedule repeating, store id), `handleHeatDecay()` (decay each tick).
- Modify: `js/ui/main.js` + the headless run-wiring (`wireRunHandlers`) + bot init — register `on(TIMER.HEAT_DECAY, handleHeatDecay)` and call `startHeatDecay()` at run start (mirror where `TRACE_TICK`/`ICE_MOVE` are wired; confirm all three entry points).
- Test: `tests/heat.test.js` (new).

**Key changes:**
- `balance.js` (placeholders — feel + census tuned in Phase 6):
  ```js
  // Heat: a decaying "notice" meter. Activity adds heat; it bleeds off each decay tick. Crossing
  // a network's (hidden) HEAT_ALARM_THRESHOLD trips one alert-ladder step + discharges heat.
  export const HEAT_COST = { probe: 1, xploit: 2, sniff: 1, replay: 3 };
  export const HEAT_ALARM_THRESHOLD = { S: 4, A: 5, B: 7, C: 9, D: 12, F: 15 }; // grade-keyed sensitivity
  export const HEAT_DECAY_PER_TICK = 0.15;   // per HEAT_DECAY interval
  export const HEAT_DISCHARGE_FRAC = 0.5;    // on a trip, heat → threshold * this
  export const HEAT_DECAY_MS = 1000;         // decay tick interval (like TRACE_TICK)
  export const LIE_LOW_HEAT_DROP = 6;        // lie-low's accelerated heat shed (Phase 4)
  ```
- `alert.js`:
  ```js
  import { HEAT_DECAY_PER_TICK, HEAT_DECAY_MS } from "./balance.js";
  import { addHeat, decayHeat, setHeatDecayTimerId } from "./state/flow.js"; // via state.js if cleaner
  export function startHeatDecay() {
    if (getState().heatDecayTimerId !== null) return;
    setHeatDecayTimerId(scheduleRepeating(TIMER.HEAT_DECAY, HEAT_DECAY_MS));
  }
  export function handleHeatDecay() {
    const s = getState();
    if (!s || s.phase !== "playing" || s.heat <= 0) return;
    decayHeat(HEAT_DECAY_PER_TICK);
    // no event per tick unless the HUD needs it — visual-renderer reads state.heat on STATE_CHANGED
  }
  ```

**Verification — automated:**
- [ ] `make lint` / `make test` / `make check` pass
- [ ] New test: `addHeat`/`decayHeat` clamp at 0; `heat` + `heatDecayTimerId` survive serialize→deserialize; pre-field save heals to `heat:0`.
- [ ] New test: after `startHeatDecay()` + `addHeat(3)`, advancing N `tick()`s reduces `heat` (decay timer fires).

**Verification — manual:** none (no UI/ratchet yet).

---

## Phase 2: Heat trip-line ratchet (replaces cumulative noise escalation)

Turn `recordHeat` into the rising-edge trip-line. This is the core mechanic.

**Files:**
- Modify: `js/core/alert.js` — `recordProgramNoise` → `recordHeat(amount)` (trip-line logic).
- Modify: `js/core/events.js` — `E.PROGRAM_NOISE` → `E.HEAT_CHANGED`; add `E.HEAT_ALARM` (trip).
- Test: `tests/heat.test.js`.

**Key changes:**
- `recordHeat` — add heat, then trip if over the network's threshold. Discharge on trip so it must
  rebuild (rising-edge without a separate armed flag). Escalation-only; steps into trace start the clock:
  ```js
  import { HEAT_ALARM_THRESHOLD, HEAT_DISCHARGE_FRAC } from "./balance.js";
  export function recordHeat(amount) {
    const total = addHeat(amount);
    emitEvent(E.HEAT_CHANGED, { amount, total });
    const s = getState();
    const threat = s.spec?.threat ?? "C";
    const threshold = HEAT_ALARM_THRESHOLD[threat] ?? 9;
    if (total < threshold) return;                    // under the bar — no trip
    // Trip: step the alert ladder up one (escalation-only); discharge heat so it must rebuild.
    const cur = s.globalAlert;
    const idx = GLOBAL_ALERT_ORDER.indexOf(cur);
    const next = GLOBAL_ALERT_ORDER[Math.min(idx + 1, GLOBAL_ALERT_ORDER.length - 1)];
    decayHeat(total - threshold * HEAT_DISCHARGE_FRAC); // knock down to threshold*frac
    emitEvent(E.HEAT_ALARM, { level: next });
    if (next === "trace") {
      if (s.globalAlert !== "trace") { setGlobalAlert("trace"); emitEvent(E.ALERT_GLOBAL_RAISED, { prev: cur, next: "trace" }); }
      if (getState().traceSecondsRemaining === null) startTraceCountdown();
      return;
    }
    if (next !== cur) { setGlobalAlert(next); emitEvent(E.ALERT_GLOBAL_RAISED, { prev: cur, next }); }
  }
  ```
  (Delete the old cumulative `PROGRAM_NOISE_THRESHOLD` yellow/red/trace block.)

**Verification — automated:**
- [ ] `make check` passes
- [ ] New test: a single `recordHeat` spike ≥ threshold steps alert green→yellow AND discharges heat (heat < threshold after).
- [ ] New test: several small `recordHeat` calls each < threshold, with `decayHeat` between, never step the alert (paced = safe).
- [ ] New test: repeated over-threshold trips climb yellow→red→trace and start the trace countdown.
- [ ] New test: per-network sensitivity — same heat trips a hardened (low-threshold) grade but not a low-threat (high-threshold) grade.

**Verification — manual:** none yet.

---

## Phase 3: Heat fed by core activity (probe / xploit / programs)

Make the whole loop generate heat, so pacing matters for probe/xploit — the anti-tedium payoff.

**Files:**
- Modify: `js/core/node-graph/game-ctx.js` — `resolveProbe` calls `recordHeat(HEAT_COST.probe)`.
- Modify: `js/core/combat.js` — `applyCombatResult` calls `recordHeat(HEAT_COST.xploit)` on **every** attempt (both success and failure branches).
- Modify: `js/core/programs.js` — `recordProgramNoise(...)` → `recordHeat(HEAT_COST.sniff|replay)` (rename call).
- Test: `tests/heat.test.js`.

**Key changes:**
- `game-ctx.js resolveProbe`: after the probe resolves, `ctx`-side call `recordHeat(HEAT_COST.probe)` (import from alert.js + balance.js). Confirm import direction (game-ctx already calls alert-ish ctx methods).
- `combat.js applyCombatResult`: add `recordHeat(HEAT_COST.xploit)` once near the top (fires for success and failure alike — activity is racket regardless of outcome; the grid still separately handles failure-detection).

**Verification — automated:**
- [ ] `make check` passes
- [ ] New test: `resolveProbe` raises `state.heat` by `HEAT_COST.probe`.
- [ ] New test: an xploit attempt raises heat by `HEAT_COST.xploit` on both a forced success and a forced failure.
- [ ] New test: a burst of probes (no decay between) trips the alert; the same probes spaced with decay ticks between do not.

**Verification — manual:**
- [ ] Playtest harness: `probe`/`xploit` several nodes fast → alert trips; `tick`-space them → stays cool.

---

## Phase 4: lie-low → heat cooling; alert-down via subversion only

Repoint the cooldown levers to the two-layer model.

**Files:**
- Modify: `js/core/alert.js` — `lieLow(wanNodeId)` stops calling `coolGrid`; instead sheds heat (`decayHeat(LIE_LOW_HEAT_DROP)` or to 0), keeps the per-run use/exhaust bookkeeping, emits a cooled event. `scrubLogs` unchanged (stays the alert step-down = subversion). `coolGrid` retained for `scrubLogs`.
- Modify: `js/core/events.js` — reuse `E.ALERT_COOLED` for scrub; add/repoint a heat-cooled signal for lie-low (e.g. `E.HEAT_CHANGED`).
- Modify: `MANUAL.md` — lie-low now cools heat (not alert); alert-down is subversion-only.
- Test: `tests/heat.test.js` + update existing lie-low tests.

**Key changes:**
- `lieLow`:
  ```js
  export function lieLow(wanNodeId) {
    const s = getState(); const graph = s.nodeGraph; if (!graph) return;
    // Heat-only now: lie-low sheds heat, never lowers the alert ratchet (that's subversion's job).
    decayHeat(LIE_LOW_HEAT_DROP);
    emitEvent(E.HEAT_CHANGED, { amount: -LIE_LOW_HEAT_DROP, total: getState().heat });
    const remaining = (graph.getNodeState(wanNodeId)?.lieLowUsesRemaining ?? 0) - 1;
    graph.setNodeAttr(wanNodeId, "lieLowUsesRemaining", Math.max(0, remaining));
    if (remaining <= 0) graph.setNodeAttr(wanNodeId, "lieLowExhausted", true);
  }
  ```
  (No `coolGrid` / trace guard — heat cooling works regardless of alert level. Keep uses limited.)

**Verification — automated:**
- [ ] `make check` passes
- [ ] Updated test: `lieLow` reduces `state.heat` and does NOT change `globalAlert`.
- [ ] Test: `scrubLogs` still steps the global alert down one level (subversion lever intact).
- [ ] Existing lie-low tests updated (no longer assert grid→green).

**Verification — manual:**
- [ ] Harness: get hot, `exec lie-low` → heat drops, alert unchanged; `exec scrub-logs` on an open monitor → alert steps down.

---

## Phase 5: Qualitative heat gauge (replace numeric NOISE readout)

Swap the numeric readout for a stroked gauge (relative + zone; no number, no threshold).

**Files:**
- Modify: `js/ui/indicator-glyphs.js` — `heatGaugeSvg(frac, opts)` + `heatGaugeDataUri(frac)` (stroked tick-ladder/segment gauge, green→amber→red zones; count is the colorblind channel). Pure.
- Modify: `js/ui/components/starnet-hud.js` — replace the `programNoise` numeric span with the gauge `<img>` (prop `heat`).
- Modify: `js/ui/visual-renderer.js` — feed `hudEl.heat = state.heat` (drop `programNoise`).
- Modify: `js/ui/preview.js` / `preview.html` — demo the gauge across cool/warm/hot.
- Test: `tests/indicator-glyphs` (or `heat.test.js`) — gauge geometry is pure/deterministic.

**Key changes:**
- Gauge fill = `heat` mapped onto a **fixed visual scale** (e.g. 0..a display-max constant), NOT the
  hidden threshold — the player sees *how hot*, never *how close to the line*. Zone bands
  (cool/warm/hot) by fill fraction. Stroke-only + glow (vector-UI rule).

**Verification — automated:**
- [ ] `make check` passes
- [ ] New test: `heatGaugeSvg` is deterministic and stroke-only (no `fill=` except "none"); zone changes with frac.

**Verification — manual:**
- [ ] Preview harness shows the gauge filling/zoning across the range; stroke+glow only.
- [ ] In-game (`?network=corporate-exchange`): gauge climbs with activity and visibly bleeds down over time / on lie-low.

---

## Phase 6: Census tuning + docs

Tune the numbers against the bot and document.

**Files:**
- Modify: `js/core/balance.js` — tune `HEAT_COST` / `HEAT_ALARM_THRESHOLD` / `HEAT_DECAY_PER_TICK` / `HEAT_DISCHARGE_FRAC`.
- Modify: `MANUAL.md` — replace the Session 1 "noise" language with the heat model (heat/alert two layers, hidden thresholds, lie-low=heat, alert-down=subversion, gauge); update node-action/console rows if any.
- Modify: `docs/BOT-PLAYER.md` — heat now feeds probe/xploit (the bot DOES accrue heat); census is a real gate for this mechanic, not just no-regression.

**Key changes:**
- Run `make census SEEDS=50` on this branch and a same-seed run on `main`; compare
  `successRate`/`traceFiredRate`. Tune heat so the curve holds (heat shouldn't make the bot trace
  far more/less often than `main`). Log what was dropped/changed.

**Verification — automated:**
- [ ] `make check` passes
- [ ] `make census SEEDS=50` vs same-seed `main`: `successRate`/`traceFiredRate` within noise (report the delta).

**Verification — manual:**
- [ ] **Feel-tuning with Les** on `?network=corporate-exchange`: bursting trips, pacing survives, lie-low relief feels worth the time. Numbers NOT locked autonomously.
- [ ] MANUAL.md re-read matches behavior.
