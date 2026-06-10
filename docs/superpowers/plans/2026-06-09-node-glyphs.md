# Node Glyph Legibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace abstract per-type Cytoscape node shapes with a common faceted dodecagon container plus an ideographic, per-type glyph (shape + hue), so a node's type is legible at a glance. Implements issue #126.

**Architecture:** A new pure module `js/ui/node-glyphs.js` holds the dodecagon polygon points and the per-type glyph SVG vocabulary (stroke-only line art, hue baked in), exposing `glyphDataUri(type)` and `ALL_GLYPH_TYPES`. `graph.js` renders every node as `shape: "polygon"` (dodecagon) and sets the glyph via a `background-image` SVG data-URI — node **state** (access/alert/grade) stays entirely on the container border/fill exactly as today; the glyph is purely additive. `preview.js` extends its shape gallery to render the full vocabulary for visual tuning.

**Tech Stack:** Vanilla ES modules, Cytoscape.js (`shape-polygon-points` + `background-image`), `node:test` + `node:assert/strict` for unit tests, JSDoc `@ts-check`.

---

## File Structure

- **Create** `js/ui/node-glyphs.js` — pure data/SVG module (dodecagon points, glyph vocabulary, data-URI helpers). Mirrors the `js/ui/preview-cards.js` pure-module pattern. `@ts-check`.
- **Create** `tests/node-glyphs.test.js` — unit tests for the vocabulary/helpers.
- **Modify** `js/ui/graph.js` — consume `node-glyphs.js`: dodecagon shape in stylesheet (replacing all `ellipse`), glyph `background-image` in `updateNodeStyle`, remove the obsolete `NODE_SHAPES` map. `@ts-nocheck` (Cytoscape-coupled, untested by project convention).
- **Modify** `js/ui/preview.js` — drive the shape gallery from `ALL_GLYPH_TYPES` + a fallback demo. `@ts-nocheck`.
- **Modify** `tests/preview-card-gallery.test.js` is unrelated; instead add gallery-coverage assertions inside `tests/node-glyphs.test.js`.
- **Modify** `MANUAL.md` — update the node-types table "Shape" column to describe glyphs.

Why this split: the glyph vocabulary is pure data and must be unit-testable; `graph.js`/`preview.js` are DOM/Cytoscape-coupled (already `@ts-nocheck`, untested by the project — same as `preview-cards.js` ↔ `preview.js`). Keeping the data in its own module lets tests assert correctness without a browser.

---

## Task 1: Glyph vocabulary module (`node-glyphs.js`)

**Files:**
- Create: `js/ui/node-glyphs.js`
- Test: `tests/node-glyphs.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/node-glyphs.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONTAINER_POLYGON_POINTS,
  NODE_GLYPHS,
  FALLBACK_GLYPH,
  ALL_GLYPH_TYPES,
  glyphFor,
  glyphSvg,
  glyphDataUri,
} from "../js/ui/node-glyphs.js";

const CORE = ["wan", "gateway", "router", "firewall", "workstation", "ids", "security-monitor", "fileserver", "cryptovault", "mine"];
const SETPIECE = ["key-server", "vault", "routing-panel", "routing-switch", "data-relay", "watchdog-daemon", "tripwire-sensor", "alarm-latch"];

test("vocabulary covers all core and set-piece types", () => {
  for (const t of [...CORE, ...SETPIECE]) {
    assert.ok(NODE_GLYPHS[t], `missing glyph for ${t}`);
  }
  assert.deepEqual(ALL_GLYPH_TYPES.sort(), [...CORE, ...SETPIECE].sort());
});

test("every glyph has a hex color and non-empty body", () => {
  for (const [type, g] of Object.entries(NODE_GLYPHS)) {
    assert.match(g.color, /^#[0-9a-f]{6}$/i, `bad color for ${type}`);
    assert.ok(g.body.length > 0, `empty body for ${type}`);
  }
});

test("container polygon is a 12-gon (24 normalized coords in [-1,1])", () => {
  const nums = CONTAINER_POLYGON_POINTS.trim().split(/\s+/).map(Number);
  assert.equal(nums.length, 24);
  for (const n of nums) assert.ok(n >= -1 && n <= 1, `${n} out of range`);
});

test("glyphFor falls back to the microchip for unknown types", () => {
  assert.equal(glyphFor("totally-unknown-type"), FALLBACK_GLYPH);
  assert.equal(glyphFor("fileserver"), NODE_GLYPHS.fileserver);
});

test("glyphSvg wraps body in a 64x64 svg with the type's stroke color", () => {
  const svg = glyphSvg("cryptovault");
  assert.ok(svg.startsWith("<svg"));
  assert.match(svg, /viewBox="0 0 64 64"/);
  assert.ok(svg.includes(NODE_GLYPHS.cryptovault.color));
  assert.ok(svg.includes(NODE_GLYPHS.cryptovault.body));
});

test("glyphDataUri returns an encoded svg data uri (no raw # )", () => {
  const uri = glyphDataUri("mine");
  assert.ok(uri.startsWith("data:image/svg+xml,"));
  assert.ok(!uri.slice("data:image/svg+xml,".length).includes("#"), "hex # must be percent-encoded");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/node-glyphs.test.js`
