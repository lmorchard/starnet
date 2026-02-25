# Plan: LAN Dungeon — Session 4 (ICE / Adversarial Presence)

_Session: 2026-02-24-1821-lan-dungeon-4_

## Overview

Six steps, each a clean commit. Each step leaves the game in a working state.

1. **Timer system** — foundation module used by all subsequent steps
2. **Deselect** — small self-contained UX improvement, useful immediately
3. **ICE state model** — data shape, init, disturbance tracking, mutation functions
4. **ICE movement + detection** — tick loop, AI behaviors, dwell timer, alert consequences
5. **ICE graph rendering** — fog of war, moving icon, trace-back path, rebooting state
6. **Player actions** — EJECT, REBOOT, console commands, dwell countdown in sidebar

---

## Step 1 — Timer system (`js/timers.js`)

**Context:** The codebase currently has one ad-hoc `setInterval` for the trace countdown in `state.js`. This session adds ICE movement ticks, a dwell/detection countdown, and a REBOOT lockout timer. Rather than scattering these, build a centralized timer module first.

**New file: `js/timers.js`**

```js
// Timer IDs are integers. Each entry tracks the native handle, type, payload, and
// optional visibility metadata for UI rendering.
const timers = new Map(); // timerId → { handle, type, payload, visible, label, startedAt, durationMs }
let nextId = 1;

export function scheduleEvent(type, delayMs, payload = {}, visibility = null) {
  // visibility: null (hidden) or { label } (shown in UI)
  const id = nextId++;
  const startedAt = Date.now();
  const handle = setTimeout(() => {
    timers.delete(id);
    document.dispatchEvent(new CustomEvent(`starnet:timer:${type}`, { detail: { ...payload, timerId: id } }));
  }, delayMs);
  timers.set(id, { handle, type, payload, startedAt, durationMs: delayMs, visible: !!visibility, label: visibility?.label ?? null });
  return id;
}

export function scheduleRepeating(type, intervalMs, payload = {}) {
  const id = nextId++;
  const handle = setInterval(() => {
    document.dispatchEvent(new CustomEvent(`starnet:timer:${type}`, { detail: { ...payload, timerId: id } }));
  }, intervalMs);
  timers.set(id, { handle, type, payload, startedAt: Date.now(), durationMs: intervalMs, visible: false, label: null, repeating: true });
  return id;
}

export function cancelEvent(id) {
  const entry = timers.get(id);
  if (!entry) return;
  entry.repeating ? clearInterval(entry.handle) : clearTimeout(entry.handle);
  timers.delete(id);
}

export function cancelAllByType(type) {
  for (const [id, entry] of timers) {
    if (entry.type === type) {
      entry.repeating ? clearInterval(entry.handle) : clearTimeout(entry.handle);
      timers.delete(id);
    }
  }
}

export function clearAll() {
  for (const [id, entry] of timers) {
    entry.repeating ? clearInterval(entry.handle) : clearTimeout(entry.handle);
  }
  timers.clear();
}

export function getVisibleTimers() {
  const now = Date.now();
  return [...timers.values()]
    .filter((t) => t.visible)
    .map((t) => ({
      label: t.label,
      remaining: Math.max(0, Math.ceil((t.durationMs - (now - t.startedAt)) / 1000)),
    }));
}
```

**Wire into existing code:**
- In `state.js`: import `clearAll` from `./timers.js`; call `clearAll()` at the top of `endRun()` before mutating phase.
- In `main.js`: import `getVisibleTimers` from `./timers.js` — will be used in later steps for countdown display. No handlers needed yet.

**After this step:** Timer infrastructure exists. No visible game change.

---

## Step 2 — Deselect action

**Context:** Player presence is the selected node. Deselecting is a primary defensive move against ICE. Currently there's no way to clear selection without selecting a different node.

**`js/state.js`**

Add `deselectNode()` export:
```js
export function deselectNode() {
  state.selectedNodeId = null;
  emit();
}
```

**`js/main.js`**

- Import `deselectNode` from `./state.js`.
- Add listener for `starnet:action:deselect`:
  ```js
  document.addEventListener("starnet:action:deselect", () => {
    deselectNode();
  });
  ```
