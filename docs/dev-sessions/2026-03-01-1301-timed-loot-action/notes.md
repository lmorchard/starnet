# Notes: Timed Loot Action

## Summary

Converted loot from instant to timed action with ripple ring animation. Follows the same pattern as probe and read conversions from previous sessions.

## Final parameters

- **Duration table**: S: 3s, A: 2.5s, B: 2s, C: 1.2s, D: 1s, F: 0.6s
- **Ring color**: `rgba(0,255,160)` — cyan-green, distinct from probe (cyan) and read (green)
- **Ring spawn rate**: every 200ms
- **Ring lifetime**: 800ms expand + fade
- **Ring thickness**: scales by remaining progress — fat at start (~60% of node radius), thins to hairlines as node is drained
- **Timer label**: "EXTRACTING"

## Iteration

1. Initial: random 1-3px thickness per ring (uniform throughout)
2. Les: rings should start small and get thicker as loot approaches completion
3. Implemented quadratic scaling from hairline to ~60% node radius
4. Les: reverse it — fat at start, thin at end, like the node is being emptied
5. Final: `remaining * remaining * r * 0.6` — draining visual

## Files changed

- `js/loot-exec.js` — **new** — startLoot, cancelLoot, handleLootExtractTimer
- `js/types.js` — ActiveLoot type, activeLoot on GameState, event payloads, ActionContext
- `js/state/player.js` — setActiveLoot setter
- `js/state/index.js` — activeLoot: null in initState
- `js/timers.js` — LOOT_EXTRACT timer
- `js/events.js` — LOOT_EXTRACT_STARTED/CANCELLED events
- `js/action-context.js` — startLoot/cancelLoot replace lootNode
- `js/node-actions.js` — updated loot action, added cancel-loot
- `js/main.js` — wired LOOT_EXTRACT timer
- `js/node-orchestration.js` — removed lootNode
- `index.html` — loot-rings SVG overlay
- `js/graph.js` — ring animation (syncLootRings/clearLootRings)
- `js/visual-renderer.js` — loot timing tracking + events
- `js/log-renderer.js` — log entries for start/cancel
- `js/console.js` — cancel-loot command, status display
- `scripts/playtest.js` — timer wiring + event output
- `tests/node-actions.test.js` — updated mock context + tests
- `MANUAL.md` — loot section, actions table, console commands
