# Session Plan: Set-Piece Playground & Playthrough Harness

## Overview

Build incrementally: start with a minimal rendering page, add interactivity layer
by layer, then extend playtest.js. Each phase produces a working artifact.

**Dependency chain:**
```
Phase 1: Mini-network builder (shared module)
Phase 2: Minimal playground.html (renders a set-piece in Cytoscape)
Phase 3: Game init + console (full game actions work)
Phase 4: Debug commands (inject, set, inspect, triggers, etc.)
Phase 5: Inspector panel + JSON viewer
Phase 6: Dev overlay toggles (message trace, internal state)
Phase 7: playtest.js --piece and --graph flags
```

---

## Phase 1: Mini-Network Builder

**Goal:** Shared module that wraps a set-piece or raw NodeGraphDef in a playable
micro-network. Used by both playground.html and playtest.js.

### Step 1.1: Create `js/core/node-graph/mini-network.js`

```js
export function buildMiniNetwork(graphDef, opts = {}) → { graphDef, meta }
export function buildSetPieceMiniNetwork(pieceName) → { graphDef, meta }
```

**`buildMiniNetwork(graphDef, opts)`:**
- Takes a raw `{ nodes, edges, triggers }`
- Adds a gateway node (accessible, grade F, connected to first node)
- Adds a WAN node (darknet store)
- Wraps nodes via `createGameNode()` if they have no traits
- Returns `{ graphDef, meta: { name, startNode: "gateway", startCash: 0, ... } }`

**`buildSetPieceMiniNetwork(pieceName)`:**
- Looks up `SET_PIECES[pieceName]`
- Calls `instantiate()` with a simple prefix
- Wraps nodes via `createGameNode()`
- Connects gateway to set-piece external ports
- Merges triggers
- Returns same format

### Step 1.2: Tests

Minimal test: `buildSetPieceMiniNetwork("idsRelayChain")` returns valid graphDef
with gateway + set-piece nodes + edges.

**Checkpoint:** `make check` passes. Module exists, tested, not wired anywhere yet.

---

## Phase 2: Minimal Playground Page

**Goal:** `playground.html` that renders a set-piece in Cytoscape. No interactivity
yet — just visual rendering.

### Step 2.1: Create `playground.html`

Minimal HTML page:
- Loads `dist/vendor.js` (Cytoscape bundle)
- Loads `css/style.css` (reuse game styles)
- Has `<div id="cy">` for the graph
- Has a simple toolbar: set-piece dropdown
- Entry point: `<script type="module" src="js/playground/main.js">`

### Step 2.2: Create `js/playground/main.js`

Playground-specific init:
- Parse URL params (`?piece=`, `?network=`, `?file=`)
- Build network from selected source (using mini-network builder)
- Call `initGame()` to set up full game state + NodeGraph
- Call `initGraph()` to render in Cytoscape
- Call `syncInitialNodes()` to show initial visible nodes
- Wire the set-piece dropdown to reload with different piece

Reuses from the game:
- `js/ui/graph.js` — Cytoscape init + styling
- `js/core/state/index.js` — initGame
- `js/core/node-graph/mini-network.js` — wrapping
- `data/networks/*.js` — for ?network= mode

Does NOT load: visual-renderer.js overlays (probe sweep etc), store.js, level-select.js.

### Step 2.3: Populate dropdown

Build dropdown from `Object.keys(SET_PIECES)` + network names. Selecting an item
reloads the page with the appropriate URL param.

**Checkpoint:** Open `playground.html?piece=idsRelayChain` in browser, see the
set-piece rendered as a Cytoscape graph with game-styled nodes.

---

## Phase 3: Game Init + Console

**Goal:** Full game actions work in the playground. Player can select nodes, probe,
exploit, etc. Console input works.

### Step 3.1: Wire console

- Add console input HTML (same pattern as game: `<input id="console-input">`)
- Import and call `initConsole()` from `js/ui/console.js`
- Import and call `initDynamicActions()` for graph action discovery
- Wire `buildActionContext()` + `initActionDispatcher()`

### Step 3.2: Wire timer + tick

- Set up `setInterval(() => tick(1), TICK_MS)` for real-time ticking
- Register timer handlers: ICE_MOVE, ICE_DETECT, TRACE_TICK
- Wire graph bridge: `initGraphBridge()`

### Step 3.3: Wire basic event logging

- Add a log pane (simple `<div id="log-entries">`)
- Import and call `initLogRenderer()` OR create a simpler log that just
  shows raw events. The game's log-renderer already handles ACTION_FEEDBACK
  and ACTION_RESOLVED — reuse it.

### Step 3.4: Add message log pane

- Separate from the game log — this shows structured message trace
- Subscribe to graph `onEvent("message-delivered", ...)`
- Format: `[MSG] type → nodeId (operators: relay, flag)`
- Subscribe to `onEvent("node-state-changed", ...)`
- Format: `[ATTR] nodeId.attr: oldVal → newVal`

**Checkpoint:** Can type `select gateway`, `probe`, `exploit 1` etc in the playground
console. Actions execute, timed-action operator ticks, log shows events.

---

## Phase 4: Debug Commands

**Goal:** Playground-specific console commands for circuit debugging.