- In `onNodeClick(nodeId)`: if the clicked node is already selected, dispatch `starnet:action:deselect` instead of `starnet:action:select`.
- In `renderSidebarNode()`: add a `[ DESELECT ]` button to the node header area (before or after the type/label). Wire it to dispatch `starnet:action:deselect`. It appears whenever any node is selected (all access levels).
- In `wireActionButtons()`: the deselect button is in the header, not the actions list — wire it separately after DOM insertion in `renderSidebarNode()`.

**`js/console.js`**

- Add `"deselect"` to `VERBS`.
- Add `case "deselect": return cmdDeselect();` to `handleCommand`.
- Add `function cmdDeselect() { dispatch("starnet:action:deselect"); }`.

**CSS:** Add minor styling for the deselect button in the node header — smaller/dimmer than action buttons, positioned top-right of the header or inline with node type/label.

**After this step:** `deselect` command works, clicking selected node deselects, sidebar shows button.

---

## Step 3 — ICE state model

**Context:** Establish ICE as a state object before wiring any movement or rendering. This step only touches data and state — no timers, no graph changes.

**`data/network.js`**

Add an `ice` entry to `NETWORK`:
```js
ice: {
  grade: "C",        // D/F=random, C/B=disturbance-tracking, A/S=player-seeking
  startNode: null,   // null = random at init
},
```

**`js/state.js`**

Extend `state` shape in `initState()`:

```js
state.ice = null;        // populated below if network defines ICE
state.lastDisturbedNodeId = null;
```

After `accessNode(networkData.startNode)`, init ICE if defined:
```js
if (networkData.ice) {
  const nodeIds = Object.keys(nodes);
  const residentNodeId = networkData.ice.startNode
    ?? nodeIds[Math.floor(Math.random() * nodeIds.length)];
  state.ice = {
    grade: networkData.ice.grade,
    residentNodeId,
    attentionNodeId: residentNodeId,  // starts at home
    active: true,
    dwellTimerId: null,               // set when detection window opens
  };
}
```

Track disturbances — update `probeNode()` and failed-exploit path in `launchExploit()`:
```js
state.lastDisturbedNodeId = nodeId;
```
(Add this line in `probeNode()` after `node.probed = true`, and in `launchExploit()` inside the failure branch before `emit()`.)

Add ICE mutation exports:

```js
export function moveIceAttention(nodeId) {
  if (!state.ice || !state.ice.active) return;
  state.ice.attentionNodeId = nodeId;
  emit();
}

export function ejectIce() {
  if (!state.ice || !state.ice.active) return;
  const neighbors = state.adjacency[state.ice.attentionNodeId] || [];
  if (neighbors.length === 0) return;
  const target = neighbors[Math.floor(Math.random() * neighbors.length)];
  state.ice.attentionNodeId = target;
  addLog("ICE ejected to adjacent node.", "success");
  emit();
}

export function rebootIce() {
  // Send ICE attention back to resident node (called by REBOOT action)
  if (!state.ice || !state.ice.active) return;
  state.ice.attentionNodeId = state.ice.residentNodeId;
  emit();
}

export function disableIce() {
  if (!state.ice) return;
  state.ice.active = false;
  addLog("// ICE PROCESS TERMINATED — threat neutralized.", "success");
  emit();
}
```

Check if owned node is ICE resident — add to `launchExploit()` after access level advance to `owned`:
```js
if (state.ice?.active && state.ice.residentNodeId === nodeId) {
  disableIce();
}
```

**After this step:** ICE state exists in the game state. No visible change yet. Can inspect via `window._starnetState.ice` in devtools.

---

## Step 4 — ICE movement + detection

**Context:** Wire the timer system to ICE movement and detection. After this step ICE moves invisibly through the graph and can trigger alert escalation — fully playable but not yet visible.

**`js/ice.js`** (new file — ICE AI logic, imported by main.js)

