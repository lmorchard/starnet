# Session Notes: Composable Traits & Core Mechanics Migration

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
