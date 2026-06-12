# Plan — Reconcile the alert layer (#173)

Vertical slices. TDD except where noted (deletion/docs). Run `make check` after each phase.

Escalation mechanism (validated): an operator emits an `operator-effect` event carrying a
`ctx-call`; the runtime applies it via `applyEffect(payload, _actionMutators(nodeId))`, which
sets `targetNodeId = nodeId` so `args:["$nodeId"]` resolves to the node. This is exactly how
`timed-action.onComplete` fires ctx-calls (`operators.js:420-447`, `runtime.js:351-358`,
`effects.js:58-62`, `runtime.js:474-476`).

---

## Phase 1 — Grid escalation: monitor climbs to TRACE (new behavior, TDD)

End-to-end slice: exploit failure → bridge broadcasts `alert` to IDS nodes → un-corrupted IDS
relays to its monitor → monitor fires `recordMonitorAlert` per alert → global alert steps up
and starts the trace at a grade-scaled count. Corrupting the IDS severs it.

### Files
- `js/core/node-graph/operators.js` — add a `report` operator.
- `js/core/alert.js` — add `recordMonitorAlert(monitorId)` + `MONITOR_TRACE_THRESHOLD`.
- `js/core/node-graph/ctx.js` — add `recordMonitorAlert` to `nullCtx` and `mockCtx`.
- `js/core/node-graph/types.js` — add `recordMonitorAlert` to `CtxInterface`.
- `js/core/node-graph/game-ctx.js` — wire `recordMonitorAlert: (nodeId) => recordMonitorAlert(nodeId)`.
- `js/core/node-graph/traits.js` — `security` trait: add `alertCount: 0` attribute, add the
  `report` operator, **remove** the one-shot `alert-escalate` trigger. Keep `flag(alerted)`.
- `js/core/graph-bridge.js` — `NODE_ALERT_RAISED` handler broadcasts `alert` to every type-`ids`
  node instead of only the origin node.
- `js/core/node-graph/runtime.test.js` — rewrite the dishonest IDS-relay blocks (`assert.ok(true)`
  / `assert.doesNotThrow`, ~lines 44-97, 103-148) to assert the real relayed consequence.
- `tests/integration.test.js` — new suite for the full grid chain.

### Key changes

`operators.js` — generic per-message ctx-call:
```js
/**
 * report — on a matching message, fire a ctx-call (as an operator-effect).
 * config.on: message type to match. config.call: ctx method name (called with the node id).
 */
registerOperator("report", (config, _attrs, message, _ctx) => {
  if (!message || message.type === "tick") return {};
  if (config.on && message.type !== config.on) return {};
  return { events: [{ type: "operator-effect",
    payload: { effect: "ctx-call", method: config.call, args: ["$nodeId"] } }] };
});
```

`alert.js` — mirror `recordIceDetection` (count lives on the monitor graph node; grade from
`s.spec.threat`; separate threshold table so the grid tunes independently of ICE):
```js
// Security-grid trace gate: accumulated monitor alerts before trace, by network grade.
// Mirrors DETECTION_TRACE_THRESHOLD (ICE) but separate so the two tune independently.
const MONITOR_TRACE_THRESHOLD = { S: 1, A: 1, B: 2, C: 2, D: 3, F: 3 };

/**
 * Record an alert reaching a security monitor (the passive grid sensor). Mirrors
 * recordIceDetection: steps the global alert up per alert (capped below trace), and at the
 * grade-scaled accumulated count starts the trace. Count lives on the monitor graph node
 * (serializes with the graph). Reaches the monitor only via an un-corrupted IDS relay.
 */
export function recordMonitorAlert(monitorId) {
  const s = getState();
  const graph = s.nodeGraph;
  if (!graph) return;
  const count = (graph.getNodeState(monitorId)?.alertCount ?? 0) + 1;
  graph.setNodeAttr(monitorId, "alertCount", count);

  const threat = s.spec?.threat ?? "C";
  const threshold = MONITOR_TRACE_THRESHOLD[threat] ?? 2;
  if (count >= threshold) {
    if (getState().traceSecondsRemaining === null) startTraceCountdown();
    return;
  }
  const idx = GLOBAL_ALERT_ORDER.indexOf(s.globalAlert);
  if (idx < GLOBAL_ALERT_ORDER.indexOf("red")) {
    const prev = s.globalAlert;
    const next = GLOBAL_ALERT_ORDER[idx + 1];
    setGlobalAlert(next);
    emitEvent(E.ALERT_GLOBAL_RAISED, { prev, next });
  }
}
```