```js
import { getState, moveIceAttention, deselectNode, addLogEntry } from "./state.js";
import { propagateAlertEvent } from "./state.js";
import { scheduleEvent, scheduleRepeating, cancelAllByType } from "./timers.js";

// Grade → movement interval (ms)
const MOVE_INTERVALS = { S: 2500, A: 3000, B: 4500, C: 5000, D: 7000, F: 8000 };

// Grade → dwell time before detection (ms); null = instant
const DWELL_TIMES = { S: null, A: null, B: 3500, C: 4500, D: 9000, F: 10000 };

export function startIce() {
  const s = getState();
  if (!s.ice || !s.ice.active) return;
  const interval = MOVE_INTERVALS[s.ice.grade] ?? 6000;
  scheduleRepeating("ice-move", interval);
}

export function stopIce() {
  cancelAllByType("ice-move");
  cancelAllByType("ice-detect");
}

// BFS: shortest path from src to dst through adjacency. Returns next hop or null.
function nextHopToward(src, dst, adjacency) {
  if (src === dst) return null;
  const visited = new Set([src]);
  const queue = [[src, []]];
  while (queue.length) {
    const [node, path] = queue.shift();
    for (const neighbor of (adjacency[node] || [])) {
      if (neighbor === dst) return path.length > 0 ? path[0] : neighbor;
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([neighbor, path.length === 0 ? [neighbor] : path]);
      }
    }
  }
  return null;
}

export function handleIceTick() {
  const s = getState();
  if (!s.ice || !s.ice.active || s.phase !== "playing") return;

  const { grade, attentionNodeId, residentNodeId } = s.ice;
  const neighbors = s.adjacency[attentionNodeId] || [];
  if (neighbors.length === 0) return;

  let nextNode;

  if (grade === "D" || grade === "F") {
    // Random walk
    nextNode = neighbors[Math.floor(Math.random() * neighbors.length)];
  } else if (grade === "C" || grade === "B") {
    // Move toward last disturbed node, fall back to random
    const target = s.lastDisturbedNodeId;
    nextNode = (target && target !== attentionNodeId)
      ? (nextHopToward(attentionNodeId, target, s.adjacency) ?? neighbors[Math.floor(Math.random() * neighbors.length)])
      : neighbors[Math.floor(Math.random() * neighbors.length)];
  } else {
    // A/S: bee-line to player's selected node, fall back to random
    const target = s.selectedNodeId;
    nextNode = (target && target !== attentionNodeId)
      ? (nextHopToward(attentionNodeId, target, s.adjacency) ?? neighbors[Math.floor(Math.random() * neighbors.length)])
      : neighbors[Math.floor(Math.random() * neighbors.length)];
  }

  moveIceAttention(nextNode);
  checkIceDetection(nextNode);
}

function checkIceDetection(nodeId) {
  const s = getState();
  if (!s.ice || !s.ice.active) return;
  if (s.selectedNodeId !== nodeId) return;

  const dwellMs = DWELL_TIMES[s.ice.grade];
  cancelAllByType("ice-detect");

  if (dwellMs === null) {
    // Instant detection
    triggerDetection(nodeId);
  } else {
    addLogEntry(`// ICE AT ${s.nodes[nodeId]?.label ?? nodeId} — DISENGAGE OR EJECT`, "error");
    const timerId = scheduleEvent("ice-detect", dwellMs, { nodeId }, { label: "ICE DETECTION" });
    s.ice.dwellTimerId = timerId;
  }
}

export function handleIceDetect({ nodeId }) {
  const s = getState();
  if (!s.ice?.active) return;
  // Only fire if player is still on that node
  if (s.selectedNodeId === nodeId) {
    triggerDetection(nodeId);
  }
}

function triggerDetection(nodeId) {
  addLogEntry("// DETECTED — ICE has locked your signal.", "error");
  propagateAlertEvent(nodeId);
}

