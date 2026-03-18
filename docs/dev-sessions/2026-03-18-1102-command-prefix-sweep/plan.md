# Command Prefix Uniqueness Sweep — Plan

_Session: 2026-03-18-1102 | Issue: #73_

## Strategy

Each phase is a vertical slice — one rename (or small group) through all layers, ending with `make check` passing. This keeps the game working after every commit and makes bisecting easy if something breaks.

The `abort` unification is the only phase with real logic changes; all others are mechanical find-and-replace.

---

## Phase 0: Commit session docs

Commit spec and plan before touching code.

---

## Phase 1: `store` → `darknet`

Smallest rename — only touches the console command definition and help text. Good warmup to verify the workflow.

### Prompt

Rename the console command `store` to `darknet` across the Starnet codebase. This is a command verb rename for tab-completion ergonomics.

Files to update:
- `js/core/console-commands/commands.js` — change verb from `"store"` to `"darknet"`, update usage text
- `js/core/console-commands/commands.js` — update help text that references "store"

The action ID `access-darknet` on the WAN node is unchanged. The `buy` command is unchanged. Only the console verb that opens the store UI changes.

Run `make check` after changes to verify nothing broke.

---

## Phase 2: `select` → `target`, `deselect` → `untarget`

These touch the global action registry, console commands, dynamic-actions static set, action-context click handler, UI code, bot player, and tests.

### Prompt

Rename `select` → `target` and `deselect` → `untarget` across the Starnet codebase. These are action ID and console verb renames.

Files to update (search each for string literals "select" and "deselect" as action IDs):
- `js/core/actions/global-actions.js` — change `id: "select"` to `id: "target"`, `id: "deselect"` to `id: "untarget"`
- `js/core/console-commands/commands.js` — change verb definitions, update `has.has("select")` / `has.has("deselect")` checks, update help text
- `js/core/console-commands/dynamic-actions.js` — update `STATIC_ACTION_IDS` set entries
- `js/core/actions/action-context.js` — update the click handler that emits `actionId: "select"` / `actionId: "deselect"`
- `js/ui/visual-renderer.js` — any references to select/deselect action IDs
- `js/ui/console.js` — any references
- `scripts/bot/execute.js` — update `INSTANT_ACTIONS` set and any `choice.action` checks
- `scripts/playtest.js` — update command dispatch and help text
- `tests/` — update action ID assertions in integration and unit tests
- `css/style.css` — rename `.deselect-btn` to `.untarget-btn` and update any HTML that references the class
- `js/ui/visual-renderer.js` — update any HTML that renders a deselect button with the old class name

Do NOT rename DOM event names like `starnet:action` — only the action ID payloads. Do NOT rename `selectedNodeId` in game state — that's a state field, not a command verb.

Run `make check` after changes.

---

## Phase 3: `reconfigure` → `corrupt`, `recalibrate` → `spoof`

These are node-graph action IDs defined in set-pieces. They flow through game-ctx event payloads into log-renderer, alert.js, and tests.

### Prompt

Rename action IDs: `reconfigure` → `corrupt` and `recalibrate` → `spoof` across the Starnet codebase.

Files to update:
- `data/biomes/corporate-pieces.js` — all `id: "reconfigure"` in action definitions become `id: "corrupt"`. The one `id: "recalibrate"` becomes `id: "spoof"`. Update labels too (e.g. "Reconfigure IDS" → "Corrupt IDS", "Recalibrate Sensor" → "Spoof Sensor").
- `js/core/node-graph/game-types.js` — rename `RECONFIGURE_ACTION` id and constant name. Update the label.
- `js/core/node-graph/game-ctx.js` — update `action: "reconfigure"` in ACTION_RESOLVED emissions to `action: "corrupt"`
- `js/core/alert.js` — update listener that checks `action === "reconfigure"`
- `js/ui/log-renderer.js` — update case statements for "reconfigure" in ACTION_RESOLVED handler, update log message text
- `scripts/bot/execute.js` — update `INSTANT_ACTIONS` set entry from "reconfigure" to "corrupt"
- `scripts/bot/` — search all strategy/heuristic files for "reconfigure" references
- `scripts/playtest.js` — update command dispatch for "reconfigure"
- `tests/integration.test.js` — update assertions checking for "reconfigure" action availability
- `tests/` — search all test files for "reconfigure" and "recalibrate" strings

