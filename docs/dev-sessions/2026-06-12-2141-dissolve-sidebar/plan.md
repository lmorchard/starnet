# Dissolve the Sidebar / Maximize the Graph — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the right sidebar, fold node detail into a graph-anchored node inspector, rehome mission/vitals/hand, and reclaim the freed width for the network graph.

**Architecture:** Vanilla ES modules + Lit light-DOM components. A single `visual-renderer.js` bridge subscribes to game events (`STATE_CHANGED`, `TIMERS_UPDATED`) and pushes properties onto components by `id`. UI components emit DOM CustomEvents (`hud-action`, `starnet:action`) handled in `main.js`. All persistent state lives in one object (`js/core/state/`) and round-trips through save/load.

**Tech Stack:** HTML/CSS/JS, Lit, Cytoscape.js, JSDoc `@ts-check`, `node:test` (run via `make test`), `make check` (tsc + tests).

---

## Verification philosophy for this plan

This is a UI-relocation overhaul. Two kinds of verification apply, and the plan uses each where it fits — this is deliberate, not a shortcut:

- **Automated TDD** for the extractable *pure logic*: the inspector positioning geometry (Task 1.1) and the UI-flag save/load round-trip (Task 6.1). These get real failing-test-first cycles.
- **Visual checkpoint** for layout/CSS/reparenting, per the project's staged-review workflow (spec "Delivery & staging"). Each stage ends with `make serve` + a concrete in-browser checklist and a commit. DOM-layout assertions in `node:test` would be brittle and low-value here; the human checkpoint is the verification.

Run `make check` at the end of every stage regardless (type safety + existing test suite must stay green).

## File map

**Stage 1 — Node inspector**
- Create: `js/ui/inspector-position.js` — pure positioning geometry (testable).
- Create: `tests/inspector-position.test.js` — unit tests for the geometry.
- Modify: `js/ui/components/starnet-context-menu.js` — add header + footer regions; rename intent to "inspector".
- Modify: `js/ui/visual-renderer.js` — feed inspector header/footer/timers; use new positioner; push timers on `TIMERS_UPDATED`; drop `#sidebar-node` writes.
- Modify: `css/style.css` — inspector header/footer styles (reuse `.nd-*` rules).
- Modify: `index.html` — remove `<starnet-node-panel>`; the inspector keeps `id="node-context-menu"`.
- Delete (end of stage): `js/ui/components/starnet-node-panel.js` + its `<script>` tag in `index.html`. `starnet-ice-timers.js` is reused by the inspector footer.

**Stage 2 — Mission → header + hamburger**
- Modify: `js/ui/components/starnet-hud.js` — mission block; hamburger toggle; collapsible button group.
- Modify: `js/ui/main.js` — `hud-action` `toggle-menu` case; seed `paused`/menu state.
- Modify: `js/ui/visual-renderer.js` — `syncMissionPane` targets the HUD; `syncHud` reads `state.ui.menuOpen`.
- Modify: `js/core/state/index.js`, `js/core/types.js` — add `state.ui` (see Task 6.1).
- Modify: `js/ui/console.js` — `menu` toggle command (GUI/console symmetry).
- Modify: `index.html` — remove `<starnet-mission-pane>` from sidebar.
- CSS: header layout for mission + hamburger.

**Stage 3 — Vitals → floating insets**
- Modify: `index.html` — move `#vital-stack` (the two `<starnet-waveform>`s) into `#graph-container` as an overlay.
- Modify: `css/style.css` — position `#vital-stack` absolute upper-right; `pointer-events` scoped.
- `syncVitals` in `visual-renderer.js` is unchanged (targets the same element ids).

**Stage 4 — Hand → terminal split + collapse**
- Modify: `index.html` — move `<starnet-hand>` into the `#log-pane` region with a splitter.
- Modify: `js/ui/components/starnet-hand.js` — collapse control + `collapsed` property.
- Modify: `js/ui/visual-renderer.js` — `syncHandPane` sets `collapsed` from `state.ui.handCollapsed`.
- Modify: `js/ui/main.js` + `js/ui/console.js` — handle/emit hand collapse toggle.
- Modify: resize wiring (`initResizers`, `js/ui/resizers.js` or wherever splitters live) — register the new split, drop `sidebarW`.