export function cancelIceDwell() {
  cancelAllByType("ice-detect");
}
```

**`js/main.js`**

- Import `{ startIce, stopIce, handleIceTick, handleIceDetect, cancelIceDwell }` from `./ice.js`.
- After `initState()` call in `init()`, call `startIce()`.
- Add timer event listeners:
  ```js
  document.addEventListener("starnet:timer:ice-move", () => handleIceTick());
  document.addEventListener("starnet:timer:ice-detect", (evt) => handleIceDetect(evt.detail));
  ```
- In `starnet:action:deselect` handler, also call `cancelIceDwell()`.
- In `starnet:statechange` handler, if `state.phase === "ended"`, call `stopIce()`.

**After this step:** ICE moves through the graph invisibly. Failed exploits and probes attract disturbance-tracking ICE. Detection fires alert escalation when dwell timer expires. Console log shows ICE warnings.

---

## Step 5 — ICE graph rendering

**Context:** ICE now moves and detects. This step makes it visible, implements fog-of-war, and adds the trace-back path.

**`js/graph.js`**

Add stylesheet entries in `buildStylesheet()`:

```js
// ICE entity node
{ selector: "node.ice", style: {
  shape: "star", width: 28, height: 28,
  "background-color": "#1a0010",
  "border-color": "#ff00aa", "border-width": 2,
  label: "ICE", color: "#ff00aa",
  "font-size": 7, "font-weight": "bold",
  "text-valign": "bottom", "text-margin-y": 4,
  "z-index": 10,
}},
// ICE pulsing when on player's node
{ selector: "node.ice.docked", style: {
  "border-color": "#ff2020", "border-width": 4,
}},
// Trace-back waypoint nodes
{ selector: "node.ice-traced", style: {
  display: "element",
  shape: "ellipse", width: 20, height: 20,
  "background-color": "#150010",
  "border-color": "#660033", "border-width": 1,
  "border-style": "dashed",
  label: "???", color: "#440022", "font-size": 7,
  "text-valign": "bottom", "text-margin-y": 4,
}},
// ICE resident node marker
{ selector: "node.ice-resident", style: {
  "border-color": "#ff00aa", "border-width": 3,
}},
// Trace-back edges
{ selector: "edge.ice-trace", style: {
  display: "element",
  "line-color": "#440033",
  "line-style": "dashed",
  "target-arrow-shape": "none",
  width: 1, opacity: 0.6,
}},
```

Add exported functions:

```js
export function addIceNode() {
  if (!cy) return;
  if (cy.getElementById("ice-0").length > 0) return; // already added
  cy.add({ data: { id: "ice-0", label: "ICE" }, position: { x: 0, y: 0 }, classes: ["ice"] });
}

export function syncIceGraph(iceState, nodeStates) {
  if (!cy || !iceState) return;
  const iceNode = cy.getElementById("ice-0");
  if (!iceNode || iceNode.length === 0) return;

  if (!iceState.active) {
    iceNode.style("display", "none");
    clearIceTrace();
    return;
  }

  const attentionNode = cy.getElementById(iceState.attentionNodeId);
  if (!attentionNode || attentionNode.length === 0) return;

  const atNodeState = nodeStates[iceState.attentionNodeId];
  const isVisible = atNodeState?.accessLevel === "compromised" || atNodeState?.accessLevel === "owned";

  if (isVisible) {
    iceNode.style("display", "element");
    iceNode.animate({ position: attentionNode.position() }, { duration: 400 });
  } else {
    iceNode.style("display", "none");
  }

  // Docked pulse: ICE on player's selected node
  // (selectedNodeId passed in or checked externally — mark with class)
  // Handled by caller passing isDocked flag

  // Trace-back path
  const isOwned = atNodeState?.accessLevel === "owned";
  clearIceTrace();
  if (isVisible && isOwned && iceState.residentNodeId !== iceState.attentionNodeId) {
    drawIceTrace(iceState.attentionNodeId, iceState.residentNodeId, nodeStates);
  }
}

function clearIceTrace() {
  cy.nodes(".ice-traced").removeClass("ice-traced");
  cy.nodes(".ice-resident").removeClass("ice-resident");
  cy.edges(".ice-trace").removeClass("ice-trace");
}

