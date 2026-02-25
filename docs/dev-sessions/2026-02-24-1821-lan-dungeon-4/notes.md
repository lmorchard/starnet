# Notes: LAN Dungeon — Session 4 (ICE / Adversarial Presence)

_Session: 2026-02-24-1821-lan-dungeon-4_
_Branch: lan-dungeon-4_

---

## Recap

Designed and implemented a full adversarial ICE (Intrusion Countermeasure Electronics) system. ICE is a roaming entity that moves through the network graph and can detect the player based on their selected node. Key features delivered:

- **Centralized timer system** (`js/timers.js`) — replaces ad-hoc setInterval/setTimeout; all timed game events flow through a single Map-based tracker with DOM event dispatch
- **Deselect action** — console command, sidebar button, and click-to-deselect on graph; player can remove presence from the network defensively
- **ICE state model** — two-position entity (resident node + attention focus), grade-based behavior, disturbance tracking
- **ICE movement AI** — grade D/F: random walk; C/B: disturbance tracking with BFS; A/S: direct pathfinding to player
- **ICE graph rendering** — fog-of-war visibility (only on compromised/owned nodes), animated star-shape Cytoscape overlay, trace-back path to resident node (BFS through adjacency, waypoints revealed), docked pulsing state
- **EJECT action** — pushes ICE attention to random adjacent node (contextual, owned + ICE present)
- **REBOOT action** — sends ICE home, deselects player, locks node 1–3s, ICE and player both blocked from the rebooting node
- **ICE dwell countdown** — visible timer in sidebar (`⚠ ICE DETECTION: Ns`), cancellable by deselect

---

## Divergences from Plan

**None significant.** The plan was detailed enough that execution was essentially mechanical. One minor order fix: the plan had `addLogEntry` before `scheduleEvent` in `checkIceDetection`, but since `addLogEntry` triggers `emit()` → re-render → `getVisibleTimers()`, the countdown wouldn't appear until the next statechange. Fixed by swapping the order (schedule first, then log).

The plan also suggested BFS in `drawIceTrace()` by building an adjacency map from Cytoscape edges first, but the implementation iterates edges directly per BFS step. Minor implementation detail, equivalent result.

---

## Insights

**Timer ordering matters for UI rendering.** When `emit()` is embedded in `addLogEntry`, any state that needs to be present during that render must be set before calling it. Discovered this when the ICE detection countdown wasn't showing — the timer was scheduled after the emit. General lesson: prepare state, then emit.

**ICE as a Cytoscape overlay works cleanly.** Adding ICE as a dynamic `cy.add()` node (not in network data) with `ungrabify()` is a clean separation. The fog-of-war is handled purely by CSS display without touching node state, which is the right call — it keeps game state clean.

**"Schedule-before-log" becomes a pattern.** Anywhere a visible timer needs to show in the sidebar after being created, the `scheduleEvent` call must precede the log entry that triggers re-render. Worth documenting as a pattern.

**Grade C disturbance tracking is subtle.** Without any disturbances registered, grade C ICE does a random walk just like D/F — it only hunts once the player does something. This creates an interesting ramp-up dynamic where ICE gets smarter as the run progresses. Not explicitly designed that way; it's a happy side effect of the fallback-to-random behavior.

**Detection fires via existing alert propagation.** `triggerDetection` calls `propagateAlertEvent`, which means IDS subversion is already a partial defense against ICE — if the player subverted IDS nodes along the path from the ICE's attack vector, detection might not reach the security monitor. This emerged naturally without any new mechanics.

---

## Efficiency

The brainstorm + plan sessions (session context before this execution) were extremely effective at front-loading design decisions. By the time execution started, almost every implementation detail was pre-decided. Steps 1–6 each took one focused pass with no significant backtracking.

The only debugging step was the countdown visibility bug, caught during a quick browser test after Step 6.

---

## Process Improvements

- **Render-time ordering should be a checklist item.** Before finalizing any code that schedules a visible timer and then logs, verify the order. Could add a comment convention: `// must schedule before emit`.
- **The cheat system made testing fast.** `cheat own gateway` + waiting for ICE to naturally track a disturbance was a clean test path. The cheat system is proving its value.
- **Next time: consider adding a cheat to move ICE directly** (`cheat ice-move <node>`) for testing detection scenarios without waiting for ticks.

---

## Conversation Turns

This session was a continuation from a compacted context. The visible execution portion (post-context-summary) consisted of roughly 15–20 tool-call exchanges across all 6 implementation steps plus testing.

---

## Other Highlights