`ctx.js` — `nullCtx`: `recordMonitorAlert(_nodeId) {}`; `mockCtx`: `recordMonitorAlert: spy("recordMonitorAlert")`.
`types.js` — `@property {(nodeId: string) => void} recordMonitorAlert`.
`game-ctx.js` — import `recordMonitorAlert` from `../alert.js`; add `recordMonitorAlert: (nodeId) => recordMonitorAlert(nodeId)`.

`traits.js` security trait:
```js
registerTrait("security", {
  attributes: { alerted: false, alertState: "green", alertCount: 0 },
  operators: [
    { name: "flag", on: "alert", attr: "alerted", value: true },
    { name: "report", on: "alert", call: "recordMonitorAlert" },
  ],
  actions: [ACTION_TEMPLATES.CANCEL_TRACE],
  triggers: [
    // owned-cancel-trace stays (repeating). alert-escalate REMOVED — escalation now
    // flows per-alert through the report operator → recordMonitorAlert.
    { id: "owned-cancel-trace", repeating: true,
      when: { type: "node-attr", attr: "accessLevel", eq: "owned" },
      then: [{ effect: "ctx-call", method: "cancelTrace", args: [] }] },
  ],
});
```

`graph-bridge.js` — broadcast to IDS nodes (assumption: alert-relaying detectors are type
`ids`; all current relay(filter:alert) nodes are):
```js
on(E.NODE_ALERT_RAISED, () => {
  const graph = getState().nodeGraph;
  if (!graph) return;
  const nodes = getState().nodes;
  for (const id of Object.keys(nodes)) {
    if (nodes[id].type !== "ids") continue;
    const msg = createMessage({ type: "alert", origin: id, payload: { nodeId: id } });
    try { graph.sendMessage(id, msg); } catch (_) { }
  }
});
```

### Tests (write first, watch fail)
- `tests/integration.test.js` new suite "security grid: IDS→monitor escalation":
  - On a graph with one `idsRelayChain`-style IDS→monitor pair at grade C, emitting
    `E.NODE_ALERT_RAISED` (or a failed exploit) twice climbs `globalAlert` and a third starts the
    trace (`traceSecondsRemaining !== null`). Assert observable global alert / trace, not attrs.
  - Corrupting the IDS first (`forwardingEnabled:false` via its `corrupt` action) → repeated
    alerts leave `globalAlert` green and `traceSecondsRemaining === null`.
  - Owning the monitor mid-climb cancels an in-flight trace (exercises `owned-cancel-trace`).
- `runtime.test.js`: replace the `assert.ok(true)` / `assert.doesNotThrow` IDS-relay assertions
  with real ones — inject an `alert` at the IDS, assert the monitor's `alerted` flips true (and
  stays false when `forwardingEnabled:false`).

### Verification — automated
- [ ] new integration test fails before implementation, passes after
- [ ] `make check` (1029+ tests, 0 fail, lint clean)
- [ ] `node scripts/playtest.js --generated --seed t1 reset` then a few failed exploits climb alert (smoke)

### Verification — manual
- [ ] Read the new test: it drives exploit-fail → bridge → IDS → monitor → global alert, and asserts the consequence (not intermediate attrs).
- [ ] Confirm corrupting the IDS demonstrably prevents escalation in the test.

---

## Phase 2 — Retire the legacy alert.js layer (deletion; guarded by Phase 1 + existing tests)

TDD opt-out: pure removal. Behavior guarded by Phase 1's grid tests + the existing ICE/trace tests.

### Files
- `js/core/alert.js` — delete `recomputeGlobalAlert`, `propagateAlertEvent`, `raiseGlobalAlert`,
  the `DETECTOR_TYPES`/`MONITOR_TYPES` consts, and the `initAlertHandlers` handlers
  (`NODE_ALERT_RAISED` → recompute; `ACTION_RESOLVED`/CORRUPT → recompute). If `initAlertHandlers`
  is then empty, remove it + its module-load call (`alert.js:58`).
- `scripts/lib/headless-engine.js` — if `initAlertHandlers` removed, drop the import (line 18) and
  call (line 66).
- `js/core/state/node.js` — delete `setNodeEventForwarding` and the `eventForwardingDisabled`
  write; remove `eventForwardingDisabled` from any node default shape.
- `js/core/state.js` — remove the `setNodeEventForwarding` re-export.
- `js/core/types.js` — remove `eventForwardingDisabled` from `NodeState` typedef if present.
- `tests/integration.test.js` — remove/rewrite the two dishonest tests (`:317` sets `alertState`
  directly; `:330` sets `eventForwardingDisabled`). They test the deleted path; replace with the
  Phase 1 real-path coverage (delete if now redundant).