function drawIceTrace(fromId, toId, nodeStates) {
  // BFS to find path from attention focus back to resident node
  const adjacency = {};
  cy.edges().forEach((e) => {
    const s = e.data("source"), t = e.data("target");
    if (!adjacency[s]) adjacency[s] = [];
    if (!adjacency[t]) adjacency[t] = [];
    adjacency[s].push(t);
    adjacency[t].push(s);
  });

  const visited = new Map([[fromId, null]]);
  const queue = [fromId];
  let found = false;
  while (queue.length && !found) {
    const cur = queue.shift();
    for (const nb of (adjacency[cur] || [])) {
      if (!visited.has(nb)) {
        visited.set(nb, cur);
        if (nb === toId) { found = true; break; }
        queue.push(nb);
      }
    }
  }
  if (!found) return;

  // Walk path from toId back to fromId
  let cur = toId;
  while (cur && cur !== fromId) {
    const cyNode = cy.getElementById(cur);
    if (cyNode.length > 0 && cyNode.hasClass("hidden")) {
      cyNode.addClass("ice-traced");
    }
    const prev = visited.get(cur);
    if (prev) {
      // Mark edge
      cy.edges().filter((e) =>
        (e.data("source") === prev && e.data("target") === cur) ||
        (e.data("source") === cur && e.data("target") === prev)
      ).addClass("ice-trace");
    }
    cur = prev;
  }
  cy.getElementById(toId).addClass("ice-resident");
}
```

**`js/main.js`**

- Import `{ addIceNode, syncIceGraph }` from `./graph.js`.
- After `initGraph()` call, call `addIceNode()`.
- In `syncGraph(state)`, after the existing node style updates, add:
  ```js
  if (state.ice) {
    syncIceGraph(state.ice, state.nodes);
    // Docked class: ICE on player's selected node
    const cy = getCy();
    const iceNode = cy?.getElementById("ice-0");
    if (iceNode?.length > 0) {
      const docked = state.ice.attentionNodeId === state.selectedNodeId;
      docked ? iceNode.addClass("docked") : iceNode.removeClass("docked");
    }
  }
  ```
- In `syncHud()`, add visible timer display. Replace the existing trace countdown block with a general visible-timer renderer that handles all visible timers (ICE detect + existing trace):
  ```js
  // Render visible timers (ice detection dwell, future timers)
  // (keep existing trace countdown logic for now; integrate later)
  ```
  For now: add ICE dwell countdown to `renderSidebarNode()` — if `getVisibleTimers()` has an entry with label "ICE DETECTION", show it above the actions section.

Also add `node.rebooting` visual state: add to `updateNodeStyle()`:
```js
node.removeClass("rebooting");
if (nodeState.rebooting) node.addClass("rebooting");
```
And stylesheet entry:
```js
{ selector: "node.rebooting", style: {
  "border-color": "#888800", "border-style": "dashed", opacity: 0.5,
}},
```

**After this step:** ICE is visible on the graph when it moves through compromised/owned nodes. Trace-back path shows waypoints. Docked state triggers visual pulse on ICE icon. Rebooting nodes dimmed.

---

## Step 6 — Player actions: EJECT, REBOOT, console commands

**Context:** Final step. Player can now fight back. Wire actions, add REBOOT timer, add countdown to sidebar.

**`js/state.js`**

Add `rebootNode(nodeId)`:
```js
import { scheduleEvent, cancelAllByType } from "./timers.js";  // add to existing import

export function rebootNode(nodeId) {
  const node = state.nodes[nodeId];
  if (!node || node.rebooting) return;

  // Send ICE attention home
  rebootIce();

  // Deselect
  state.selectedNodeId = null;

  // Lock node
  node.rebooting = true;
  addLog(`${node.label}: REBOOTING — node offline temporarily.`, "info");

  const duration = 1000 + Math.random() * 2000; // 1–3s
  scheduleEvent("reboot-complete", duration, { nodeId }, { label: `REBOOT: ${node.label}` });

  emit();
}
```

Add `completeReboot(nodeId)`:
```js
export function completeReboot(nodeId) {
  const node = state.nodes[nodeId];
  if (!node) return;
  node.rebooting = false;
  addLog(`${node.label}: back online.`, "info");
  emit();
}
```

Extend node state shape in `initState()` — add `rebooting: false` to each node.

Prevent selection of rebooting nodes — in `selectNode()`:
```js
export function selectNode(nodeId) {
  const node = state.nodes[nodeId];
  if (node?.rebooting) {
    addLog(`${node.label}: node is rebooting.`, "error");
    emit();
    return;
  }
  state.selectedNodeId = nodeId;
  emit();
}
```

ICE tick should skip rebooting nodes — in `ice.js` `handleIceTick()`, after computing `nextNode`:
```js
const s = getState();
if (s.nodes[nextNode]?.rebooting) {
  // Pick a different random neighbor instead
  const nonRebooting = neighbors.filter((n) => !s.nodes[n]?.rebooting);
  nextNode = nonRebooting.length > 0
    ? nonRebooting[Math.floor(Math.random() * nonRebooting.length)]
    : null;
  if (!nextNode) return;
}
```

**`js/main.js`**

Add timer event listener:
```js
document.addEventListener("starnet:timer:reboot-complete", (evt) => {
  completeReboot(evt.detail.nodeId);
});
```

Import `completeReboot` from `./state.js`.

Add action event listeners:
```js
document.addEventListener("starnet:action:eject", (evt) => {
  if (!evt.detail.fromConsole) addLogEntry(`> eject`, "command");
  ejectIce();
});

