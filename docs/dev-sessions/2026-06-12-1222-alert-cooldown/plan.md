# Plan — Alert cooldown levers (#174)

Vertical slices, TDD. Run `make check` after each phase. Scrub (instant) first — it establishes
the `coolGrid` core + de-escalation event + ctx wiring; lie-low layers timed-action complexity on top.

Uses tracking lives on the **WAN node** (graph attributes), not player state — so the action's
`requires` can gate on it via a node-attr condition.

---

## Phase 1 — `coolGrid` core + "scrub logs" (compromised monitor) — TDD

End-to-end: a compromised monitor with accumulated `alertCount` can be scrubbed → its count resets and
the global alert steps down one level (below trace only). Grid-only (ICE untouched).

### Files
- `js/core/events.js` — add `ALERT_COOLED: "alert:cooled"`.
- `js/core/alert.js` — `coolGrid(monitorIds, mode)` core + `scrubLogs(monitorId)`.
- `js/core/node-graph/ctx.js` — `scrubLogs` in `nullCtx` + `mockCtx`.
- `js/core/node-graph/types.js` — `scrubLogs` on `CtxInterface`.
- `js/core/node-graph/game-ctx.js` — wire `scrubLogs: (nodeId) => scrubLogs(nodeId)`.
- `js/core/action-ids.js` — `SCRUB_LOGS: "scrub-logs"`.
- `js/core/node-graph/game-types.js` — `SCRUB_LOGS_ACTION`.
- `js/core/node-graph/traits.js` — add `scrub-logs` to the `security` trait's actions.
- `js/ui/log-renderer.js` — log entry for `ALERT_COOLED`.
- `tests/integration.test.js` — scrub scenarios.

### Key changes

`alert.js`:
```js
/** Security-monitor node ids in the current state. */
function monitorNodeIds(s) {
  return Object.keys(s.nodes).filter((id) => s.nodes[id].type === "security-monitor");
}

/**
 * Ease the security grid below trace: reset alertCount on the given monitors and lower the global
 * alert. Grid-only — never touches ICE detectionCount. No-op at trace. Returns true if it cooled.
 * @param {string[]} monitorIds
 * @param {"green"|"step"} mode
 */
function coolGrid(monitorIds, mode) {
  const s = getState();
  if (s.globalAlert === "trace") return false;       // below-trace only
  const graph = s.nodeGraph;
  for (const id of monitorIds) graph?.setNodeAttr(id, "alertCount", 0);
  const idx = GLOBAL_ALERT_ORDER.indexOf(s.globalAlert);
  const targetIdx = mode === "green" ? 0 : Math.max(0, idx - 1);
  if (targetIdx < idx) {
    const prev = s.globalAlert;
    const next = GLOBAL_ALERT_ORDER[targetIdx];
    setGlobalAlert(next);
    emitEvent(E.ALERT_COOLED, { prev, next });
  }
  return true;
}

/** Scrub one compromised monitor's logs: reset its accumulation, ease the alert one level. */
export function scrubLogs(monitorId) {
  coolGrid([monitorId], "step");
}
```

`game-types.js`:
```js
const SCRUB_LOGS_ACTION = {
  id: A.SCRUB_LOGS,
  label: "SCRUB LOGS",
  desc: "Wipe this monitor's accumulated alert logs, easing the global alert.",
  requires: [{ type: "any-of", conditions: [
    { type: "node-attr", attr: "accessLevel", eq: "compromised" },
    { type: "node-attr", attr: "accessLevel", eq: "owned" },
  ]}],
  effects: [{ effect: "ctx-call", method: "scrubLogs", args: ["$nodeId"] }],
};
```
`traits.js` security trait: add `ACTION_TEMPLATES.SCRUB_LOGS` to `actions`.
`ctx.js`: `scrubLogs(_nodeId) {}` / `scrubLogs: spy("scrubLogs")`. `types.js`: `@property {(nodeId: string) => void} scrubLogs`.
`game-ctx.js`: import `scrubLogs` from `../alert.js`; `scrubLogs: (nodeId) => scrubLogs(nodeId)`.
`log-renderer.js`: on `ALERT_COOLED` → `setLogEntry`/append `Alert cooled: ${prev} → ${next}` (match existing alert log style).

