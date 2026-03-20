# Web Components + lit-html — Notes

_Session: 2026-03-19-1540 | Issue: #67_

## Summary

Converted all innerHTML rendering sites in the game UI to Lit-based web components.
10 components created in `js/ui/components/`, all extending a shared `StarnetElement`
base class that uses light DOM (no shadow DOM — components inherit global CSS).

## What was done

- **Phase 0:** Committed spec + plan
- **Phase 1:** Added `lit` npm dependency, created `js/lit-vendor.js` → `dist/lit.js` vendor bundle
- **Phase 2:** Created `StarnetElement` base class + `<starnet-log>` (first component, proved the pattern)
- **Phase 3:** `<starnet-mission-pane>` + `<starnet-ice-timers>` (simple leaf components)
- **Phase 4:** `<starnet-hud>` (header bar with button wiring via `hud-action` custom events)
- **Phase 5:** `<starnet-context-menu>` (removed `_lastContextMenuActionIds` cache)
- **Phase 6:** `<starnet-node-panel>` (largest component, contains ice-timers as child)
- **Phase 7:** `<starnet-hand>` (exploit cards, removed `_lastHandKey` cache + dead `execStartTime`/`execTotalMs`)
- **Phase 8a:** `<starnet-end-screen>` (pre-placed, open/close via property)
- **Phase 8b:** `<starnet-store>` (darknet broker, `store.js` becomes bridge)
- **Phase 8c:** `<starnet-level-select>` (form with internal state, `level-select.js` becomes bridge)
- **Phase 9:** Cleanup — removed dead imports/variables, updated CLAUDE.md docs

## Architecture after migration

```
Game Events (E.*)
    ↓
visual-renderer.js / log-renderer.js  (bridge — event → property)
    ↓
<starnet-*> web components            (pure rendering, reactive properties)
    ↓
css/style.css                          (shared global styles, light DOM)
```

Bridge files are now thin orchestrators: subscribe to events, set component properties.
No innerHTML remains in visual-renderer.js or log-renderer.js.

## Decisions and surprises

- **Component files excluded from tsc**: `/dist/lit.js` is a runtime-only import path
  that tsc can't resolve. Component files excluded from lint target (same as vendor.js,
  graph.js, main.js).
- **`execStartTime`/`execTotalMs` were dead code**: `execTotalMs` was never assigned a
  non-null value. The progress display actually worked purely through the `progress`
  parameter from ACTION_FEEDBACK events. Cleaned up during hand component conversion.
- **CSS selectors updated**: `#darknet-store-modal` → `#darknet-store`,
  `#level-select-modal` → `#level-select` to match new element IDs.
- **Modal components use `display:none` toggle**: Store, level-select, and end-screen
  components toggle `this.style.display` in `updated()` instead of relying on `nothing`
  return (which would leave the positioned element taking up space and intercepting
  pointer events).

## Bugs found during Playwright playtest

1. **Lit reactivity for mutable objects** — Node panel, mission pane, and hand strip
   weren't re-rendering after state changes (e.g. probe completing). Root cause: state
   objects are mutated in place, so the reference doesn't change, and Lit's default `===`
   check skips the re-render. Fix: shallow-copy objects (`{ ...node }`) in the bridge
   layer before setting them on components.

2. **End screen blocking pointer events** — `<starnet-end-screen>` has
   `position:fixed; inset:0; background:rgba(0,0,0,0.85)` in CSS. When closed, the
   element still existed in the DOM with those styles, creating an invisible 85% opacity
   dark overlay that dimmed the entire page and intercepted all clicks. Fix: toggle
   `display:none` when `open=false` (same pattern already used by store/level-select).

## Playwright playtest results

- [x] Log entries appear and auto-scroll
- [x] Mission pane shows objective status
- [x] HUD buttons: NEW RUN, PAUSE/RESUME, SAVE, LOAD, JACK OUT
- [x] HUD connection status updates (PASSIVE SCAN → ACTIVE: gateway)
- [x] Context menu appears on node selection (PROBE button)
- [x] Node panel shows detail on selection (type, grade, access, alert)
- [x] Node panel updates after probe (vulns revealed, alert yellow)
- [x] Exploit execution via console command works
- [x] End screen appears on jackout with correct stats
- [x] RUN AGAIN button starts fresh run
- [x] NEW RUN opens level select modal
- [x] Level select CANCEL closes modal
- [ ] ICE timers update in node panel (not tested — needs longer playthrough)
- [ ] Exploit card click interaction (tested via console, not click)
- [ ] Cancel overlay during execution (not tested)
- [ ] Darknet store (not tested — need WAN node access)
- [ ] SAVE/LOAD (not tested)
