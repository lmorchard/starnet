# Plan: Game Events & Console Redesign

_Session: 2026-02-25-1112-game-events-console-redesign_

---

## Overview

8-step migration. Each step leaves the game fully functional. No orphaned code between steps.

**Key design decisions baked into the plan:**

- `log:entry` is a special event in the catalog — during migration, `addLogEntry` emits this instead of writing to `state.log`. This avoids a `state.js → log-renderer.js` import (which would cause circularity). After the full migration, `addLogEntry` disappears from `state.js` and `log:entry` is only emitted by `console.js`/`cheats.js` for command echoing and error feedback.
- `state.log` is removed from state in Step 4. log-renderer.js owns the log buffer from that point.
- `sidebarMode` stays in `main.js` (it's action-wiring state, not render state). main.js passes it to visual-renderer's `syncSidebar(state, sidebarMode)` function.
- The `starnet:statechange` DOM event is replaced in Step 2 and removed. All event routing goes through `events.js` after that point.

---

## Step 1 — `js/events.js`: pub/sub infrastructure

**Builds on:** nothing — pure new module, no game logic.

**After this step:** `events.js` exists and is tested, but nothing uses it yet. The game is unchanged.

### Prompt

Create `js/events.js`. This module is the core of the new event architecture — a simple synchronous pub/sub system with no game knowledge.

Requirements:

- Export `emitEvent(type, payload)` — calls all registered handlers for `type` with `payload`, synchronously. Silently no-ops if no handlers registered.
- Export `on(type, handler)` — register a handler function for an event type. Multiple handlers per type are allowed.
- Export `off(type, handler)` — remove a specific handler for an event type.
- Internally, maintain a `Map<string, Set<Function>>` of handlers.
- Export a frozen `E` object (or `EVENTS` object) with string constants for every event type in the catalog. This is the authoritative list of all event types. Define all of the following:

```js
export const E = Object.freeze({
  STATE_CHANGED:        "state:changed",
  LOG_ENTRY:            "log:entry",

  RUN_STARTED:          "run:started",
  RUN_ENDED:            "run:ended",

  NODE_REVEALED:        "node:revealed",
  NODE_PROBED:          "node:probed",
  NODE_ACCESSED:        "node:accessed",
  NODE_ALERT_RAISED:    "node:alert-raised",
  NODE_READ:            "node:read",
  NODE_LOOTED:          "node:looted",
  NODE_RECONFIGURED:    "node:reconfigured",
  NODE_REBOOTING:       "node:rebooting",
  NODE_REBOOTED:        "node:rebooted",

  EXPLOIT_SUCCESS:      "exploit:success",
  EXPLOIT_FAILURE:      "exploit:failure",
  EXPLOIT_DISCLOSED:    "exploit:disclosed",
  EXPLOIT_PARTIAL_BURN: "exploit:partial-burn",
  EXPLOIT_SURFACE:      "exploit:surface-revealed",

  ALERT_GLOBAL_RAISED:  "alert:global-raised",
  ALERT_TRACE_STARTED:  "alert:trace-started",
  ALERT_PROPAGATED:     "alert:propagated",

  ICE_MOVED:            "ice:moved",
  ICE_DETECT_PENDING:   "ice:detect-pending",
  ICE_DETECTED:         "ice:detected",
  ICE_EJECTED:          "ice:ejected",
  ICE_REBOOTED:         "ice:rebooted",
  ICE_DISABLED:         "ice:disabled",

  MISSION_STARTED:      "mission:started",
  MISSION_COMPLETE:     "mission:complete",
});
```

No imports from any other game module. No side effects on import.

---

## Step 2 — Thread `state:changed` and `log:entry` through `events.js`

**Builds on:** Step 1 (`events.js` exists).

**After this step:** `starnet:statechange` DOM event is gone. All state updates and log entries flow through `events.js`. The game is fully functional.

### Prompt

Modify `js/state.js` and `js/main.js` to route state change notifications and log entries through the new `events.js` system.

**In `state.js`:**
- Import `{ emitEvent, E }` from `./events.js`
- Replace the `emit()` function body: instead of `document.dispatchEvent(new CustomEvent("starnet:statechange", ...))`, call `emitEvent(E.STATE_CHANGED, state)`. Keep `window._starnetState = state` for dev convenience.
- Replace the internal `addLog(text, type)` function body: instead of pushing to `state.log`, call `emitEvent(E.LOG_ENTRY, { text, type })`. The `state.log` array in the state object remains for now (will be removed in Step 4), but stop writing to it here.
- `addLogEntry(text, type)` remains exported and unchanged in signature (it calls `addLog` then `emit()` — keep this, callers don't change yet).

**In `main.js`:**
- Import `{ on, E }` from `./events.js`
- Replace `document.addEventListener("starnet:statechange", (evt) => { ... })` with `on(E.STATE_CHANGED, (state) => { ... })`. Note the handler now receives `state` directly as the payload, not `evt.detail`.
- Leave all `document.addEventListener("starnet:action:*", ...)` listeners unchanged — action events stay as DOM events.
- Remove the manual `document.dispatchEvent(new CustomEvent("starnet:statechange", ...))` at the bottom of `init()` — it's no longer needed since `initState` calls `emit()` which now routes through `events.js`.

Verify the game loads and plays correctly before proceeding.

---

## Step 3 — `js/visual-renderer.js`: extract all render logic from `main.js`

**Builds on:** Steps 1–2. `state:changed` is now the canonical render trigger.

**After this step:** `main.js` contains only init orchestration and action event wiring. All DOM rendering lives in `visual-renderer.js`. The game is fully functional.

### Prompt

Create `js/visual-renderer.js` and migrate all rendering logic out of `main.js`.

**Create `js/visual-renderer.js`:**
- Import `{ on, E }` from `./events.js`
- Import everything currently imported from `./graph.js` in main.js: `updateNodeStyle`, `getCy`, `flashNode`, `addIceNode`, `syncIceGraph`, `syncSelection`
- Import `{ getVisibleTimers }` from `./timers.js`
- Move these functions wholesale from `main.js` into `visual-renderer.js`:
  - `syncGraph(state)`
  - `syncHud(state)` — but remove the `syncLogPane(state.log)` call from it (log pane is handled separately)
  - `syncMissionPane(state)`
  - `syncHandPane(state)`
  - `renderSidebarNode(sidebarNode, node, state)` — but see note on sidebarMode below
  - `renderExploitSelect(sidebarNode, node)`
  - `renderExploitCard(card, selectedNode, index, isSelecting)`
  - `renderEndScreen(state)`
  - `renderIceTimers()`
  - `renderActions(node, state)`
  - `actionBtn(action, label, desc, stub)`
  - `wireActionButtons(node)`
  - `cardSortKey(card, node)`

- **sidebarMode**: `sidebarMode` variable stays in `main.js` (it's set by action event handlers). Export a `syncSidebar(state, sidebarMode)` function from `visual-renderer.js` that replaces the inline sidebar logic currently embedded in `syncHud`. `main.js` calls `syncSidebar(state, sidebarMode)` from its `state:changed` handler.

- Export `initVisualRenderer()` which registers the `state:changed` subscription and sets up the `run-again-btn` click handler (currently in `renderEndScreen`). Actually: keep the `run-again-btn` handler inside `renderEndScreen` as it does now (inline addEventListener after DOM insertion).

- Export `setSidebarMode(mode)` so action handlers in `main.js` can update sidebar state. Use it from main.js instead of directly setting the module-scoped variable.

- The `syncLogPane` function: move it to `visual-renderer.js` temporarily but wire it to receive log entries from `events.js` `LOG_ENTRY` events — subscribe in `initVisualRenderer()` to `E.LOG_ENTRY` and append new entries to the log pane DOM. Also keep a `state:changed` subscription that re-renders if needed (this will be replaced in Step 4).

**Update `main.js`:**
- Import `{ initVisualRenderer, syncSidebar, setSidebarMode }` from `./visual-renderer.js`
- Call `initVisualRenderer()` in `init()` after graph setup
- In the `state:changed` handler: call `syncSidebar(state, sidebarMode)` and let visual-renderer handle everything else. Remove the direct calls to `syncGraph`, `syncHud` etc.
- Keep `sidebarMode` variable and all action event listeners in `main.js`. Replace direct `sidebarMode = "..."` assignments with `setSidebarMode(...)` calls.
- Remove all the render functions that have moved to `visual-renderer.js`.

Verify the game renders identically before and after.

---

## Step 4 — `js/log-renderer.js`: own the log buffer and log pane

**Builds on:** Steps 1–3. `LOG_ENTRY` events already flow through `events.js`.

**After this step:** `state.log` is removed from state. The log pane is exclusively owned by `log-renderer.js`. `console.js` and `cheats.js` import `addLogEntry` from `log-renderer` instead of `state.js`. Game is fully functional.

### Prompt

Create `js/log-renderer.js` to own the log buffer and log pane rendering.

**Create `js/log-renderer.js`:**
- Import `{ on, emitEvent, E }` from `./events.js`
- Maintain a private `logBuffer = []` array of `{ text, type }` entries. Cap at 200 entries.
- Export `initLogRenderer()` which:
  - Subscribes to `E.LOG_ENTRY`: appends `{ text, type }` to `logBuffer`, then calls `renderLogPane()`
- Export `addLogEntry(text, type = "info")` — calls `emitEvent(E.LOG_ENTRY, { text, type })`. This is the convenience wrapper for console.js and cheats.js.
- Export `getRecentLog(n = 20)` — returns last `n` entries from `logBuffer`.
- `renderLogPane()` (private) — reads `logBuffer`, renders to `#log-entries` DOM element. Same logic as the current `syncLogPane` in main.js. Scrolls to bottom.

**Update `js/state.js`:**
- The internal `addLog` function now only calls `emitEvent(E.LOG_ENTRY, { text, type })` — no longer pushes to any array.
- Remove `state.log` from the state object in `initState` and from the state shape entirely.
- Keep `addLogEntry` exported for now (callers will migrate in this step).

**Update `js/console.js`:**
- Remove import of `addLogEntry` from `./state.js`
- Import `addLogEntry` from `./log-renderer.js` instead

**Update `js/cheats.js`:**
- Same: remove addLogEntry from state.js import, add from log-renderer.js

**Update `js/visual-renderer.js`:**
- Remove the `LOG_ENTRY` subscription and `syncLogPane` function added in Step 3 (log-renderer now owns this)
- Remove the `state:changed` handler's log pane re-render path

**Update `js/main.js`:**
- Import `{ initLogRenderer }` from `./log-renderer.js`
- Call `initLogRenderer()` in `init()`

Verify log entries still appear correctly. Run the game through a full sequence: probe, exploit, loot, jackout.

---

## Step 5 — Typed events from `state.js`: node, exploit, and alert events

**Builds on:** Steps 1–4. Infrastructure is complete. `state.js` still uses `addLog` internally (which emits `LOG_ENTRY`), but we're replacing all those calls with typed events.

**After this step:** All node, exploit, and alert events flow as typed events. `state.js` has zero `addLog` calls remaining. log-renderer formats these events with `[PREFIX] narrative` strings.

### Prompt

Migrate all game event emissions in `js/state.js` from `addLog` calls to typed `emitEvent` calls. Simultaneously implement the log-renderer formatters for these events.

**In `js/state.js`:**
- Remove the internal `addLog(text, type)` function entirely. Remove `addLogEntry` export.
- For every game mutation, replace `addLog(...)` with `emitEvent(E.EVENT_TYPE, { ...payload })`. The full list:

  - `initState`: after mission assignment, emit `E.MISSION_STARTED` with `{ targetName }`. After `accessNode(startNode)`, emit `E.RUN_STARTED` with `{ state }`.
  - `probeNode`: emit `E.NODE_PROBED` with `{ nodeId, label: node.label }`. Emit `E.NODE_ALERT_RAISED` with `{ nodeId, label: node.label, prev: oldAlert, next: node.alertState }` if alert changed.
  - `setAccessLevel`: emit `E.NODE_ACCESSED` with `{ nodeId, label: node.label, prev, next: level }` when level changes.
  - `revealNeighbors` / `accessNode`: emit `E.NODE_REVEALED` with `{ nodeId, label }` for each newly-revealed node (where visibility was `"hidden"` before and is now `"revealed"` or `"accessible"`).
  - `raiseNodeAlert`: emit `E.NODE_ALERT_RAISED` with `{ nodeId, label, prev, next }` if level changed.
  - `raiseGlobalAlert`: emit `E.ALERT_GLOBAL_RAISED` with `{ prev, next: state.globalAlert }`.
  - `startTraceCountdown`: emit `E.ALERT_TRACE_STARTED` with `{ seconds: 60 }`.
  - `propagateAlertEvent`: for each monitor that gets escalated, emit `E.ALERT_PROPAGATED` with `{ fromNodeId, fromLabel: fromNode.label, toNodeId, toLabel: neighbor.label }`.
  - `launchExploit` success path: emit `E.EXPLOIT_SUCCESS` with `{ nodeId, label: node.label, exploitName: exploit.name, flavor: result.flavor, roll: result.roll, successChance: result.successChance, matchingVulns: result.matchingVulns }`. If staged vulnerabilities are revealed, emit `E.EXPLOIT_SURFACE` with `{ nodeId, label: node.label }`.
  - `launchExploit` failure path: emit `E.EXPLOIT_FAILURE` with `{ nodeId, label: node.label, exploitName: exploit.name, flavor: result.flavor, roll: result.roll, successChance: result.successChance, matchingVulns: result.matchingVulns }`. If full disclose: emit `E.EXPLOIT_DISCLOSED` with `{ exploitName: exploit.name }`. If partial burn: emit `E.EXPLOIT_PARTIAL_BURN` with `{ exploitName: exploit.name, usesRemaining: exploit.usesRemaining }`.
  - `readNode`: emit `E.NODE_READ` with `{ nodeId, label: node.label, macguffinCount: node.macguffins.length }`.
  - `lootNode`: emit `E.NODE_LOOTED` with `{ nodeId, label: node.label, items: uncollected.length, total }`. If mission complete: emit `E.MISSION_COMPLETE` with `{ targetName: state.mission.targetName }`.
  - `reconfigureNode`: emit `E.NODE_RECONFIGURED` with `{ nodeId, label: node.label }`.
  - `rebootNode`: emit `E.NODE_REBOOTING` with `{ nodeId, label: node.label, durationMs }` (capture durationMs before scheduleEvent).
  - `completeReboot`: emit `E.NODE_REBOOTED` with `{ nodeId, label: node.label }`.
  - `endRun`: emit `E.RUN_ENDED` with `{ outcome: state.runOutcome }`.
  - `disableIce`: emit `E.ICE_DISABLED` with `{}`.

  Keep all `emit()` calls (the state:changed dispatch). Only remove `addLog` calls.

  Note: `ejectIce` and `rebootIce` will be handled in Step 6 alongside ice.js.

**In `js/log-renderer.js`:**
Add subscriptions in `initLogRenderer()` for all events emitted in this step. Use the `[PREFIX] narrative` format throughout:

```js
on(E.NODE_PROBED,       ({ label }) => add(`[NODE] ${label}: vulnerabilities scanned.`, "info"));
on(E.NODE_ACCESSED,     ({ label, prev, next }) => add(`[NODE] ${label}: access level ${prev} → ${next}.`, "success"));
on(E.NODE_ALERT_RAISED, ({ label, prev, next }) => add(`[NODE] ${label}: alert ${prev} → ${next}.`, "error"));
on(E.NODE_REVEALED,     ({ label }) => add(`[NODE] Signal detected: ${label}.`, "info"));
on(E.NODE_READ,         ({ label, macguffinCount }) =>
  add(macguffinCount > 0
    ? `[NODE] ${label}: ${macguffinCount} item(s) found.`
    : `[NODE] ${label}: nothing of value found.`, "info"));
on(E.NODE_LOOTED,       ({ label, items, total }) => add(`[NODE] ${label}: looted ${items} item(s). +¥${total.toLocaleString()}`, "success"));
on(E.NODE_RECONFIGURED, ({ label }) => add(`[NODE] ${label}: event forwarding disabled.`, "success"));
on(E.NODE_REBOOTING,    ({ label }) => add(`[NODE] ${label}: REBOOTING — offline temporarily.`, "info"));
on(E.NODE_REBOOTED,     ({ label }) => add(`[NODE] ${label}: back online.`, "info"));

on(E.EXPLOIT_SUCCESS,   ({ label, exploitName, flavor, roll, successChance, matchingVulns }) => {
  add(`[EXPLOIT] ${label} — ${flavor}`, "success");
  add(`[EXPLOIT] Roll: ${roll} vs ${successChance}%${matchingVulns.length > 0 ? " (vuln match)" : ""}`, "meta");
});
on(E.EXPLOIT_FAILURE,   ({ label, exploitName, flavor, roll, successChance, matchingVulns }) => {
  add(`[EXPLOIT] ${label} — ${flavor}`, "error");
  add(`[EXPLOIT] Roll: ${roll} vs ${successChance}%${matchingVulns.length > 0 ? " (vuln match)" : ""}`, "meta");
});
on(E.EXPLOIT_DISCLOSED,    ({ exploitName }) => add(`[EXPLOIT] ${exploitName}: signature fully disclosed.`, "error"));
on(E.EXPLOIT_PARTIAL_BURN, ({ exploitName, usesRemaining }) =>
  add(`[EXPLOIT] ${exploitName}: signature partially leaked — ${usesRemaining} use${usesRemaining !== 1 ? "s" : ""} remaining.`, "error"));
on(E.EXPLOIT_SURFACE,      ({ label }) => add(`[EXPLOIT] ${label}: deeper attack surface revealed.`, "success"));

on(E.ALERT_GLOBAL_RAISED,  ({ prev, next }) => add(`[ALERT] Global alert: ${prev.toUpperCase()} → ${next.toUpperCase()}`, "error"));
on(E.ALERT_TRACE_STARTED,  ({ seconds }) => add(`[ALERT] ⚠ TRACE INITIATED — ${seconds}s to disconnect.`, "error"));
on(E.ALERT_PROPAGATED,     ({ fromLabel, toLabel }) => add(`[ALERT] Event forwarded: ${fromLabel} → ${toLabel}`, "meta"));

on(E.MISSION_STARTED,  ({ targetName }) => add(`[MISSION] Objective: retrieve ${targetName}.`, "info"));
on(E.MISSION_COMPLETE, ({ targetName }) => add(`[MISSION] ★ Target acquired: ${targetName}.`, "success"));

on(E.RUN_STARTED,  () => add(`[SYS] Run initialized. Jack in.`, "meta"));
on(E.RUN_ENDED,    ({ outcome }) => add(`[SYS] Run ended: ${outcome === "caught" ? "TRACED — score forfeit." : "SUCCESS — disconnected clean."}`, outcome === "caught" ? "error" : "success"));
```

(Use a private `add(text, type)` helper inside log-renderer that calls `emitEvent(E.LOG_ENTRY, { text, type })`.)

**In `js/visual-renderer.js`:**
Add subscriptions in `initVisualRenderer()` for visual one-shot effects:
```js
on(E.EXPLOIT_SUCCESS, ({ nodeId }) => flashNode(nodeId, "success"));
on(E.EXPLOIT_FAILURE, ({ nodeId }) => flashNode(nodeId, "failure"));
on(E.NODE_REVEALED,   ({ nodeId }) => flashNode(nodeId, "reveal"));
on(E.NODE_ACCESSED,   ({ nodeId }) => flashNode(nodeId, "success"));
```

Remove the manual `flashNode` calls from `main.js`'s `launch-exploit` handler — they're now handled by the event subscription.

Also remove the `newlyVisible` flash logic from `syncGraph` in visual-renderer — `node:revealed` events handle that now. The `fit` animation on reveal can stay in the `NODE_REVEALED` handler (or remain in `syncGraph` as a one-time fit after revealing — use judgment here; keeping it in `syncGraph` checking for newly visible nodes is fine for now).

Verify: run a full game session. All log entries should appear with `[PREFIX]` format. Flash effects should work. No double-logging.

---

## Step 6 — Typed events from `ice.js` and ICE-related state mutations

**Builds on:** Step 5. All state.js events are typed. Now migrate ice.js.

**After this step:** All ICE events are typed. `ice.js` has zero `addLogEntry` calls. The ICE actions in `state.js` (`ejectIce`, `rebootIce`) also emit typed events.

### Prompt

Migrate `js/ice.js` to emit typed events instead of calling `addLogEntry`. Also handle the ICE-related state.js mutations that were deferred from Step 5.

**In `js/ice.js`:**
- Import `{ emitEvent, E }` from `./events.js`
- Remove import of `addLogEntry` from `./state.js`
- In `handleIceTick()`:
  - Replace the `addLogEntry("// ICE: ...")` call with `emitEvent(E.ICE_MOVED, { fromId, toId, fromLabel, toLabel, fromVisible, toVisible })`. Compute `fromLabel` and `toLabel` (using `???` for non-visible endpoints) and pass as payload fields.
- In `checkIceDetection()`:
  - Replace `addLogEntry("// ICE AT ...")` with `emitEvent(E.ICE_DETECT_PENDING, { nodeId, label: s.nodes[nodeId]?.label ?? nodeId, dwellMs })`.
- In `triggerDetection()`:
  - Replace `addLogEntry("// DETECTED ...")` with `emitEvent(E.ICE_DETECTED, { nodeId, label: s.nodes[nodeId]?.label ?? nodeId })`.

**In `js/state.js`:**
- `ejectIce()`: replace `addLog("ICE ejected...")` with `emitEvent(E.ICE_EJECTED, { fromId: state.ice.attentionNodeId, toId: target })`. (Compute `toId` = `target` before assigning.)
- `rebootNode()` / `rebootIce()`: `rebootIce` is called inside `rebootNode`. Emit `E.ICE_REBOOTED` with `{ residentNodeId: state.ice.residentNodeId, residentLabel: state.nodes[state.ice.residentNodeId]?.label ?? state.ice.residentNodeId }` from `rebootNode` after calling `rebootIce()`.
- `disableIce()`: already emits `E.ICE_DISABLED` from Step 5. ✓

**In `js/log-renderer.js`:**
Add ICE event subscriptions:
```js
on(E.ICE_MOVED, ({ fromLabel, toLabel, fromVisible, toVisible }) => {
  if (fromVisible || toVisible) {
    add(`[ICE] Moving: ${fromLabel} → ${toLabel}`, "error");
  }
});
on(E.ICE_DETECT_PENDING, ({ label, dwellMs }) =>
  add(`[ICE] ⚠ ${label} — disengage or eject (${Math.round(dwellMs/1000)}s)`, "error"));
on(E.ICE_DETECTED,    ({ label }) => add(`[ICE] ⚠ Detected at ${label} — signal locked.`, "error"));
on(E.ICE_EJECTED,     ({ fromId }) => add(`[ICE] Ejected from ${fromId}.`, "success"));
on(E.ICE_REBOOTED,    ({ residentLabel }) => add(`[ICE] Sent home: ${residentLabel}.`, "info"));
on(E.ICE_DISABLED,    () => add(`[ICE] Process terminated — threat neutralized.`, "success"));
```

**In `js/visual-renderer.js`:**
No new visual effects needed for ICE events at this point — ICE graph rendering is handled idempotently by `syncIceGraph` on `state:changed`.

Verify: play through ICE detection, eject, reboot, and disable scenarios. All log entries should use `[ICE]` prefix.

---

## Step 7 — Final cleanup: remove all legacy log calls, verify completeness

**Builds on:** Steps 5–6. All typed events are emitting. This step removes any remaining legacy code paths and ensures the event catalog is fully wired.

**After this step:** `state.js` and `ice.js` contain zero `addLog`/`addLogEntry` calls. `state.js` no longer exports `addLogEntry`. The spec's acceptance criteria for event coverage are met.

### Prompt

Audit and clean up all remaining legacy log infrastructure. Verify every event in the catalog is being emitted.

1. **Search for any remaining `addLog` or `addLogEntry` calls in `state.js` and `ice.js`.** There should be none after Steps 5–6. Remove any that remain, replacing with the appropriate typed event or eliminating if redundant.

2. **Remove `addLogEntry` export from `state.js`.** It should no longer be exported. Verify `console.js` and `cheats.js` import it from `log-renderer.js`.

3. **Verify `node:revealed` coverage.** Confirm that `revealNeighbors` and `accessNode` emit `NODE_REVEALED` for each newly-visible node. The previous flash logic in `syncGraph` for newly-revealed nodes should be removed (replaced by the `NODE_REVEALED` event subscription in visual-renderer).

4. **Verify `run:started` timing.** Confirm it emits after the full state is initialized (after ICE spawn, macguffin assignment, start node access). It should be the last call in `initState`, just before the final `emit()`.

5. **Remove `state.log` from state shape.** Confirm the `log: []` field in `initState` is gone. Check that no code reads `state.log` (the `status` command and `syncLogPane` should no longer reference it).

6. **Remove `syncLogPane` from `visual-renderer.js`** (it was migrated to `log-renderer.js` in Step 4 and should no longer exist in visual-renderer).

7. **Check for orphaned `window._starnetState.log`** — since `state.log` is removed, update the dev note comment in `emit()` if needed.

8. **Scan `main.js` for any remaining render logic** — there should be none. Only init calls, action event listeners, and timer event listeners.

9. **Play a complete run** from start to jackout, exercising: probe, multiple exploits (success + failure), loot, IDS reconfigure, ICE encounter (detect, eject, reboot), global alert escalation, mission complete, jackout. Verify the log reads cleanly with consistent `[PREFIX]` formatting throughout.

---

## Step 8 — Console commands: `help`, `status <noun>`, `log [n]`

**Builds on:** Steps 1–7. The full event system is operational. This step adds the new console commands.

**After this step:** All new console commands from the spec are implemented. `status` has subcommands. `help` lists all commands. `log` provides scrollback. The game is fully LLM-observable from the console.

### Prompt

Implement the new console commands in `js/console.js`.

**Add `log` to the `VERBS` list** for tab completion.

**`cmdLog(args)`:**
- Import `{ getRecentLog }` from `./log-renderer.js`
- Parse optional `n` argument (integer, default 20, cap at 200)
- Call `getRecentLog(n)` and emit each entry as a `LOG_ENTRY` event (so it renders in the log pane). Use type `"meta"` for replayed entries to visually distinguish them, or preserve their original types. Prefix each line with a header like `-- LOG REPLAY (last ${n}) --` using type `"meta"`.

**`cmdHelp()`:**
Emit a formatted help listing via `addLogEntry`. Use consistent column widths for LLM parseability:

```
[SYS] Available commands:
  select <node>             Set active node (by id or label prefix)
  deselect                  Remove presence from network
  probe [node]              Reveal vulnerabilities. Raises local alert.
  exploit [node] <card>     Launch exploit. Card by index, id, or name prefix.
  escalate [node] <card>    Alias for exploit.
  read [node]               Scan node contents.
  loot [node]               Collect macguffins from owned node.
  reconfigure [node]        Disable IDS event forwarding.
  eject                     Push ICE attention to adjacent node.
  reboot [node]             Send ICE home. Node offline 1–3s.
  jackout                   Disconnect and end run.
  status [noun]             Game state. Nouns: ice hand node alert mission
  log [n]                   Replay last n log entries (default: 20).
  help                      Show this listing.
  cheat <args>              Cheat commands (see: cheat help).
```

**`cmdStatus(args)`** — extend the existing function to handle subcommands:
- `status` (no args): existing full dump behavior, preserved
- `status ice`: ICE section only — grade, active state, attention node, resident node, dwell timer if present
- `status hand`: hand section only — all cards with decay/uses/targets, in display sort order
- `status node <id>`: single node full detail — access, alert, probed status, all visible vulns (patched or not), macguffins (if read), ICE presence, rebooting state
- `status alert`: global alert, trace countdown, list of all IDS and security-monitor nodes with their alert states and forwarding state
- `status mission`: mission target name, collected status, cash value, whether mission macguffin has been looted

Each subcommand emits its lines via `addLogEntry` with type `"meta"`, same as the main `status`.

**Wire up in `handleCommand`:**
```js
case "log":   return cmdLog(args);
case "help":  return cmdHelp();
```

Update the `status` case to pass `args` through: `case "status": return cmdStatus(args);`

**Tab completion:** add `"log"` and `"help"` to `VERBS`. For `status`, add tab completion for the noun argument: `["ice", "hand", "node", "alert", "mission"]`.

Verify: type `help`, check output. Type `status ice`, `status hand`, `status node gateway`, `status alert`, `status mission`. Type `log 30`. All should produce clean, consistently formatted output suitable for LLM parsing.