- Any other reference surfaced by grep (e.g. `cmd-status.js` — handled in Phase 3).

### Key changes
- `initAlertHandlers` becomes empty → remove it and the headless-engine wiring, OR keep a no-op if
  other callers need the symbol (grep first: only `alert.js:58` + `headless-engine.js:66`).
- `recordMonitorAlert` and `recordIceDetection` are the only global-escalation entry points left
  (plus `startTraceCountdown`, `cancelTraceCountdown`, `forceGlobalAlert` cheat).

### Verification — automated
- [ ] `grep -rn "recomputeGlobalAlert\|propagateAlertEvent\|raiseGlobalAlert\|eventForwardingDisabled\|setNodeEventForwarding\|DETECTOR_TYPES\|MONITOR_TYPES" js scripts` → only comments, if any
- [ ] `make check` green
- [ ] `node scripts/bot/census.js --seeds 5` runs without error (headless wiring intact)

### Verification — manual
- [ ] `alert.js` now contains only: trace-countdown machinery, `recordIceDetection`, `recordMonitorAlert`, `forceGlobalAlert`, `MONITOR_TRACE_THRESHOLD`, `DETECTION_TRACE_THRESHOLD`, `GLOBAL_ALERT_ORDER`.

---

## Phase 3 — Fix the IDS forwarding status display (small)

`cmd-status.js` reads the deleted `eventForwardingDisabled`, so it always showed "enabled".

### Files
- `js/core/console-commands/cmd-status.js` — lines 258-259 and 296: read `forwardingEnabled`
  (`true`/undefined = enabled; `false` = disabled/subverted).

### Key changes
```js
// node detail
if (node.forwardingEnabled !== undefined) {
  lines.push(`- event forwarding: ${node.forwardingEnabled === false ? "disabled" : "enabled"}`);
}
// node list tag
? (n.forwardingEnabled === false ? "  [fwd:OFF]" : "  [fwd:ON]")
```

### Verification — automated
- [ ] `make check` green
- [ ] `node scripts/playtest.js --piece ids-relay-chain reset && node scripts/playtest.js "status node <monitor/ids>"` shows forwarding state (smoke; adjust node id)

### Verification — manual
- [ ] After corrupting an IDS in a playtest, `status` shows `[fwd:OFF]` / "disabled" for it.

---

## Phase 4 — Docs (doc-only, no test)

### Files
- `MANUAL.md` — "Detection" section: describe two sensors (ICE active, security grid passive)
  feeding one ladder; grid climbs to trace via exploit failures through IDS→monitor; subvert the
  IDS to go dark; own the monitor to cancel a trace.
- `CLAUDE.md` — "Alert System" section: same model; **remove** the #173 known-gap caveat added
  to the "What's Shipped" scope section.

### Verification — manual
- [ ] MANUAL.md "Detection" matches the shipped two-sensor model (no IDS-counting language).
- [ ] CLAUDE.md alert section updated; the `> Known gap (2026-06-11 deep audit)` block is gone.

---

## Phase 5 — Census + tune

The grid becoming a real trace driver shifts difficulty.

### Steps
- Run `make census SEEDS=20` on the branch; compare to `main` on the same seeds (commit ALL work
  first, then the checkout-main-files comparison — per [[commit-before-file-swap-comparison]]).
- Report successRate / traceFiredRate / avgCash deltas in `notes.md`.
- If the grid over-pressures (traceFiredRate spikes) or under-pressures, tune
  `MONITOR_TRACE_THRESHOLD` and note the rationale. No fixed target — compare to main.

### Verification — automated
- [ ] `make census SEEDS=20` completes; deltas recorded in `notes.md`
- [ ] `make check` still green after any threshold tuning

### Verification — manual
- [ ] Difficulty delta is reasonable / explained; threshold table reflects any tuning.

---

## Plan self-review

- **Spec coverage:** grid sensing (P1 bridge), monitor climbs to trace (P1 recordMonitorAlert),
  subversion-scoped (P1, forwardingEnabled gate preserved), legacy retired (P2), status fixed
  (P3), honest tests (P1+P2 rewrites), docs (P4), census (P5). All spec success criteria mapped.
- **Placeholders:** none — all code shown.
- **Type/name consistency:** `recordMonitorAlert` (alert.js, ctx.js, types.js, game-ctx.js,
  report operator `call`), `report` operator, `MONITOR_TRACE_THRESHOLD`, `alertCount` attribute —
  consistent across phases.
- **Open assumption (documented):** alert-relaying detectors are type `ids`; the bridge broadcasts
  to type-`ids` nodes. Verified true for all current relay(filter:alert) nodes; extend the type set
  if future detector set-pieces use another type.
