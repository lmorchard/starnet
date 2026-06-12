# Drag-resizable UI regions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the player drag three borders — sidebar width, graph/log height, and hand height — to rebalance the layout, with sizes persisted across reloads.

**Architecture:** Three CSS custom properties on `#app` (`--sidebar-w`, `--log-h`, `--hand-h`) drive the flex bases of `#sidebar`, `#log-pane`, and `#hand-strip`. Thin flex-participating `.splitter` bars between the panes capture pointer drags and update those vars. A small `layout-store.js` persists the sizes to `localStorage` (outside game state); `resizers.js` wires the drag/double-click behavior. Pure size-clamping and load-normalization logic is unit-tested; the DOM wiring is verified live in the browser.

**Tech Stack:** Vanilla ES modules, Pointer Events API, CSS flexbox + custom properties, `node:test` for units. No new dependencies.

---

## File structure

- **Create** `js/ui/layout-store.js` — `DEFAULT_LAYOUT`, `SIZE_BOUNDS`, pure `clampSize()` + `normalizeLayout()`, and `loadLayout()` / `saveLayout()` (localStorage). One responsibility: persistence + validation of layout sizes.
- **Create** `js/ui/layout-store.test.js` — unit tests for `clampSize` and `normalizeLayout`.
- **Create** `js/ui/resizers.js` — `initResizers()`: applies the loaded layout to CSS vars and wires the three dividers (pointer drag, clamp, debounced save, double-click reset).
- **Modify** `css/style.css` — flex-basis via vars on `#sidebar` / `#log-pane` / `#hand-strip`, the `#log-pane`/`#log-entries` refactor, removal of the `#hand-strip` `max-height: 33%`, and `.splitter` styles.
- **Modify** `index.html` — three `<div class="splitter">` elements at the pane borders.
- **Modify** `js/ui/main.js` — call `initResizers()` in `init()`.

---

## Task 1: layout-store — defaults, bounds, and pure `clampSize`

**Files:**
- Create: `js/ui/layout-store.js`
- Test: `js/ui/layout-store.test.js`

- [ ] **Step 1: Write the failing test**

Create `js/ui/layout-store.test.js`:

```js
// @ts-check
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { clampSize, DEFAULT_LAYOUT, SIZE_BOUNDS } from "./layout-store.js";

describe("clampSize", () => {
  test("passes through an in-range value", () => {
    assert.equal(clampSize(400, 280, 1200), 400);
  });
  test("clamps below min up to min", () => {
    assert.equal(clampSize(100, 280, 1200), 280);
  });
  test("clamps above max down to max", () => {
    assert.equal(clampSize(5000, 280, 1200), 1200);
  });
  test("non-finite falls back to min", () => {
    assert.equal(clampSize(NaN, 280, 1200), 280);
    assert.equal(clampSize(Infinity, 280, 1200), 280);
    assert.equal(clampSize("nope", 280, 1200), 280);
  });
});

describe("DEFAULT_LAYOUT / SIZE_BOUNDS", () => {
  test("defaults are within their static bounds", () => {
    for (const key of Object.keys(DEFAULT_LAYOUT)) {
      const { min, max } = SIZE_BOUNDS[key];
      const v = DEFAULT_LAYOUT[key];
      assert.ok(v >= min && v <= max, `${key}=${v} out of [${min},${max}]`);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test js/ui/layout-store.test.js`
Expected: FAIL — cannot find module `./layout-store.js`.

- [ ] **Step 3: Write minimal implementation**

Create `js/ui/layout-store.js`:

```js
// @ts-check
// Persistence + validation for the resizable-layout sizes (sidebar width,
// log-pane height, hand height). UI chrome — deliberately kept OUT of the game
// state object so save/load of a run stays pure (see CLAUDE.md). Mirrors the
// load/save/normalize idiom of profile-store.js.

const LAYOUT_KEY = "starnet:layout";

/** Default sizes in px. `sidebarW` matches the historical fixed 400px. */
export const DEFAULT_LAYOUT = { sidebarW: 400, logH: 260, handH: 200 };

/**
 * Static sanity bounds used when normalizing a persisted payload. The live
 * viewport-relative maximum (≈50vw / 60vh / 60% of sidebar) is enforced during
 * drag in resizers.js; these just keep a stored value finite and on-screen.
 */
export const SIZE_BOUNDS = {
  sidebarW: { min: 280, max: 1200 },
  logH:     { min: 64,  max: 1200 },
  handH:    { min: 80,  max: 1200 },
};

/**
 * Clamp a size to [min, max]. Non-finite / non-number input falls back to min.
 * @param {unknown} px
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clampSize(px, min, max) {
  const n = typeof px === "number" ? px : NaN;
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test js/ui/layout-store.test.js`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```bash
git add js/ui/layout-store.js js/ui/layout-store.test.js
git commit -m 'feat: layout-store defaults, bounds, and clampSize'
```

