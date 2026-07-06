## Task 1: kick becomes a short timed action

Implemented per `plan.md` Task 1, with two corrections to the brief/plan (both documented
in `.superpowers/sdd/task-1-report.md`):

- The synthesis test file does not exist at `js/core/node-graph/timed-synthesis.test.js`
  (that path never existed in this repo — checked git history). The real Phase-1 file is
  `tests/timed-synthesis.test.js`; the new KICK synthesis test was added there, following
  that file's existing `NodeGraph` + `mockCtx()` construction idiom rather than calling
  `synthesizeTimedActions()` directly.
- The integration test uses `s.nodeGraph.executeAction(...)` (matching the existing kick
  test's pattern), not `emitEvent("starnet:action", ...)` — the dispatcher
  (`initActionDispatcher`) is only wired once, later in `tests/integration.test.js` inside
  the "EXEC dispatch echo" `before()` hook; calling it a second time earlier would register
  a duplicate `starnet:action` listener and double-execute every action dispatched from
  that point on for the rest of the file.

Two pre-existing tests asserted immediate ejection and needed a tick added after dispatch
(legitimate behavior change, assertions kept, not weakened):
- `tests/integration.test.js`: "kick action (renamed from eject)"
- `tests/ice-multi-detection.test.js`: "KICK at a node boots the instance on THAT node..."

`make check`: green — 1519/1519 tests, tsc clean.

`make census SEEDS=50` (branch `timed-actions-phase2`, config threat=C wealth=B complexity=C depth=C):
```
successRate: 0.12
traceFiredRate: 0.92
avgNodesOwned: 2.62
avgNodesTotal: 20.52
avgCash: 3487.48
```
No main baseline run here per task instructions (controller compares). Numbers look
plausible for this threat/wealth config but are on the harsh side (successRate 0.12,
traceFiredRate 0.92) — worth a same-seed main comparison before treating as confirmed
no-regression.

## Task 2: `hasBehavior` predicate

Landed (7f5c78f) ahead of this notes entry — no session-doc summary was recorded at the
time (small, infra-only addition consumed directly by Task 3 below).

## Task 3: sniff/replay operator bridge

Implemented per `plan.md`/the task brief, following the brief's production code close to
verbatim: `SNIFF_DURATION`/`REPLAY_DURATION` in `balance.js`, `resolveSniff`/`resolveReplay`
in `game-ctx.js`, `armTimedProgram` + rewired `SNIFF_ACTION.execute`/`REPLAY_ACTION.execute`
+ `!busy` availability gating in `program-actions.js`. SWEEP untouched (stays a process).

**Test-dispatch path (per the brief's "determine and note" instruction):** SNIFF/REPLAY are
program actions (`program-actions.js`), not NodeDef actions, so `graph.executeAction(...)`
(kick's pattern) doesn't reach them. Used `getAvailableActions(node, state).find(a => a.id
=== A.SNIFF).execute(node, state, {}, payload)` directly instead of wiring
`initActionDispatcher` a second time — that dispatcher is registered exactly once, later in
the file, in "EXEC dispatch echo"'s `before()`; a second registration would double the
`starnet:action` listener count and double-execute every action dispatched for the rest of
the file (same trap Task 1 hit and documented for kick). ABORT, being a real NodeDef action
(structural `active-abortable-timed-action` condition, present on any "hackable" node), IS
exercised the normal way: `graph.executeAction(nodeId, "abort")`.

**Fixture:** reused `data/networks/corporate-exchange.js` (already imported in
`tests/integration.test.js`) rather than hand-rolling a new minimal LAN — it already carries
an authored `switch-2 → fw-1` credential flow (key `fw-root-key`) and a finesse-locked `fw-1`,
the same fixture `tests/flow-programs.test.js` uses. New suite: "sniff/replay are timed (#187
Phase 2)" in `tests/integration.test.js`, 5 tests (arm/complete, abort-mid-sniff, replay
arm/complete, re-arm reuses the operator via `graph.snapshot().nodes[...].operators`
filtering — proven pattern from `tests/cascade.test.js`'s `attachBehavior` suite — and a
save/load round-trip mid-sniff via `serializeState`/`deserializeState`, the same idiom used
throughout the file).

**Pre-existing tests broken by the change (fixed, not weakened):** `tests/flow-programs.test.js`
had two tests that called `SNIFF_ACTION`/`REPLAY_ACTION.execute` and asserted immediate
resolution — the "GUI/console parity" test (dispatch via `emitEvent("starnet:action", ...)`)
and the "full loop: SNIFF → REPLAY → owned" test. Both now tick the graph
(`getState().nodeGraph.tick(SNIFF_DURATION | REPLAY_DURATION)`) before asserting the
post-resolution state, matching the assertions' original intent.

RED confirmed twice: (1) reverting all production files hit an import error for
`SNIFF_DURATION`/`REPLAY_DURATION` (expected — no fallback path); (2) reverting only
`program-actions.js` (keeping the balance constants + ctx resolvers) produced 5 clean
failures in the new suite with the pre-bridge `execute` still resolving synchronously,
proving the tests exercise the bridge and not a tautology. Re-applied → GREEN.

`make check`: green — 1525/1525 tests, tsc clean (up from 1519 baseline: +5 new sniff/replay
tests, +1 net from the isNodeBusy/hasBehavior Task 2 suites already landed).

**Playtest harness sanity — found a pre-existing, unrelated bug while checking legibility.**
Manually walked corporate-exchange via the harness (`cheat own switch-1` → `probe`/`xploit`
switch-2 → `sniff 2`) and confirmed the mechanics: SNIFF arms (`_ta_active_sniff: true`,
`_sniff_flow_id` stashed, `_ta_sniff_duration: 12`), does not resolve at dispatch, and
resolves (`FLOW_SNIFFED`) after ticking to completion. But the harness never printed a
"[SNIFF] running..." (ACTION_FEEDBACK "start") log line across separate CLI invocations —
traced it to `deserializeState()`'s NodeGraph `onEvent` bridge in `js/core/state/index.js`
(~line 421), which is missing the `else if (type === "action-feedback") emitEvent(E.
ACTION_FEEDBACK, payload)` branch that `initGame()`'s otherwise-identical bridge has (added
at some earlier point in the timed-actions work, never mirrored to the restore path). A
minimal in-process repro (arm sniff, `graph.tick(1)`, no serialize round-trip) fires
ACTION_FEEDBACK "start"+"progress" correctly — the bug is specifically in the *restored*
graph's event wiring, not the operator itself. `resolveSniff`/`resolveReplay` (and every
other timed action's completion effect) still fire correctly after a restore, because
`onComplete` effects route through a separate `operator-effect` → `applyEffect(...)` path
that bypasses `onEvent` entirely — only the "start"/"progress"/"cancel"/"complete"
ACTION_FEEDBACK *log/overlay* cues are lost. Confirmed pre-existing (`git log -p` shows the
`action-feedback` branch was only ever added to `initGame`'s bridge, never to
`deserializeState`'s) and NOT specific to sniff/replay — every timed action loses its
start/progress/cancel feedback after any save/load, including in a real browser session if
the player saves-and-reloads mid-action. Each `scripts/playtest.js` CLI invocation is its own
process (state round-trips through `serializeState`/`deserializeState` between every single
command), so this harness happens to exercise the restore path on literally every command —
which is how it surfaced. **Not fixed** (out of scope for this task — a general node-graph/
state bug, not sniff/replay-specific; the one-line fix is copying the `action-feedback`
branch from `initGame`'s bridge into `deserializeState`'s). Flagging for a follow-up issue.

`make census SEEDS=50` (same config as Task 1: threat=C wealth=B complexity=C depth=C):
```
successRate: 0.12
traceFiredRate: 0.92
avgNodesOwned: 2.62
avgNodesTotal: 20.52
avgCash: 3487.48
```
Byte-identical to Task 1's numbers. Expected: the bot never uses SNIFF/REPLAY, and the
default census network is procedurally generated (flows only exist on hand-authored
networks per MANUAL.md) — so this change is provably inert on the bot's path, not just
"within noise."

**MANUAL.md:** not updated, per Task 1's precedent — SNIFF/REPLAY's player-facing verb,
availability, and effect are unchanged; only their timing (feel-draft ~1.2s/~2s, tuned in
Part 3) and the fact they're now abortable via ABORT. Worth a single documentation pass
covering kick + sniff + replay together once Part 3 tuning lands, as Task 1 flagged.

**Part 3 handoff:** kick (duration 5), SNIFF_DURATION (12), REPLAY_DURATION (20), and the
flat `DEFAULT_SCRIPT_ACTION_DURATION`/`corrupt` durationTable are all feel-draft placeholders
awaiting a live in-browser tuning pass with Les — not touched here per the brief's explicit
"pause and hand off" instruction.
