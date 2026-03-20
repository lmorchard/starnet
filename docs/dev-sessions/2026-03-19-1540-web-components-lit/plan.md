# Web Components + lit-html — Plan

_Session: 2026-03-19-1540 | Issue: #67_

## Strategy

Each phase converts one or two components end-to-end: create component → update index.html → update bridge layer → remove old innerHTML code → verify. The game stays functional after every commit.

Start with the vendor bundle, then prove the pattern with the simplest component (log), then work through the rest in dependency order.

**Bridge layers** — two files currently own innerHTML rendering:
- `visual-renderer.js` — owns most UI panels (HUD, sidebar, hand, context menu, modals)
- `log-renderer.js` — owns the log pane

Both become thin orchestrators: listen to events → set properties on components.

**Base class** — create `js/ui/components/starnet-element.js` in Phase 2 (alongside the first component). All components extend this instead of repeating `createRenderRoot()`:
```js
import { LitElement } from "/dist/lit.js";
export class StarnetElement extends LitElement {
  createRenderRoot() { return this; }
}
```

**Import path** — use `/dist/lit.js` (absolute from server root) for the vendor bundle. Avoids ugly relative paths like `../../../dist/lit.js` from deep component files.

**Component loading** — each component file is a `<script type="module">` tag in index.html, loaded before main.js. Components self-register via `customElements.define()`. Module scripts are deferred by spec, so execution order follows document order — components will be defined before main.js runs.

**Light DOM pattern for all components:**
```js
import { html } from "/dist/lit.js";
import { StarnetElement } from "./starnet-element.js";

class StarnetFoo extends StarnetElement {
  static properties = {
    myProp: { type: Object },
  };
  render() {
    return html`<div class="foo">${this.myProp?.name}</div>`;
  }
}
customElements.define("starnet-foo", StarnetFoo);
```

---

## Phase 0: Commit session docs

Commit spec + plan before writing any code.

---

## Phase 1: Vendor bundle — lit → dist/lit.js

### Prompt

Set up the Lit vendor bundle for the Starnet game at `/Users/lorchard/devel/starnet-game-2026`.

1. Run `npm install lit` to add lit as a dependency.

2. Create `js/lit-vendor.js` — the esbuild entry point that re-exports from lit:
```js
export { LitElement, html, css, nothing } from "lit";
export { repeat } from "lit/directives/repeat.js";
export { classMap } from "lit/directives/class-map.js";
export { ifDefined } from "lit/directives/if-defined.js";
```
Include `repeat` (efficient list rendering), `classMap` (conditional classes), and `ifDefined` (optional attributes) — the directives most useful for this project.

3. Update the Makefile `bundle-vendor` target to also build `dist/lit.js`:
```
npx esbuild js/lit-vendor.js --bundle --outfile=dist/lit.js --format=esm --platform=browser --minify
```
Keep the existing `dist/vendor.js` build. Both should run from the same target.

4. Add `dist/lit.js` to `.gitignore` (same as `dist/vendor.js`).

5. Build it: `make bundle-vendor`. Verify `dist/lit.js` exists and is reasonable size (~15-20kb minified).

6. Create a minimal smoke test: a temporary HTML file or a quick node check that the ESM exports work. Then remove it.

Run `make check` to verify no regressions.

---

## Phase 2: Base class + first component — `<starnet-log>`

Prove the pattern with the simplest component. Log pane is a flat list with no children or complex interactions. Also create the base class so every subsequent component starts from it.

### Prompt

Create the StarnetElement base class and the first Lit web component: `<starnet-log>`.

**Create `js/ui/components/starnet-element.js`:**
```js
import { LitElement } from "/dist/lit.js";
export class StarnetElement extends LitElement {
  createRenderRoot() { return this; }
}
```

**Create `js/ui/components/starnet-log.js`:**
```js
import { html, repeat } from "/dist/lit.js";
import { StarnetElement } from "./starnet-element.js";
```