Expected: FAIL — `Cannot find module '../js/ui/node-glyphs.js'`.

- [ ] **Step 3: Write the implementation**

Create `js/ui/node-glyphs.js`:

```js
// @ts-check
// Node glyph vocabulary — pure data + SVG generation for graph node rendering.
//
// Design (issue #126): every node renders as a common faceted dodecagon
// container (state color rides on border/fill, unchanged) with an ideographic,
// no-curves glyph inside it (type identity: shape + hue). State is NOT baked
// into glyphs.
//
// This module is pure (no DOM / no Cytoscape) so it is unit-testable. graph.js
// and preview.js consume it.

/**
 * Dodecagon points for Cytoscape `shape-polygon-points`, normalized to [-1, 1]
 * about the node center (radius -> 1). Replaces the circle/ellipse everywhere.
 */
export const CONTAINER_POLYGON_POINTS =
  "0 -1 0.5 -0.866 0.866 -0.5 1 0 0.866 0.5 0.5 0.866 0 1 -0.5 0.866 -0.866 0.5 -1 0 -0.866 -0.5 -0.5 -0.866";

/**
 * @typedef {{ color: string, body: string }} Glyph
 * `body` is stroke-only inner SVG (polygon/line/rect/polyline), authored on a
 * 0 0 64 64 viewBox. `color` is applied as the stroke by glyphSvg().
 */

/** @type {Record<string, Glyph>} */
export const NODE_GLYPHS = {
  // ── Core 10 ──────────────────────────────────────────────
  wan: { color: "#66ccff", body: `<polygon points="32,20 42,26 42,38 32,44 22,38 22,26"/><line x1="22" y1="32" x2="42" y2="32"/><line x1="32" y1="20" x2="32" y2="44"/>` },
  gateway: { color: "#00ffff", body: `<polyline points="22,44 22,28 32,20 42,28 42,44"/><line x1="28" y1="44" x2="28" y2="34"/><line x1="36" y1="44" x2="36" y2="34"/>` },
  router: { color: "#88ff33", body: `<rect x="28" y="28" width="8" height="8"/><polyline points="29,21 32,17 35,21"/><line x1="32" y1="17" x2="32" y2="28"/><polyline points="29,43 32,47 35,43"/><line x1="32" y1="47" x2="32" y2="36"/><polyline points="21,29 17,32 21,35"/><line x1="17" y1="32" x2="28" y2="32"/><polyline points="43,29 47,32 43,35"/><line x1="47" y1="32" x2="36" y2="32"/>` },
  firewall: { color: "#cc55ff", body: `<rect x="22" y="24" width="20" height="16"/><line x1="22" y1="32" x2="42" y2="32"/><line x1="32" y1="24" x2="32" y2="32"/><line x1="27" y1="32" x2="27" y2="40"/><line x1="37" y1="32" x2="37" y2="40"/>` },
  workstation: { color: "#9fb9c9", body: `<rect x="22" y="22" width="20" height="14"/><line x1="32" y1="36" x2="32" y2="42"/><line x1="26" y1="42" x2="38" y2="42"/>` },
  ids: { color: "#ff4488", body: `<polygon points="20,32 26,25 38,25 44,32 38,39 26,39"/><polygon points="32,28 35,30 35,34 32,36 29,34 29,30"/>` },
  "security-monitor": { color: "#ff8800", body: `<polygon points="32,20 41,25 41,35 32,40 23,35 23,25"/><polygon points="32,28 35,30 32,34 29,30"/><line x1="32" y1="14" x2="32" y2="20"/><line x1="32" y1="40" x2="32" y2="46"/><line x1="18" y1="30" x2="23" y2="30"/><line x1="41" y1="30" x2="46" y2="30"/>` },
  fileserver: { color: "#33ff99", body: `<rect x="23" y="21" width="18" height="6"/><rect x="23" y="29" width="18" height="6"/><rect x="23" y="37" width="18" height="6"/><line x1="27" y1="24" x2="29" y2="24"/><line x1="27" y1="32" x2="29" y2="32"/><line x1="27" y1="40" x2="29" y2="40"/>` },
  cryptovault: { color: "#ffcc22", body: `<rect x="22" y="22" width="20" height="20"/><polygon points="32,27 37,30 37,36 32,39 27,36 27,30"/><line x1="32" y1="32" x2="36" y2="29"/>` },
  mine: { color: "#ff2a2a", body: `<polygon points="32,24 39,28 39,36 32,40 25,36 25,28"/><line x1="32" y1="24" x2="32" y2="18"/><line x1="39" y1="28" x2="44" y2="24"/><line x1="39" y1="36" x2="44" y2="40"/><line x1="32" y1="40" x2="32" y2="46"/><line x1="25" y1="36" x2="20" y2="40"/><line x1="25" y1="28" x2="20" y2="24"/>` },

  // ── Set-piece 8 ──────────────────────────────────────────
  "key-server": { color: "#44ddcc", body: `<polygon points="25,26 30,29 30,35 25,38 20,35 20,29"/><line x1="30" y1="32" x2="44" y2="32"/><line x1="38" y1="32" x2="38" y2="37"/><line x1="43" y1="32" x2="43" y2="36"/>` },
  vault: { color: "#ffaa22", body: `<polyline points="26,30 26,25 32,21 38,25 38,30"/><rect x="23" y="30" width="18" height="13"/><polygon points="32,33 35,35 34,39 30,39 29,35"/>` },
  "routing-panel": { color: "#66dd66", body: `<rect x="21" y="24" width="22" height="16"/><rect x="25" y="28" width="3" height="3"/><rect x="31" y="28" width="3" height="3"/><rect x="37" y="28" width="3" height="3"/><rect x="25" y="34" width="3" height="3"/><rect x="31" y="34" width="3" height="3"/><rect x="37" y="34" width="3" height="3"/>` },
  "routing-switch": { color: "#66dd66", body: `<rect x="21" y="28" width="22" height="9"/><rect x="33" y="26" width="9" height="13"/><line x1="24" y1="32.5" x2="29" y2="32.5"/>` },
  "data-relay": { color: "#4499ff", body: `<polyline points="27,44 32,28 37,44"/><line x1="29" y1="38" x2="35" y2="38"/><polyline points="27,25 24,28 27,31"/><polyline points="37,25 40,28 37,31"/><line x1="32" y1="28" x2="32" y2="24"/>` },
  "watchdog-daemon": { color: "#ff8800", body: `<polygon points="32,20 42,24 42,33 32,43 22,33 22,24"/><polygon points="27,30 32,27 37,30 32,33"/>` },
  "tripwire-sensor": { color: "#ff4488", body: `<polygon points="20,27 20,37 28,32"/><rect x="42" y="29" width="6" height="6"/><line x1="28" y1="32" x2="42" y2="32" stroke-dasharray="3 3"/><line x1="35" y1="23" x2="35" y2="41"/>` },
  "alarm-latch": { color: "#ff5522", body: `<polyline points="25,40 28,28 36,28 39,40"/><line x1="22" y1="40" x2="42" y2="40"/><line x1="32" y1="28" x2="32" y2="24"/><line x1="32" y1="40" x2="32" y2="44"/>` },
};

/** Generic fallback for any unmapped type — a microchip / IC, neutral teal. */
export const FALLBACK_GLYPH = {
  color: "#7fd9c9",
  body: `<rect x="24" y="24" width="16" height="16"/><line x1="28" y1="20" x2="28" y2="24"/><line x1="36" y1="20" x2="36" y2="24"/><line x1="28" y1="40" x2="28" y2="44"/><line x1="36" y1="40" x2="36" y2="44"/><line x1="20" y1="28" x2="24" y2="28"/><line x1="20" y1="36" x2="24" y2="36"/><line x1="40" y1="28" x2="44" y2="28"/><line x1="40" y1="36" x2="44" y2="36"/>`,
};

/** All explicitly-mapped types (excludes the fallback). */
export const ALL_GLYPH_TYPES = Object.keys(NODE_GLYPHS);

/**
 * @param {string} type
 * @returns {Glyph} the type's glyph, or the microchip fallback.
 */
export function glyphFor(type) {
  return NODE_GLYPHS[type] || FALLBACK_GLYPH;
}

/**
 * Full standalone SVG markup for a type's glyph (stroke = type hue).
 * @param {string} type
 * @returns {string}
 */
export function glyphSvg(type) {
  const { color, body } = glyphFor(type);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;
}

/**
 * Glyph as a Cytoscape-ready `background-image` data URI (# percent-encoded).
 * @param {string} type
 * @returns {string}
 */
export function glyphDataUri(type) {
  return "data:image/svg+xml," + encodeURIComponent(glyphSvg(type));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/node-glyphs.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Lint**

Run: `make lint`
Expected: no new tsc errors.

- [ ] **Step 6: Commit**

```bash
git add js/ui/node-glyphs.js tests/node-glyphs.test.js
git commit -m 'feat: add node glyph vocabulary module (#126)'
```

---

## Task 2: Render dodecagon container + glyph in `graph.js`

**Files:**
- Modify: `js/ui/graph.js` (imports near top; `buildStylesheet` ~line 273; `updateNodeStyle` ~line 502–508; remove `NODE_SHAPES` ~line 12–22)

No unit test: `graph.js` is `@ts-nocheck` and Cytoscape/DOM-coupled — untested by project convention (same as all of `graph.js`). Verification is `make lint` + loading `preview.html` and visually confirming the gallery (done in Task 3). This is honest: the testable logic lives in `node-glyphs.js` (Task 1); this task is pure wiring.

- [ ] **Step 1: Add the import**

At the top of `js/ui/graph.js`, after the existing `import { isIceVisible } from "../core/state.js";`:

```js
import { CONTAINER_POLYGON_POINTS, glyphDataUri } from "./node-glyphs.js";
```

- [ ] **Step 2: Remove the obsolete `NODE_SHAPES` map**

Delete the entire block (currently `js/ui/graph.js:11-22`):

```js
// Node type → shape mapping
const NODE_SHAPES = {
  "wan":              "barrel",
  "gateway":          "diamond",
  "router":           "ellipse",
  "firewall":         "pentagon",
  "workstation":      "ellipse",
  "ids":              "hexagon",
  "security-monitor": "octagon",
  "fileserver":       "rectangle",
  "cryptovault":      "diamond",
};
```

Replace it with a comment:

```js
// Node type → glyph/shape now lives in node-glyphs.js. Every node renders as a
// common dodecagon container (state on border/fill) + an ideographic glyph
// background-image (type identity). See issue #126.
```

- [ ] **Step 3: Make the container a dodecagon in the stylesheet**

In `buildStylesheet()`, in the `node.revealed` rule, replace `shape: "ellipse",` with:

```js
        shape: "polygon",
        "shape-polygon-points": CONTAINER_POLYGON_POINTS,
