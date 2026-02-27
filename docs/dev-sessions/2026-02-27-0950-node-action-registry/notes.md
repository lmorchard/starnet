# Notes: Node Action Registry

## Recap

Centralized all action availability logic into a composable registry.
Before this session, both `visual-renderer.js` and `console.js` duplicated
nearly identical if/else chains to decide which action buttons to render or
list. Now that logic lives in two registry files:

- `js/node-actions.js` — 8 node-contextual `ActionDef` objects (probe,
  cancel-probe, exploit, cancel-exploit, read, loot, eject, reboot) plus
  `getNodeActions()` and `getAvailableActions()`
- `js/global-actions.js` — 3 global `ActionDef` objects (jackout, select,
  deselect) plus `getGlobalActions()`

Each `ActionDef` carries `available()`, `desc()`, and `execute()`. The
`execute()` takes a dependency-injected `ActionContext`, making the actions
fully testable without any game state initialization.

`main.js` now builds one `ActionContext` instance and routes all UI/console
actions through a single `on("starnet:action", ...)` dispatcher, replacing
12 individual per-action handlers. Type-specific actions (`reconfigure`,
`cancel-trace`) also received `execute()` methods and were folded into the
unified dispatch.

143 tests passing across 37 suites.

---

## Divergences from Plan

**Phase 6 (visual-renderer.js):** The plan said to use `getAvailableActions()`
directly, but global actions (jackout, select, deselect) are already rendered
as hardcoded UI fixtures — a dedicated deselect button in the node header,
jackout in the HTML. Using `getAvailableActions()` would have duplicated those.
Used `getNodeActions()` + `getTypeActions()` instead, which is the correct
semantic split.

**Phase 7 (console.js):** The plan suggested a simple `forEach` over
`getAvailableActions()` for the `actions` output, but the exploit action
needs a rich card listing (sorted, with match indicators, worn/disclosed
status). Kept the card listing logic intact and used a `has` Set for
availability gating instead.

**Phase 9 (main.js dispatch):** The plan showed a unified `starnet:action`
event schema as a possible approach. We committed to it, which required also
changing event emitters in visual-renderer.js and console.js. Added execute()
to `reconfigure` and `cancel-trace` in node-types.js (not originally scoped)
to make the unified dispatcher work cleanly without carve-outs.

**Probe predicate bug:** The Phase 5 parity tests caught a missing check in
the probe `available()` predicate — it didn't block when an exploit was
already executing on the same node. The original visual-renderer.js had an
early-return that blocked all non-cancel-exploit actions when a exploit was
running; this wasn't mirrored in the new predicate. Fixed before proceeding.

---

## Insights

**Test-before-migrate paid off.** Writing parity tests (Phase 5) before
touching any consumer (Phases 6–7) caught the probe predicate bug immediately.
Without that gate, the bug would have silently survived the migration and
showed up as a subtle gameplay regression.

**`ActionDef` with execute() is a clean contract.** The DI context pattern
(`ActionContext`) makes every action independently testable with a 10-line
mock. The dispatch routing tests (Phase 8) run fast, require no game
initialization, and give exact call-site verification.

**The `exploit` action needs special treatment in two places.** Visual display
(card listing in the console `actions` command) and log format (card index vs
node ID) both required small carve-outs. These are display concerns, not
availability concerns — the registry correctly only owns the latter.

**Unified event schema is worth the churn.** Changing from `starnet:action:*`
to `starnet:action` + `{ actionId }` required touching emitters in three
files, but the result is one dispatcher instead of 12 handlers. The
`fromConsole` flag for suppressing log echoes carries over cleanly.

**node-types.js type-specific actions were half-finished.** They had
`available()` and `desc()` but no `execute()`. This wasn't noticed until
Phase 9 forced the issue. A more thorough initial audit of action-adjacent
code would have caught this earlier.

---

## Efficiency

- **Smooth:** All 10 phases executed without backtracking. The incremental
  commit-per-phase structure kept the work reviewable and made it easy to
  reason about what each change added.
- **Friction:** The context window ran out mid-session (before Phase 5 tests
  were run), requiring a resume. No work was lost but some re-orientation was
  needed.
- **Fast:** Phase 6 and 7 migrations were trivially small once the registry
  was in place — the preparation phases paid for themselves quickly.

---

## Process Improvements

- **Audit ALL action-adjacent code before writing the spec.** node-types.js
  had action definitions without `execute()` — surfacing this during brainstorm
  would have scoped them in from the start.
- **Name event schema changes explicitly in the plan.** The plan described
  the unified `starnet:action` event format but didn't call out that it
  requires touching emitters in multiple files. Flagging that as a distinct
  step (not buried in Phase 9) would have made the scope clearer.
- **Keep retros short.** Future retros can be lighter — key divergences and
  one or two insights are sufficient. The value is in the pattern over time,
  not the length per entry.

---

## Conversation Turns

Approximately 30–35 back-and-forth exchanges (this session spanned two
context windows due to a mid-session compaction).

---

## Other Highlights

- The `select` global action is purely a console/API concept — there's no
  corresponding sidebar button (you select by clicking graph nodes). The
  registry correctly models it as an available action, and the console
  `actions` command lists it. The sidebar has no equivalent UI element, which
  is correct.
- `starnet:action:run-again` intentionally stays outside the registry — it's
  a meta-action for resetting the game, not a gameplay action with an
  `available()` predicate.
- The playtest harness (`scripts/playtest.js`) was not updated this session
  to use the new unified event format — it dispatches actions differently
  (directly calling state functions). It remains functional but would benefit
  from being wired through ActionContext in a future session.