---

## Task 2: layout-store — `normalizeLayout`, `loadLayout`, `saveLayout`

**Files:**
- Modify: `js/ui/layout-store.js`
- Test: `js/ui/layout-store.test.js`

- [ ] **Step 1: Write the failing test**

Append to `js/ui/layout-store.test.js`:

```js
import { normalizeLayout } from "./layout-store.js";

describe("normalizeLayout", () => {
  test("non-object payload returns the defaults", () => {
    assert.deepEqual(normalizeLayout(null), DEFAULT_LAYOUT);
    assert.deepEqual(normalizeLayout("x"), DEFAULT_LAYOUT);
    assert.deepEqual(normalizeLayout(42), DEFAULT_LAYOUT);
  });
  test("missing keys fall back to per-key defaults", () => {
    assert.deepEqual(normalizeLayout({ sidebarW: 500 }), {
      sidebarW: 500, logH: DEFAULT_LAYOUT.logH, handH: DEFAULT_LAYOUT.handH,
    });
  });
  test("out-of-range values are clamped to static bounds", () => {
    const out = normalizeLayout({ sidebarW: 99999, logH: 1, handH: 0 });
    assert.equal(out.sidebarW, SIZE_BOUNDS.sidebarW.max);
    assert.equal(out.logH, SIZE_BOUNDS.logH.min);
    assert.equal(out.handH, SIZE_BOUNDS.handH.min);
  });
  test("ignores unknown keys", () => {
    assert.deepEqual(normalizeLayout({ sidebarW: 400, bogus: 1 }), DEFAULT_LAYOUT);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test js/ui/layout-store.test.js`
Expected: FAIL — `normalizeLayout` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `js/ui/layout-store.js`:

```js
/**
 * Coerce an arbitrary parsed payload into a valid layout: every key from
 * DEFAULT_LAYOUT is taken from `raw` (clamped to its static bounds) or falls
 * back to the default. Unknown keys are dropped. Pure.
 * @param {unknown} raw
 * @returns {{ sidebarW: number, logH: number, handH: number }}
 */
export function normalizeLayout(raw) {
  const src = raw && typeof raw === "object" ? /** @type {any} */ (raw) : {};
  const out = /** @type {any} */ ({});
  for (const key of /** @type {(keyof typeof DEFAULT_LAYOUT)[]} */ (Object.keys(DEFAULT_LAYOUT))) {
    const { min, max } = SIZE_BOUNDS[key];
    out[key] = key in src ? clampSize(src[key], min, max) : DEFAULT_LAYOUT[key];
    // A present-but-invalid value clamps to min; if it was simply absent we used
    // the default above. Treat a min-clamped *default-equal* as fine either way.
  }
  return out;
}

/**
 * Load the layout from localStorage, normalized. Corrupt/absent payload →
 * defaults. Never throws.
 * @returns {{ sidebarW: number, logH: number, handH: number }}
 */
export function loadLayout() {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return { ...DEFAULT_LAYOUT };
    return normalizeLayout(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_LAYOUT };
  }
}

/**
 * Persist the layout (normalized first so we never store junk).
 * @param {{ sidebarW: number, logH: number, handH: number }} layout
 */
export function saveLayout(layout) {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(normalizeLayout(layout)));
  } catch {
    // storage full / unavailable — non-fatal, sizes just won't persist
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test js/ui/layout-store.test.js`
Expected: PASS (all tests, including the new `normalizeLayout` block).

Note: `loadLayout`/`saveLayout` touch `localStorage` and are not unit-tested in node (no DOM); they are thin wrappers over the tested `normalizeLayout` and verified live in Task 7.

- [ ] **Step 5: Commit**

```bash
git add js/ui/layout-store.js js/ui/layout-store.test.js
git commit -m 'feat: layout-store normalizeLayout + load/save'
```

---

## Task 3: CSS — flex-basis vars, log-pane refactor, hand cap removal, splitter styles

**Files:**
- Modify: `css/style.css` (`#log-pane` ~102, `#log-entries` ~115, `#sidebar` ~181, `#sidebar-node`/`#hand-strip` ~221-233)

No unit test (pure presentation); verified live in Task 7.

