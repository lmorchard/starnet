# Heat Model (Flow Subversion anti-tedium arc, part 1) Spec

**Goal:** Collapse Session 1's monotonic `programNoise` into a decaying **heat** meter that feeds
the alert ladder as a **ratchet** — so *bursts* of activity trip the alarm while *paced* activity
cools below notice. Heat is fed by core activity (probe/xploit/programs), its thresholds are hidden
and per-network, `lie-low` becomes active heat-cooling, and the alert ratchet only comes back down
by subverting security systems. This is the first slice of the anti-tedium arc; it targets the
probe→xploit grind by making *how you pace* matter, not just *what you click*.

**Source:** User request 2026-07-01 (design conversation with Les, mid Session 1). Full arc design:
`docs/design/flow-subversion.md` → "Anti-tedium arc". Builds on Session 1 (#263).

## Current state

See `research.md` for `file:line`. Load-bearing facts:
- Session 1 shipped `programNoise` as a **monotonic accumulator** (`state/flow.js addProgramNoise`,
  `alert.js recordProgramNoise`) that steps the shared `green→yellow→red→trace` ladder and starts
  the trace; a **numeric `NOISE: N`** HUD readout; per-program `PROGRAM_NOISE_*` in `balance.js`.
  Only SNIFF/REPLAY feed it — the bot never does.
- Alert is two sensors (grid, ICE) + program noise, all escalation-only below trace
  (`js/core/alert.js`); cooldown levers `scrubLogs`/`lieLow` both currently cool the **grid alert**.
- The repeating-timer pattern is `TRACE_TICK` (`timers.js` + `alert.js`), handler wired at
  `main.js:162` and via the shared `wireRunHandlers` for headless.
- Probe resolves in `game-ctx.js resolveProbe`; xploit in `combat.js applyCombatResult`.

## Desired end state

- **Heat** is a decaying scalar (`state.programNoise` → conceptually "heat"; keep or rename the
  field, serializable + healed). A **repeating `HEAT_DECAY` timer** bleeds it toward 0 each interval
  (`HEAT_DECAY_RATE`, `balance.js`). Probe, xploit (every attempt), and program plays each add heat
  (`HEAT_COST`, per-action).
- **Alert ratchet (trip-line):** each rising-edge crossing of a network's hidden
  `HEAT_ALARM_THRESHOLD` commits **one** step up the alert ladder (escalation-only) and **discharges
  heat** (knocked down so it must rebuild). A single massive spike can trip repeatedly / reach trace;
  paced activity never crosses the line. Alert never decays passively.
- **Alert comes down only via subversion** — `scrubLogs` (open monitor), `corrupt` (IDS),
  `cancel-trace` (owned monitor). **`lie-low` no longer touches alert** — it becomes accelerated
  **heat** cooling (a timed action that rapidly decays heat; time is the cost).
- **Per-network sensitivity:** `HEAT_ALARM_THRESHOLD` is grade-keyed — a low-threat LAN has a high
  bar (absorbs a burst), a hardened LAN a low bar (any burst trips).
- **Qualitative readout:** the numeric `NOISE: N` is replaced by a stroked **heat gauge** showing
  relative fill + a cool/warm/hot zone, never the exact number or the threshold. Visibly cools as
  heat decays. Geometry in a pure module, demoed in the preview harness.
- Grid + ICE sensors are unchanged and still escalate the same ladder.
- Fully serializable round-trip (heat value + decay timer). `make census` shows no difficulty-curve
  regression vs. a same-seed `main` run (tuned by feel + census).

## Design decisions

- **Decision:** collapse noise into ONE decaying heat meter (not a second parallel meter).
  - **Why:** honors Session 1's "feed the existing clock, don't add a parallel resource"; the
    decaying leaky-bucket is what delivers pacing-beats-bursting. **Reverses** Session 1's "noise
    only escalates" for the *meter* (the ladder it drives still only escalates).
  - **Rejected:** heat + noise as two separate scalars (legibility cost, redundant).
- **Decision:** heat is fed by **core activity** (probe/xploit/programs), not programs alone.
  - **Why:** the tedium being targeted is the probe/xploit loop; pacing only matters if core
    actions generate heat. **Rejected:** programs-only (heat would barely matter; wouldn't dent the
    grind this session).
- **Decision:** ratchet is a **rising-edge trip-line** (cross hidden threshold → one alert step +
  heat discharge), not a high-water-mark recompute.
  - **Why:** implementable and legible; makes "too much at once → alarm, spread out → safe" literal;
    avoids the recompute/subversion fight (a committed step stays until subverted, regardless of heat
    decaying below the line). **Rejected:** alert = f(current heat) recompute (subversion couldn't
    hold; heat decay would auto-lower alert, killing the ratchet).
- **Decision:** `lie-low` → heat cooling only; **alert reduction is subversion-only**.
  - **Why:** gives the security-subversion mechanics their reason to exist and drives a play
    direction (too hot → go take out the watchers); makes lie-low a heat tool. Changes today's
    behavior (lie-low calms grid to green) — deliberate. **Rejected:** keep lie-low calming alert
    (leaves the ratchet with a cheap passive escape, defeating it).
- **Decision:** thresholds hidden; readout qualitative.
  - **Why:** "heat is felt, not read" — judging a network's tolerance is a skill. **Rejected:**
    numeric readout (contradicts the principle; we'd redo it).
- **Decision:** census is a **gate** this session (not just no-regression proof).
  - **Why:** heat now feeds probe/xploit, which the bot does every run — real balance impact. Tune
    `HEAT_COST`/`HEAT_ALARM_THRESHOLD`/`HEAT_DECAY_RATE` so the curve holds vs. same-seed `main`.

## Patterns to follow
- Decaying repeating timer: mirror `TRACE_TICK` (`alert.js` schedule + `handleTraceTick`; wire the
  handler at `main.js` **and** `wireRunHandlers`). Start `HEAT_DECAY` at run init.
- Sensor shape: mirror `recordMonitorAlert`/`recordProgramNoise` in `alert.js` for the trip-line.
- New serializable field + heal: the Session 1 pattern (`state/flow.js`, `state/index.js`, shim).
- Stroked indicator geometry in a pure module consumed by HUD + `preview.js`: mirror
  `indicator-glyphs.js` (`alertLampDataUri`, `tickMeterSvg`) — data-URI `<img>`, stroke-only.
- Balance tables grade-keyed like `MONITOR_TRACE_THRESHOLD` / `TRACE_SECONDS`.

## What we're NOT doing
- **No verb variants** (SWEEP/meticulous PROBE, parallel/serial XPLOIT) — their own later session
  (multi-node targeting UI).
- **No flows-as-scouting** — its own later session (fog-of-war rework).
- **Heat does NOT subsume the grid or ICE sensors** — they stay separate, unchanged.
- **No new objectives/skim/TAP/SPLICE, no loadout/store** (other arcs).
- **No numeric heat readout** (qualitative only).
- **No change to what winning is** — heat reduces grind friction; it is not the reconfiguration cure.

## Open questions (each with a default so planning proceeds)
- **Heat on every xploit attempt, or only failures?** Default: **every attempt** adds heat (activity
  = racket, independent of the grid's failure-detection). Successes may add less than failures.
  Revisit in feel/census tuning.
- **Discharge amount on a trip.** Default: knock heat down to ~50% of the threshold on a trip, so a
  sustained burst re-climbs in a few actions but a one-off spike gives breathing room. Feel-tuned.
- **Decay rate + costs + thresholds.** Placeholders in `balance.js`; **feel + census tuned with Les**
  — do NOT lock autonomously. (Heuristic that this is feel-driven: yes for the numbers, but the
  structure — decay timer, trip-line, lie-low repoint, gauge — is spec'd and TDD-able.)
- **Keep the field name `programNoise` or rename to `heat`?** Default: rename to `heat` for clarity
  (touches the S1 field + heal + readout); acceptable churn since S1 just shipped.