document.addEventListener("starnet:action:reboot", (evt) => {
  if (!evt.detail.fromConsole) addLogEntry(`> reboot`, "command");
  rebootNode(evt.detail.nodeId);
});
```

Import `{ ejectIce, rebootNode }` from `./state.js`.

**`js/main.js` — `renderActions()`**

Add EJECT to owned nodes when ICE is present — pass `state` to `renderActions(node, state)` and check:
```js
if (node.accessLevel === "owned") {
  const icePresent = state.ice?.active && state.ice?.attentionNodeId === node.id;
  if (icePresent) btns.push(actionBtn("eject", "EJECT", "Boot ICE to a random adjacent node."));
  if (!node.rebooting) btns.push(actionBtn("reboot", "REBOOT", "Force ICE home. Node offline 1–3s."));
  // ... existing buttons
}
```

Update all `renderActions(node)` calls to `renderActions(node, state)`.

Update `wireActionButtons(node)` — eject and reboot dispatch with `nodeId`:
```js
document.dispatchEvent(new CustomEvent(`starnet:action:${action}`, { detail: { nodeId: node.id } }));
```
(no change needed — already passes `nodeId`)

**Sidebar dwell countdown:** In `renderSidebarNode()`, above the actions section, add:
```js
const visibleTimers = getVisibleTimers();
const iceTimer = visibleTimers.find((t) => t.label === "ICE DETECTION");
const rebootTimer = visibleTimers.find((t) => t.label?.startsWith("REBOOT:"));
// Render inline in sidebar HTML if present
```
Show as a warning row: `⚠ ICE DETECTION: 8s` in red/magenta.

**`js/console.js`**

Add `"eject"` and `"reboot"` to `VERBS`.

Add cases:
```js
case "eject":  return cmdEject();
case "reboot": return cmdReboot(args);
```

```js
function cmdEject() {
  const s = getState();
  if (!s.ice?.active || s.ice.attentionNodeId !== s.selectedNodeId) {
    addLogEntry("No ICE present at selected node.", "error");
    return;
  }
  dispatch("starnet:action:eject", { nodeId: s.selectedNodeId });
}

function cmdReboot(args) {
  const node = args.length >= 1 ? resolveNode(args[0]) : resolveImplicitNode();
  if (!node) return;
  if (node.accessLevel !== "owned") { addLogEntry(`${node.id}: must be owned to reboot.`, "error"); return; }
  dispatch("starnet:action:reboot", { nodeId: node.id });
}
```

**After this step:** Full ICE system playable. ICE moves, detects, players can eject/reboot, owns the resident to neutralize permanently.

---

## Acceptance Checklist

- [ ] `js/timers.js` — scheduleEvent, scheduleRepeating, cancelEvent, cancelAllByType, clearAll, getVisibleTimers
- [ ] All timers cleared on endRun
- [ ] `deselect` console command + sidebar button + click-to-deselect on graph
- [ ] ICE defined in network data; spawns at run start
- [ ] `state.ice` has residentNodeId, attentionNodeId, grade, active
- [ ] `state.lastDisturbedNodeId` updated on probe and failed exploit
- [ ] ICE moves each tick; behavior matches grade (random / disturbance / player-seeking)
- [ ] Detection fires alert via propagateAlertEvent; dwell timer for slow ICE, instant for A/S
- [ ] Dwell timer cancelled on deselect
- [ ] ICE visible on graph only when attention on compromised/owned node
- [ ] Trace-back path shown (waypoints + edges) when attention on owned node
- [ ] Resident node marked when trace-back active
- [ ] ICE node animates between positions
- [ ] EJECT action + console command: moves ICE attention to random neighbor
- [ ] REBOOT action + console command: ICE goes home, node offline 1–3s, both ICE and player locked out
- [ ] Rebooting node has distinct visual state; cannot be selected
- [ ] Owning ICE's resident node disables ICE
- [ ] ICE dwell countdown shown in sidebar