- [ ] **Step 1: Drive the three flex bases from CSS vars**

In `css/style.css`, change `#sidebar` (currently `flex: 0 0 400px;`):

```css
#sidebar {
  flex: 0 0 var(--sidebar-w, 400px);
  display: flex;
  flex-direction: column;
  background: var(--bg-panel);
  border-left: 1px solid var(--border);
  overflow: hidden;
}
```

Change `#log-pane` (currently `flex: 0 0 auto;`) to carry the basis, and let its
contents fill:

```css
#log-pane {
  flex: 0 0 var(--log-h, 260px);
  display: flex;
  flex-direction: column;
  background: var(--bg-panel);
  border-top: 1px solid var(--border);
  overflow: hidden;
  min-height: 0;
}
```

Change `#log-entries` from `flex: 0 0 14rem;` to fill the pane (console row stays
pinned by its own `flex: 0 0 auto` default):

```css
#log-entries {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  overflow-y: auto;
  padding: 0.3rem 1rem 0.3rem 1rem;
  min-height: 0;
}
```

- [ ] **Step 2: Hand-strip — basis var, drop the max-height cap**

Change `#hand-strip` (currently `flex: 0 0 auto; max-height: 33%;` plus the
comment added in #182). Remove the `max-height` and its comment; the `--hand-h`
basis + drag clamp now own the height:

```css
/* Height owned by the --hand-h var + the resizer's clamp (see resizers.js); the
   clamp's max (~60% of the sidebar) preserves the "don't crowd the node panel"
   intent that the old max-height: 33% served. */
#hand-strip {
  flex: 0 0 var(--hand-h, 200px);
  overflow-y: auto;
  border-top: 1px solid var(--border);
  background: var(--bg-panel);
  padding: 0.4rem 0.75rem;
}
```

- [ ] **Step 3: Splitter styles**

Add a new block (near the layout rules, e.g. after `#sidebar`):

```css
/* ── Resize splitters ───────────────────────────────────────
   Thin flex-participating bars between resizable panes. Stroke-only, no fill:
   a hairline (::before) that brightens to a cyan phosphene glow on hover/drag,
   inside a wider transparent hit zone so it stays easy to grab. */
.splitter {
  flex: 0 0 auto;
  position: relative;
  z-index: 4;            /* above panel chrome, below modals (store/level-select z10) */
  background: transparent;
  touch-action: none;    /* let Pointer Events own the drag gesture on touch */
}
.splitter::before {
  content: "";
  position: absolute;
  background: var(--border);
  transition: background 120ms, box-shadow 120ms;
}
.splitter:hover::before,
.splitter.dragging::before {
  background: var(--cyan);
  box-shadow: 0 0 6px var(--cyan);
}

/* Vertical bar between two side-by-side panes (sidebar split). */
.splitter--col {
  width: 10px;
  cursor: col-resize;
  align-self: stretch;
}
.splitter--col::before {
  top: 0; bottom: 0; left: 50%;
  width: 1px; transform: translateX(-0.5px);
}

/* Horizontal bar between two stacked panes (log split, hand split). */
.splitter--row {
  height: 10px;
  cursor: row-resize;
  align-self: stretch;
}
.splitter--row::before {
  left: 0; right: 0; top: 50%;
  height: 1px; transform: translateY(-0.5px);
}
```

- [ ] **Step 4: Commit**

```bash
git add css/style.css
git commit -m 'feat: CSS vars for resizable panes + splitter styles'
```

---

## Task 4: index.html — insert the three splitter elements

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add the graph↔log splitter**

Between `#graph-container` (closes at line 42) and `#log-pane` (line 43), insert:

```html
        <div class="splitter splitter--row" data-resize="logH" title="Drag to resize — double-click to reset"></div>
```

- [ ] **Step 2: Add the graph-column↔sidebar splitter**

Between `#graph-column` (closes at line 50) and `<aside id="sidebar">` (line 52), insert:

```html
      <div class="splitter splitter--col" data-resize="sidebarW" title="Drag to resize — double-click to reset"></div>
```

- [ ] **Step 3: Add the node↔hand splitter**

Between `<starnet-node-panel id="sidebar-node">` (line 64) and
`<starnet-hand id="hand-strip">` (line 65), insert:

```html
        <div class="splitter splitter--row" data-resize="handH" title="Drag to resize — double-click to reset"></div>
```

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m 'feat: add resize splitter elements to layout'
```

---

## Task 5: resizers.js — wire drag, clamp, persist, reset

**Files:**
- Create: `js/ui/resizers.js`

This module is DOM-coupled; its correctness is verified live (Task 7). The
numeric clamping it relies on is already covered by Task 1.

- [ ] **Step 1: Write the module**

Create `js/ui/resizers.js`:

```js
// @ts-check
// Wires the three layout splitters (sidebar width, log height, hand height).
// Each divider drags one CSS var on #app; the var drives a flex-basis (see
// css/style.css). Sizes load from / save to layout-store (localStorage).
//
// Pointer Events cover mouse + touch with one code path. The numeric clamp is
// clampSize() in layout-store (unit-tested); live viewport-relative maxima are
// computed here at drag time.

import { loadLayout, saveLayout, clampSize, DEFAULT_LAYOUT, SIZE_BOUNDS } from "./layout-store.js";

/**
 * Per-axis config. `cssVar` is set on #app; `delta(start, ev)` converts a
 * pointer position into a new size (the resized pane is below/right of the
 * divider, so moving toward it shrinks, away grows); `liveMax()` is the
 * viewport-relative ceiling enforced during drag.
 */
function axisConfig() {
  const sidebar = document.getElementById("sidebar");
  return {
    sidebarW: {
      cssVar: "--sidebar-w",
      vertical: false, // drag along X
      // sidebar is the RIGHT pane: moving left (smaller clientX) grows it
      sizeFrom: (startSize, startPos, pos) => startSize + (startPos - pos),
      liveMin: () => SIZE_BOUNDS.sidebarW.min,
      liveMax: () => Math.max(SIZE_BOUNDS.sidebarW.min, window.innerWidth * 0.5),
    },
    logH: {
      cssVar: "--log-h",
      vertical: true, // drag along Y
      // log-pane is the BOTTOM pane: moving up (smaller clientY) grows it
      sizeFrom: (startSize, startPos, pos) => startSize + (startPos - pos),
      liveMin: () => SIZE_BOUNDS.logH.min,
      liveMax: () => Math.max(SIZE_BOUNDS.logH.min, window.innerHeight * 0.6),
    },
    handH: {
      cssVar: "--hand-h",
      vertical: true,
      // hand is the BOTTOM pane: moving up grows it
      sizeFrom: (startSize, startPos, pos) => startSize + (startPos - pos),
      liveMin: () => SIZE_BOUNDS.handH.min,
      liveMax: () => {
        const h = sidebar ? sidebar.clientHeight : window.innerHeight;
        return Math.max(SIZE_BOUNDS.handH.min, h * 0.6);
      },
    },
  };
}

/** Read the current px size for an axis from the applied CSS var (fallback to default). */
function currentSize(app, cssVar, fallback) {
  const raw = getComputedStyle(app).getPropertyValue(cssVar).trim();
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Apply a full layout object to the #app CSS vars. */
function applyLayout(app, layout) {
  app.style.setProperty("--sidebar-w", `${layout.sidebarW}px`);
  app.style.setProperty("--log-h", `${layout.logH}px`);
  app.style.setProperty("--hand-h", `${layout.handH}px`);
}

/**
 * Initialize the resizers: apply the saved layout, then wire each splitter.
 * Idempotent enough for a single call from main.js init().
 */
export function initResizers() {
  const app = document.getElementById("app");
  if (!app) return;

  const layout = loadLayout();
  applyLayout(app, layout);

  const cfg = axisConfig();
  /** debounce timer for saves */
  let saveTimer = null;
  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveLayout({
        sidebarW: currentSize(app, "--sidebar-w", DEFAULT_LAYOUT.sidebarW),
        logH: currentSize(app, "--log-h", DEFAULT_LAYOUT.logH),
        handH: currentSize(app, "--hand-h", DEFAULT_LAYOUT.handH),
      });
    }, 250);
  };

  for (const el of document.querySelectorAll(".splitter")) {
    const axis = /** @type {HTMLElement} */ (el).dataset.resize;
    const c = axis && cfg[axis];
    if (!c) continue;

    el.addEventListener("pointerdown", (/** @type {PointerEvent} */ ev) => {
      ev.preventDefault();
      const startPos = c.vertical ? ev.clientY : ev.clientX;
      const startSize = currentSize(app, c.cssVar, DEFAULT_LAYOUT[axis]);
      el.classList.add("dragging");
      el.setPointerCapture(ev.pointerId);

      const onMove = (/** @type {PointerEvent} */ mv) => {
        const pos = c.vertical ? mv.clientY : mv.clientX;
        const next = clampSize(c.sizeFrom(startSize, startPos, pos), c.liveMin(), c.liveMax());
        app.style.setProperty(c.cssVar, `${next}px`);
      };
      const onUp = (/** @type {PointerEvent} */ up) => {
        el.classList.remove("dragging");
        el.releasePointerCapture(up.pointerId);
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        scheduleSave();
      };
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
    });

    // Double-click resets just this axis to its default.
    el.addEventListener("dblclick", () => {
      app.style.setProperty(c.cssVar, `${DEFAULT_LAYOUT[axis]}px`);
      scheduleSave();
    });
  }
}
```

- [ ] **Step 2: Lint**

Run: `make lint`
Expected: PASS (no new tsc errors). `resizers.js` is type-checked; `layout-store.js` is too.

- [ ] **Step 3: Commit**

```bash
git add js/ui/resizers.js
git commit -m 'feat: resizers.js — drag/persist/reset wiring for splitters'
```

---

## Task 6: main.js — call `initResizers()` at startup

**Files:**
- Modify: `js/ui/main.js` (import near line 18; call inside `init()` near line 66)

- [ ] **Step 1: Add the import**

After the existing UI imports (e.g. after line 18 `import { initProfileRunCommit } from "./profile-store.js";`):

```js
import { initResizers } from "./resizers.js";
```

- [ ] **Step 2: Call it in `init()`**

In `init()`, after `initConsole();` (line 66), add:

```js
  initResizers();  // apply saved layout + wire the resize splitters