Component spec:
- **Tag:** `starnet-log`
- **Properties:** `entries` (Array) — array of `{ text: string, type: string }`
- **Render:** map entries to `<div class="log-entry log-${type}">${text}</div>`
- Use `repeat()` directive with entry index as key for efficient list updates
- **Scroll behavior:** In `willUpdate()`, capture whether the user is scrolled near the bottom (`scrollTop + clientHeight >= scrollHeight - 20`). In `updated()`, if they were near bottom, scroll to bottom. This keeps auto-scroll working without fighting manual scroll-up.

**Update `index.html`:**
- Replace `<div id="log-entries"></div>` with `<starnet-log id="log-entries"></starnet-log>`
- Add `<script type="module" src="js/ui/components/starnet-element.js"></script>` before component scripts
- Add `<script type="module" src="js/ui/components/starnet-log.js"></script>` before main.js

**Update `js/ui/log-renderer.js`:**
- In `renderLogPane()` (~L166), instead of building innerHTML, set `el.entries = visible` where `el` is the `<starnet-log>` element
- Remove the innerHTML template string code and the manual `el.scrollTop = el.scrollHeight`
- The component handles rendering and scroll behavior internally

**Verify in browser:** log entries appear, scroll-to-bottom works, no flickering on rapid updates. Confirm component loading order works — main.js should find `<starnet-log>` already defined.

Run `make check`.

---

## Phase 3: Simple leaf components — mission-pane, ice-timers

Two simple components with no children, no interactions, minimal templates.

### Prompt

Create two Lit web components for the Starnet game.

**1. `js/ui/components/starnet-mission-pane.js`:**
- **Tag:** `starnet-mission-pane`
- **Extends:** `StarnetElement`
- **Properties:** `mission` (Object — `{ targetName, complete }`), `phase` (String)
- **Render:** The mission briefing template currently in `syncMissionPane()` of visual-renderer.js (~L422-425). Mission label, target name, status (complete/in progress/run ended).
- Show nothing if `!this.mission`

**2. `js/ui/components/starnet-ice-timers.js`:**
- **Tag:** `starnet-ice-timers`
- **Extends:** `StarnetElement`
- **Properties:** `timers` (Array — `{ label, remaining, progress, type }`), `traceSeconds` (Number, nullable)
- **Render:** The timer list currently in `renderIceTimers()` (~L638) and the trace countdown. Each timer: `<div class="ice-timer ${cls}">⚠ ${label}: ${remaining}s</div>`. Trace: `<div class="ice-timer trace-timer">TRACE: ${seconds}s</div>`.

**Update `index.html`:**
- Replace `<div id="sidebar-mission"></div>` with `<starnet-mission-pane id="sidebar-mission"></starnet-mission-pane>`
- Add component script tags

**Update `visual-renderer.js`:**
- `syncMissionPane(state)` (~L406) → set `missionEl.mission = state.mission; missionEl.phase = state.phase`. Remove innerHTML code.
- `syncIceTimers()` (~L631) → set `iceTimerEl.timers = getVisibleTimers(); iceTimerEl.traceSeconds = state.traceSecondsRemaining`. The `.ice-timers-slot` div stays for now — replaced when node-panel is converted in Phase 6.

Verify in browser. Run `make check`.

---

## Phase 4: HUD

The HUD has button wiring in main.js (pause toggle, file input, dynamic imports) — handle this carefully as its own phase.

### Prompt

Create `js/ui/components/starnet-hud.js`:

- **Tag:** `starnet-hud`
- **Extends:** `StarnetElement`
- **Properties:** `alert` (String), `cash` (Number), `traceSeconds` (Number, nullable), `connectionStatus` (String), `connectionLabel` (String), `isCheating` (Boolean), `phase` (String), `paused` (Boolean)
- **Render:** The full HUD bar. Keep the existing CSS class structure:
  - Title: `★ STARNET`
  - Connection status: dot + label (classes: `detecting`, `active`, or default)
  - Alert: dot + level label (color driven by `alert` property)
  - Wallet: `¥{cash}`
  - Trace countdown (only shown when `traceSeconds !== null`)
  - Cheat indicator (only shown when `isCheating`)
  - Buttons: NEW RUN, PAUSE/RESUME (driven by `paused` property), SAVE, LOAD (wraps file input), JACK OUT (disabled when `phase !== "playing"`)