**Stage 5 — Remove sidebar + reflow**
- Modify: `index.html` — delete `<aside id="sidebar">` and its column splitter.
- Modify: `css/style.css` — remove `#sidebar`, `--sidebar-w`, `sidebarW` rules; `#main` single full-width column.

**Cross-cutting (final stage)**
- Modify: `MANUAL.md` — UI/layout section.
- Verify: `preview.html` / `js/ui/preview.js` and the playground entrypoint don't reference removed ids (`grep` shows no current references — confirm).

---

## Stage 1 — Node inspector

### Task 1.1: Extract + test the positioning geometry (TDD)

**Files:**
- Create: `js/ui/inspector-position.js`
- Test: `tests/inspector-position.test.js`

The risk Les flagged is positioning across node/pan/zoom. Pull the geometry out of the
DOM-coupled `_positionContextMenu` into a pure function so it can be tested, and change the
vertical rule from "center on node" to "anchor header-top + clamp top into view" so header +
actions stay visible even when the footer is tall (no-scroll decision).

- [ ] **Step 1: Write the failing test**

```js
// tests/inspector-position.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeInspectorPosition } from "../js/ui/inspector-position.js";

const container = { w: 800, h: 600 };
const popup = { w: 200, h: 160 };

test("places to the right of the node when there is room", () => {
  const node = { x: 300, y: 300, r: 20 };
  const { left, onRight } = computeInspectorPosition({ node, popup, container });
  assert.equal(onRight, true);
  assert.equal(left, 300 + 20 + 20); // pos.x + r + gap
});

test("flips left when the popup would clip the right edge", () => {
  const node = { x: 760, y: 300, r: 20 };
  const { left, onRight } = computeInspectorPosition({ node, popup, container });
  assert.equal(onRight, false);
  assert.equal(left, 760 - 20 - 20 - 200); // pos.x - r - gap - w
});

test("anchors header near the node top, clamped into view", () => {
  const node = { x: 300, y: 300, r: 20 };
  const { top } = computeInspectorPosition({ node, popup, container });
  // header-top anchor = node top edge (pos.y - r), clamped to >= 4
  assert.equal(top, 300 - 20);
});

test("a popup taller than the container pins to the top (header+actions stay visible)", () => {
  const node = { x: 300, y: 550, r: 20 };
  const tall = { w: 200, h: 720 }; // taller than container
  const { top } = computeInspectorPosition({ node, popup: tall, container });
  assert.equal(top, 4); // pinned to top margin; footer overflows the bottom by design
});

test("near the bottom edge, shifts up so the popup fits when it can", () => {
  const node = { x: 300, y: 560, r: 20 };
  const { top } = computeInspectorPosition({ node, popup, container });
  assert.equal(top, container.h - popup.h - 4); // 600 - 160 - 4 = 436
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `node --test tests/inspector-position.test.js`
Expected: FAIL — `computeInspectorPosition` is not defined.

- [ ] **Step 3: Implement the pure function**

```js
// js/ui/inspector-position.js
// @ts-check
// Pure geometry for placing the node inspector popup relative to its anchor node.
// No DOM/Cytoscape access — caller supplies measured rects. Tested in isolation.

const GAP = 20;
const MARGIN = 4;

/**
 * @param {{ node: {x:number,y:number,r:number}, popup: {w:number,h:number}, container: {w:number,h:number} }} args
 * @returns {{ left:number, top:number, onRight:boolean }}
 */