```

In the `node.accessible` rule (the base accessible rule, currently starting ~line 297), add these properties (it has no explicit `shape` today, so it inherits the Cytoscape default ellipse — make it explicit) after `display: "element",`:

```js
        shape: "polygon",
        "shape-polygon-points": CONTAINER_POLYGON_POINTS,
        "background-image-opacity": 1,
        "background-fit": "none",
        "background-width": "70%",
        "background-height": "70%",
        "background-position-x": "50%",
        "background-position-y": "50%",
        "background-clip": "none",
```

In the `node.ice-traced` rule, replace `shape: "ellipse",` with:

```js
        shape: "polygon",
        "shape-polygon-points": CONTAINER_POLYGON_POINTS,
```

- [ ] **Step 4: Set the glyph background-image in `updateNodeStyle`**

In `updateNodeStyle`, inside the `if (nodeState.visibility === "accessible") { ... }` block, replace the existing shape logic (currently `js/ui/graph.js:502-507`):

```js
    // Shape by node type — but an obscured node shows a generic ellipse so its
    // type isn't telegraphed before it's probed.
    const networkNode = cy.getElementById(nodeId);
    const type = networkNode.data("type");
    const shape = obscured ? "ellipse" : (NODE_SHAPES[type] || "ellipse");
    node.style("shape", shape);
