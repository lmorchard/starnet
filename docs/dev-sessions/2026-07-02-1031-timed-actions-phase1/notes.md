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

## Phase 5 — Proof slice: `corrupt` + `crack-vault` + `extract-key` go timed (#187)

Converted the three actions named in `plan.md`'s proof slice from instant to timed, proving the
full Phase 1-4 chain (declarable `timed` → synthesis → arm/tick/complete, unified abortable
busy/abort, generic default overlay/drone/cue) against real gameplay verbs instead of a synthetic
fixture.

**`corrupt` (core verb, trait-supplied):** `RECONFIGURE_ACTION` in `js/core/node-graph/action-templates.js`
gained `timed: { durationTable: { S:30, A:25, B:20, C:15, D:12, F:8 } }` and `...NOT_BUSY` in
`requires`. No hand-moved effects — synthesis rewrites `effects` (`forwardingEnabled=false` +
`reconfigureNode`) into `onComplete` automatically. Since `RECONFIGURE_ACTION` is shared by
reference across every `detectable`-trait node, this is the first *real* exercise of the Phase-1
new-object-per-node synthesis (previously only proven via a synthetic test fixture) — a dedicated
test constructs a two-IDS bare NodeGraph and asserts each node got its own synthesized operator
object (`notEqual`) and arms independently.

**`crack-vault` / `extract-key` (set-piece verbs):** inline `ActionDef`s in
`data/biomes/corporate-pieces/scattered.js` (on the scattered-vault and scattered-encrypted-vault
set-pieces) each gained `timed: { duration: 20 }` (flat, feel-draft ~2s) plus a
`{ type: "no-active-timed-action" }` structural busy-gate in `requires` (one-at-a-time, matching
the core verbs' `NOT_BUSY` intent — these files don't import `action-templates.js`'s local
`NOT_BUSY` const, so the bare structural condition was used directly rather than adding a new
export). Neither declares an inline `feedback` override, so both fall through the layered
resolution straight to `DEFAULT_PROFILE` (`generic-process` overlay / `generic` drone /
`process.done` cue) — the intended "kill the dud" outcome.

**Bot compatibility (`scripts/bot/execute.js`):** moved `A.CORRUPT` from `INSTANT_ACTIONS` to
`TIMED_ACTIONS` — it emits `ACTION_RESOLVED` on completion (`reconfigureNode`), same shape as
probe/dump/fetch/reboot/mine, so `tickUntilResolved` can wait for it correctly. **Left
`crack-vault`/`extract-key` in `INSTANT_ACTIONS` deliberately** — they only call
`giveReward`/`set-attr`/`log` via `onComplete`, never `ACTION_RESOLVED`, so `tickUntilResolved`
would never see them resolve and would spin to the full tick budget (500) for nothing. They're
one-shot puzzle actions the bot proposes at most once per node (`puzzleStrategy`'s `completed`
set survives regardless of instant/timed dispatch), and `loop.js`'s
`totalTicks += result.ticksUsed || 1` guarantees the game clock keeps advancing at least one tick
per bot cycle either way, so the 20-tick arm resolves naturally in the background over the
following cycles without the bot blocking on it. Verified via `make census SEEDS=50` — no
observable regression (see below).

**Existing tests updated for the new timing (behavior legitimately changed, not broken):**
`js/core/node-graph/node-factories.test.js` (corrupt), `js/core/network/set-pieces.test.js`
(crack-vault reward test, crack-vault one-shot test, decrypt-loot-requires-all-keys test — each
needed a `graph.tick(...)` inserted after the dispatch), and `tests/integration.test.js` (the two
EXEC/corrupt tests). One pre-existing corrupt-adjacent test (`"corrupting the IDS severs the
chain"`, `idsRelayChain` set-piece) did NOT need updating — it exercises a *different*,
hand-authored inline `corrupt` ActionDef defined directly on that specific set-piece node
(`data/biomes/corporate-pieces/defense.js`), not `RECONFIGURE_ACTION`; out of scope, left alone.

**New test suite:** `tests/timed-proof-slice.test.js` (16 tests) — dispatch-doesn't-complete-instantly,
tick-to-completion (asserting the observable consequence: `forwardingEnabled`/cash/`keyExtracted`/
quality, not an intermediate flag), the durationTable branch's exact tick count (grade C → 15
progress ticks + 1 resolve tick = 16 total — the brief's "previously untested" carry-forward),
mid-action ABORT and `PLAYER_NAVIGATED` cancellation (no effect fires, ticking further doesn't
resurrect it), the two-IDS shared-synthesis check, and legibility (`resolveFeedback` resolves all
three converted actions to `DEFAULT_PROFILE`, confirming no central profile entry and thus the
generic overlay/drone/cue instead of a silent dud).

**MANUAL.md updated:** `corrupt` row + "Subverting the IDS" section note it's now timed
(grade-scaled, abortable); the `abort` row and the timed-action list in the SFX section both add
`corrupt`. `crack-vault`/`extract-key` aren't individually documented in the manual (no prior
entries existed for these set-piece-specific verb ids — they're covered generically as
puzzle-payout mechanics), so nothing needed changing there.

**Test result:** `make check` green — 1436 passing (1420 baseline + 16 new), 0 failures. `tsc`
lint clean.

**Census (this branch, `make census SEEDS=50`, default grades C/B/C/C):**
`successRate: 0.20`, `traceFiredRate: 0.88`, `avgTicksElapsed: 603.78`, `avgNodesOwned: 3.44`,
`avgCash: 4949.2`. Not compared against a `main` run in this session (per the task brief, the
controller/Les will diff against a same-seed `main` census) — no retuning performed regardless of
how the numbers land; `corrupt` going timed does change IDS-subversion pacing (grade C IDS now
takes ~1.6s of grid exposure before the corrupt lands, vs. instant before), so some shift in
`traceFiredRate` relative to `main` would be expected and is not itself a bug.
