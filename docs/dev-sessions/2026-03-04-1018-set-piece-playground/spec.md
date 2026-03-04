# Session Spec: Set-Piece Playground & Playthrough Harness

## Goal

Build a browser-based interactive playground for inspecting, debugging, and
playtesting node graph circuits in isolation. Think "dev tools for the node graph"
— layers of visibility you can toggle, a debug console with circuit manipulation
commands, and enough game context to probe/exploit/reconfigure nodes meaningfully.

Also extend the existing playtest.js harness to work with set-pieces and ad-hoc
graph definitions, ensuring LLM-legible output.

## Tool 1: Browser Playground (`playground.html`)

### Entry Point

Separate HTML page, independent from the main game UI. Loads via URL parameters:

- `playground.html?piece=idsRelayChain` — load a named set-piece wrapped in a mini-network
- `playground.html?file=path/to/circuit.json` — load an ad-hoc NodeGraphDef from JSON
- `playground.html?network=corporate-foothold` — load a full network definition (bonus)

### Graph Input Formats

**Named set-piece** (default): the playground wraps the set-piece in a mini-network
with a gateway (accessible, entry point) and a WAN node. Set-piece nodes are wrapped
via `createGameNode()` so full game actions (probe, exploit, read, loot, reconfigure)
are available. This is the "Option B" wrapper — enough context for meaningful
interaction without a full game.

**Ad-hoc JSON**: a raw `NodeGraphDef` — `{ nodes, edges, triggers }`. Nodes can use
traits (resolved at load time) or raw operators/actions. No factory functions needed —
pure data. Example:

```json
{
  "nodes": [
    { "id": "gw", "type": "gateway", "traits": ["graded", "hackable", "rebootable", "gate"],
      "attributes": { "visibility": "accessible", "grade": "D" } },
    { "id": "target", "type": "fileserver",
      "traits": ["graded", "hackable", "lootable", "rebootable", "gate"],
      "attributes": { "grade": "C" } }
  ],
  "edges": [["gw", "target"]],
  "triggers": []
}
```

