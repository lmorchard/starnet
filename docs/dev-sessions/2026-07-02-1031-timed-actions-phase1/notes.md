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

## Phase 4a — generic-overlay feel loop (with Les)

Feel lab: `tmp/generic-overlay-lab.html` (throwaway, gitignored) — a slider-driven Canvas harness with
four candidate treatments. **Chosen for the generic default: `segmented-ring`** — a stroked polygon ring
whose segments light up clockwise as progress fills. Locked feel: idle spin ~8°/s, unlit dimness ~0.10,
hue **141** (green), radius 54, 12 segments, stroke 2.0, segment gap 0.18, glow blur 10, leading-edge
pulse 0.5. (Confirm final spin/dim with Les before porting.)

**Future palette candidates (Les — keep for the bespoke-feedback arc; see spec "future palette" + #288):**
the three unchosen lab styles are worth reusing as bespoke overlays assigned across ranges of actions:
- **`converging-brackets`** — four corner brackets marching inward + a progress tick-ring. Reads as
  "locking on / tightening" — good for exploit-like or vault-crack actions.
- **`sweep-ticks`** — a clockwise sweep line lighting a tick ring as it passes. Reads as "scanning" —
  good for scan/probe-family set-piece actions.
- **`aperture-blades`** — blades rotating CW and closing with progress. Reads as "opening/sealing" —
  good for unlock/extract/gate actions.
The lab code preserves the exact geometry of all four if we rebuild it for that arc.
