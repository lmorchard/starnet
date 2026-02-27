# Plan: Node Context Menu

## Architecture

The context menu is an absolutely-positioned `<div>` inside `#graph-container`,
positioned using the same `node.renderedPosition()` + `node.renderedWidth()` pattern
as the SVG overlays (probe sweep, reticle, etc.).

**Ownership split:**
- `index.html` — static DOM element (initially hidden)
- `css/style.css` — visual styling
- `js/visual-renderer.js` — all logic: content rendering, positioning, event wiring
  - Uses the already-exported `getCy()` to access Cytoscape for position calculations
  - Registers its own `cy.on("pan zoom", ...)` listener for keeping the menu attached
  - No new exports from graph.js needed

**Action list:**
The context menu uses `getAvailableActions(node, state)` filtered to exclude the
contextless globals (`select`, `jackout`) and `noSidebar` actions (exploit, triggered
by card clicks). This naturally includes all node/type-specific actions + `deselect`.

---

## Phase 1 — HTML + CSS scaffold

**`index.html`**: Add context menu div inside `#graph-container`, after the SVG overlays.

**`css/style.css`**: New rules — floating menu container, `.ctx-item` buttons with
hover in magenta, `.ctx-deselect` visually de-emphasised at the bottom.

---

## Phase 2 — Context menu logic in visual-renderer.js

Three new functions, no new module-level imports needed beyond `getCy` (already
imported) and `getAvailableActions` (already imported via node-actions.js).

**`_positionContextMenu(nodeId)`** — pure geometry, no content changes. Called on
pan/zoom. Fixed offset: below-right of node (`pos.x + r + 8`, `pos.y + r * 0.5`).

**`syncContextMenu(node, state)`** — renders action items as `<button class="ctx-item">`
elements, wires click → `emitEvent("starnet:action", { actionId, nodeId })`, then calls
`_positionContextMenu` and sets opacity/pointer-events to visible.

**`clearContextMenu()`** — sets opacity 0, pointer-events none.

Register pan/zoom in `initRenderer()`:
```js
getCy().on("pan zoom", () => _positionContextMenu(contextMenuNodeId));
```

---

## Phase 3 — Drive from state events

In `initRenderer()`, the existing `STATE_CHANGED` handler already calls
`syncNodePane(state)`. Add context menu sync alongside it:

```js
on(E.STATE_CHANGED, (state) => {
  // ... existing calls ...
  const node = state.selectedNodeId ? state.nodes[state.selectedNodeId] : null;
  if (node) syncContextMenu(node, state);
  else clearContextMenu();
});

on(E.RUN_STARTED, () => clearContextMenu());
```

`STATE_CHANGED` fires on every mutation, so the menu naturally reflects in-progress
state changes (exploit running → only `cancel-exploit`; access gained → new actions).

---

## Phase 4 — Strip actions from sidebar

In `visual-renderer.js`:
- Remove the ACTIONS section (`nd-section-label` + `nd-actions` divs) from
  `renderSidebarNode`'s innerHTML template
- Remove the `[ DESELECT ]` button from the node header
- Remove `renderActions()`, `actionBtn()`, `wireActionButtons()` helper functions
  (all dead code once the sidebar no longer renders actions)

Sidebar retains: node label/type badge, grade, access, alert, vulnerabilities,
macguffin contents, ice-timers slot.

---

## Phase 5 — Verify + playtest

1. `make check` — 145 tests should pass unchanged (no logic changes)
2. Browser playtest checklist:
   - Select node → context menu appears below-right
   - Pan/zoom → menu stays attached
   - Start exploit → menu shows only `cancel-exploit`
   - Cancel exploit → full action list returns
   - Click `deselect` in menu → dismisses, sidebar clears
   - Click graph background → same dismissal
   - Console `actions` output matches menu items
   - Sidebar shows only metadata, no action buttons

---

## Commit strategy

Single commit after all phases complete. Branch: `node-context-menu`.