**Full network** (bonus): load any registered network definition (corporate-foothold,
research-station, corporate-exchange) with full dev tools overlay.

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ TOOLBAR: [Set-piece ▾] [Load JSON] [Reload] [Tick ▶] [×N]  │
│          [▶ Auto] [⏸ Pause]  Toggles: [Messages] [State]   │
├───────────────────────────────────┬──────────────────────────┤
│                                   │ INSPECTOR PANEL          │
│         CYTOSCAPE GRAPH           │                          │
│    (same rendering as game,       │ Selected node:           │
│     with dev overlays)            │   - attributes           │
│                                   │   - operators            │
│                                   │   - traits               │
│                                   │   - actions              │
│                                   │   - internal state       │
│                                   ├──────────────────────────┤
│                                   │ JSON INSPECTOR           │
│                                   │ (pretty-printed,         │
│                                   │  read-only graph state)  │
├───────────────────────────────────┴──────────────────────────┤
│ MESSAGE LOG (structured, scrolling text)                     │
│ > inject ids-1 alert                                         │
│ [MSG] alert → ids-1 (relay → monitor)                        │
│ [ATTR] monitor.alerted: false → true                         │
│ [TRIGGER] alert-reached-monitor: FIRED                       │
├──────────────────────────────────────────────────────────────┤
│ > _                                                    DEBUG │
│ CONSOLE (game commands + debug commands)                     │
└──────────────────────────────────────────────────────────────┘
```

### Capabilities

**Rendering & navigation:**
- Cytoscape graph with same node styles as the game
- Click nodes to select → inspector shows full state
- Dev overlays toggleable (message propagation, internal state, trigger status)

**Tick controls:**
- Step 1 tick
- Step N ticks
- Auto-play at game speed (100ms/tick)
- Pause

**Message injection:**
- Send any message type to any node via console command
- Visual feedback: highlight receiving nodes, flash edges on propagation

**Node inspection:**
- Click a node → inspector panel shows all attributes, operators, traits, actions
- Internal operator state visible (`_clock_ticks`, `_allof_state`, etc.)
- Toggleable: show/hide attributes hidden from the player in the real game

**Action execution:**
- Standard game commands work (probe, exploit, read, loot, reconfigure, etc.)
- Dynamically discovered from graph available actions

**Direct state manipulation:**
- Set any node attribute via console command
- Useful for testing trigger conditions without playing through

**Message trace log:**
- Structured log showing every message delivered: type, origin, path, operators fired
- Attribute changes logged: which attribute, old value → new value
- Trigger events logged: which trigger, condition state, fired/armed
- Defaults to ON (dev tool, not player-facing)

**Trigger inspection:**
- Console command to list all triggers with current condition state
- Visual indicator on graph for fired triggers (optional)

**JSON inspector:**
- Read-only pane showing current graph state as pretty-printed JSON
- Updates on every state change (or on demand)
- Foundation for future read/write editor

### Dev Console Commands

Standard game commands (probe, exploit, read, loot, status, etc.) come for free via
the existing command system + dynamic action discovery.

Additional debug commands:

| Command | Description |
|---------|-------------|
| `inject <nodeId> <msgType> [key=val...]` | Send a raw message to a node |
| `set <nodeId> <attr> <value>` | Directly set a node attribute |
| `inspect <nodeId>` | Dump full node state (attrs, operators, internal state) |
| `triggers` | List all triggers with condition state |
| `messages [on\|off]` | Toggle message trace logging |
| `qualities` | Dump all quality values |
| `graph` | Dump full graph state as JSON |
| `tick [n]` | Step N ticks (already exists) |

Designed for easy extensibility — adding a new debug command is adding an entry
to a command array, same pattern as the game's command system.

### Toggle Switches (Dev Overlays)

- **Messages**: show/hide message propagation highlights on the graph
- **Internal state**: show/hide operator internal attributes (_clock_ticks, etc.)
- **Triggers**: show/hide trigger armed/fired indicators
- **Hidden attrs**: show/hide attributes normally hidden from the player

These enable assessing what's legible in the real game UI vs what's only visible
with dev tools — like browser dev tools for the node graph.

## Tool 2: Playtest.js Extensions

### Set-piece mode

Add `--piece <name>` flag to playtest.js. Uses the same mini-network wrapper as the
playground — shared module, same logic. Wraps the named set-piece with a gateway + WAN,
initializes the game, and enters the REPL.

### Ad-hoc JSON mode

Add `--graph <path.json>` flag to playtest.js. Loads a NodeGraphDef from JSON, resolves
traits, wraps if needed, initializes.

### Shared mini-network builder

A module (e.g. `js/core/node-graph/mini-network.js`) that both the playground and
playtest.js use to wrap a set-piece or raw NodeGraphDef in a playable micro-network:

- Adds a gateway node (accessible, entry point)
- Adds a WAN node (darknet store access)
- Connects gateway to set-piece external ports
- Returns a `{ graphDef, meta }` like full network builders

### LLM-legible output

Ensure playtest.js output from ACTION_FEEDBACK and ACTION_RESOLVED events is
consistently formatted and complete. The existing output should already be close
after the composable-traits session — verify and tighten if needed.

## Scope

### In Scope

1. `playground.html` — separate page with Cytoscape + inspector + console + message log
2. Debug console commands (inject, set, inspect, triggers, messages, qualities, graph)
3. Dev overlay toggles
4. JSON inspector pane (read-only)
5. Mini-network wrapper (shared module)
6. playtest.js `--piece` and `--graph` flags
7. URL parameter loading (piece, file, network)

### Out of Scope

- Bot player rebuild
- Inline JSON editor (future: make inspector read/write)
- Automated metrics collection / census-style batch runs
- New set-pieces or traits (this session builds the tool, not the content)
- Visual effects (probe sweep, exploit brackets) — use game rendering as-is

### Design Aesthetic

Same cyberpunk phosphene look as the game but more utilitarian. Dark background,
monospace, neon accents. The inspector and message log can be denser/more technical
than the game's sidebar and log — this is a dev tool, not a player-facing UI.
