# Session Notes: Composable Traits & Core Mechanics Migration

## Session Retro

### Summary

Replaced the factory-based node type system with a composable trait system and migrated
all core game mechanics (probe, exploit, read, loot, reboot, reconfigure) into the
node-graph runtime. This is the second major architectural overhaul after the node-graph
integration — moving from "graph as state store" to "graph as behavior engine."

**23 commits, 51 files changed, +3,007 / -1,893 lines.**

### Key Actions

**Planned phases (1-8) — all completed:**
1. Trait registry and composition engine (`resolveTraits`)
2. 8 built-in traits (graded, hackable, lootable, rebootable, relay, detectable, security, gate)
3. Factory functions rewritten as trait-based NodeDefs
4. Network definitions verified (no-op — createGameNode handles it)
5. Generic timed-action operator (one operator for all timed actions)
6. ACTION_FEEDBACK event type
7. Migrate executors to ctx resolve methods (the big swap)
8. Delete executor files + cleanup

**Beyond-plan work:**
- Renderer rewire (visual-renderer, log-renderer) to ACTION_FEEDBACK
- ICE noise detection migrated from EXPLOIT_NOISE to ACTION_FEEDBACK
- Reboot action migrated to timed-action operator
- Reconfigure action migrated to game-ctx, node-orchestration.js deleted
- Node lifecycle (cancel trace on monitor owned, disable ICE on resident owned)
  migrated from event-driven type checks to graph triggers + ctx functions
- Cancel-on-navigate restored (regression from executor deletion)
- Exploit hand pane rendering fixed (dead state.executingExploit reference)
- Context menu flicker fix (innerHTML rebuild on every progress tick)
- Dynamic command discovery — all graph actions auto-registered as console commands
- Tab completion for dynamic commands
- ACTION_RESOLVED event — unified resolution event replacing 8 per-action events
- NodeState typedef loosened to index signature for trait-provided attributes
- Old state fields removed (activeProbe, executingExploit, activeRead, activeLoot)
- Old timer types removed (PROBE_SCAN, EXPLOIT_EXEC, etc.)
- playtest-graph.js deleted (redundant with playtest.js)
- Backlog updated with deferred items

### Divergences from Plan

1. **Phases 6+7 merged.** The plan had Phase 6 (renderer rewire) separate from Phase 7
   (executor swap). In practice, rewiring renderers before the executors were replaced
   would create a broken intermediate state. Combined them into one pass.

2. **Rebootable on all hackable types.** The spec had rebootable only on fileserver/
   cryptovault, but the old system gave eject/reboot to everything. Kept old behavior.

3. **Exploit special case persisted.** The spec envisioned all actions using pure set-attr
   effects. Exploit still needs a ctx-call because it requires the exploitId from the
   event payload to compute card-dependent duration. This is the one action that doesn't
   fit the pure data model cleanly.

4. **ACTION_RESOLVED was not in the original plan.** Emerged during follow-up cleanup —
   Les pushed for coalescing per-action resolution events after seeing the event catalog.

5. **Dynamic command discovery was not planned.** Emerged when cleaning up static command
   stubs — Les identified that graph-provided actions should be auto-registered.

6. **Graph trigger evaluation on setNodeAttr.** The runtime's `setNodeAttr` didn't
   evaluate triggers — had to add this so ownership triggers (cancel trace, disable ICE)
   fire correctly when access level changes via state sync.

### Insights & Lessons

- **The "all at once" approach for Phase 7 was correct.** Les pushed for doing all
  executor migrations simultaneously rather than one-at-a-time. This avoided dual-path
  complexity and was actually simpler — fewer intermediate states to manage.

- **Behavior regressions hide in event-driven side effects.** Cancel-on-navigate was
  a module-level `on(E.PLAYER_NAVIGATED, ...)` in the deleted executor files. Easy to
  miss because it wasn't in the executor's main logic — it was a side effect of importing
  the module. Lesson: when deleting a module, grep for all its side effects, not just its
  exports.

- **Dynamic attributes break static type systems.** The trait system produces attributes
  dynamically — `probing`, `exploiting`, `activeExploitId` etc. don't exist on the static
  NodeState typedef. Loosening to an index signature was the right call. JSDoc's type
  system isn't expressive enough for this pattern.

- **Operator events channel was the key design decision for Phase 5.** Extending
  OperatorResult with an `events` array and having the runtime apply `operator-effect`
  events through the effect system kept operators pure while enabling completion effects.

- **Context menu flicker is a symptom of the new architecture.** The timed-action operator
  changes node attributes on every tick, which triggers STATE_CHANGED, which re-renders
  the context menu. The fix (skip innerHTML when action IDs unchanged) is a band-aid.
  The deeper solution would be fine-grained DOM updates (lit-html) — already noted in
  the backlog.