```

with:

```js
    // Glyph by node type — but an obscured node shows the bare dodecagon (no
    // glyph) so its type isn't telegraphed before it's probed. The container
    // shape itself is the dodecagon for all nodes (set in the stylesheet);
    // type identity rides on this glyph image, state stays on border/fill.
    const type = node.data("type");
    node.style("background-image", obscured ? "none" : glyphDataUri(type));
```

- [ ] **Step 5: Lint**

Run: `make lint`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add js/ui/graph.js
git commit -m 'feat: render nodes as dodecagon container + type glyph (#126)'
```

---

## Task 3: Full-vocabulary glyph gallery in the preview harness

**Files:**
- Modify: `js/ui/preview.js` (shape gallery block, `js/ui/preview.js:39-49`)
- Test: extend `tests/node-glyphs.test.js` with a gallery-coverage assertion

The project requires every new visual treatment to appear in the preview harness. The existing shape gallery (`SHAPE_TYPES`) only lists 9 core types; drive it from `ALL_GLYPH_TYPES` so it can never drift, and add one unmapped node to demonstrate the microchip fallback.

- [ ] **Step 1: Write the failing coverage test**

Append to `tests/node-glyphs.test.js`:

```js
test("gallery type list (ALL_GLYPH_TYPES) includes every mapped type for the preview harness", () => {
  // Guards against the preview gallery silently dropping a type as the
  // vocabulary grows. preview.js builds its gallery from ALL_GLYPH_TYPES.
  assert.ok(ALL_GLYPH_TYPES.includes("mine"), "mine must be demoable (it used to fall through to a circle)");
  assert.ok(ALL_GLYPH_TYPES.includes("alarm-latch"), "set-piece types must be demoable");
  assert.equal(ALL_GLYPH_TYPES.length, 18);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/node-glyphs.test.js`
