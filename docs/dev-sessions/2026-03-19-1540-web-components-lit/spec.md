# Web Components + lit-html — Spec

_Session: 2026-03-19-1540 | Issue: #67_

## Problem

`visual-renderer.js` rebuilds DOM sections via full `innerHTML` replacement on every state change. This causes:
- Flickering when animated/interactive elements are destroyed and recreated (exploit cancel overlay, card hover states)
- Manual cache-key workarounds (`_lastHandKey`, `_lastContextMenuActionIds`) to skip unnecessary rebuilds
- Fragile event listener re-attachment after each innerHTML replacement

## Goal

Replace all innerHTML rendering sites with Lit-based web components. Components receive data via reactive properties set by visual-renderer.js (the bridge layer). No shadow DOM — components render into light DOM and inherit the global `style.css` stylesheet.

## Architecture

```
Game Events (E.*)
    ↓
visual-renderer.js (bridge — subscribes to events, sets component properties)
    ↓
<starnet-*> web components (pure rendering, reactive properties, light DOM)
    ↓
css/style.css (shared global styles)
```

- **Components are property-driven** — parent sets `.node = nodeState`, component re-renders reactively via LitElement
- **Components do NOT subscribe to game events** — that's the bridge layer's job
- **Light DOM** — no shadow DOM, components inherit global CSS
- **visual-renderer.js** becomes a thin orchestrator: listen to events → set properties on components

## Vendor Bundle

Add `lit` to npm dependencies. Bundle it with esbuild into `dist/lit.js` as an ESM module that game components can import from.

**Approach:** Same pattern as `js/vendor.js` → `dist/vendor.js` for Cytoscape. Create `js/lit-vendor.js` that re-exports from `lit`, build with esbuild to `dist/lit.js`.

**Makefile:** Add `dist/lit.js` target alongside `dist/vendor.js`. Both built by `make bundle-vendor`.

**Import pattern in components:**
```js
import { LitElement, html, css } from "/dist/lit.js";
```

## Components (10 total)

### 1. `<starnet-log>` — Log pane
- **Element:** `#log-entries`
- **Properties:** `entries: LogEntry[]`
- **Frequency:** High (every log line)
- **Notes:** Simple list render. Scroll-to-bottom behavior.

### 2. `<starnet-context-menu>` — Action menu on graph
- **Element:** `#node-context-menu`
- **Properties:** `actions: ActionDef[]`, `nodeId: string`
- **Events emitted:** `starnet:action` (bubbles up on button click)
- **Notes:** Positioned absolutely over graph. Replaces manual cache-key optimization.

### 3. `<starnet-mission-pane>` — Mission briefing
- **Element:** `#sidebar-mission`
- **Properties:** `mission: Mission`, `phase: string`
- **Notes:** Tiny, simple. Low update frequency.

### 4. `<starnet-node-panel>` — Sidebar node detail
- **Element:** `#sidebar-node`
- **Properties:** `node: NodeState`, `state: GameState` (or specific fields)
- **Contains:** `<starnet-ice-timers>` as child
- **Notes:** Largest component. Shows grade, access, alert, vulns, macguffins.

### 5. `<starnet-hand>` — Exploit card hand
- **Element:** `#hand-strip`
- **Properties:** `cards: ExploitCard[]`, `selectedNode: NodeState`, `executingCardId: string`, `execProgress: number`
- **Events emitted:** `starnet:action` with xploit payload on card click
- **Notes:** Each card could be a `<starnet-exploit-card>` child, but start with a single component and extract if needed.

### 6. `<starnet-ice-timers>` — Timer display in sidebar
- **Element:** `.ice-timers-slot` (inside node panel)
- **Properties:** `timers: TimerInfo[]`
- **Notes:** Very high update frequency. Benefits most from reactive diffing.

### 7. `<starnet-end-screen>` — Game over overlay
- **Element:** `#end-screen` (dynamically created)
- **Properties:** `outcome: string`, `cash: number`, `missionComplete: boolean`, `nodesOwned: number`, etc.
- **Events emitted:** `run-again` on button click
- **Notes:** Once per run. Can be pre-placed in HTML, shown/hidden via property.

### 8. `<starnet-store>` — Darknet broker modal
- **Element:** `#darknet-store-modal`
- **Properties:** `catalog: StoreItem[]`, `cash: number`, `open: boolean`
- **Events emitted:** `buy` with vulnId on purchase, `close` on dismiss
- **Notes:** Currently re-renders entire modal on each buy. Component handles partial updates.

### 9. `<starnet-level-select>` — New run form
- **Element:** `#level-select-modal`
- **Properties:** `open: boolean`, `currentParams: URLSearchParams`
- **Notes:** Form-heavy. Lowest priority — rarely changes.

### 10. `<starnet-hud>` — Header bar (alert, wallet, trace, connection)
- **Element:** `#hud`
- **Properties:** `alert: string`, `cash: number`, `traceSeconds: number`, `connectionStatus: string`
- **Notes:** Currently uses direct DOM manipulation in syncHud(). Convert to reactive properties.

## File Structure

```
js/
  lit-vendor.js          — esbuild entry: re-exports from "lit"
  ui/
    components/
      starnet-log.js
      starnet-context-menu.js
      starnet-mission-pane.js
      starnet-node-panel.js
      starnet-hand.js
      starnet-ice-timers.js
      starnet-end-screen.js
      starnet-store.js
      starnet-level-select.js
      starnet-hud.js
dist/
  lit.js                 — esbuild output (ESM bundle of lit)
  vendor.js              — existing Cytoscape bundle
```

## Migration Strategy

1. Set up vendor bundle (`lit` → `dist/lit.js`)
2. Convert leaf components first (no children): log, mission, ice-timers, end-screen, hud
3. Convert mid-level: context menu, store, level-select
4. Convert complex/nested: node panel (contains ice-timers), hand strip
5. Thin out visual-renderer.js — remove innerHTML code, keep event→property bridge

Each component conversion:
- Create component file in `js/ui/components/`
- Register custom element
- Add element to `index.html` (replace the old container div)
- Update `visual-renderer.js` to set properties instead of innerHTML
- Remove the old rendering code
- Verify in browser

## Out of Scope

- Shadow DOM (using light DOM throughout)
- Graph overlays (SVG effects stay in graph.js — they're Cytoscape-coupled, not innerHTML)
- Console input (`js/ui/console.js` — manages a text input, not innerHTML)
- preview.html (can be converted later)
- Refactoring the event bus or state management
