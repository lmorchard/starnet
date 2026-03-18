# Command Prefix Uniqueness Sweep — Spec

_Session: 2026-03-18-1102 | Issue: #73_

## Problem

Several core gameplay commands share prefixes, making tab completion slow under time pressure (trace countdown, ICE pursuit). The `cancel-*` family requires 8+ keystrokes. `exploit`, `eject`, and `extract-*` all collide at `e`. `select`, `status`, `store`, `scan-*`, `subvert` all collide at `s`.

## Goal

Every hot-path command should resolve to a unique match with a single keystroke + tab. Lower-pressure commands can tolerate 2-3 keystrokes.

## Rename Table

### Hot path (1-keystroke prefix)

| Current | New | Prefix | Notes |
|---------|-----|--------|-------|
| `probe` | `probe` | `p` | Unchanged |
| `exploit` | `xploit` | `x` | Frees `e` for eject |
| `read` | `dump` | `d` | "Dump the node" — better flavor |
| `loot` | `fetch` | `f` | "Fetch the data" |
| `select` | `target` | `t` | "Target a node" |
| `deselect` | `untarget` | `u` | Follows from target |
| `jackout` | `jackout` | `j` | Unchanged |
| `eject` | `eject` | `e` | Clean now that exploit→xploit |
| `cancel-probe`, `cancel-exploit`, `cancel-read`, `cancel-loot` | `abort` | `a` | Unified — cancels whatever timed action is in progress |

### Low pressure (2-3 keystroke prefix OK)

| Current | New | Prefix | Notes |
|---------|-----|--------|-------|
| `status` | `status` | `s` | Clean now that select→target |
| `store` | `darknet` | `da` | More diegetic |
| `buy` | `buy` | `b` | Unchanged |
| `reboot` | `reboot` | `re` | Clean after reconfigure/recalibrate renamed |
| `reconfigure` | `corrupt` | `c` | "Corrupt the IDS" |
| `recalibrate` | `spoof` | `sp` | "Spoof the sensor" |
| `log` | `log` | `l` | Clean now that loot→fetch |
| `help` | `help` | `h` | Unchanged |
| `cheat` | `cheat` | `ch` | Unchanged |
| `actions` | `actions` | `ac` | Unchanged |

### Not in scope

Dynamic set-piece actions (`activate`, `align`, `subvert`, `disarm`, `blind`, `bypass`, `crack-vault`, `extract-key`, `extract-token`, `muffle`, `neutralize`, `scan-lock`, `scan-vault`, `unlock-vault`) are contextual and only appear when a specific puzzle node is targeted. Leave as-is for now.

`cancel-trace` remains a node action on the security monitor, not part of the unified `abort` command. `abort` only cancels the player's own timed actions (probe, exploit, dump, fetch).

## Abort behavior

`abort` replaces the four `cancel-*` commands with a single verb. It checks for an active timed action (probe, exploit, read/dump, loot/fetch) and cancels it. If nothing is in progress, it's a no-op with a log message.

## Affected systems

- **Console command registry** (`js/core/console-commands/commands.js`) — rename verbs
- **Node-graph action IDs** (`data/biomes/corporate-pieces.js`, node type definitions) — rename action IDs where they match changed verbs
- **Action dispatcher / context** — update action ID references
- **Tab completion** — should work automatically once verbs change
- **Log messages** — update any hardcoded verb references in log output
- **MANUAL.md** — update command reference and node actions sections
- **Bot player** — update any action ID references in bot strategy
- **Playtest harness** — update command dispatch
- **Tests** — update verb/action ID references

## Future work (separate issue)

**Player-defined command aliases** — allow players to supply custom aliases in a preferences file, mapping their own short forms to canonical command verbs. Decouples personal ergonomics from the default naming scheme.