- **Graph triggers on setNodeAttr was a gap.** The original NodeGraph only evaluated
  triggers after message delivery, tick, and executeAction. External attribute changes
  (from state sync) didn't fire triggers. This was architecturally correct (triggers
  react to graph-internal changes) but practically wrong (ownership changes come from
  combat.js via state sync). The fix was one line but exposed a design tension.

### Stats

- **Commits:** 23
- **Tests:** 497 passing (started at 506, peaked at 529, settled at 497 after removing
  old executor tests and static command tests)
- **Lines:** +3,007 / -1,893 net across 51 files
- **Files deleted:** 7 (4 executor files, node-orchestration.js, node-lifecycle.js,
  playtest-graph.js)
- **New files:** 3 (traits.js, traits.test.js, timed-action.test.js)
- **Events removed:** 17 per-action events → 2 unified events (ACTION_FEEDBACK + ACTION_RESOLVED)
- **Conversation turns:** ~100+

### Process Observations

- **Planning-to-execution ratio felt right.** The brainstorm → spec → plan → audit
  cycle took significant time but execution was smooth — we knew what we were doing
  and caught several issues (ICE noise, renderer state, test scope) before they became
  bugs.

- **Browser playtesting via Playwright caught real bugs.** The exploit not starting
  (wrapGraphAction ctx routing) and context menu flicker would not have surfaced from
  headless tests.

- **Les's real-time direction drove several important extensions.** Reboot migration,
  reconfigure migration, node-lifecycle migration, dynamic command discovery, and
  ACTION_RESOLVED were all Les-initiated during the session — not pre-planned. Each
  one made the system cleaner.

- **The "barrel through" approach worked.** Les explicitly declined pausing between
  phases, which maintained momentum through the entire 8-phase plan plus follow-up
  work. The incremental commits gave safe rollback points without losing flow.

### Follow-Up Work Identified

**Immediate (next session candidates):**
- Visual preview harness ("Storybook") for isolated renderer/animation testing
- Set-piece playtest jigs for isolated circuit testing
- Bot player rebuild for the new trait/graph system

**Architecture:**
- Merge playtest scripts into one (done this session)
- state.js re-export shim cleanup (backlogged)
- lit-html or fine-grained DOM updates to replace innerHTML pattern

**Trait system expansion:**
- New traits: trapped, encrypted, volatile, mirrored, hardened, audited
- Parameterized traits (gate("owned") instead of attributes override)
- Conditional trait activation via triggers

---

## Phase-by-Phase Notes

## Phase 1: Trait Registry & Composition Engine ✓

- Created `js/core/node-graph/traits.js` — registry, resolveTraits(), clearTraits()
- Added `traits?: string[]` to NodeDef typedef
- Wired resolveTraits() into NodeGraph constructor (runs before node map build)
- fromSnapshot() unaffected (snapshot nodes lack `traits` field, passthrough works)
- 14 unit tests covering registry, composition rules, merge order, overrides
- All 506 tests pass

## Phase 2: Define Initial Trait Vocabulary ✓

- Extracted RECONFIGURE_ACTION and CANCEL_TRACE_ACTION to module-level constants
- Registered all 8 traits: graded, hackable, lootable, rebootable, relay, detectable, security, gate
- Traits import action templates from game-types.js ACTION_TEMPLATES
- 11 new tests for built-in trait definitions + composition
- All 517 tests pass

## Phase 3: Rewrite Game-Types.js to Use Traits ✓

- Factory functions now produce trait-based NodeDefs (thin wrappers)
- createGameNode() attaches default traits from TRAITS_BY_TYPE for known types
- Added TRAITS_BY_TYPE lookup table and ACCESS_DARKNET_ACTION constant
- Removed defaultAttributes(), BASIC_ACTIONS, LOOTABLE_ACTIONS (traits provide these)
- Key fix: rebootable trait added to all hackable node types (matching old behavior)
- Key fix: lootCount default added to lootable trait
- Key fix: macguffins/forwardingEnabled guards for non-lootable/non-detectable nodes
- Updated game-types.test.js, networks.test.js, integration.test.js, node.test.js
- All 521 tests pass

**Divergence from spec:** The spec listed rebootable as only on fileserver/cryptovault,
but the old system had eject/reboot on all hackable nodes. Kept old behavior —
rebootable on all hackable types. Can revisit later.

## Phase 4: Update Network Definitions & Set-Pieces ✓

- No changes needed — Phase 3's createGameNode() already attaches traits from
  TRAITS_BY_TYPE for known types. Set-piece nodes pass through correctly.
- All 3 networks build, all set-pieces instantiate, all 521 tests pass.

## Phase 5: Generic Timed-Action Operator ✓

- Registered `timed-action` operator in operators.js
- Extended OperatorResult to include `events` array
- Runtime delivers operator events via onEvent, handles `operator-effect` events
  by applying them through the effect system (ctx-call, set-attr, etc.)
- Operator handles: start detection (grade table → duration), progress ticking,
  completion (fires onComplete effects), onProgressInterval for milestone effects
