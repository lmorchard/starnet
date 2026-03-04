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
