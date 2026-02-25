# Notes: LAN Dungeon Prototype — Session 2

_Session: 2026-02-24-1615-lan-dungeon-prototype-2_

## What Was Built

All six planned phases were completed:

1. **Console UI skeleton** — `#log-pane` with `#log-entries` + `#console-input`, command history (arrow keys), submit dispatch, unknown command error.
2. **Core game commands** — `probe`, `exploit`, `read`, `loot`, `reconfigure`, `jackout`, `select`. Node/card resolution by id or case-insensitive label prefix with ambiguity handling.
3. **Click-to-command echo** — Every click dispatches the equivalent command text to the log. `fromConsole: true` flag prevents double-logging.
4. **Tab completion** — Verb completion, node id/label completion, card name completion for `exploit`. Unix-style multi-match listing.
5. **Staged vulnerability chaining** — `hidden`/`unlockedBy` fields on vuln objects. Successful exploit of matching type reveals deeper attack surface. Demonstrated on `fileserver` (path-traversal → kernel-exploit) and `cryptovault` (side-channel → hardware-backdoor).
6. **Cheat commands** — `cheat give card [rarity]`, `cheat give cash <n>`, `cheat set alert <level>`, `cheat own <node>`. Sets `isCheating` flag. HUD shows `// CHEAT` indicator when flag is set. Cheat code isolated in `js/cheats.js`.

Post-plan additions (bugs found during playtesting):

- **Persistent hand pane** — `#sidebar-hand` split from `#sidebar-node` so the exploit hand is always visible.
- **`select` command** — console equivalent of clicking a node.
- **Log direction + scrollability** — `addLog` changed from `unshift` to `push`; `#log-entries` changed from `overflow: hidden` to `overflow-y: auto`; `syncLogPane` scrolls to bottom after render.
- **Hand pane visibility bug** — `max-height: 40%` collapsed on flex children in some viewports. Fixed to `max-height: 40vh`.

---

## What Went Well

- **Event-driven architecture paid off immediately.** Console commands dispatching the same `starnet:action:*` events as clicks meant zero duplication of game logic. Adding the console didn't touch `state.js` at all for the action paths — only for the log API.
- **Lazy import of `cheats.js`** kept cheat code cleanly isolated. It doesn't load at all unless a `cheat` command is typed.
- **Staged vuln mechanic landed exactly as planned.** The data model (hidden + unlockedBy) was minimal and the unlock logic in `launchExploit` was a handful of lines.
- **Playwright playtesting was genuinely useful.** The console made it easier for me to exercise the game state quickly without wrestling with the click UI.

---

## Divergences from Plan

- **`addLogEntry` export**: Plan said to rename the private `addLog` to `addLogEntry`. Instead, kept private `addLog` and added a separate public `addLogEntry` that calls `addLog` then emits. Cleaner separation — internal callers don't need to emit themselves.
- **Persistent hand pane** was not in the original plan. Emerged from playtesting — the hand vanishing when a node was selected was immediately disorienting.
- **`select` command** was not planned. Added after noticing there was no console equivalent for node selection.
- **Log direction** was not explicitly planned as a fix — the log was already in the wrong direction from session 1 but it wasn't noticed until the console made log behavior more visible.

---

## Technical Insights

- `max-height: %` on a flex child can silently collapse if the flex container doesn't have a definite height. `vh` units are always definite. **Rule: use `vh`/`vh`/`px` for max-height on flex children when the container height is defined by the viewport, not the content.**
- Keeping `fromConsole: true` on dispatched events as a guard flag is a clean pattern for any multi-input UI that shares a single event bus.
- Tab completion state is entirely derivable from the current input string + game state. No extra state needed.
- Staged vulnerabilities as a chaining mechanic work well for teaching the two-step escalation: first foothold reveals the deeper attack surface, which then enables full ownership. This creates a natural pacing rhythm.

---

## Bugs Found / Fixed