Expected: FAIL on the length assertion only if the count is wrong — if Task 1 is correct it will actually PASS at 18. Run it; if it passes, that's fine (this test documents/locks the count). If it fails, fix the count in the assertion to match `ALL_GLYPH_TYPES.length` ONLY if you have added/removed a real type — never to paper over a missing glyph.

- [ ] **Step 3: Drive the preview gallery from the vocabulary**

In `js/ui/preview.js`, add to the imports at the top:

```js
import { ALL_GLYPH_TYPES } from "./node-glyphs.js";
```

Replace the shape gallery block (`js/ui/preview.js:39-49`):

```js
// Shape gallery — one per type, cycling grades
const SHAPE_TYPES = ["wan", "gateway", "router", "firewall", "workstation", "ids", "security-monitor", "fileserver", "cryptovault"];
const GRADES = ["F", "D", "C", "B", "A", "S"];
const SHAPE_NODES = SHAPE_TYPES.map((type, i) => ({
  id: `shape-${type}`,
  label: type,
  type,
  grade: GRADES[i % GRADES.length],
  x: 80 + i * 100,
  y: 440,
}));
```

with (renders the full vocabulary + a fallback demo, wrapping to a second row so 19 nodes fit):

```js
// Glyph gallery — full vocabulary from node-glyphs, plus an unmapped node to
// demonstrate the microchip fallback. Cycles grades so border colors vary.
const SHAPE_TYPES = [...ALL_GLYPH_TYPES, "unknown-fallback-demo"];
const GRADES = ["F", "D", "C", "B", "A", "S"];
const GALLERY_COLS = 10;
const SHAPE_NODES = SHAPE_TYPES.map((type, i) => ({
  id: `shape-${type}`,
  label: type,
  type,
  grade: GRADES[i % GRADES.length],
  x: 80 + (i % GALLERY_COLS) * 100,
  y: 440 + Math.floor(i / GALLERY_COLS) * 110,
}));
```

- [ ] **Step 4: Run the full test suite + lint**

Run: `node --test tests/node-glyphs.test.js`
Expected: PASS.
Run: `make lint`
Expected: no new errors.

- [ ] **Step 5: Visually verify in the browser**

Run: `make bundle-vendor` (if `dist/vendor.js` is missing), then `make serve`.
Open `http://localhost:3000/preview.html`. Confirm:
- The glyph gallery shows all 18 types as dodecagons with distinct faceted glyphs in their hues, plus the `unknown-fallback-demo` node showing the microchip.
- The alert demo row (green/yellow/red/reboot routers) still pulses correctly — glyph stays visible over the state fill/border.
- No node renders as a circle anywhere.

