# Visual Preview Harness — Spec

_Session: 2026-03-19-1415 | Issue: #63_

## Problem

Visual effects (probe sweep, exploit brackets, loot rings, etc.) can only be seen by playing the game and reaching the right state. Designing, tuning, and debugging animations requires going through gameplay each time. There's no way to isolate and inspect an effect at a specific progress point.

## Goal

A standalone HTML page (`preview.html`) that renders each visual effect in isolation with interactive controls. No game engine — just a minimal Cytoscape graph with fake nodes, the existing graph.js overlay functions, and a control panel.

## Approach

**Lightweight / minimal Cytoscape**: stand up a small Cytoscape instance with a few positioned nodes, call the existing `graph.js` overlay functions directly with nodeId + progress values. Accepts the existing Cytoscape coupling, works within it.

## Page Layout

Two-panel layout in the cyberpunk aesthetic:

- **Left**: Cytoscape graph container with a handful of positioned nodes (one per effect demo + a node shape gallery row)
- **Right**: Control panel with sections for each effect

## Sections

### 1. SVG Overlay Effects

Six effects, each with:
- **Slider** (0–1) for manual progress scrubbing
- **Play button** that animates 0→1 over a configurable duration (default ~3s)
- **Label** showing effect name and current progress value

Each effect targets a dedicated demo node in the graph:

| Effect | Function | Data needed |
|--------|----------|-------------|
| Probe Sweep | `syncProbeSweep(nodeId, progress)` | nodeId + progress 0–1 |
| Read Sectors | `syncReadSectors(nodeId, progress)` | nodeId + progress 0–1 |
| Loot Rings | `syncLootRings(nodeId, progress)` | nodeId + progress 0–1 |
| Exploit Brackets + Zaps | `syncExploitBrackets(nodeId, progress)` | nodeId + progress 0–1 |
| ICE Detection Sweep | `syncIceDetectSweep(nodeId, progress)` | nodeId + progress 0–1 |
| Selection Reticle | `syncSelection(nodeId)` | nodeId (no progress — just on/off) |

Each effect has a corresponding `clear*()` function to reset it.

### 2. Node Flash

Three flash types triggered by buttons:
- **Success** flash (cyan)
- **Failure** flash (red)
- **Reveal** flash (blue)

Uses `flashNode(nodeId, type)`.

### 3. Node Shape Gallery

A row of nodes showing every node type with its mapped Cytoscape shape. Each node labeled with its type name. Shows all 9 explicitly mapped types plus a "default" fallback:

| Type | Shape |
|------|-------|
| wan | barrel |
| gateway | diamond |
| router | ellipse |
| firewall | pentagon |
| workstation | ellipse |
| ids | hexagon |
| security-monitor | octagon |
| fileserver | rectangle |
| cryptovault | diamond |

Also show grade colors on the shapes — the gallery nodes should cycle through grades (F through S) so you can see the border color progression.

### 4. Node Alert States

Demo nodes showing each alert state with their pulsing animations:
- Green (no pulse)
- Yellow (slow amber pulse)
- Red (fast red pulse)
- Rebooting (opacity pulse)

Uses `updateNodeStyle(nodeId, nodeState)` with mocked state objects.

## Technical Approach

- **`preview.html`** — standalone page, loads `dist/vendor.js` (Cytoscape) + `css/style.css`
- **`preview.html` must include the SVG overlay elements** from `index.html` (`#probe-sweep`, `#read-sectors`, `#loot-rings`, `#exploit-brackets`, `#ice-detect-sweep`, `#selection-reticle`) inside the graph container div — these are the DOM targets the graph.js overlay functions write to
- **`js/ui/preview.js`** — ES module, imports from `graph.js` the overlay/flash/style functions it needs
- Uses `initGraph()` with fake network data (all demo nodes pre-positioned) and no-op callbacks — this sets up the Cytoscape instance that overlays depend on
- Graph.js imports `isIceVisible` from state.js at module level, but preview never calls the functions that use it — no game engine init needed
- Graph.js may need minor exports added if some functions are currently private
- The Cytoscape instance is initialized with a preset layout (fixed positions) — no layout algorithm needed
- Demo nodes are plain Cytoscape elements, not game NodeDefs — just `{ data: { id, label, type }, position: { x, y } }`
- Control panel is plain HTML/CSS in the cyberpunk aesthetic (dark background, cyan/green accents, monospace font)
- No build step — same vanilla JS approach as the rest of the game

## Out of scope

- ICE HTML overlay animation (requires game state visibility checks)
- ICE path flash / trace path (requires full graph with edges + access levels)
- HUD elements (alert dot, trace countdown) — these are DOM elements, not graph overlays
- Decoupling graph.js from Cytoscape — that's a future refactor
- Exploit card UI preview — separate from graph effects
