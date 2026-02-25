# Plan: LAN Dungeon Prototype — Session 3

_Session: 2026-02-24-1728-lan-dungeon-3_

## Overview

Four features in order of dependency:
1. **Wheel zoom speed** — trivial, no dependencies
2. **Mission state model** — data layer, no UI yet
3. **Mission briefing UI** — depends on mission state
4. **Visual juice** — node flash utility + log styling
5. **Exploit/unlock flash** — depends on flash utility
6. **Node reveal pan + flash** — depends on flash utility, reworks `syncGraph`

---

## Step 1 — Wheel zoom speed

**Context:** `graph.js` initializes Cytoscape with no `wheelSensitivity` set, defaulting to `1.0` which scrolls too fast.

**Changes:** `js/graph.js`

In the `cytoscape({...})` init options, add:
```js
wheelSensitivity: 0.3,
```

That's the only change. The rest of the Cytoscape config is untouched.

**After this step:** Mouse wheel zoom is ~30% of the current speed.

---

## Step 2 — Mission state model

**Context:** `loot.js` generates and assigns macguffins after `initState` calls `assignMacguffins()`. State has no mission tracking yet.

**Changes:** `js/loot.js`, `js/state.js`

### `js/loot.js`

Add `flagMissionMacguffin(nodes)`:
- Collects all macguffins from all nodes (flatten `node.macguffins`)
- Picks one at random
- Multiplies its `cashValue` by 10
- Sets `isMission: true` on it
- Returns `{ id, name }` (used by `initState` to record mission target)

Export it.

### `js/state.js`

Import `flagMissionMacguffin` from `loot.js`.

In `initState()`, after `assignMacguffins(...)`:
```js
const missionTarget = flagMissionMacguffin(Object.values(nodes));
state.mission = {
  targetMacguffinId: missionTarget.id,
  targetName: missionTarget.name,
  complete: false,
};
```

Also add the mission briefing to the initial log (before `emit()`):
```js
addLog(`// MISSION: Retrieve ${missionTarget.name}`, "info");
```

In `lootNode()`, after marking macguffins collected and adding cash, check:
```js
if (!state.mission.complete) {
  const collected = uncollected.some((m) => m.id === state.mission.targetMacguffinId);
  if (collected) state.mission.complete = true;
}
```

In `endRun()`, the `state.mission.complete` flag is already set correctly — no change needed. `getState()` exposes it automatically.

**After this step:** Mission target macguffin is assigned, valued at 10x, tracked in state. No UI yet.

---

## Step 3 — Mission briefing UI

**Context:** State now has `state.mission`. The sidebar has two existing panes: `#sidebar-node` and `#sidebar-hand`. The end screen is in `main.js`'s `renderEndScreen()`. `index.html` needs a `#sidebar-mission` pane added.

**Changes:** `index.html`, `js/main.js`, `css/style.css`

### `index.html`

Add a `#sidebar-mission` div as the first child inside `<aside id="sidebar">`, before `#sidebar-node`. It will always be visible.

### `js/main.js`

Add `syncMissionPane(state)`:
```
- Gets #sidebar-mission
- Renders: section label "MISSION", target name, status line
  - If mission.complete: "STATUS: COMPLETE" (green)
  - Else if phase === 'ended' (caught): "STATUS: FAILED" (red)
  - Else: "STATUS: ACTIVE" (yellow)
```

Call `syncMissionPane(state)` from `syncHud()`.

In the macguffin rendering section of `renderSidebarNode()`, mark the mission macguffin:
- If `m.isMission && !m.collected`: show `★ MISSION TARGET` label with distinct styling
- The 10x value is already baked into `cashValue`, so it will display naturally

In `renderEndScreen()`, add a MISSION STATUS row to the stats block:
```
MISSION STATUS    COMPLETE  (green) | FAILED (red)
```

### `css/style.css`

Add styles for:
- `#sidebar-mission` — fixed-height pane with a divider, similar to hand pane header
- `.mission-status-active` — yellow
- `.mission-status-complete` — green
- `.mission-status-failed` — red
- `.mg-mission` — highlight styling for the mission macguffin item in node contents (e.g. gold/yellow accent)

**After this step:** Mission briefing is visible in sidebar and init log. Mission macguffin is marked in node contents. End screen shows mission outcome.

---

## Step 4 — Flash utility in graph.js

**Context:** Cytoscape supports inline style animation via `node.animate({ style: {...} }, { duration, complete })`. After animation, `node.removeStyle(props)` hands control back to class-based styles. No flash utility exists yet.

**Changes:** `js/graph.js`

Add and export `flashNode(nodeId, flashType)`:
- `flashType`: `'success'` | `'failure'` | `'reveal'`
- Gets the Cytoscape node via `cy.getElementById(nodeId)`
- Returns early if node not found or cy not initialized
- `'success'`: animate border-color → `#ffffff`, border-width → 4, duration 150ms; on complete animate back to `#00ffff`, width 2, duration 350ms; on complete `removeStyle`
- `'failure'`: animate border-color → `#ff4040`, border-width → 4, duration 150ms; on complete animate back to original border (use `#ff2020` for red-alert nodes, `#00ffff` default; simplest: just removeStyle on complete so class style wins), duration 350ms
- `'reveal'`: animate border-color → `#00ffff`, border-width → 2, background-color → `#0d2020`, duration 250ms; on complete animate border back to `#223333`, background back to `#0d0d14`, duration 400ms; on complete `removeStyle`