- **Events emitted:** Custom event `hud-action` with `detail: { action }` where action is one of: `"new-run"`, `"pause"`, `"save"`, `"jackout"`
- **Load button special case:** The LOAD button wraps a `<input type="file">`. On file change, emit `hud-action` with `{ action: "load", file: event.target.files[0] }` then reset the input.

**Update `index.html`:**
- Replace the entire `<header id="hud">...</header>` content with just `<starnet-hud id="hud"></starnet-hud>` (keep the `<header>` wrapper or make the component render as header)

**Update `visual-renderer.js`:**
- `syncHud(state)` (~L319) → set properties on `<starnet-hud>` element:
  - `hudEl.alert = state.globalAlert`
  - `hudEl.cash = state.player.cash`
  - `hudEl.traceSeconds = state.traceSecondsRemaining`
  - `hudEl.connectionStatus = ...` (compute from selectedNodeId + timer presence)
  - `hudEl.isCheating = state.isCheating`
  - `hudEl.phase = state.phase`
- Remove the direct DOM manipulation code from `syncHud()` (wallet text, alert dot, trace display, cheat label, etc.)
- **Keep** the sidebar-node and hand-strip parts of syncHud() — they move to their own components in later phases

**Update `main.js`:**
- Remove all manual button wiring (~L108-147): pause btn, save btn, load input, jackout btn, new-run btn
- Instead, listen for `hud-action` on the hud element and dispatch:
  - `"new-run"` → dynamic import level-select
  - `"pause"` → toggle pause/resume, set `hudEl.paused`
  - `"save"` → dynamic import save-load
  - `"load"` → dynamic import save-load, pass file
  - `"jackout"` → emit starnet:action

Verify in browser: all HUD buttons work, alert/wallet/trace update, connection status changes.
Run `make check`.

---

## Phase 5: Context menu

### Prompt

Create `js/ui/components/starnet-context-menu.js`:

- **Tag:** `starnet-context-menu`
- **Extends:** `StarnetElement`
- **Properties:** `actions` (Array of `{ id, label, desc }`), `nodeId` (String), `visible` (Boolean)
- **Render:** Button grid from the current `syncContextMenu()` code (~L246-275). Each button emits `starnet:action` with `{ actionId, nodeId }` on click.
- When `visible` is false or `actions` is empty, render nothing (or set `display:none`)
- Remove the manual cache-key optimization (`_lastContextMenuActionIds` at ~L33) — Lit's diffing handles this

**Update `index.html`:**
- Replace `<div id="node-context-menu" ...>` with `<starnet-context-menu id="node-context-menu" ...></starnet-context-menu>` (keep the positioning styles)

**Update `visual-renderer.js`:**
- `syncContextMenu(node, state)` (~L246) → compute actions, then set `menuEl.actions = actions; menuEl.nodeId = node.id; menuEl.visible = true`
- `clearContextMenu()` → set `menuEl.visible = false`
- `_positionContextMenu()` stays as-is (positions the element absolutely) — or move it into the component if cleaner
- Remove innerHTML code and `_lastContextMenuActionIds` cache

Verify: context menu appears on node selection, buttons work, positioning correct.
Run `make check`.

---

## Phase 6: Node panel

The largest component. Contains ICE timers as a child.

### Prompt

Create `js/ui/components/starnet-node-panel.js`:

- **Tag:** `starnet-node-panel`
- **Extends:** `StarnetElement`
- **Properties:**
  - `node` (Object — NodeState or null)
  - `selectedNodeId` (String)
  - `timers` (Array — passed through to child `<starnet-ice-timers>`)
  - `traceSeconds` (Number, nullable — passed through)
