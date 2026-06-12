# Spec — Drag-resizable UI regions

Issue: #181
Branch: `resizable-ui-regions`

## Goal

Let the player rebalance the main UI layout by dragging region borders, with the
chosen sizes persisted across reloads. First pass covers three dividers; the
header HUD stays fixed.

## Scope (this pass)

Three draggable dividers, each a simple two-side split that adjusts one size:

1. **Graph ↔ log** — height of `#log-pane` inside `#graph-column`.
2. **Graph-column ↔ sidebar** — width of `#sidebar` (currently fixed `flex: 0 0 400px`).
3. **Sidebar-node ↔ hand** — height of `#hand-strip`. The vital-sign stack and
   mission pane stay pinned at the top of the sidebar; the divider sits just
   above the hand.

**Out of scope (deferred):** resizing the vital-stack / mission / node sections
relative to each other (the full 4-way sidebar split from #181), and resizing
the HUD.

## Design

### Mechanism — CSS-variable-driven flex sizing

Three custom properties on `#app` drive the flex bases:

- `--sidebar-w`  → `#sidebar { flex-basis: var(--sidebar-w, 400px); }`
- `--log-h`      → `#log-pane { flex-basis: var(--log-h, 260px); }`
- `--hand-h`     → `#hand-strip { flex-basis: var(--hand-h, 200px); }`

`DEFAULT_LAYOUT` = `{ sidebarW: 400, logH: 260, handH: 200 }` (px; tunable during build).

Dragging a divider updates one variable. Declarative, no per-frame layout math.
The graph's existing `ResizeObserver` (added in #180) already calls `cy.resize()`
when `#graph-container` changes size, so the graph copes with live resize for free.

**Log-pane refactor:** `#log-pane` currently sizes to content via a fixed
`#log-entries { flex: 0 0 14rem }`. Flip it so `#log-pane` carries the basis
(`--log-h`) and `#log-entries` becomes `flex: 1 1 auto` (scrolling), with the
console row pinned. The divider then grows/shrinks the scrollable log area.

**Hand-strip cap:** `#hand-strip` currently has `max-height: 33%` (from #182) so
a full deck can't crowd the node panel. The `--hand-h` basis + the hand-axis
clamp now own that height, so the `max-height: 33%` is removed to avoid two
mechanisms fighting over the same dimension. The clamp's max (≈60% of sidebar)
preserves the original "don't crowd the node panel" intent.

### Splitters — thin flex-participating bars

Three `<div class="splitter">` elements in `index.html`, each placed *between*
its two panes as a thin (~6px) flex item:

- Vertical bar, `cursor: col-resize`, between `#graph-column` and `#sidebar`.
- Horizontal bar, `cursor: row-resize`, between `#graph-container` and `#log-pane`.
- Horizontal bar, `cursor: row-resize`, between `#sidebar-node` and `#hand-strip`.

No absolute positioning or `getBoundingClientRect` border math — the bars
participate in the existing flex layout.

**Aesthetic (vector vocabulary):** a hairline that is nearly invisible at rest
and brightens to a cyan stroke + phosphene glow on hover/drag. A wider (~10px)
transparent hit zone makes it grabbable without a fat visible bar. Stroke-only,
no fill, no bitmap chrome. Exact look tuned live in the browser during build.

### Modules

- **`js/ui/layout-store.js`** — mirrors `profile-store.js`:
  - `DEFAULT_LAYOUT` — default px sizes for the three axes.
  - `loadLayout()` — read `localStorage["starnet:layout"]`, JSON-parse,
    normalize-and-clamp every field (corrupt/stale/missing payload falls back to
    defaults; never wedges the layout).
  - `saveLayout(layout)` — persist JSON.
  - `clampSize(axis, px)` — **pure**, the unit-tested core. Clamps a size to the
    axis min/max.
- **`js/ui/resizers.js`** — wires the three dividers:
  - Pointer Events (`pointerdown` / `pointermove` / `pointerup` +
    `setPointerCapture`) — covers mouse and touch uniformly.
  - On drag: compute new size from the pointer delta, `clampSize`, write the CSS
    var on `#app`.
  - On release: debounced `saveLayout()`.
  - Initializes the CSS vars from `loadLayout()` at startup.
  - **Double-click a divider resets that axis** to its `DEFAULT_LAYOUT` value
    (and saves).

UI-prefs live OUTSIDE the game state object (CLAUDE.md state-encapsulation rule):
layout is chrome, not gameplay, so save/load of a run stays pure.

### Constraints (clamped per axis)

| Axis         | Min                          | Max            |
|--------------|------------------------------|----------------|
| Sidebar width| ~280px (HUD/cards readable)  | ~50vw          |
| Log height   | ~console row + one line       | ~60vh          |
| Hand height  | ~one card row                | ~60% of sidebar |

Final numbers tunable during build; intent is no pane collapses to zero or
starves its neighbor.

## Testing

- `clampSize` — pure unit tests: in-range passthrough, below-min, above-max,
  each axis.
- `loadLayout` normalization — corrupt JSON, missing keys, out-of-range values,
  non-object payload all return a clamped valid layout.
- Drag wiring is DOM-coupled; per the `testing-ui-modules-in-node` note a
  `globalThis.document` stub allows a smoke test, but the meaningful assertions
  stay on the pure helpers.

## Reset mechanism

Double-click a divider → resets that one axis to its default. (No global
"reset all" button this pass; can add later if wanted.)

## Out of scope / future

- Full 4-way sidebar section resize (#181 remainder).
- Resizable/collapsible HUD.
- A global "reset layout" affordance.