The visual result is genuinely tense. Seeing the ICE star materialize on the graph when it moves onto an owned node, with the trace-back path lighting up the path to its resident node in dashed magenta — and then `⚠ ICE DETECTION: 5s` appearing in the sidebar — is exactly the spatial threat feeling the spec was aiming for. The 5-second dwell timer at grade C creates real urgency without being unfair.

The system also composes with existing mechanics in satisfying unplanned ways:
- IDS subversion provides partial ICE defense (existing mechanic, new relevance)
- Owning the ICE resident node (using standard probe/exploit flow) permanently neutralizes it
- REBOOT doubles as both a panic button and a tactical tool for redirecting ICE movement

---

## Acceptance Criteria Review

All items from the spec checked off:

- [x] `js/timers.js` — scheduleEvent, scheduleRepeating, cancelEvent, cancelAllByType, clearAll, getVisibleTimers
- [x] All timers cleared on endRun
- [x] `deselect` console command + sidebar button + click-to-deselect on graph
- [x] ICE defined in network data; spawns at run start on random node
- [x] `state.ice` has residentNodeId, attentionNodeId, grade, active
- [x] `state.lastDisturbedNodeId` updated on probe and failed exploit
- [x] ICE moves each tick; behavior matches grade (random / disturbance / player-seeking)
- [x] Detection fires alert via propagateAlertEvent; dwell timer for slow ICE
- [x] Dwell timer cancelled on deselect
- [x] ICE visible on graph only when attention on compromised/owned node
- [x] Trace-back path shown (waypoints + edges) when attention on owned node
- [x] Resident node marked when trace-back active
- [x] ICE node animates between positions
- [x] EJECT action + console command
- [x] REBOOT action + console command; node offline 1–3s, ICE and player locked out
- [x] Rebooting node cannot be selected
- [x] Owning ICE's resident node disables ICE
- [x] ICE dwell countdown shown in sidebar

---

## Near-Future Iteration Topics

### Console as LLM Interface

The console log + command interface has been identified as a potential LLM legibility layer — sufficient for an AI agent to observe and play the game without the visual graph. Current state:

- `status` command dumps full game state in markdown
- All game events have (or should have) corresponding log entries
- All actions are issuable as console commands

**Potential next steps:**

1. **Typed event log**: Replace ad-hoc `addLogEntry` strings with a structured `logEvent(type, payload)` call that both renders a human-readable line and records a machine-readable event. Would enable an LLM to parse a clean event stream rather than scraping text.

2. **Formal log message conventions**: Define consistent prefixes/formats per event category (e.g. `ICE:`, `EXPLOIT:`, `ALERT:`, `NODE:`). Currently somewhat consistent but informal.

3. **LLM playtest harness**: A script that feeds `status` output + log to an LLM and reads back console commands. Would validate both game balance and the completeness of the text interface.

4. **Richer `status` subcommands**: e.g. `status ice`, `status hand`, `status node <id>` for targeted queries without full dump noise.

**Recommendation**: Don't formalize the event structure until building an actual LLM agent — requirements will clarify at that point. The current ad-hoc approach with consistent discipline (every visual event logged) is good enough for now. The `status` command is the main investment needed.

### Unified Game Event Bus (Visual + Log Forcing Function)

Currently, imperative game events (ICE movement, exploit resolution, alert escalation) produce two independent side effects: a log entry (via `addLogEntry` in state/ice modules) and a visual effect (via Cytoscape animations in `graph.js`). These are not explicitly linked — it's possible to add one without the other.

**Proposed architecture**: a `emitGameEvent(type, payload)` function that drives both simultaneously. Each event type registers a log formatter and an optional visual handler:

```js
emitGameEvent("ice:move", { fromId, toId });
// → formats: "// ICE: Gateway → Fileserver-1" into log
// → triggers: flashIcePath(fromId, toId) in graph
```

The key property: it is architecturally impossible to produce a visual event without simultaneously defining its log representation. This is the "forcing function" for LLM legibility.

**What needs unification** (imperative events with side effects):
- ICE movement, detection, dwell
- Exploit success/failure/disclosure
- Alert escalation, propagation
- Node access level changes
- Reboot start/complete, EJECT

**What doesn't need it** (idempotent state renders):
- `syncGraph` — reads state, updates Cytoscape classes; already correct by construction

**Tradeoffs**:
- Adds an indirection layer; currently the code is direct and readable
- Requires deciding where in the flow events are emitted (during mutation, or after?)
- Some events (exploit resolution) already have rich payload context available at mutation time — easy to unify. Others (graph flashes) are currently triggered from graph.js which doesn't know game semantics — would need restructuring.

**Recommendation**: Good candidate for a dedicated session once the game has more event types and the cost of the current approach is felt more clearly. The `status` command + "every event logged" discipline is the right interim step.