- **Render:** The full sidebar node detail template from `renderSidebarNode()` (~L432-496):
  - Header with type icon + label + untarget button
  - Grade, access level, alert state rows
  - Vulnerability list (if probed)
  - Macguffin list (if read)
  - `<starnet-ice-timers>` child component (pass timers + traceSeconds as properties)
  - "Select a node..." placeholder when `!this.node`
  - "Unknown node" placeholder for unrevealed nodes (visibility !== "revealed" and accessLevel === "locked")
- **Events emitted:** Untarget button emits `starnet:action` with `{ actionId: "untarget" }`

**Update `index.html`:**
- Replace `<div id="sidebar-node"></div>` with `<starnet-node-panel id="sidebar-node"></starnet-node-panel>`

**Update `visual-renderer.js`:**
- The sidebar node update in `syncHud()` (~L385-398) → set `nodePanelEl.node = node; nodePanelEl.selectedNodeId = state.selectedNodeId`
- `syncIceTimers()` (~L631) → set `nodePanelEl.timers = getVisibleTimers(); nodePanelEl.traceSeconds = state.traceSecondsRemaining`
- Remove `renderSidebarNode()` function and its innerHTML code
- Remove the separate `syncIceTimers()` innerHTML call (now handled by component child)
- The standalone `<starnet-ice-timers>` element from Phase 3 is now nested inside `<starnet-node-panel>` — remove the standalone element from index.html if it was placed there

Verify: node panel updates on selection, vulns/macguffins display, ice timers update, untarget button works.
Run `make check`.

---

## Phase 7: Hand strip

### Prompt

Create `js/ui/components/starnet-hand.js`:

- **Tag:** `starnet-hand`
- **Extends:** `StarnetElement`
- **Properties:**
  - `cards` (Array — sorted ExploitCard[])
  - `selectedNode` (Object — NodeState or null, for match indication)
  - `executingCardId` (String — id of card being executed, or null)
  - `execProgress` (Number — 0-1 execution progress)
  - `isSelecting` (Boolean — true when a node is selected and cards are selectable)
- **Render:** The hand template from `syncHandPane()` / `renderExploitCard()` (~L523-576):
  - Hand container with class `exploit-hand-selecting` or `exploit-hand-executing`
  - Each card: rarity class, quality pips, vuln type tags, match indicator, decay state
  - Selectable cards emit `starnet:action` with `{ actionId: "xploit", nodeId, exploitId, cardIndex }` on click
  - Executing card shows progress bar via CSS custom properties (`--exec-total`, `--exec-elapsed`)
  - Cancel overlay on executing card emits `starnet:action` with `{ actionId: "abort" }`
- Remove the manual `_lastHandKey` cache (~L521) — Lit handles diffing

**Update `index.html`:**
- Replace `<div id="hand-strip"></div>` with `<starnet-hand id="hand-strip"></starnet-hand>`

**Update `visual-renderer.js`:**
- `syncHandPane(state)` (~L523) → compute sorted hand, set properties on `<starnet-hand>`
- `updateExploitProgress()` → set `handEl.execProgress = progress`
- Remove `renderExploitCard()` (~L576), `syncHandPane()` innerHTML, and `_lastHandKey` cache

Verify: cards display, match indicators work, card selection dispatches exploit, cancel overlay works during execution, progress bar animates.
Run `make check`.

---

## Phase 8a: Modal — end screen

Split modals into separate sub-phases since each touches different files and has different wiring complexity. End screen is simplest — start here.

### Prompt

Create `js/ui/components/starnet-end-screen.js`:

- **Tag:** `starnet-end-screen`
- **Extends:** `StarnetElement`
- **Properties:** `open` (Boolean), `outcome` (String), `cash` (Number), `missionComplete` (Boolean), `nodesOwned` (Number), `nodesTotal` (Number), `macguffinsLooted` (Number), `isCheating` (Boolean)
- **Render:** The end screen overlay from `renderEndScreen()` (~L682-705). Backdrop + score box.
- **Events:** `run-again` on button click
- When `open` is false, render `nothing` (imported from lit)

