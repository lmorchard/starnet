# Plan: Hand Strip + Pie Menu

## Phase 1 — Hand Strip

### 1a. HTML restructure (index.html)
- Remove `<div id="sidebar-hand">` from `<aside id="sidebar">`
- Add `<div id="hand-strip"></div>` inside `#graph-column`, between
  `#graph-container` and `#log-pane`

### 1b. CSS (style.css)
- Remove old `#sidebar-hand` block
- Add `#hand-strip`: `display: flex; flex-direction: row; overflow-x: auto;
  gap: 0.5rem; padding: 0.5rem; border-top: 1px solid var(--border); flex-shrink: 0;`
- Restyle `.nd-hand`: `display: flex; flex-direction: row; gap: 0.5rem; flex-wrap: nowrap;`
- Restyle `.exploit-card`: narrow vertical tile — `width: 130px; flex-shrink: 0;
  height: 160px; flex-direction: column; position: relative; overflow: hidden;`
  Remove flex layout that was row-oriented.
- Change progress fill from left-to-right to bottom-to-top:
  ```css
  .exploit-card.executing::before {
    transform-origin: bottom center;
    transform: scaleY(0);
    animation: exec-fill-sweep var(--exec-total) linear forwards;
    animation-delay: var(--exec-elapsed);
  }
  @keyframes exec-fill-sweep {
    from { transform: scaleY(0); }
    to   { transform: scaleY(1); }
  }
  ```
- Add `.ec-executing-label` visibility rule:
  `.ec-executing-label { visibility: hidden; }`
  `.exploit-card.executing .ec-executing-label { visibility: visible; }`

### 1c. JS (visual-renderer.js)
- In `syncHandPane`: change `getElementById("sidebar-hand")` → `"hand-strip"`
  Remove the "EXPLOIT HAND" section label (no longer needed).
- In `renderExploitCard`: always render `.ec-executing-label` (remove the
  `${isExecuting ? ... : ""}` conditional); label is always in the DOM, CSS
  controls visibility. Also re-order card content for vertical layout:
  index + name on top, then rarity, quality pips, uses, vulns, executing label.

---

## Phase 2 — Pie Menu

### 2a. HTML (index.html)
Add CDN script after Cytoscape.js:
```html
<script src="https://cdn.jsdelivr.net/npm/cytoscape-cxtmenu@3.6.0/cytoscape-cxtmenu.min.js"></script>
```

### 2b. graph.js
Add `export function initCxtMenu(commands)` that registers the ctxmenu extension:
```js
export function initCxtMenu(commands) {
  cy.cxtmenu({
    selector: "node.accessible",
    commands,
    menuRadius: (el) => 80,
    indicatorSize: 24,
    separatorWidth: 3,
    spotlightPadding: 6,
    minSpotlightRadius: 12,
    maxSpotlightRadius: 28,
    openMenuEvents: "cxttap",
    activeFillColor: "rgba(0, 200, 255, 0.35)",
    activePadding: 8,
    zIndex: 9999,
  });
}
```

### 2c. visual-renderer.js
- Import `initCxtMenu` from graph.js
- Build `buildPieCommands(ele)` function that reads `getState()` and returns
  command array for the given cytoscape element (by nodeId):
  ```js
  function buildPieCommands(ele) {
    const state = getState();
    const nodeId = ele.id();
    const node = state.nodes[nodeId];
    if (!node) return [];
    const cmds = [];
    // DESELECT always
    cmds.push({ content: "DESELECT", select: () => emitEvent("starnet:action:deselect", {}) });
    // ... per spec conditions ...
    return cmds;
  }
  ```
- Call `initCxtMenu((ele) => buildPieCommands(ele))` after cy is initialized
  (in the `E.STATE_CHANGED` first-init path or after `initGraph`)
- Remove sidebar action buttons from `syncNodePane`: strip `renderActions` call
  and `wireActionButtons` call; remove the `<div class="nd-actions">` section

### 2d. CSS (style.css)
Add ctxmenu overrides in a new section:
```css
/* ── Pie Menu (ctxmenu) overrides ─────────────────────────── */
.cy-context-menus-cxt-menu {
  font-family: "Courier New", monospace;
  font-size: 0.7rem;
  letter-spacing: 0.05em;
}
.cy-context-menus-cxt-menuitem {
  background: rgba(5, 5, 15, 0.92);
  color: var(--green);
  border: 1px solid var(--border);
}
.cy-context-menus-cxt-menuitem:hover,
.cy-context-menus-cxt-menuitem.active {
  background: rgba(0, 200, 255, 0.15);
  color: var(--cyan);
}
```

---

## Files Changed

| File | Change |
|------|--------|
| `index.html` | Move hand div; add ctxmenu CDN |
| `css/style.css` | Hand strip + card redesign; bottom-to-top fill; ctxmenu overrides |
| `js/visual-renderer.js` | Target `#hand-strip`; always-render executing label; add pie commands |
| `js/graph.js` | Export `initCxtMenu` |

## Verification

```bash
make check
# Open browser, verify:
# - Hand strip visible below graph, above log, full width
# - Cards are narrow vertical tiles
# - Fill animation goes bottom-to-top
# - Card height stable during execution
# - Right-click node → pie menu appears with correct actions
# - Clicking pie item executes action
# - Sidebar has no action buttons
```