If anything misreads (e.g. a glyph too small against the fill), adjust `background-width`/`background-height` in the `node.accessible` stylesheet rule (Task 2, Step 3) and note the change.

- [ ] **Step 6: Commit**

```bash
git add js/ui/preview.js tests/node-glyphs.test.js
git commit -m 'feat: full node-glyph vocabulary gallery in preview harness (#126)'
```

---

## Task 4: Update the player manual

**Files:**
- Modify: `MANUAL.md` (node-types table, `MANUAL.md:76-86`)

- [ ] **Step 1: Update the node-types table**

In `MANUAL.md`, rename the table's `Shape` column header to `Glyph` and replace each shape word with the glyph description:

```markdown
| Type              | Glyph              | Gate         | What it does                                      |
|-------------------|--------------------|--------------|---------------------------------------------------|
| **WAN**           | Globe              | Probe        | The network boundary — your tether to the outside. Access the darknet broker here. |
| **Gateway**       | Portal arch        | Probe        | Entry point. Your foothold into the LAN.          |
| **Router**        | Four-way arrows    | Compromised  | Routes traffic. Bridges to deeper nodes. Must compromise to see connections. |
| **Firewall**      | Brick wall         | Owned        | High-security chokepoint. Must fully own to reveal what's beyond. |
| **Workstation**   | Monitor            | Probe        | User machines. Often soft targets with loose data.|
| **File Server**   | Rack stack         | Probe        | Where documents live. Usually where your mission target is. |
| **Cryptovault**   | Safe + dial        | Probe        | High-value encrypted storage. Hardest targets.    |
| **IDS**           | Camera eye         | Owned        | Intrusion Detection System. Must own to see connections. Can be subverted. |
| **Security Mon.** | Scope + crosshair  | Owned        | Aggregates IDS alerts. Must own to see connections. Can cancel trace. |
```

- [ ] **Step 2: Add a sentence on the container/state convention**

Immediately after the table (before the existing "The **Gate** column…" paragraph), add:

```markdown
Every node is drawn as a 12-sided container holding a small glyph of the device
it represents. The glyph (and its color) tells you *what kind* of node it is; the
container's border and fill tell you its *state* — locked, compromised, owned, or
on alert.
```

- [ ] **Step 3: Commit**

```bash
git add MANUAL.md
git commit -m 'docs: describe node glyphs in the manual (#126)'
```

---

## Self-Review

**Spec coverage (issue #126):**
- Common dodecagon container → Task 1 (`CONTAINER_POLYGON_POINTS`) + Task 2 (stylesheet).
- Faceted no-curves glyph per type, hue baked in → Task 1 (`NODE_GLYPHS`).
- State on container / type on glyph → Task 2 (state classes untouched; glyph via `background-image` only).
- Core 10 + 8 set-piece + microchip fallback → Task 1 (`NODE_GLYPHS` + `FALLBACK_GLYPH`).
- No bare circles anywhere (revealed, accessible, ice-traced) → Task 2 (all three stylesheet rules → polygon).
- Obscured nodes don't telegraph type → Task 2 (no glyph when obscured; bare dodecagon).
- Preview-harness gallery → Task 3.
- LLM-legibility (text `type` unchanged) → no change to `status`/node panel; glyph is additive only (Task 2 touches only `shape`/`background-image`).
- MANUAL.md node-types table → Task 4.
- Accessibility (shape not color alone) → satisfied by design: glyph shape is the primary cue, hue is redundant (no code task needed; noted).

**Open item deferred to execution:** exact `background-width/height` may need a nudge after eyeballing the gallery (Task 3, Step 5) — the plan sets 70% as a starting value and tells the implementer how to adjust.

**Placeholder scan:** none — all code is complete.

**Type consistency:** `glyphDataUri`, `CONTAINER_POLYGON_POINTS`, `ALL_GLYPH_TYPES`, `NODE_GLYPHS`, `FALLBACK_GLYPH`, `glyphFor`, `glyphSvg` are named identically across Tasks 1–3 and the tests.

**Not in scope (per issue):** the `data(glyphUri)` reactive-stylesheet alternative was rejected in favor of direct `node.style("background-image", …)` to avoid empty-data-mapper edge cases; card↔node match highlighting (that's #117); animating glyphs.