The action labels shown to the player should also change: "Reconfigure IDS" → "Corrupt IDS", "Recalibrate Sensor" → "Spoof Sensor".

Run `make check` after changes.

---

## Phase 4: `read` → `dump`, `loot` → `fetch`

These are core gameplay verbs. They appear in game-types action definitions, traits, game-ctx event payloads, console commands, visual-renderer animation dispatch, log-renderer, bot player, and tests.

### Prompt

Rename action IDs: `read` → `dump` and `loot` → `fetch` across the Starnet codebase.

Files to update:
- `js/core/node-graph/game-types.js` — rename READ_ACTION to DUMP_ACTION (id: "dump"), CANCEL_READ_ACTION to CANCEL_DUMP_ACTION (id: "cancel-dump"), LOOT_ACTION to FETCH_ACTION (id: "fetch"), CANCEL_LOOT_ACTION to CANCEL_FETCH_ACTION (id: "cancel-fetch"). Update labels.
- `js/core/node-graph/traits.js` — update `id: "read"` in lootable trait to `id: "dump"`. Update any "loot" references.
- `js/core/node-graph/game-ctx.js` — update `action: "read"` and `action: "loot"` in ACTION_RESOLVED and cancellation feedback emissions
- `data/biomes/corporate-pieces.js` — update any `id: "loot"` action definitions in set-piece nodes (e.g. vault loot actions)
- `js/core/console-commands/commands.js` — update `has.has("cancel-read")`, `has.has("read")`, `has.has("cancel-loot")`, `has.has("loot")` checks. Update the timed action verbs array. Update help text.
- `js/ui/visual-renderer.js` — update ACTION_FEEDBACK case checks for "read" and "loot" animation dispatch
- `js/ui/log-renderer.js` — update case statements for "read" and "loot", update log message text
- `scripts/bot/execute.js` — update TIMED_ACTIONS set entries
- `scripts/bot/` — search all strategy files for "read" and "loot" action references
- `scripts/playtest.js` — update command dispatch and help text
- `tests/` — update all action ID assertions

Be careful with "read" — it's a common English word. Only rename it where it appears as an action ID string literal, not in variable names like `readNode` or comments about reading files.

Note: the cancel actions here (`cancel-dump`, `cancel-fetch`) are temporary — they'll be unified into `abort` in Phase 6. For now, rename them to maintain the existing pattern.

Run `make check` after changes.

---

## Phase 5: `exploit` → `xploit`

The most-referenced action verb. Touches combat.js, node-actions.js special handling, ice.js, console commands, visual-renderer, log-renderer, bot player, and tests.

### Prompt

Rename action ID `exploit` → `xploit` across the Starnet codebase.

Files to update:
- `js/core/node-graph/game-types.js` — rename EXPLOIT_ACTION (id: "xploit"), CANCEL_EXPLOIT_ACTION (id: "cancel-xploit"). Update labels.
- `js/core/combat.js` — update `action: "exploit"` in ACTION_RESOLVED emissions
- `js/core/actions/node-actions.js` — update the special-case check `action.id === "exploit"` that handles card argument passing
- `js/core/console-commands/commands.js` — rename verb from "exploit" to "xploit", update dispatch calls, `has.has("exploit")` / `has.has("cancel-exploit")` checks, help text
- `js/core/console-commands/dynamic-actions.js` — update STATIC_ACTION_IDS entry
- `js/core/ice.js` — update ACTION_FEEDBACK listener check `action !== "exploit"`
- `js/ui/visual-renderer.js` — update ACTION_RESOLVED case check for "exploit", update any action dispatch emitting exploit
- `js/ui/log-renderer.js` — update case statements for "exploit"
- `js/core/actions/action-context.js` — update any "exploit" references in logging
- `scripts/bot/execute.js` — update TIMED_ACTIONS, check for `ga.id === "exploit"` in card selection
- `scripts/bot/` — search all strategy files for "exploit" references
- `scripts/playtest.js` — update command dispatch and help text
- `tests/` — update all action ID assertions
- `js/core/console-commands/commands.test.js` — update exploit action ID assertions