Keep the animations simple — they're decorative and will resolve cleanly since `removeStyle` restores class-driven appearance.

**After this step:** `flashNode` is available to import. Nothing calls it yet.

---

## Step 5 — Exploit/unlock flash + log line styling

**Context:** `launchExploit()` in `state.js` returns `result` (from `combat.js`). The `main.js` handler for `starnet:action:launch-exploit` already calls `launchExploit`. Log entries already use a `type` field but `success`/`failure` log types may lack CSS styling.

**Changes:** `js/state.js`, `js/main.js`, `css/style.css`

### `js/state.js`

In `launchExploit()`, augment the returned result object:
```js
result.levelChanged = (result.success && /* access level advanced */);
```
Specifically: set `result.nodeId = nodeId` and `result.levelChanged = true` when the access level transitions (locked→compromised or compromised→owned). Since `result` comes from `resolveExploit` in `combat.js`, add these fields to the object returned from `launchExploit` (not from combat.js — just tack them on before `return result`).

### `js/main.js`

Import `flashNode` from `./graph.js`.

In the `starnet:action:launch-exploit` handler, after the `launchExploit()` call:
```js
if (result) {
  flashNode(nodeId, result.success ? 'success' : 'failure');
}
```

The `launchExploit` emit already fires synchronously (triggering syncGraph / updateNodeStyle) before this line runs, so the flash runs after the style sync. That's correct — flash overlays the already-updated class styles, then removes itself.

### `css/style.css`

Check existing `.log-success` and `.log-failure` rules. If absent or only partially styled:
- `.log-entry.log-success`: color distinct bright green (e.g. `#7fff7f` or `#00ff41` bold) — visually distinct from the default `--green` body text
- `.log-entry.log-failure`: color red (`#ff4040`)

These types are already written to the log in `state.js` (`addLog(result.flavor, "success")` etc.) so this is purely CSS.

**After this step:** Exploit attempts flash the node and produce styled log lines.

---

## Step 6 — Node reveal pan + flash

**Context:** `syncGraph()` in `main.js` currently calls `cy.fit()` on every state change when no node is selected — this is too aggressive and will conflict with the new nudge behavior. Need to replace it with: detect newly visible nodes, flash them, and nudge the viewport only if needed.

**Changes:** `js/main.js`

Rework `syncGraph(state)`:

```js
function syncGraph(state) {
  // Snapshot which nodes are currently hidden before applying updates
  const cy = getCy(); // import getCy at top of file alongside initGraph
  const prevHiddenIds = cy
    ? new Set(cy.nodes('.hidden').map((n) => n.id()))
    : new Set();

  Object.values(state.nodes).forEach((n) => updateNodeStyle(n.id, n));

  if (!cy) return;

  // Find nodes that just became visible
  const newlyVisible = cy.nodes().filter(
    (n) => prevHiddenIds.has(n.id()) && !n.hasClass('hidden')
  );

  if (newlyVisible.length > 0) {
    // Flash each newly visible node
    newlyVisible.forEach((n) => flashNode(n.id(), 'reveal'));

    // Nudge viewport only if any newly visible node is outside current extent
    const extent = cy.extent();
    const anyOutOfView = newlyVisible.some((n) => {
      const pos = n.position();
      return pos.x < extent.x1 || pos.x > extent.x2 ||
             pos.y < extent.y1 || pos.y > extent.y2;
    });

    if (anyOutOfView) {
      cy.animate({
        fit: { eles: cy.nodes('.accessible, .revealed'), padding: 60 },
        duration: 500,
      });
    }
  }
}
```

Remove the old `import("./graph.js").then(...)` dynamic import and `cy.fit()` call. Import `getCy` statically at the top of the file alongside the existing `initGraph, updateNodeStyle` import, and also import `flashNode`.

**After this step:** Newly revealed nodes flash with a cyan reveal pulse and the viewport nudges to include them when they're off-screen. All four features are complete.

---

## Acceptance Checklist

- [ ] Wheel zoom speed is noticeably slower (~30% of original)
- [ ] Mission target macguffin is assigned at init with 10x base value
- [ ] Mission name appears in sidebar MISSION pane and init console log
- [ ] Mission macguffin is marked `★ MISSION TARGET` in node contents
- [ ] End screen shows MISSION COMPLETE (green) or MISSION FAILED (red)
- [ ] Exploit success: cyan→white node flash + bright green log line
- [ ] Exploit failure: red node flash + red log line
- [ ] Node unlock (access level change): same success flash
- [ ] Newly revealed nodes: cyan reveal pulse flash
- [ ] Newly revealed nodes off-screen: animated pan/zoom nudge to fit them in view
