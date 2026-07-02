# Timed Actions — Session Notes

## Phase 1 — Declarable `timed` → operator synthesis (#187)

Implemented per `plan.md` Phase 1, TDD (`tests/timed-synthesis.test.js` written and watched fail
before implementation).

**Files:**
- `js/core/node-graph/types.js` — added `ActionDef.timed` (`TimedActionSpec`: `duration?`,
  `durationTable?`, `abortable?` — `abortable` typed now, wiring deferred to Phase 2), `ActionDef.feedback`
  (`ActionFeedbackSpec`, reserved for Phase 3, unread by Phase 1), and `ActionDef._timedSynthesized`.
- `js/core/node-graph/timed-actions.js` — added `timedActiveAttr(actionId)` (`_ta_active_<id>`).
  Additive; `TIMED_ACTIONS`/`ABORTABLE_FLAGS` untouched.
- `js/core/node-graph/timed-synthesis.js` (new) — `synthesizeTimedActions(node)`.
- `js/core/node-graph/runtime.js` — calls `synthesizeTimedActions(n)` right after `resolveTraits(raw)`
  in the constructor's per-node loop, before the node is stored — covers both trait-supplied and inline
  actions.
- `tests/timed-synthesis.test.js` (new) — 3 tests: operator+arm-effects shape at construction,
  idempotency, and dispatch→tick→completion behavior.

**Deviation from the plan's reference sketch (worth flagging):** the sketch mutates `action.effects`
and pushes onto `node.operators` in place. Trait-supplied `ActionDef` objects are shared by reference
across every node composing that trait (`traits.js`'s `actionMap.set(action.id, action)` copies the
reference, not the object — confirmed by reading `resolveTraits`). In-place mutation plus the
`_timedSynthesized` guard would mean the *first* node to synthesize a shared trait action "steals" the
operator: later nodes see `_timedSynthesized` already `true` on the shared object and skip, silently
missing their own operator. `synthesizeTimedActions` instead returns a **new** action object per node
(via `.map()`) and rebuilds `node.operators` via spread rather than `.push()`, so nothing shared is
mutated. Added a dedicated idempotency test that constructs two graphs from the same node-def object
to lock this in. This only matters once a *trait* declares a `timed` action (no built-in trait does
yet — Phase 5 converts `corrupt`, which is trait-supplied via `RECONFIGURE_ACTION`, so this would have
surfaced there if left unfixed).

**Also confirmed against the real operator (not the sketch):** a flat `duration` is seeded directly by
the arm effects, so the operator's grade-table "first tick sets duration" branch is bypassed entirely —
completion lands at exactly `tick(duration)`, not `tick(duration + 1)`. The plan's sketch commentary said
`tick(6)` for a `duration:5` case; verified via the test that `tick(5)` is correct and used that.

**Test result:** `make check` green — 1363 passing (1360 baseline + 3 new), 0 failures. `tsc` lint clean
(needed one adjustment: extracting the arm-effects array into a `/** @type {Effect[]} */`-annotated
`const` built with `.push()` rather than array-literal `...` spread, so TS doesn't widen the `effect`
string literals inside the conditional branch).

Not touched (correctly out of scope for Phase 1): `isNodeBusy`, `NOT_BUSY`/ABORT wiring, feedback
resolution, overlay/drone default, and the `corrupt`/`crack-vault`/`extract-key` proof slice — all later
phases per `plan.md`.