Note: the cancel action (`cancel-xploit`) is temporary — will become `abort` in Phase 6.

Be careful with "exploit" — only rename string literals used as action IDs, not variable names like `exploitCard`, `activeExploitId`, function names like `resolveExploit`, or CSS classes like `.exploit-card`.

Run `make check` after changes.

---

## Phase 6: Cancel-* → unified `abort`

This is the one phase with real logic changes. The four separate cancel actions become a single `abort` that detects what's in progress and cancels it.

### Prompt

Replace the four cancel actions (`cancel-probe`, `cancel-xploit`, `cancel-dump`, `cancel-fetch`) with a single unified `abort` action.

**Logic change in game-types.js / game-ctx.js:**
- Remove CANCEL_PROBE_ACTION, CANCEL_EXPLOIT_ACTION, CANCEL_DUMP_ACTION, CANCEL_FETCH_ACTION
- Add a single ABORT_ACTION with `id: "abort"`. Its `available` check should return true if the node has any active timed action (probe, xploit, dump, or fetch in progress). It should look at the node's attributes for `activeProbe`, `activeExploitId`, `activeRead`, or `activeLoot` (whatever the state fields are called).
- The abort action's `execute` in game-ctx.js should detect which action is active and cancel it, reusing the existing cancellation logic from the individual cancel handlers. If multiple are active (shouldn't happen normally), cancel the first one found.
- The ACTION_FEEDBACK event for abort should still indicate what was cancelled (e.g. `action: "abort"` with `cancelledAction: "probe"` in the payload, or similar) so log-renderer can produce the right message.

**Console command changes:**
- `js/core/console-commands/commands.js` — remove the four separate cancel checks in the consolidated action block. Add a single `abort` entry or let it flow through dynamic-actions as a graph action.
- The help text should list `abort` as "Cancel the current action".

**Bot player:**
- `scripts/bot/execute.js` — the bot currently builds cancel action IDs dynamically as `cancel-${choice.action}`. Change this to always use `"abort"` when the bot wants to cancel.

**Tests:**
- Update all tests that assert on `cancel-probe`, `cancel-exploit`, `cancel-read`, `cancel-loot` to use `abort`.

**Node definitions:**
- Update all node type definitions and traits that include cancel actions in their available action lists — they should now include `abort` instead of the four separate cancel actions.

Run `make check` after changes.

---

## Phase 7: Help text + MANUAL.md

Update all player-facing documentation to reflect the new command names.

### Prompt

Update all player-facing text to reflect the command renames:

- `MANUAL.md` — update the console commands section, node actions reference, and all examples throughout. Replace:
  - `select` → `target`, `deselect` → `untarget`
  - `exploit` → `xploit`
  - `read` → `dump`
  - `loot` → `fetch`
  - `store` → `darknet`
  - `reconfigure` → `corrupt`
  - `recalibrate` → `spoof`
  - `cancel-probe/exploit/read/loot` → `abort`
- `js/core/console-commands/commands.js` — verify all help text strings are updated
- `scripts/playtest.js` — update the help/usage text at the top of the file
- `docs/BOT-PLAYER.md` — update any command references

Be thorough — search for every old verb name in these documentation files. The manual is the player's canonical reference and must match the actual commands exactly.

---

## Phase 8: Final verification

### Prompt

Run the full verification suite:

1. `make check` — lint + all tests pass
2. `node scripts/playtest.js reset && node scripts/playtest.js "status"` — harness works with new verbs
3. `node scripts/playtest.js "target gateway"` — select renamed
4. `node scripts/playtest.js "probe"` — unchanged verb still works
5. `node scripts/bot-census.js --time F --money F --seeds 5` — bot runs successfully with renamed action IDs
6. Manually verify tab completion: confirm each hot-path command resolves with 1 keystroke (this requires browser testing)

Fix any failures found during verification.
