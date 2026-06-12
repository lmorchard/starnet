# Spec — Reconcile the alert layer: two sensors, one ladder

GitHub issue: #173. Background analysis: `../2026-06-11-1810-code-review-refactor/deep-audit.md`.

## Goal

Make the IDS→monitor security grid a real, climbable failure mode (up to TRACE), retire the
vestigial legacy `alert.js` layer that shadows it, and make the docs + tests describe the
system that actually ships. The grid is the **passive-adversary** failure mode for LANs that
have no ICE; ICE remains the **active-adversary** mode. Both feed one global alert ladder.

## Mental model (the design we're building toward)

**Two sensors, one ladder.** Global alert (`green → yellow → red → trace`) is driven by two
independent sensors that share the same ladder and the same trace clock:

- **ICE (active):** hunts the player's disturbances; detections accumulate and start the
  trace at a grade-scaled count. Unchanged by this work. (`recordIceDetection`, `alert.js`.)
- **Security grid (passive):** sloppy hacking (exploit failures) raises alerts that flow to
  IDS → security-monitor; the monitor accumulates them and climbs the ladder to trace.
  Subverting an IDS (`corrupt` → `forwardingEnabled:false`) blinds its monitor. NEW: today
  this caps at yellow and barely trips; this work makes it a full ladder.

An ICE-less LAN is more static and forgiving: the only clock is the grid, and you can
pre-empt it (corrupt the IDS to go dark) or cancel it (own the monitor → `owned-cancel-trace`).

## Current state (verified, post-PR-#163)

What works:
- `idsRelayChain` set-piece (+ tamper and two-IDS variants) in `data/biomes/corporate-pieces.js`
  IS the IDS→monitor puzzle. IDS = `relay(filter:alert)` gated by `forwardingEnabled` + a
  `corrupt` action; monitor rides the `security` trait.
- Graph chain fires (post-B1): alert → IDS relay → monitor `flag(alerted:true)` →
  `security` trait `alert-escalate` trigger → `setGlobalAlert("yellow")`. Corrupting the IDS
  severs it. Empirically confirmed.
- `recordIceDetection` (`alert.js:200`) — the live ICE trace driver.
- Trace countdown machinery (`startTraceCountdown` / `handleTraceTick` /
  `cancelTraceCountdown`, `alert.js:136-174`) — essential, keep.

What's broken / vestigial:
- The grid caps at **yellow** (`traits.js:279-284`, hardcoded one-shot) and only trips when a
  failure happens *on the IDS node itself* — the bridge sends `alert` only to the originating
  node (`graph-bridge.js:42-47`).
- Legacy `alert.js` layer duplicates/shadows the graph chain and is mostly dead in graph mode:
  - `propagateAlertEvent` (`alert.js:62`) — only runs in the non-graph `else` branch. Dead.
  - `recomputeGlobalAlert` (`alert.js:85`) — counts IDS/monitor by `alertState` (graph nodes
    use `alerted`, a boolean) and filters on the never-set `eventForwardingDisabled`.
    Semi-live only via the accidental "exploit-fail directly on a detector" path.
  - `raiseGlobalAlert` (`alert.js:115`) — zero callers, fully dead.
  - `DETECTOR_TYPES` / `MONITOR_TYPES` sets (`alert.js:20-21`) — only used by the above.
  - `eventForwardingDisabled` attribute + `setNodeEventForwarding` (`state/node.js:181`) — zero
    production writers; opposite polarity to the real `forwardingEnabled`.
- `cmd-status.js:258-259,296` reads the dead `eventForwardingDisabled`, so the console's IDS
  forwarding display is **always wrong** (shows enabled regardless of actual subversion).
- Dishonest tests (pass on injected dead state): `tests/integration.test.js:317` (sets
  `alertState` directly), `:330` (sets `eventForwardingDisabled` directly); the IDS-relay
  blocks in `js/core/node-graph/runtime.test.js` (`assert.ok(true)` / `assert.doesNotThrow`).

## Desired end state

