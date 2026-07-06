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