```

- [ ] **Step 3: Lint**

Run: `make lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add js/ui/main.js
git commit -m 'feat: wire initResizers into app init'
```

---

## Task 7: Verify live + full check

**Files:** none (verification)

- [ ] **Step 1: Build vendor + serve (worktree has no dist/)**

```bash
make bundle-vendor
npx serve . -l 4319
```

- [ ] **Step 2: Manual verification in the browser** at `http://localhost:4319/`

Confirm each, then note results in `notes.md`:
- Drag the **sidebar** border left/right — sidebar widens/narrows, graph reflows, stops at ~280px / ~50vw.
- Drag the **log** border up/down — log area grows/shrinks, console row stays pinned, graph reflows, stops at min / ~60vh.
- Drag the **hand** border up/down — hand grows/shrinks, node panel takes the rest, stops at min / ~60% sidebar.
- Splitter hairline brightens cyan on hover/drag.
- **Double-click** each splitter resets that axis.
- Reload the page — all three sizes persist.
- In DevTools, run `localStorage.removeItem("starnet:layout")` then reload — layout returns to defaults, no errors.

- [ ] **Step 3: Full check**

Run: `make check`
Expected: lint clean; all tests pass (including the new `layout-store.test.js`).

- [ ] **Step 4: Update MANUAL.md**