### Step 4.1: Create `js/playground/debug-commands.js`

Register debug commands using the existing command registry:

- `inject <nodeId> <msgType> [key=val...]` — `graph.sendMessage(nodeId, msg)`
- `set <nodeId> <attr> <value>` — `graph.setNodeAttr(nodeId, attr, parsed)`
- `inspect <nodeId>` — dump all attrs, operators, internal state to log
- `triggers` — list triggers with condition state
- `messages [on|off]` — toggle verbose message trace
- `qualities` — dump quality store
- `graph` — dump full graph snapshot as JSON to log

### Step 4.2: Wire debug commands in playground init

Import and call `registerDebugCommands()` after `initConsole()`.

### Step 4.3: Value parsing for `set` command

Parse value strings: `"true"` → true, `"false"` → false, numeric strings → numbers,
`"null"` → null, otherwise keep as string.

**Checkpoint:** Can type `inject ids-1 alert`, `set monitor accessLevel owned`,
`inspect gateway`, `triggers` in the playground console.

---

## Phase 5: Inspector Panel + JSON Viewer

**Goal:** Click a node → see its full state. Read-only JSON pane shows graph state.

### Step 5.1: Inspector panel HTML

Add right sidebar with:
- Node detail section (populated on selection)
- Sections: Attributes, Operators, Actions, Traits, Internal State

### Step 5.2: Wire inspector to node selection

Subscribe to `E.PLAYER_NAVIGATED` or node click events. When a node is selected:
- Read `graph.getNodeState(nodeId)` for all attributes
- Read node's operators and actions from the resolved NodeDef
- Format and render in the inspector panel
- Auto-update on `E.STATE_CHANGED` / `E.NODE_STATE_CHANGED`

### Step 5.3: JSON inspector pane

Add a collapsible pane (below the node inspector or as a tab) that shows:
- `JSON.stringify(graph.snapshot(), null, 2)`
- Updates on demand (button) or auto-refresh toggle
- Monospace, pre-formatted, scrollable

**Checkpoint:** Click a node in the playground graph, see all its attributes and
operators in the inspector. JSON pane shows full graph state.

---

## Phase 6: Dev Overlay Toggles

**Goal:** Toggle switches that show/hide debug information on the graph and in logs.

### Step 6.1: Toolbar toggle switches

Add toggle buttons to the toolbar:
- Messages (on/off) — show message propagation in the message log
- Internal state (on/off) — show `_clock_ticks`, `_allof_state` etc in inspector
- Hidden attrs (on/off) — show attributes normally hidden from player

### Step 6.2: Message propagation highlights

When "Messages" is on and a message is delivered:
- Briefly highlight the receiving node (CSS class flash)
- Briefly highlight the edge the message traveled along
- Log the message in the message log pane

Uses the existing `onEvent("message-delivered", ...)` callback from the NodeGraph.

### Step 6.3: Internal state filtering

The inspector shows all attributes by default. When "Internal state" is off,
filter out attributes starting with `_` (convention for operator internal state).

When "Hidden attrs" is off, filter out attributes that a player wouldn't see
(forwardingEnabled, lootCount, gateAccess, etc. — or just show everything and
let the toggle control whether `_` prefixed attrs appear).

**Checkpoint:** Toggle "Messages" on, inject an alert message, see it propagate
visually through the graph. Toggle "Internal state" off, internal operator
attributes disappear from the inspector.

---

## Phase 7: playtest.js Extensions

**Goal:** `--piece` and `--graph` flags for the headless harness.

### Step 7.1: Import mini-network builder

Add imports for `buildMiniNetwork` and `buildSetPieceMiniNetwork` to playtest.js.

### Step 7.2: Parse new flags

Add `--piece <name>` and `--graph <path>` to arg parsing. When present, use the
mini-network builder instead of the network registry.

For `--graph`: read the JSON file, parse it, pass to `buildMiniNetwork()`.
For `--piece`: pass the name to `buildSetPieceMiniNetwork()`.

### Step 7.3: Verify LLM-legible output

Run a quick playtest with `--piece idsRelayChain` and verify the output is
clean, consistent, and parseable. ACTION_FEEDBACK and ACTION_RESOLVED events
should produce readable log lines.

**Checkpoint:** `node scripts/playtest.js --piece idsRelayChain reset` initializes
a mini-network with the IDS relay chain. Standard commands work.

---

## Risk Notes

- **Cytoscape layout with small graphs.** Cola layout may behave oddly with 3-5
  nodes. May need to switch to a simpler layout (grid, circle) for small graphs.

- **Graph.js coupling.** `initGraph()` expects a specific data format and sets up
  overlays, ICE node, etc. The playground may need to skip some of that. Check
  whether `addIceNode()` crashes when there's no ICE.

- **Console.js DOM coupling.** `initConsole()` expects specific DOM elements
  (`#console-input`). The playground HTML must provide them with matching IDs.

- **Visual-renderer.js side effects.** If loaded, it subscribes to many events
  and expects DOM elements that may not exist in the playground. Either don't
  load it, or create a playground-specific renderer.

- **State assumptions.** `initGame()` expects a network with exploits, macguffins,
  mission, etc. A bare set-piece may not have lootable nodes. Ensure no crashes
  when macguffins/mission are absent.