### Tests (write first, watch fail)
`tests/integration.test.js` — "security grid cooldown: scrub logs":
- Build `buildSetPieceMiniNetwork("idsRelayChain")`; drive the grid up by sending alerts to `sp/ids`
  until `globalAlert` is red and `sp/monitor` `alertCount > 0` (loop `graph.sendMessage("sp/ids", {type:"alert"})`).
- Set `sp/monitor` accessLevel `compromised`; `graph.executeAction("sp/monitor", "scrub-logs")`.
- Assert `getNodeState("sp/monitor").alertCount === 0` and `globalAlert` stepped **down one level**.
- At trace: drive to trace, scrub → `globalAlert` still `trace`, `alertCount` unchanged (no-op).
- ICE-untouched: assert `recordIceDetection` path unaffected — set an ICE detectionCount, scrub, assert it's unchanged (or simply assert scrub only zeroes monitor `alertCount`).

### Verification
- [ ] new scrub test fails before impl, passes after
- [ ] `make check` green
- [ ] manual: a `scrub-logs` action shows on a compromised monitor (`status`/`actions` in playtest)

---

## Phase 2 — "lie low" (WAN timed action + per-run limit) — TDD

Builds on `coolGrid`. A timed action on the WAN node; on completion fully calms the grid (all monitors
→ 0, global → green) and spends one of 2 per-run uses; exhaustion makes it unavailable.

### Files
- `js/core/alert.js` — `lieLow(wanNodeId)`.
- `js/core/node-graph/ctx.js` / `types.js` / `game-ctx.js` — wire `lieLow`.
- `js/core/action-ids.js` — `LIE_LOW: "lie-low"`.
- `js/core/node-graph/game-types.js` — `LIE_LOW_ACTION`; add `lyingLow` to the `ABORT_ACTION` requires any-of.
- `js/core/node-graph/traits.js` — extend `darknet` trait: attrs + timed-action operator + lie-low action.
- `js/core/node-graph/game-ctx.js` — nav-cancel handler: `lyingLow` branch.
- `tests/integration.test.js` — lie-low scenarios.

### Key changes

`alert.js`:
```js
const LIE_LOW_USES = 2; // per-run; tunable

/** Lie low at the WAN: fully calm the grid (all monitors → green) and spend one per-run use. */
export function lieLow(wanNodeId) {
  const s = getState();
  const graph = s.nodeGraph;
  if (!graph) return;
  const cooled = coolGrid(monitorNodeIds(s), "green");
  if (!cooled) return; // at trace — no-op
  const remaining = (graph.getNodeState(wanNodeId)?.lieLowUsesRemaining ?? 0) - 1;
  graph.setNodeAttr(wanNodeId, "lieLowUsesRemaining", Math.max(0, remaining));
  if (remaining <= 0) graph.setNodeAttr(wanNodeId, "lieLowExhausted", true);
}
```

`traits.js` `darknet` trait:
```js
registerTrait("darknet", {
  attributes: { lyingLow: false, lieLowUsesRemaining: 2, lieLowExhausted: false },
  operators: [
    { name: "timed-action", action: "lielow", activeAttr: "lyingLow",
      durationTable: { S: 50, A: 50, B: 50, C: 50, D: 50, F: 50 }, // ~5s; tunable
      onComplete: [{ effect: "ctx-call", method: "lieLow", args: ["$nodeId"] }] },
  ],
  actions: [ACTION_TEMPLATES.ACCESS_DARKNET, ACTION_TEMPLATES.LIE_LOW],
});
```

`game-types.js`:
```js
const LIE_LOW_ACTION = {
  id: A.LIE_LOW,
  label: "LIE LOW",
  desc: "Go quiet and wait for the security grid's logs to age out. Limited — a human admin eventually notices.",
  requires: [{ type: "node-attr", attr: "lieLowExhausted", eq: false }],
  effects: [
    { effect: "set-attr", attr: "lyingLow", value: true },
    { effect: "set-attr", attr: "_ta_lielow_progress", value: 0 },
  ],
};
```
Add to `ABORT_ACTION` requires any-of: `{ type: "node-attr", attr: "lyingLow", eq: true }`.