| Bug | Root Cause | Fix |
|---|---|---|
| Hidden vulns included in combat resolution | `combat.js` filtered only `!patched`, not `!hidden` | Added `&& !v.hidden` to `knownVulns` filter |
| Hand pane collapsed when node selected | `max-height: 40%` on flex child with non-definite container | Changed to `max-height: 40vh` |
| Log scroll direction wrong | `addLog` used `unshift` (newest at top) | Changed to `push`, trim from front, scroll to bottom |
| Log not scrollable with mouse wheel | `#log-entries` had `overflow: hidden` | Changed to `overflow-y: auto` |
| Match highlights for hidden vulns in card render | Vuln match check didn't exclude hidden entries | Added `!v.hidden` filter in `renderExploitCard` |

---

## Post-Retro: Playtesting Pass (continuation session)

A second round of work in the same session, covering bugs surfaced by Playwright playtesting plus three UX improvements. Four commits beyond the original retro.

### Bugs Fixed

| Bug | Root Cause | Fix |
|---|---|---|
| Hand disappears + exploit mode broken on EXPLOIT click | `exploit`/`escalate`/`cancel` handlers called `getElementById("sidebar")` (the whole `<aside>`), destroying both sidebar panes and leaving both IDs returning null on all subsequent renders | Changed to `getElementById("sidebar-node")`, added `syncHandPane` after each |
| Sidebar stuck in exploit-select after success | `sidebarMode = "node"` set after `launchExploit()` call; `emit()` inside `launchExploit` fires synchronously so `syncHud` ran while mode was still `"exploit-select"` | Moved `sidebarMode = "node"` to before the `launchExploit` call |
| Deeper network unreachable after compromising gateway | `revealNeighbors` only promotes `hidden→revealed`, never `revealed→accessible`; compromising gateway left all neighbors as `???` with no action buttons | Added `accessNeighbors()` to `state.js`: promotes revealed neighbors to accessible and calls `revealNeighbors` on each to expose the next ring. Called on `locked→compromised` transition and in `cheatOwn` |
| Multi-attempt exploit exiting to node view on failure | `sidebarMode = "node"` in the card click listener ran after `dispatchEvent()` returned (dispatch is synchronous), overwriting the correct mode the handler had already set | Removed `sidebarMode` assignment from the click listener entirely; handler solely owns mode decisions |
| Selecting new node while in exploit-select rendered new node in exploit-select view | `sidebarMode = "node"` in the select handler was set after `selectNode()`, but `selectNode` calls `emit()` synchronously | Moved mode reset before `selectNode()` call |

### Features Added

- **Multi-attempt exploit** (`clickMode` flag) — Failed exploit attempts stay in exploit-select so the player can keep trying cards. Only exits on success, cancel, or console use.
- **Exploit hand sort** (`cardSortKey`) — When a node is selected, matching cards (targetVulnTypes intersects probed vulns) float to the top. Disclosed cards sink to bottom. Display-only sort; state not mutated.
- **Auto-cancel on node select** — Selecting any node while a command is in progress (any `sidebarMode !== "node"`) logs "Action cancelled." and resets to node view before rendering the new selection.

### Technical Insights

- **`document.dispatchEvent()` is synchronous.** The entire handler runs and returns before the next line after the dispatch call executes. This caused two separate bugs in this session: mode assignments after dispatch calls that were actually too late. Rule: if a state variable controls rendering triggered by an emit inside a function you're about to call, set it *before* the call.
- **Element ID scoping matters when using `innerHTML`.** Setting `innerHTML` on a container destroys all child elements, invalidating any existing references to those children by ID. Using the wrong container element (`sidebar` vs `sidebar-node`) silently nuked both sidebar panes.

---

## Ideas for Next Session

- **Mission objectives** — right now it's freeform macguffin hunting. A mission briefing at game start with specific targets would add direction.
- **Node flavor text** — when you `read` a node, give it some cyberpunk lore flavor beyond "X item(s) found."
- **Alert consequence tuning** — the trace countdown (60s) feels long; consider tightening or making it a config.
- **Procedural or semi-procedural network** — the hand-crafted LAN is fine for prototyping, but variation between runs would help playtesting.
- **`help` command** — deferred from this session; now that commands are stable, a help listing would be useful.
- **Card restock / economy** — player has no way to get new cards mid-run except cheats. Consider a "buy card" action at certain node types.
- **Visual feedback for staged vuln reveal** — the log message is subtle; a pulse or flash on the node when deeper attack surface unlocks would be more satisfying.