export function computeInspectorPosition({ node, popup, container }) {
  // Horizontal: prefer right of node, flip left if clipped.
  const onRight = node.x + node.r + GAP + popup.w <= container.w;
  const left = onRight
    ? node.x + node.r + GAP
    : node.x - node.r - GAP - popup.w;

  // Vertical: anchor the header top near the node's top edge, then clamp so the
  // top never rises above MARGIN. When the popup is taller than the container the
  // min() goes negative and the max() pins it to MARGIN — header + actions stay
  // on-screen, an overlong footer runs off the bottom (no-scroll decision).
  const topRaw = node.y - node.r;
  const top = Math.max(MARGIN, Math.min(topRaw, container.h - popup.h - MARGIN));

  return { left, top, onRight };
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `node --test tests/inspector-position.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add js/ui/inspector-position.js tests/inspector-position.test.js
git commit -m 'feat(inspector): pure positioning geometry with header-top clamp'
```

### Task 1.2: Wire the positioner into visual-renderer

**Files:**
- Modify: `js/ui/visual-renderer.js:184-215` (`_positionContextMenu`)

- [ ] **Step 1:** Import the function at the top of `visual-renderer.js`:

```js
import { computeInspectorPosition } from "./inspector-position.js";
```

- [ ] **Step 2:** Replace the body of `_positionContextMenu` to delegate the math:

```js
function _positionContextMenu(nodeId) {
  const menu = document.getElementById("node-context-menu");
  if (!menu || !nodeId) return;
  const cy = getCy();
  if (!cy) return;
  const node = cy.getElementById(nodeId);
  if (!node || node.length === 0) return;

  const pos = node.renderedPosition();
  const container = cy.container();
  const { left, top, onRight } = computeInspectorPosition({
    node: { x: pos.x, y: pos.y, r: node.renderedWidth() / 2 },
    popup: { w: menu.offsetWidth, h: menu.offsetHeight },
    container: { w: container.offsetWidth, h: container.offsetHeight },
  });

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.style.textAlign = onRight ? "left" : "right";
}
```

- [ ] **Step 3:** `make check` — confirm tsc + tests still pass.
- [ ] **Step 4: Commit**

```bash
git add js/ui/visual-renderer.js
git commit -m 'refactor(inspector): position context menu via pure geometry'
```

### Task 1.3: Add header + footer regions to the inspector component

**Files:**
- Modify: `js/ui/components/starnet-context-menu.js`

The component currently renders only action buttons. Add a `node` property (the full node
object) and a `timers` property, and render header → actions → footer. Reuse the existing
`.nd-*` markup classes from the old node panel so styling carries over; the footer reuses
`<starnet-ice-timers>`.

- [ ] **Step 1:** Add properties to the component:

```js
static properties = {
  actions: { type: Array },
  nodeId: { type: String },
  visible: { type: Boolean },
  node: { type: Object },      // full NodeState for header + footer
  timers: { type: Array },     // live ICE/action timers
};
```
Initialize `this.node = null; this.timers = [];` in the constructor.

- [ ] **Step 2:** Restructure `render()` to three regions. Header + footer reproduce what
`starnet-node-panel.js` rendered (identity row, GRADE/ACCESS/ALERT, vulnerabilities, contents),
plus the obscured-node hint. Import the glyph helpers the panel used:

```js
import { isObscured } from "../../core/state.js";
import { vulnGlyphDataUri } from "../vuln-glyphs.js";
import { alertLampDataUri } from "../indicator-glyphs.js";
```

Render order inside the visible wrapper:
1. **Header** — `.insp-hd`: `[TYPE] label` line, then `GRADE · ACCESS · <lamp> ALERT`. For an
   obscured node, render the `[???] sig-N` alias + access hint instead (port the `isObscured`
   branch from `starnet-node-panel.js:43-51`).
2. **Actions** — the existing `this.actions.map(...)` button list, unchanged.
3. **Footer** — `<starnet-ice-timers .timers=${this.timers}>` first, then vulnerabilities
   (port `_renderVulns`), then contents (port `_renderMacguffins`). Omit empty sections.

Port `_renderVulns` and `_renderMacguffins` verbatim from `starnet-node-panel.js:88-126` into
this component (they reference only the node object). Guard the whole header/footer on
`this.node` being present so the picker-less path still works.

- [ ] **Step 3: Visual checkpoint** (deferred to stage close — needs the renderer wiring in 1.4).
- [ ] **Step 4: Commit** after 1.4 (the component + its data source land together).

### Task 1.4: Feed the inspector from visual-renderer; push timers each tick

**Files:**
- Modify: `js/ui/visual-renderer.js` (`syncContextMenu`, `syncIceTimers`, `syncHud` end-screen reset)

- [ ] **Step 1:** In `syncContextMenu`, after setting `menu.actions`, also pass the node and timers:

```js
menu.node = { ...node };               // header + footer source (new ref for Lit)
menu.timers = getVisibleTimers();      // initial timer snapshot
menu.nodeId = node.id;
menu.visible = true;
```

- [ ] **Step 2:** Repoint `syncIceTimers` from the deleted panel to the inspector, and reposition
after the timer set (timer rows appearing/disappearing changes popup height):

```js
function syncIceTimers() {
  const menu = /** @type {any} */ (document.getElementById("node-context-menu"));
  if (!menu || !menu.visible) return;
  menu.timers = getVisibleTimers();
  menu.updateComplete.then(() => _positionContextMenu(contextMenuNodeId));
}
```

- [ ] **Step 3:** Remove the `#sidebar-node` writes in `syncHud`: delete the
`nodePanelEl` block (`visual-renderer.js:405-410`) and the two `sidebar-node` resets in the
end-screen branch (`visual-renderer.js:392-393`).

- [ ] **Step 4:** Remove `<starnet-node-panel>` from `index.html` (the `<starnet-node-panel id="sidebar-node">`
line) and its `<script type="module" src=".../starnet-node-panel.js">` tag. Delete
`js/ui/components/starnet-node-panel.js`.

- [ ] **Step 5:** Move the inspector header/footer CSS into `css/style.css`. The `.nd-*`,
`.ice-timers`/`.ice-timer*`, `.macguffin`, `.vuln-*` rules already exist and are reused; add
`.insp-hd` (fixed height, magenta bottom border) and scope the footer below the action list.
Keep the `#node-context-menu` magenta border + glow.

- [ ] **Step 6: `make check`.**

- [ ] **Step 7: VISUAL CHECKPOINT (Stage 1).** `make serve`, open the game:
  - Select an **unprobed** node → header shows identity (or `[???]` alias), one PROBE action, footer hint.
  - Probe + exploit to **owned** → footer shows vulnerabilities then contents; actions stay at the same offset.
  - Reach a node with **ICE present** → ICE timer rows appear at the top of the footer and tick down live.
  - Drag/select nodes at **all four graph corners**, after **panning**, and at **min/max zoom** → header + actions never clip; popup never covers its own node; flips left near the right edge.
  - Confirm `status node <id>` in the console still prints full detail (legibility preserved).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m 'feat(inspector): fold node detail into anchored popup; remove sidebar node panel'
```

---

## Stage 2 — Mission → header + hamburger

> Depends on Task 6.1 (state.ui). Do Task 6.1 first, then this stage.

### Task 2.1: Mission block + hamburger in the HUD

**Files:**
- Modify: `js/ui/components/starnet-hud.js`

- [ ] **Step 1:** Add properties `mission: { type: Object }`, `phase` already exists, and
`menuOpen: { type: Boolean }`. Initialize `this.mission = null; this.menuOpen = false;`.

- [ ] **Step 2:** Render a compact mission block in the header (port the status logic from
`starnet-mission-pane.js:20-38` into an inline horizontal form): `⬡ targetName` + status
(active ▶ / complete / failed via `missionMarkDataUri`). Render nothing when `!this.mission`.

- [ ] **Step 3:** Wrap NEW RUN / PAUSE / SAVE / LOAD in a button group whose visibility follows
`this.menuOpen`; add a hamburger button that emits `this._emit("toggle-menu")`. Leave JACK OUT
and the cheat label outside the group (always visible):

```js
<button id="hud-menu-btn" title="Toggle controls" @click=${() => this._emit("toggle-menu")}>[ ☰ ]</button>
<div id="hud-menu" class="${this.menuOpen ? "open" : "closed"}">
  <button id="new-run-btn" ...>[ NEW RUN ]</button>
  <button id="pause-btn" ...>...</button>
  <button id="save-btn" ...>[ SAVE ]</button>
  <label id="load-btn" ...>[ LOAD ] ...</label>
</div>
<button id="jack-out-btn" ?disabled=${this.phase !== "playing"} @click=${() => this._emit("jackout")}>[ JACK OUT ]</button>
```

- [ ] **Step 4:** CSS in `css/style.css`: `#hud-menu.closed { display: none; }` (or a slide), and
header layout so the mission block and `☰` sit cleanly. Stroke-only, no fills (aesthetic rule).

### Task 2.2: Handle the toggle + feed mission to the HUD

**Files:**
- Modify: `js/ui/main.js:108-130` (`hud-action` switch)
- Modify: `js/ui/visual-renderer.js` (`syncMissionPane`, `syncHud`)
- Modify: `js/ui/console.js`

- [ ] **Step 1:** Add a `toggle-menu` case to the `hud-action` switch in `main.js`. Toggle
`state.ui.menuOpen` via a new setter (Task 6.1) and reflect it on `hudEl.menuOpen`. Because this
is pure UI state, update the element immediately *and* persist via the setter so save/load works:

```js
case "toggle-menu": {
  const open = toggleMenuOpen();      // setter returns the new value
  hudEl.menuOpen = open;
  break;
}
```

- [ ] **Step 2:** Point `syncMissionPane` at the HUD instead of the sidebar element, and set
`menuOpen` in `syncHud`:

```js
function syncMissionPane(state) {
  const hudEl = /** @type {any} */ (document.getElementById("hud"));
  if (!hudEl) return;
  hudEl.mission = state.mission ? { ...state.mission } : null;
}
```
In `syncHud`, add `hudEl.menuOpen = state.ui.menuOpen;`.

- [ ] **Step 3:** Remove `<starnet-mission-pane id="sidebar-mission">` from `index.html` (keep the
component file; it's harmless, but the mount is gone — or delete it and its `<script>` if unused).

- [ ] **Step 4:** Add a console `menu` command (GUI/console symmetry) that emits the same
`hud-action`/setter path. Match the existing command pattern in `console.js`.

- [ ] **Step 5: `make check`.**

- [ ] **Step 6: VISUAL CHECKPOINT (Stage 2).** Mission shows in the header with correct status
(win/lose a quick run to see complete/failed). `☰` hides/shows NEW RUN/PAUSE/SAVE/LOAD; JACK OUT
always present. Console `menu` toggles identically to the button.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m 'feat(hud): mission in header + hamburger button group (JACK OUT always shown)'
```

---

## Stage 3 — Vitals → floating insets over the graph

### Task 3.1: Reparent the waveform strips as a graph overlay

**Files:**
- Modify: `index.html` (move `#vital-stack`)
- Modify: `css/style.css`

- [ ] **Step 1:** Move the `<div id="vital-stack">…</div>` (the two `<starnet-waveform>`s) out of
`<aside id="sidebar">` and into `#graph-container`, as a sibling of `#overlay-layer` /
`#node-context-menu`. `syncVitals` targets `#vital-ecg` / `#vital-deck` by id, so no JS change.

- [ ] **Step 2:** CSS — position the stack absolutely in the upper-right of the graph, above the
graph (z-index between graph and the context menu), with `pointer-events: none` on the container
so it never eats pan/zoom (the waveforms are display-only). Give it a sensible fixed width.

- [ ] **Step 3: `make check`.**

- [ ] **Step 4: VISUAL CHECKPOINT (Stage 3).** Health + deck traces animate in the upper-right
over the graph; panning/zooming the graph works with the cursor over and around the panels;
traces still respond to taking damage / deck loss (cheat or play to verify).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m 'feat(vitals): float health/deck traces as upper-right graph overlay'
```

---

## Stage 4 — Hand → terminal split + collapse

### Task 4.1: Move the hand into the log/console region with a collapse control

**Files:**
- Modify: `index.html` (relocate `<starnet-hand>`, add splitter)
- Modify: `js/ui/components/starnet-hand.js` (collapse control + property)
- Modify: `js/ui/visual-renderer.js` (`syncHandPane`)
- Modify: `js/ui/main.js`, `js/ui/console.js` (toggle handling)
- Modify: resize wiring (`initResizers`)

- [ ] **Step 1:** In `index.html`, move `<starnet-hand id="hand-strip">` out of the sidebar into
the `#graph-column`, beside/below `#log-pane`, with a splitter between them (mirror the existing
`splitter--row`/`data-resize` pattern). Remove the sidebar's `handH` splitter.

- [ ] **Step 2:** Add `collapsed: { type: Boolean }` to `starnet-hand.js` (init `false`) and a
collapse toggle control in its render (a small stroked `[ ▾ ]` / `[ ▸ ]`). The control emits a
bubbling CustomEvent, e.g. `this.dispatchEvent(new CustomEvent("hud-action", { bubbles:true, detail:{ action:"toggle-hand" }}))`,
reusing the existing `hud-action` channel handled in `main.js`. When `collapsed`, render only the
header/toggle row, not the cards.

- [ ] **Step 3:** In `syncHandPane`, add `handEl.collapsed = state.ui.handCollapsed;`.

- [ ] **Step 4:** Add a `toggle-hand` case to the `hud-action` switch in `main.js` (toggle
`state.ui.handCollapsed` via setter, reflect on `handEl.collapsed`), and a console `hand` command
for symmetry.

- [ ] **Step 5:** Update `initResizers` / the resize module: register the new hand split, remove
the `sidebarW` and `handH` (sidebar) entries.

- [ ] **Step 6: `make check`.**

- [ ] **Step 7: VISUAL CHECKPOINT (Stage 4).** Hand sits in the terminal split, cards selectable
and exploits executable from there; collapse/expand works via control and via console `hand`;
splitter resizes; collapsed state persists across a save/load.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m 'feat(hand): move into terminal split with collapse control'
```

---

## Stage 5 — Remove the sidebar + reflow

### Task 5.1: Delete the empty sidebar, reflow graph to full width

**Files:**
- Modify: `index.html`, `css/style.css`

- [ ] **Step 1:** With mission, vitals, node panel, and hand all rehomed, the `<aside id="sidebar">`
is empty. Delete it and the `splitter--col` `data-resize="sidebarW"` element from `index.html`.

- [ ] **Step 2:** In `css/style.css`, remove `#sidebar`, `--sidebar-w`, the `sidebarW` splitter
rules, and any `#sidebar-*` selectors now dead. Make `#main` a single full-width `#graph-column`.

- [ ] **Step 3: `make check`.**

- [ ] **Step 4: VISUAL CHECKPOINT (Stage 5).** Graph fills the reclaimed width; nothing orphaned
or overlapping; log/hand row spans full width beneath the graph; inspector still positions
correctly in the now-wider container.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m 'feat(layout): remove sidebar, reflow graph to full width'
```

---

## Stage 6 — State plumbing & cross-cutting

### Task 6.1: Add `state.ui` toggles with save/load round-trip (TDD)

> Do this BEFORE Stage 2 (Stage 2/4 read `state.ui`). Placed here for grouping; sequence it first.

**Files:**
- Modify: `js/core/state/index.js` (initState literal ~line 164-184)
- Modify: `js/core/types.js` (GameState typedef ~line 320)
- Modify: `js/core/state/game.js` (setters)
- Test: `tests/integration.test.js` (or a new `tests/ui-state.test.js`)

- [ ] **Step 1: Write the failing test** — UI flags exist, toggle, and survive a state
serialize/restore round-trip:

```js
// tests/ui-state.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { initGame } from "../js/core/game.js"; // adjust import to the project's init entry
import { getState } from "../js/core/state.js";
import { toggleMenuOpen, toggleHandCollapsed } from "../js/core/state/game.js";

test("ui flags default closed/expanded and toggle", () => {
  initGame({ seed: "ui-test" });
  const s = getState();
  assert.equal(s.ui.menuOpen, false);
  assert.equal(s.ui.handCollapsed, false);
  assert.equal(toggleMenuOpen(), true);
  assert.equal(getState().ui.menuOpen, true);
  assert.equal(toggleHandCollapsed(), true);
});

test("ui flags survive a JSON round-trip", () => {
  initGame({ seed: "ui-test" });
  toggleMenuOpen();
  const snapshot = JSON.parse(JSON.stringify(getState()));
  assert.equal(snapshot.ui.menuOpen, true);
  assert.equal(snapshot.ui.handCollapsed, false);
});
```
(Confirm the actual `initGame`/`getState` import paths used by the existing tests and match them.)

- [ ] **Step 2: Run it, verify it fails** — `node --test tests/ui-state.test.js` → `s.ui` undefined.

- [ ] **Step 3: Implement.** In `state/index.js` initState literal, add alongside `selectedNodeId`:

```js
ui: { menuOpen: false, handCollapsed: false },
```

In `state/game.js`, add setters returning the new value:

```js
/** Toggle the HUD hamburger panel. @returns {boolean} new menuOpen */
export function toggleMenuOpen() {
  let v;
  mutate((s) => { s.ui.menuOpen = !s.ui.menuOpen; v = s.ui.menuOpen; });
  return v;
}

/** Toggle the exploit-hand collapse. @returns {boolean} new handCollapsed */
export function toggleHandCollapsed() {
  let v;
  mutate((s) => { s.ui.handCollapsed = !s.ui.handCollapsed; v = s.ui.handCollapsed; });
  return v;
}
```

In `types.js` GameState typedef, add: `*   ui: { menuOpen: boolean, handCollapsed: boolean },`

- [ ] **Step 4: Run it, verify it passes** — `node --test tests/ui-state.test.js`.

- [ ] **Step 5: `make check`** (tsc must accept the new typedef field).

- [ ] **Step 6: Commit**

```bash
git add js/core/state/index.js js/core/state/game.js js/core/types.js tests/ui-state.test.js
git commit -m 'feat(state): persisted ui.menuOpen / ui.handCollapsed toggles'
```

### Task 6.2: Docs + harness sweep

**Files:**
- Modify: `MANUAL.md`
- Verify: `preview.html`, `js/ui/preview.js`, playground entrypoint

- [ ] **Step 1:** Update `MANUAL.md`: node inspector replaces the sidebar node panel; mission in
header; vitals as graph overlays; hand in terminal split + collapse; hamburger control.

- [ ] **Step 2:** `grep -rn "sidebar-node\|sidebar-mission\|vital-stack\|hand-strip\|node-panel" preview.html js/ui/preview.js`
and the playground HTML. Current grep shows no references — confirm none broke. Fix any that did.

- [ ] **Step 3:** Full `make check`, then a census smoke: `make census SEEDS=10`. UI-only change
should not move balance; this confirms the engine still runs through the harness.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m 'docs(manual): reflect dissolved-sidebar layout; harness sweep'
```

---

## Self-review against the spec

- **Inspector (spec §1):** Tasks 1.1–1.4. Header/actions/footer, obscured node, live timers, no-scroll clamp. ✓
- **Mission → header + hamburger (spec §2):** Tasks 2.1–2.2. ✓
- **Vitals float (spec §3):** Task 3.1. ✓
- **Hand split + collapse (spec §4):** Task 4.1. ✓
- **Sidebar removal (spec §5):** Task 5.1. ✓
- **State persistence (spec State additions):** Task 6.1, sequenced first. ✓
- **GUI/console symmetry:** console commands in 2.2 (`menu`) and 4.1 (`hand`). ✓
- **MANUAL.md + preview/harness + census:** Task 6.2. ✓
- **Staged commits + visual checkpoint per stage:** every stage ends with a checkpoint + commit. ✓

**Sequencing note:** execute **Task 6.1 first** (state plumbing), then Stage 1 → 2 → 3 → 4 → 5,
then Task 6.2. Stage 1 is independent of 6.1; Stages 2 and 4 require it.

**Known acceptance risk (recorded, owned by Les):** with no footer scroll, a pathological
node could exceed viewport height; Task 1.1's top-clamp keeps header + actions visible in that
case (footer overflows the bottom). Verified by the tall-popup unit test and the Stage 1 checkpoint.
