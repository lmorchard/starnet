# Spec — Alert cooldown levers (#174)

Builds on #173 (PR #175): the security grid (exploit failures → IDS → monitor → `recordMonitorAlert`,
accumulating `alertCount` per monitor, climbing to trace at `MONITOR_TRACE_THRESHOLD`). That ladder
currently only escalates below trace. This adds two **active, grid-only** relief levers so the grid is
a managed pressure rather than a one-way ratchet.

## Goal

Give the player cheaper-than-owning ways to cool the security grid: a slow, scarce "lie low" wait at
the WAN node, and a surgical "scrub logs" action on a compromised monitor. Both relax the
below-trace ratchet by reducing the grid's *accumulation* (not just the visible level).

## Design decisions (settled in brainstorm)

- **Grid-only.** Cooldown reduces monitor `alertCount` and eases the global level; it never touches
  ICE `detectionCount`. You can lie low / scrub against the passive grid, but an active ICE that's
  hunting you re-escalates. Preserves the active/passive distinction.
- **Reduce accumulation, not just level.** Dropping the global level alone would re-escalate on the
  next failure (the monitor's `alertCount` is still near threshold). So both levers reset `alertCount`
  on the affected monitor(s) *and* ease the level.
- **Below-trace only.** Once the trace clock runs, relief is jack-out or own→cancel-trace. The cooldown
  helper no-ops (with a log) when `globalAlert === "trace"`.
- **Tuning is empirical.** Numbers below are starting points; tune via `make census` + headless
  playtest (like #173), not by guessing now.

## Lever 1 — "Lie low" (WAN node, timed + per-run limited)

- A **timed action** on the WAN node (cost = *time*: the player waits idle while it runs, and ICE keeps
  moving/detecting during the wait — the risk). Modeled on the `rebootable` timed-action pattern.
  Duration ~50 ticks (5s), tunable. Navigating away cancels it (nav-cancel handler).
- **On completion** (`ctx.lieLow`): reset **every** monitor's `alertCount` to 0 and set the global
  alert to **green** (full grid-calm — justified by being slow + scarce), below-trace only.
- **Per-run hard limit:** start with **2** uses. Tracked on the WAN node as attributes
  `lieLowUsesRemaining` (init 2) + `lieLowExhausted` (init false). The action's `requires` gate is
  `node-attr lieLowExhausted eq false`. On each completion, decrement remaining; at 0 set
  `lieLowExhausted: true`. Exhaustion fiction (flavor log/desc): *"a human admin has clocked your
  tether — no more lying low."*

## Lever 2 — "Scrub logs" (compromised security-monitor)

- Node action on a security-monitor, `requires: any-of [accessLevel compromised, accessLevel owned]`
  (available once you have at least compromised access — the cheaper, earlier relief).
- **On use** (`ctx.scrubLogs($nodeId)`): reset **that monitor's** `alertCount` to 0 and step the global
  alert **down one level**, below-trace only. Instant (not timed), repeatable.
- Completes the security-chain trichotomy: **corrupt the IDS** (stop new alerts) / **scrub the monitor**
  (clear accumulated alerts) / **own + cancel-trace** (stop an active trace) — escalating access cost.

## Desired end state / behavior

- Below trace, the player can: wait at the WAN to fully calm the grid (≤2×/run), or scrub a compromised
  monitor to reset its count + ease the level one step.
- Neither reduces ICE detection; ICE-driven pressure re-escalates.
- At trace, both no-op with a log directing the player to jack out / cancel-trace.
- Every cooldown emits a log entry (CLAUDE.md: visible event ⇒ log entry).

## Implementation outline (touch-points)

- **`alert.js`** — new `coolGrid({ monitorIds, toGreen })` core (below-trace guard; reset `alertCount` on
  the given monitors; ease global level to green or down one). Public `lieLow()` (all monitors → green +
  decrement WAN uses) and `scrubLogs(monitorId)` (one monitor + one level down). New de-escalation event
  `E.ALERT_COOLED` (escalation-only `ALERT_GLOBAL_RAISED` is the wrong semantic).
- **`events.js`** — add `ALERT_COOLED`.
- **`log-renderer.js`** — log entry for `ALERT_COOLED` (and exhaustion flavor).
- **ctx wiring** — `lieLow`, `scrubLogs` added to `nullCtx` + `mockCtx` (`ctx.js`), `CtxInterface`
  (`node-graph/types.js`), and `game-ctx.js` (wired to `alert.js`).
- **`node-graph/game-types.js`** — `LIE_LOW_ACTION` (id `lie-low`, requires `lieLowExhausted eq false`,
  effect set-attr `lyingLow:true` + reset `_ta_lielow_progress`) and `SCRUB_LOGS_ACTION` (id
  `scrub-logs`, requires any-of compromised/owned, effect ctx-call `scrubLogs $nodeId`). Add `lyingLow`
  to the unified ABORT action's `requires` any-of.
- **`node-graph/traits.js`** — extend the `darknet` trait (WAN) with the `lie-low` action + a
  `timed-action` operator (`action:"lielow"`, `activeAttr:"lyingLow"`, `durationTable`, `onComplete`
  ctx-call `lieLow`) + attributes (`lyingLow:false`, `lieLowUsesRemaining:2`, `lieLowExhausted:false`).
  Add `scrub-logs` action to the `security` trait.
- **`node-graph/game-ctx.js`** — nav-cancel handler: add a `lyingLow` branch (cancel on navigation,
  clearing `_ta_lielow_progress`), mirroring the probe/dump/etc. branches.
- **`action-ids.js`** — `LIE_LOW`, `SCRUB_LOGS` ids (non-core ⇒ auto-grouped under EXEC).

These are scripts (non-core node actions) so they surface under the EXEC submenu automatically
(`actions/scripts.js`).

## Patterns to follow

- Timed action: `rebootable` trait (`traits.js:232`) — `timed-action` operator with `activeAttr` +
  `onComplete` ctx-call. Start-action sets the activeAttr (cf. DUMP/FETCH in `game-types.js`).
- ctx method wiring: `recordMonitorAlert`/`cancelTrace` across `ctx.js`, `node-graph/types.js`,
  `game-ctx.js` (just added in #175).
- De-escalation precedent: `cancelTraceCountdown` (`alert.js`) is the only existing downward path;
  follow its emit-an-event-for-the-log shape.
- Grid accumulation it reverses: `recordMonitorAlert` (`alert.js`), `MONITOR_TRACE_THRESHOLD`,
  `GLOBAL_ALERT_ORDER`.
- Timed-action multi-site hazard (cf. #170 / the #173 deep audit): a new timed action touches the
  trait operator, the start-action, the ABORT `requires`, and the nav-cancel handler. All four are
  listed above — don't miss one.

## What we're NOT doing

- **No ICE cooldown.** Cooldown is grid-only; ICE `detectionCount` is untouched.
- **No "human admin" escalation mechanic (deferred).** Exhausting lie-low just makes it unavailable
  with flavor text. A real escalation (exhaustion spawns pursuit / bumps alert) is a future hook if it
  feels good — file as follow-up if wanted.
- **No scrubber consumable / store item** (option 3 from the #174 brainstorm — deferred).
- **No new alert levels or trace mechanics.** Same `green/yellow/red/trace` ladder.
- **No retuning of the grid thresholds** (that's #173's `MONITOR_TRACE_THRESHOLD`); we only add relief,
  then re-census to see the combined balance.

## Success criteria

- `make check` green; TDD tests cover: lie-low completion calms the grid to green + decrements uses;
  exhaustion (after 2) makes it unavailable; scrub resets one monitor's count + drops one level; both
  no-op at trace; neither reduces ICE `detectionCount`.
- Headless playtest transcript demonstrating lie-low and scrub cooling a climbing grid.
- `make census` (25 seeds, C + B) reported vs the post-#173 baseline; thresholds/limits tuned so the
  grid is a managed pressure (success rate should ease up from #173's ~0.28/0.24 toward main's ~0.32
  without removing the clock). Tune `LIE_LOW` uses/duration + scrub strength as needed.
- MANUAL.md "Detection" + CLAUDE.md alert section document the cooldown levers.