Per CLAUDE.md, the manual must reflect new behavior. Add a short note (in the UI/interface section) that the sidebar, log, and hand borders are drag-resizable and double-click resets a divider. Then:

```bash
git add MANUAL.md
git commit -m 'docs: note drag-resizable layout in the manual'
```

- [ ] **Step 5: Write session notes + open PR**

Fill `docs/dev-sessions/2026-06-12-1429-resizable-ui-regions/notes.md` with a short retro (what shipped, default sizes chosen, anything deferred), commit it, push the branch, and open a PR referencing #181.

---

## Self-review notes

- **Spec coverage:** sidebar/log/hand dividers (Tasks 3–5), CSS-var mechanism (Task 3), log-pane refactor (Task 3), hand `max-height` removal (Task 3), layout-store persistence outside game state (Tasks 1–2), pointer+touch via Pointer Events + `touch-action: none` (Tasks 3, 5), per-axis clamps (Tasks 1, 5), double-click reset (Task 5), `clampSize`/`normalizeLayout` unit tests (Tasks 1–2), manual update (Task 7). All spec sections map to a task.
- **Type/name consistency:** `clampSize(px, min, max)`, `normalizeLayout(raw)`, `DEFAULT_LAYOUT` (`sidebarW`/`logH`/`handH`), `SIZE_BOUNDS`, `loadLayout`/`saveLayout`, `initResizers`, CSS vars `--sidebar-w`/`--log-h`/`--hand-h`, and `data-resize` keys all match across tasks.
- **Constraint:** `data-resize` attribute values (`sidebarW`/`logH`/`handH`) are exactly the keys of `DEFAULT_LAYOUT`/`SIZE_BOUNDS`/`axisConfig()` — the lookup `cfg[axis]` depends on this.
