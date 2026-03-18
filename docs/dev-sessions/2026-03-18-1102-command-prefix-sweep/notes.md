# Command Prefix Uniqueness Sweep — Notes

_Session: 2026-03-18-1102 | Issue: #73_

## Execution Log

### Phase 0: Session docs committed

### Phase 1: `store` → `darknet`
- Changed verb in commands.js, updated help text and actions listing
- Fixed 2 test references (store→darknet in commands.test.js, completions.test.js)
- 600 tests pass

### Phase 2: `select` → `target`, `deselect` → `untarget`
- Updated global-actions.js, commands.js, dynamic-actions.js, action-context.js
- Updated visual-renderer.js (button class, action filter, emit)
- Updated main.js (background click handler)
- Updated CSS class `.deselect-btn` → `.untarget-btn`
- Updated bot player (execute.js, explore.js, evasion.js, puzzles.js)
- Updated playtest.js help text
- Rewrote completions.test.js and commands.test.js references
- Multi-match verb test needed reworking (prefix collision landscape changed)
- 600 tests pass

### Phase 3: `reconfigure` → `corrupt`, `recalibrate` → `spoof`
- Handled by subagent — 14 files updated
- Set-piece action IDs, game-types, game-ctx, alert.js, log-renderer, bot, tests
- 600 tests pass

### Phase 4: `read` → `dump`, `loot` → `fetch`
- Handled by subagent — 15 files updated
- Game-types, traits, game-ctx, corporate-pieces, console commands, visual-renderer, log-renderer, bot, tests
- Careful with "read" as common English word — only action ID string literals renamed
- 600 tests pass

### Phase 5: `exploit` → `xploit`
- Handled by subagent — 25 files updated (most-referenced verb)
- Combat.js, node-actions.js, action-context.js, ice.js, graph-bridge.js, console commands, UI renderers, bot, tests
- Internal attribute names `_ta_xploit_*` also renamed by subagent (from `_ta_exploit_*`)
- 600 tests pass

### Phase 6: cancel-* → unified `abort`
- Only phase with real logic changes
- Created single ABORT_ACTION with `any-of` requires (probing OR exploiting OR reading OR looting)
- New `abortTimedAction` ctx method detects active action and runs appropriate cleanup
- Removed 4 cancel action definitions (CANCEL_PROBE, CANCEL_EXPLOIT, CANCEL_DUMP, CANCEL_FETCH)
- Replaced 4 cancel entries in traits with single ABORT
- Updated ACTION_TEMPLATES export
- Updated bot execute.js to use "abort" instead of dynamic `cancel-${action}`
- Updated visual-renderer cancel overlay to emit "abort"
- Added `abortTimedAction` to CtxInterface typedef, nullCtx, and mockCtx
- 600 tests pass

### Phase 7: MANUAL.md + docs
- Handled by subagent — MANUAL.md, BOT-PLAYER.md, CLAUDE.md all updated
- Command reference tables, examples, and prose all reflect new verbs

### Phase 8: Verification
- `make check`: 600 tests, 0 failures, lint clean
- Playtest harness: `target gateway`, `probe`, `status` all work
- Bot player: `make bot-run` completes successfully

## Final hot-path prefix check

| Prefix | Command | Keystrokes |
|--------|---------|------------|
| `a` | `abort` | 1 |
| `d` | `dump` | 1 |
| `e` | `eject` | 1 |
| `f` | `fetch` | 1 |
| `j` | `jackout` | 1 |
| `p` | `probe` | 1 |
| `t` | `target` | 1 |
| `u` | `untarget` | 1 |
| `x` | `xploit` | 1 |

All hot-path commands resolve with a single keystroke + tab.

## Created during session
- Issue #81: Player-defined command aliases (future work)
