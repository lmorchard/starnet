# Plan: Timed Loot Action

## Files to create/modify

| File | Change |
|------|--------|
| `js/loot-exec.js` | **New** — loot timing lifecycle |
| `js/types.js` | Add `ActiveLoot`, `activeLoot` to GameState, event payloads, ActionContext methods |
| `js/state/player.js` | Add `setActiveLoot()` |
| `js/state/index.js` | Add `activeLoot: null` to initState |
| `js/timers.js` | Add `LOOT_EXTRACT` timer |
| `js/events.js` | Add `LOOT_EXTRACT_STARTED`, `LOOT_EXTRACT_CANCELLED` events |
| `js/action-context.js` | Replace `lootNode` with `startLoot`/`cancelLoot` |
| `js/node-actions.js` | Update `loot` action, add `cancel-loot` |
| `js/main.js` | Wire `TIMER.LOOT_EXTRACT` handler |
| `js/node-orchestration.js` | Remove `lootNode()` |
| `index.html` | Add `#loot-rings` SVG overlay |
| `js/graph.js` | Add ring animation (syncLootRings/clearLootRings) |
| `js/visual-renderer.js` | Track loot timing, wire events |
| `js/log-renderer.js` | Add log entries for start/cancel |
| `js/console.js` | Add `cancel-loot` command, update status |
| `scripts/playtest.js` | Wire timer, add event output |
| `tests/node-actions.test.js` | Update mock context and tests |

## Implementation steps

### Step 1: Types, state, timer, events

Same pattern as read. Add ActiveLoot type, activeLoot to GameState, setActiveLoot to player.js, LOOT_EXTRACT timer, LOOT_EXTRACT_STARTED/CANCELLED events, event payload types.

### Step 2: Create loot-exec.js + wire

New file mirroring read-exec.js. Duration table, startLoot, cancelLoot, handleLootExtractTimer. The timer handler moves the lootNode logic from node-orchestration.js.

Wire into action-context.js (replace lootNode with startLoot/cancelLoot), node-actions.js (update loot action, add cancel-loot), main.js (timer handler), playtest.js (timer + events).

Remove lootNode from node-orchestration.js.

### Step 3: SVG overlay + ring animation

Add #loot-rings SVG to index.html. Implement ring animation in graph.js using setInterval that spawns ring `<circle>` elements which grow from 0 to reticle radius then get removed. Random stroke-width per ring.

### Step 4: Visual renderer + log + console

Wire visual-renderer for loot timing (same pattern as read). Log entries for start/cancel. Console cancel-loot command, status summary shows active loot. Update tests.

### Step 5: Verify

make check, playtest harness verification, browser test.