**Update `index.html`:**
- Add `<starnet-end-screen id="end-screen"></starnet-end-screen>` inside `#graph-container`
- Add component script tag

**Update `visual-renderer.js`:**
- `renderEndScreen(state)` (~L654) → set properties + `endEl.open = true`
- Remove dynamic element creation (`document.createElement`, `appendChild` at ~L666-670)

**Update `main.js`:**
- Wire `run-again` event on end-screen element → dispatch `starnet:action:run-again` (or the existing handler)

Verify: end screen shows on jackout/trace, run-again button works.
Run `make check`.

---

## Phase 8b: Modal — darknet store

### Prompt

Create `js/ui/components/starnet-store.js`:

- **Tag:** `starnet-store`
- **Extends:** `StarnetElement`
- **Properties:** `open` (Boolean), `catalog` (Array), `cash` (Number)
- **Render:** The store modal from `store.js` (~L23-47). Catalog list with buy buttons. Disable buy buttons when cash is insufficient.
- **Events:** `buy` with `{ vulnId, index }` on purchase, `close` on backdrop click or close button
- When `open` is false, render `nothing`

**Update `index.html`:**
- Add `<starnet-store id="darknet-store"></starnet-store>` inside `#graph-container`

**Update `store.js`:**
- `openDarknetsStore(state)` (~L23) → set properties + `storeEl.open = true`
- Listen for `buy` event → call `buyFromStore()`, update `storeEl.cash` and `storeEl.catalog`
- Listen for `close` event → `storeEl.open = false`, resume timers
- Remove dynamic modal creation/destruction (`document.createElement`, `appendChild`, `remove()`)
- Remove internal `renderModal()` innerHTML code (~L26-47)

Verify: store opens from WAN node, buy works, cash updates live, close works via backdrop and button.
Run `make check`.

---

## Phase 8c: Modal — level select

### Prompt

Create `js/ui/components/starnet-level-select.js`:

- **Tag:** `starnet-level-select`
- **Extends:** `StarnetElement`
- **Properties:** `open` (Boolean), `networks` (Array of names), `defaults` (Object — seed, threat, etc.)
- **Render:** The level select form from `level-select.js` (~L47-90). Network picker, seed input, threat grade select. Show/hide generated network budget fields based on network selection (~L127-131).
- **Events:** `start` with `{ url }` (caller navigates), `close` on backdrop/button
- When `open` is false, render `nothing`

**Update `index.html`:**
- Add `<starnet-level-select id="level-select"></starnet-level-select>` inside `#graph-container`

**Update `level-select.js`:**
- `openLevelSelect()` (~L40) → set defaults + `selectEl.open = true`
- Listen for `start` event → `location.href = url`
- Listen for `close` event → `selectEl.open = false`
- Remove dynamic modal creation (~L47-90, L134, L147-149)

Verify: new run button opens level select, form fields work, start navigates, close works.
Run `make check`.

---

## Phase 9: Cleanup + docs

### Prompt

Final cleanup pass:

1. **visual-renderer.js audit** — remove any remaining innerHTML code, dead rendering functions, unused cache variables (`_lastHandKey`, `_lastContextMenuActionIds`, `contextMenuNodeId`). The file should now be a thin bridge: event subscriptions → component property setters. List what remains and confirm it's all bridge code.

2. **Import cleanup** — verify all component script tags are in index.html in correct order (starnet-element first, then components, then main.js).

3. **Update CLAUDE.md** — add `js/ui/components/` to the file structure listing. Note the Lit web component pattern and light DOM convention. Update `make bundle-vendor` docs to note it builds both `dist/vendor.js` and `dist/lit.js`.

4. **Update MANUAL.md** — no gameplay changes, but if any user-visible labels or behaviors changed during conversion, reflect them.

5. Verify the full game works end-to-end in browser: play through a run, test all UI panels, modals, card interactions, store, level select, end screen.

6. Run `make check` — ensure all tests pass (tests don't touch DOM components, so they should be unaffected).

7. Update session notes with summary of what was done, any surprises, and any follow-up work identified.