- Added resolve methods (resolveProbe, resolveExploit, etc.) to nullCtx and mockCtx
  in preparation for Phase 7
- Updated OperatorConfig and CtxInterface typedefs
- 8 unit tests for timed-action operator lifecycle
- All 529 tests pass
- Deferred adding timed-action operators to trait definitions until Phase 7
  to avoid double-execution with old executors still active

## Phase 6: ACTION_FEEDBACK Event (Partial) ✓

- Added `E.ACTION_FEEDBACK` to events.js
- Deferred full renderer rewire to Phase 7 — avoids a broken intermediate state
  where renderers are rewired but executors still emit old events. Will do the
  renderer rewire as part of the Phase 7 end-to-end swap.

## Phase 7: Migrate Executors to Ctx Resolve Methods ✓ (core swap)

All four timed actions (probe, read, loot, exploit) now use the graph-native
timed-action operator lifecycle instead of the old timer-based executors.

- Added resolve methods to game-ctx.js: resolveProbe, resolveExploit, resolveRead,
  resolveLoot, resolveReboot, emitActionFeedback
- Added timed-action operators to hackable trait (probe + exploit) and lootable
  trait (read + loot)
- Updated action effects: probe/read/loot now use set-attr to set activeAttr + progress
  instead of ctx-call to executor start functions
- Exploit special case: still uses ctx-call startExploit because it needs exploitId
  from event payload to compute card-dependent duration
- Cancel actions: set-attr to reset state + ctx-call emitActionFeedback for cancel event
- Added activeExploitId to hackable trait attributes
- Old executor files still exist but are no longer called by the action system
- Entry points (main.js, playtest.js, playtest-graph.js) still import executors
  for timer handling — to be removed in Phase 8
- All 529 tests pass

## Phase 8: Delete Executor Files & Cleanup ✓

- Deleted: probe-exec.js, exploit-exec.js, read-exec.js, loot-exec.js
- Removed executor imports from: main.js, playtest.js, playtest-graph.js, action-context.js
- Removed timer handler registrations (EXPLOIT_EXEC, EXPLOIT_NOISE, PROBE_SCAN,
  READ_SCAN, LOOT_EXTRACT) from all entry points
- Moved exploitDuration formula inline to game-ctx.js
- Stubbed executor start/cancel methods in action-context.js (no-ops for type compat)
- Removed enrichWithGameActions alias
- Replaced old executor-based integration tests with graph-native timed-action tests
- All 515 tests pass

## Follow-up: Renderer Rewire + Event Cleanup ✓

- Wired ACTION_FEEDBACK through onEvent bridge in state/index.js (both init and restore paths)
- Rewired visual-renderer.js: replaced 12 per-action event subscriptions with single
  ACTION_FEEDBACK handler that dispatches to probe/exploit/read/loot animations.
  Removed TIMERS_UPDATED progress tracking for timed actions (operator provides progress).
- Rewired log-renderer.js: replaced 8 per-action log subscriptions with ACTION_FEEDBACK handler
- Rewired ice.js: EXPLOIT_NOISE → ACTION_FEEDBACK for exploit progress noise detection
- Rewired playtest.js: replaced 8 per-action output listeners with ACTION_FEEDBACK handler
- Removed 9 old event types from events.js (PROBE_SCAN_STARTED/CANCELLED,
  READ_SCAN_STARTED/CANCELLED, LOOT_EXTRACT_STARTED/CANCELLED, EXPLOIT_STARTED/NOISE/INTERRUPTED)
- All 515 tests pass

## Dynamic Command Tab Completion + ACTION_RESOLVED ✓

- Dynamic commands now have tab completion via `completeNodeArg` — probe, read,
  loot, reboot, etc. all complete node arguments
- Replaced 8 per-action resolution events with unified `E.ACTION_RESOLVED`:
  NODE_PROBED, NODE_READ, NODE_LOOTED, EXPLOIT_SUCCESS/FAILURE, NODE_RECONFIGURED,
  NODE_REBOOTING, NODE_REBOOTED → `{ action, nodeId, label, success, detail }`
- Updated all subscribers: log-renderer, visual-renderer, graph-bridge, alert.js,
  playtest.js, playtest-graph.js
- Kept NODE_ACCESSED, NODE_ALERT_RAISED, NODE_REVEALED (not action resolutions)
- Kept EXPLOIT_DISCLOSED, EXPLOIT_PARTIAL_BURN, EXPLOIT_SURFACE (card decay side-effects)
- All 497 tests pass

## Browser Playtest ✓

- Probe: sweep animation works, log messages correct, vulns revealed, alert escalated
- Exploit: bracket animation works, start log with duration, timed execution,
  combat resolution, access promotion, card decay — all confirmed by Les
- Fix: exploit start event wasn't firing because timed-action operator skips
  start for pre-set durations. Added explicit ACTION_FEEDBACK emit from
  ctx.startExploit. Fixed wrapGraphAction routing exploit through game-ctx
  instead of stubbed ActionContext.