1. **Grid-wide, subversion-scoped sensing.** On any exploit failure, an `alert` reaches every
   IDS node in the LAN (not just the failed node). Each un-corrupted IDS relays to its monitor;
   a corrupted IDS (`forwardingEnabled:false`) does not. Multiple IDS/monitor pairs each need
   subverting to fully go dark.
2. **Monitor climbs the full ladder.** Each alert that reaches a monitor steps the global alert
   up one level and, at a grade-scaled accumulated count, starts the trace — mirroring
   `recordIceDetection` (thresholds `S/A:1, B/C:2, D/F:3`). No longer hardcoded at yellow.
3. **Legacy `alert.js` layer removed.** Graph triggers + `recordIceDetection` are the only
   escalation sources. `recomputeGlobalAlert`, `propagateAlertEvent`, `raiseGlobalAlert`, the
   `DETECTOR/MONITOR_TYPES` sets, the `eventForwardingDisabled` attr + `setNodeEventForwarding`,
   and the legacy `else` branch are gone.
4. **Status display fixed** to read `forwardingEnabled`.
5. **Docs match reality** (MANUAL.md "Detection", CLAUDE.md alert section); the #173 known-gap
   caveat in CLAUDE.md's scope section is removed.
6. **Tests are honest** — drive the real signal path and assert observable consequences.

## Design decisions (with reasoning)

- **Grid-wide sensing over segment-scoped.** Simpler, predictable, and matches the "passive,
  static, forgiving" intent for ICE-less LANs. Segment-scoping is a richer puzzle but more
  wiring; deferred (see What we're NOT doing). Grid-wide is a strict subset, so it doesn't
  paint us into a corner.
- **Subversion stays meaningful by routing alerts through IDS nodes, not directly to monitors.**
  The bridge broadcasts `alert` to IDS-type nodes; the monitor is only reached via an
  un-corrupted IDS's relay. (Sending `alert` straight to monitors would bypass the
  `forwardingEnabled` gate and break the core subversion mechanic.)
- **Mirror `recordIceDetection` for the escalation curve.** Two sensors with the same
  step-up-then-trace-at-grade-threshold shape gives one coherent feel and reuses a proven
  pattern. Put the monitor's accumulation+escalation in a new `recordMonitorAlert(monitorId)`
  in `alert.js`, invoked once per alert a monitor receives via a new `ctx.recordMonitorAlert`
  method (the graph only has `ctx`). Keeps escalation authority in `alert.js`, symmetric with
  ICE, and out of the trait data.
- **Per-monitor accumulation.** Each monitor counts its own received alerts (a `counter`
  operator or an accumulating attribute), so corrupting one IDS only blinds its monitor.