`game-ctx.js` nav-cancel handler (mirror the existing probe/dump branches):
```js
if (attrs.lyingLow) {
  graph.setNodeAttr(nodeId, "lyingLow", false);
  graph.setNodeAttr(nodeId, "_ta_lielow_progress", 0);
  emitEvent(E.ACTION_FEEDBACK, { nodeId, action: A.LIE_LOW, phase: "cancel", progress: 0 });
}
```
ctx wiring for `lieLow` as in Phase 1's `scrubLogs`.

### Tests (write first, watch fail)
`tests/integration.test.js` — "security grid cooldown: lie low". Build a graph with a WAN node
(`traits: ["graded","hackable","gate","darknet"]`, accessLevel owned) + an `idsRelayChain` pair — or
extend the mini-network if its WAN carries the darknet trait (verify; otherwise hand-build the graph).
- Drive the grid to red. `executeAction(wan, "lie-low")`; `graph.tick(60)` to complete.
- Assert `globalAlert === "green"`, all monitors `alertCount === 0`, WAN `lieLowUsesRemaining === 1`.
- Second use → `lieLowUsesRemaining === 0`, `lieLowExhausted === true`.
- Third: `getAvailableActions(wan)` no longer includes `lie-low` (requires `lieLowExhausted eq false` fails).
- Nav-cancel: start lie-low, emit `PLAYER_NAVIGATED`, assert `lyingLow === false` and no grid change.
- At trace: start + complete lie-low → `globalAlert` still `trace`, uses NOT spent (coolGrid returned false).
- ICE-untouched: an ICE detectionCount is unchanged by lie-low.

### Verification
- [ ] lie-low tests fail before impl, pass after
- [ ] `make check` green
- [ ] manual playtest: `lie-low` shows under EXEC at the WAN; completes; unavailable after 2 uses

---

## Phase 3 — docs + census + headless playtest + tune (no new behavior)

### Files
- `MANUAL.md` — "Detection"/alert section: document lie low (WAN, limited, time-cost) + scrub logs
  (compromised monitor), and the trichotomy (corrupt / scrub / cancel-trace).
- `CLAUDE.md` — alert section: note the two below-trace cooldown levers + grid-only.
- `docs/dev-sessions/.../notes.md` — census + playtest results.

### Steps
- Headless playtest transcript (engine-driven, deterministic like #173): drive grid up, scrub → eases;
  drive up, lie-low ×2 → calms then exhausts; confirm ICE detectionCount untouched; at-trace no-op.
- `make census SEEDS=25` threat C + B; compare to post-#173 baseline (C 0.28/0.76, B 0.24/0.84) and
  main (~0.32/0.76). Expect success to ease upward (relief), trace to ease down, without removing the
  clock. Tune `LIE_LOW_USES`, the lie-low `durationTable`, and scrub strength (step vs green) as needed.
  Commit ALL work before any main-vs-branch file-swap (per [[commit-before-file-swap-comparison]]).

### Verification
- [ ] headless transcript shows both levers cooling the grid, ICE untouched, trace no-op
- [ ] `make census` deltas recorded in notes.md; tuning rationale noted
- [ ] `make check` green after any tuning
- [ ] MANUAL.md + CLAUDE.md updated

---

## Plan self-review

- **Spec coverage:** scrub (P1), lie-low timed + limit + exhaustion (P2), grid-only + below-trace
  (coolGrid guard, both phases), EXEC grouping (non-core ids, automatic), docs + census/tune (P3). ✓
- **Placeholders:** none — code shown.
- **Type/name consistency:** `coolGrid`, `scrubLogs`, `lieLow`, `ALERT_COOLED`, `lyingLow`,
  `lieLowUsesRemaining`, `lieLowExhausted`, `_ta_lielow_progress`, action ids `scrub-logs`/`lie-low` —
  consistent across phases and matched to ctx wiring.
- **Timed-action multi-site (P2):** trait operator + start-action + ABORT requires + nav-cancel handler
  — all four enumerated.
- **Open verification:** whether the mini-network's WAN carries the `darknet` trait (else hand-build the
  graph node in the lie-low test) — resolved during execute, not a design risk.