- **Keep `owned-cancel-trace`** (now `repeating`, fixed in #163) as the player's escape hatch.

## Implementation outline (parts; details to the plan)

1. **Bridge: broadcast alerts to IDS nodes.** `graph-bridge.js` `NODE_ALERT_RAISED` handler →
   send the `alert` message to every node of type `ids` (filter `getState().nodes`), instead of
   only the originating node. Keep the probe-noise / exploit bridges as-is.
2. **Monitor escalation.** Replace the `security` trait's one-shot `alert-escalate → yellow`
   with a per-alert path that invokes `ctx.recordMonitorAlert(nodeId)` once per received alert
   (mechanism: a monitor-side operator returning an operator-effect ctx-call, or a `counter` +
   threshold — plan decides). Add `recordMonitorAlert` to `alert.js` mirroring
   `recordIceDetection` (step up below threshold; `startTraceCountdown` at the grade-scaled
   count). Wire the new ctx method in `ctx.js` (nullCtx + mockCtx), `types.js` (CtxInterface),
   and `game-ctx.js`.
3. **Retire legacy.** Delete `recomputeGlobalAlert`, `propagateAlertEvent`, `raiseGlobalAlert`,
   `DETECTOR_TYPES`/`MONITOR_TYPES`, the legacy `else` branch (the `NODE_ALERT_RAISED` handler
   becomes graph-only or is removed if the bridge fully covers it), the `eventForwardingDisabled`
   attribute, and `setNodeEventForwarding` (+ its `state.js` re-export).
4. **Fix status display.** `cmd-status.js:258-259,296` → read `forwardingEnabled`.
5. **Tests.** Rewrite `integration.test.js:317,330` and the `runtime.test.js` IDS-relay blocks to
   drive exploit-failure → bridge → IDS → monitor → global-alert-climbs, assert observable
   escalation, assert corrupting the IDS prevents it, and assert reaching trace at threshold.
   Add a focused test for `recordMonitorAlert` (mirror the ICE detection tests).
6. **Docs.** Rewrite MANUAL.md "Detection" and CLAUDE.md "Alert System" to the two-sensors-one-
   ladder model; remove the CLAUDE.md scope-section known-gap caveat.
7. **Census.** Re-run `make census` (same seeds, main vs branch); the grid becoming a real trace
   driver can shift difficulty — report the delta, tune the threshold table if needed.

## Patterns to follow

- Escalation symmetry: `recordIceDetection` (`js/core/alert.js:200-231`) — copy its
  step-up + grade-threshold + `startTraceCountdown` shape for `recordMonitorAlert`.
- ctx method wiring: `cancelTrace` across `ctx.js:10,67`, `types.js:250`, `game-ctx.js:56`.
- Counter primitive: `counter` operator (`operators.js:249`); `nthAlarm` set-piece
  (`corporate-pieces.js:81`) is an example of a counter emitting at a threshold.
- Operator-returned ctx effects: `runtime.js:351-357` applies `operator-effect` events via
  `applyEffect` — the route for a per-message ctx-call from the monitor.
- Test honesty rules: CLAUDE.md "Node graph / set-piece test honesty"; assert observable
  consequences (`ctx.calls.*`, global alert level), trace the full signal path.

## What we're NOT doing

- **Segment-scoped / ranged IDS (DEFERRED — Les wants to try this for larger LANs).** Instead of
  grid-wide sensing, an IDS would cover only a *segment*: alerts propagate along edges but stop
  at a boundary node (switch / hub / router), so each IDS covers a bounded range and corrupting
  it blinds only that segment. Richer "which sensor covers what" puzzle for big graphs. Grid-wide
  (this spec) is the strict subset, so this is a clean future extension — file as a follow-up
  issue at PR time.
- **Alert cooldown / de-escalation levers (DEFERRED — filed as #174).** Cheaper ways to cool the
  ladder — a "lie low" EXEC script (proposed at the WAN node) and a "scrub logs" action on a
  *compromised* IDS/monitor — so the grid is a managed pressure, not a one-way ratchet. Depends
  on this work's real ladder + `recordMonitorAlert` accumulation; its own session right after.
  This spec keeps the "only escalates below trace" ratchet intact; #174 is where we relax it.
- **ICE detection / pursuit changes** — owned by the separate ICE-reinvention work. We only add
  a parallel sensor; we don't touch `recordIceDetection` or ICE movement.
- **New alert *levels* or trace-countdown mechanics** — same `green/yellow/red/trace` ladder and
  the same grade-scaled `TRACE_SECONDS`.
- **Probe-driven grid alerts** — probing emits `probe-noise`, not `alert`; only dedicated sensor
  set-pieces (e.g. `nthAlarm`) convert probe activity to alerts. The grid trips on exploit
  failures, not probes. (Unchanged.)

## Success criteria

- `make check` green; new/rewritten tests drive the real path and would fail if the chain breaks
  or if subversion stops working.
- In an ICE-less LAN, repeated exploit failures climb the alert to trace; corrupting the IDS
  before/while failing prevents escalation; owning the monitor cancels an in-flight trace.
- No remaining references to `eventForwardingDisabled`, `recomputeGlobalAlert`,
  `propagateAlertEvent`, `raiseGlobalAlert` (grep clean).
- `make census` delta reported and acceptable (tune threshold if the grid over/under-pressures).
- MANUAL.md / CLAUDE.md describe the shipped model; #173 caveat removed.
