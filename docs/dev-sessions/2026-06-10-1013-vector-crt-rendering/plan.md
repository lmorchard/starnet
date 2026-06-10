# Vector CRT Rendering Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the network graph render like a glowing vector CRT display — blooming strokes on near-black, no solid fills, fence-hatch state encoding, no raster scanline.

**Architecture:** Bake a dodecagon-clipped fence hatch + the type glyph into each node's `background-image` SVG (density = access level, dimmed hue). Drop solid fills to transparent; keep the native Cytoscape border for state pulses. Add a single inline SVG `<filter>` (Gaussian-blur bloom) applied via CSS to the `#cy` and `#overlay-layer` layers. Delete the scanline.

**Tech Stack:** Vanilla JS ES modules, Cytoscape.js (canvas renderer), SVG filters, CSS. Tests via `node:test` + `node:assert`. Type-check via `tsc --checkJs` on JSDoc-annotated files (`node-glyphs.js` is checked; `graph.js`/`main.js`/`preview.js` are not).

**Key facts established during planning:**
- All three HTML entrypoints (`index.html`, `preview.html`, `playground.html`) link `css/style.css` and call `initGraph()` — so CSS rules and the JS-injected filter def reach all three with no per-file edits.
- `node-glyphs.js` is pure and unit-tested (`tests/node-glyphs.test.js`); `glyphDataUri`/`glyphSvg` must stay exported (tests + back-compat).
- `graph.js:526` is the single place a node's glyph `background-image` is set, inside the `visibility === "accessible"` block, where `nodeState.accessLevel` is available.
- Access levels are `"locked"`, `"compromised"`, `"owned"`.
- `make check` = `make lint` (tsc) + `make test` (node --test). `make bundle-vendor` must have run once so `dist/vendor.js` exists before opening a browser.

---

## Phase 1 — Core graph

### Task 1: `nodeFaceDataUri` — fence + glyph in node-glyphs.js

**Files:**
- Modify: `js/ui/node-glyphs.js`
- Test: `tests/node-glyphs.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `tests/node-glyphs.test.js` (extend the import on lines 3–11 to include `fenceYs, nodeFaceSvg, nodeFaceDataUri`):

```js
test("fenceYs density increases with access level", () => {
  assert.ok(fenceYs("locked").length < fenceYs("compromised").length);
  assert.ok(fenceYs("compromised").length < fenceYs("owned").length);
});

test("fenceYs is empty for an unknown access level", () => {
  assert.deepEqual(fenceYs("weird"), []);
});

test("nodeFaceSvg embeds the type glyph, a clip path, and fence lines", () => {
  const svg = nodeFaceSvg("fileserver", "owned");
  assert.ok(svg.startsWith("<svg"));
  assert.match(svg, /viewBox="0 0 64 64"/);
  assert.ok(svg.includes(NODE_GLYPHS.fileserver.body), "glyph body present");
  assert.ok(svg.includes("clipPath"), "fence clip path present");
  assert.ok(svg.includes("<line"), "fence lines present");
});

test("nodeFaceSvg for an unknown access level draws the glyph but no fence group", () => {
  const svg = nodeFaceSvg("router", "weird");
  assert.ok(svg.includes(NODE_GLYPHS.router.body));
  assert.ok(!svg.includes('clip-path="url(#sf)"'), "no fence group when level unknown");
});

test("nodeFaceDataUri returns an encoded svg data uri (no raw #)", () => {
  const uri = nodeFaceDataUri("mine", "compromised");
  assert.ok(uri.startsWith("data:image/svg+xml,"));
  assert.ok(!uri.slice("data:image/svg+xml,".length).includes("#"), "hex # must be percent-encoded");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/node-glyphs.test.js`
Expected: FAIL — `fenceYs`/`nodeFaceSvg`/`nodeFaceDataUri` are not exported (ReferenceError / undefined import).

- [ ] **Step 3: Implement the fence + face functions**

Append to `js/ui/node-glyphs.js` (after `glyphDataUri`, before EOF). The dodecagon is derived from the existing `CONTAINER_POLYGON_POINTS` so there is one source of truth for the shape:

```js
// ── Node face: dodecagon-clipped fence hatch + glyph (issue: vector CRT pass) ──
// State is NOT baked into the glyph; the fence-hatch density + dimmed hue encode
// access level. The dodecagon OUTLINE is intentionally absent here — it stays as
// the native Cytoscape border so border-driven state pulses keep working.

const FACE_C = 32; // glyph viewBox center
const FACE_R = 30; // dodecagon radius on the 0..64 box

/** Dodecagon points on the 0..64 glyph viewBox, derived from CONTAINER_POLYGON_POINTS. */
const FACE_POLYGON_POINTS = (() => {
  const n = CONTAINER_POLYGON_POINTS.trim().split(/\s+/).map(Number);
  const pts = [];
  for (let i = 0; i < n.length; i += 2) {
    pts.push(`${(FACE_C + n[i] * FACE_R).toFixed(2)},${(FACE_C + n[i + 1] * FACE_R).toFixed(2)}`);
  }
  return pts.join(" ");
})();

/**
 * Fence-hatch tuning per access level: line gap (px on the 0..64 box) + a dimmed,
 * desaturated shade of the state color (so the border stays the brightest element).
 * @type {Record<string, { gap: number, color: string }>}
 */
const FENCE = {
  locked:      { gap: 11,  color: "#1d4444" },
  compromised: { gap: 7,   color: "#1c6a85" },
  owned:       { gap: 4.5, color: "#1c8a4a" },
};
const FENCE_OPACITY = 0.28;
const FENCE_WIDTH = 0.8;

/**
 * Y positions (on the 0..64 box) of the fence-hatch lines for an access level.
 * Empty array for any unmapped level (e.g. obscured / unknown).
 * @param {string} accessLevel
 * @returns {number[]}
 */
export function fenceYs(accessLevel) {
  const cfg = FENCE[accessLevel];
  if (!cfg) return [];
  const ys = [];
  for (let y = FACE_C - FACE_R + 1; y < FACE_C + FACE_R; y += cfg.gap) {
    ys.push(Number(y.toFixed(1)));
  }
  return ys;
}

/**
 * Full standalone node-face SVG: dodecagon-clipped fence hatch (state) + glyph (type).
 * @param {string} type
 * @param {string} accessLevel
 * @returns {string}
 */
export function nodeFaceSvg(type, accessLevel) {
  const { color, body } = glyphFor(type);
  const cfg = FENCE[accessLevel];
  let fence = "";
  if (cfg) {
    const lines = fenceYs(accessLevel)
      .map((y) => `<line x1="0" y1="${y}" x2="64" y2="${y}"/>`)
      .join("");
    fence =
      `<defs><clipPath id="sf"><polygon points="${FACE_POLYGON_POINTS}"/></clipPath></defs>` +
      `<g clip-path="url(#sf)" stroke="${cfg.color}" stroke-width="${FENCE_WIDTH}" opacity="${FENCE_OPACITY}">${lines}</g>`;
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none" stroke-linejoin="round" stroke-linecap="round">` +
    fence +
    `<g stroke="${color}" stroke-width="2">${body}</g>` +
    `</svg>`
  );
}

/**
 * Node face as a Cytoscape-ready `background-image` data URI (# percent-encoded).
 * @param {string} type
 * @param {string} accessLevel
 * @returns {string}
 */
export function nodeFaceDataUri(type, accessLevel) {
  return "data:image/svg+xml," + encodeURIComponent(nodeFaceSvg(type, accessLevel));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/node-glyphs.test.js`
Expected: PASS (all existing + 5 new tests).

- [ ] **Step 5: Type-check**

Run: `make lint`
Expected: no errors (node-glyphs.js is type-checked; the new JSDoc must satisfy tsc).

- [ ] **Step 6: Commit**

```bash
git add js/ui/node-glyphs.js tests/node-glyphs.test.js
git commit -m 'feat: nodeFaceDataUri — fence-hatch + glyph node face' -m 'Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>'
```

---

### Task 2: Wire the face into graph.js; drop solid fills

**Files:**
- Modify: `js/ui/graph.js` (import line 5; stylesheet ~291/319/335-346/385; glyph set at 526)

- [ ] **Step 1: Swap the import**

Change `js/ui/graph.js:5` from:

```js
import { CONTAINER_POLYGON_POINTS, glyphDataUri } from "./node-glyphs.js";
```

to:

```js
import { CONTAINER_POLYGON_POINTS, nodeFaceDataUri } from "./node-glyphs.js";
```

- [ ] **Step 2: Use the face data URI for accessible nodes**

Change `js/ui/graph.js:526` from:

```js
    node.style("background-image", obscured ? "none" : glyphDataUri(type));
```

to:

```js
    node.style("background-image", obscured ? "none" : nodeFaceDataUri(type, nodeState.accessLevel));
```

(Obscured nodes keep showing a bare dodecagon — no face, no fence — so type and state aren't telegraphed pre-probe.)

- [ ] **Step 3: Drop the solid fills in the stylesheet**

In `buildStylesheet()`:

- `node.revealed` (line ~291): change `"background-color": "#0d0d14",` → `"background-color": "transparent",`
- `node.accessible` (line ~319): change `"background-color": "#14141f",` → `"background-color": "transparent",`
- `node.accessible.compromised` (lines ~334-339): delete the entire rule object — its only declaration was the cyan fill, now carried by the fence. Remove:

```js
    // Access level — compromised (cyan fill = foothold)
    {
      selector: "node.accessible.compromised",
      style: {
        "background-color": "#1a4d70",
      },
    },
```

- `node.accessible.owned` (lines ~341-347): remove the `"background-color": "#1a5530",` line, keep the rule and its `"border-width": 1,`.
- `node.ice-traced` (line ~385): change `"background-color": "#1a0010",` → `"background-color": "transparent",`

- [ ] **Step 4: Verify nothing broke at the unit level**

Run: `make check`
Expected: PASS (graph.js is not type-checked or unit-tested; this confirms node-glyphs + the rest of the suite still pass and tsc is clean).

- [ ] **Step 5: Visual sanity check in the preview harness**

```bash
make bundle-vendor   # once, if dist/vendor.js is missing
make serve           # background; serves http://localhost:3000
```

Open `http://localhost:3000/preview.html`. The glyph gallery nodes should now show transparent centers with the type glyph, no solid fills. (Fence density across access states is exercised in Task 5; here just confirm fills are gone and glyphs still render.)

- [ ] **Step 6: Commit**

```bash
git add js/ui/graph.js
git commit -m 'feat: render node faces (fence+glyph), drop solid fills' -m 'Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>'
```

---

### Task 3: Bloom filter + scanline removal

**Files:**
- Modify: `js/ui/graph.js` (`initGraph`, ~line 145)
- Modify: `css/style.css` (`#cy` ~151; `#graph-container::after` 136-149)

- [ ] **Step 1: Inject the bloom filter def once, in initGraph**

In `js/ui/graph.js`, add this helper near the top-level functions (e.g. just above `initGraph`):

```js
/**
 * Inject the shared SVG bloom <filter> into the DOM once. All entrypoints call
 * initGraph(), so this covers index / preview / playground without per-file edits.
 * The filter is a two-radius Gaussian blur merged under the crisp source — a
 * blurred copy beneath the original, i.e. colored phosphor halo.
 */
function ensureBloomFilter() {
  if (document.getElementById("starnet-bloom-defs")) return;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("id", "starnet-bloom-defs");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.setAttribute("aria-hidden", "true");
  svg.style.position = "absolute";
  svg.innerHTML =
    '<filter id="starnet-bloom" x="-60%" y="-60%" width="220%" height="220%">' +
    '<feGaussianBlur stdDeviation="3.2" result="b1"/>' +
    '<feGaussianBlur in="SourceGraphic" stdDeviation="1.1" result="b2"/>' +
    '<feMerge><feMergeNode in="b1"/><feMergeNode in="b2"/><feMergeNode in="SourceGraphic"/></feMerge>' +
    '</filter>';
  document.body.appendChild(svg);
}
```

Then call it at the start of `initGraph()` (immediately after the function opens, before the `cytoscape({...})` call at line 145):

```js
export function initGraph(networkData, onNodeClick, onBackgroundTap) {
  ensureBloomFilter();
  // ...existing body...
```

- [ ] **Step 2: Apply the filter via CSS and delete the scanline**

In `css/style.css`, replace the scanline block (lines 136-149):

```css
#graph-container::after {
  content: "";
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0px,
    transparent 3px,
    rgba(0, 0, 0, 0.18) 3px,
    rgba(0, 0, 0, 0.18) 4px
  );
  pointer-events: none;
  z-index: 5;
}
```

with the bloom rule (applied to the two graph layers only — NOT `#graph-container`, so context menus / action-choices stay crisp):

```css
/* Vector CRT bloom — colored phosphor halo on the graph + overlay layers.
   Single SVG <filter> def injected by graph.js (#starnet-bloom). */
#cy, #overlay-layer {
  filter: url(#starnet-bloom);
}
```

- [ ] **Step 3: Verify the bloom on the real game and the preview**

```bash
make bundle-vendor   # if needed
make serve
```

- Open `http://localhost:3000/` (index) and `http://localhost:3000/preview.html`.
- Confirm: strokes glow (nodes, edges, glyphs, fence); no horizontal scanline; reference grid still visible; context menu (right-click a node in-game) is NOT bloomed.
- Watch a probe / pulse animation and confirm no obvious stutter from the filter re-compositing. If it stutters badly, reduce `stdDeviation` (e.g. `2.2` / `0.8`) — note the change in `notes.md`.

- [ ] **Step 4: make check**

Run: `make check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/ui/graph.js css/style.css
git commit -m 'feat: SVG bloom filter on graph + overlays; remove scanline' -m 'Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>'
```

---

### Task 4: Rework fill-flash animations to border flashes

**Files:**
- Modify: `js/ui/graph.js` (`flashNode`, lines 982-1018)

Solid-fill flashes no longer read now that fills are transparent. Flash the border instead.

- [ ] **Step 1: Replace flashNode**

Replace the body of `flashNode` (lines 982-1018) with:

```js
export function flashNode(nodeId, type) {
  if (!cy) return;
  const node = cy.getElementById(nodeId);
  if (!node || node.length === 0) return;

  // [bright peak, dim settle] border colors per flash type.
  const FLASH = {
    success: ["#9ffff0", "#00d0c0"],
    failure: ["#ff6060", "#cc1100"],
    reveal:  ["#7fd0ff", "#1c6a85"],
  };
  const pair = FLASH[type];
  if (!pair) return;

  node.animate(
    { style: { "border-color": pair[0], "border-width": 3 } },
    { duration: 150, complete: () => {
      node.animate(
        { style: { "border-color": pair[1], "border-width": 2 } },
        { duration: 350, complete: () => node.removeStyle("border-color border-width") }
      );
    }}
  );
}
```

> Note: if a node is mid alert-pulse (red/yellow), the pulse loop re-asserts its border on its next cycle (≤1.2s) after this flash's `removeStyle`. A brief visual overlap is acceptable; revisit only if it reads as a glitch.

- [ ] **Step 2: Verify the flashes in the playground**

```bash
make serve
```

Open `http://localhost:3000/playground.html` (it imports `flashNode`) or trigger success/failure in-game (`http://localhost:3000/`) by running an exploit. Confirm the node border flashes bright→dim and settles back, with the bloom making it flare.

- [ ] **Step 3: make check + commit**

Run: `make check` → PASS

```bash
git add js/ui/graph.js
git commit -m 'feat: border-based node flash (success/failure/reveal)' -m 'Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>'
```

---

### Task 5: Preview harness — access-state demo nodes

**Files:**
- Modify: `js/ui/preview.js` (`ALERT_NODES` block ~58-63; node lists ~67; state overrides ~96-98)

So fence density / opacity / blur can be tuned without playing through.

- [ ] **Step 1: Add access-state demo nodes**

After the `ALERT_NODES` array (line 63), add:

```js
// Access-state demo nodes — show fence density across locked/compromised/owned
// so the vector-CRT fence treatment can be tuned in isolation.
const ACCESS_NODES = [
  { id: "acc-locked",      label: "LOCKED",      type: "fileserver", grade: "C", x: 150, y: 850 },
  { id: "acc-compromised", label: "COMPROMISED", type: "fileserver", grade: "C", x: 380, y: 850 },
  { id: "acc-owned",       label: "OWNED",       type: "fileserver", grade: "C", x: 610, y: 850 },
];
```

- [ ] **Step 2: Include them in the graph**

Change the `allNodes` line (~67) from:

```js
const allNodes = [...EFFECT_NODES, SELECT_NODE, FLASH_NODE, ...SHAPE_NODES, ...ALERT_NODES];
```

to:

```js
const allNodes = [...EFFECT_NODES, SELECT_NODE, FLASH_NODE, ...SHAPE_NODES, ...ALERT_NODES, ...ACCESS_NODES];
```

- [ ] **Step 3: Set their access states (after the existing alert overrides, ~line 98)**

Add immediately after the `updateNodeStyle("alert-reboot", ...)` line:

```js
// Access-state demo overrides (the generic loop above set every node to "owned")
updateNodeStyle("acc-locked",      { visibility: "accessible", accessLevel: "locked",      alertState: "green", rebooting: false });
updateNodeStyle("acc-compromised", { visibility: "accessible", accessLevel: "compromised", alertState: "green", rebooting: false });
updateNodeStyle("acc-owned",       { visibility: "accessible", accessLevel: "owned",       alertState: "green", rebooting: false });
```

- [ ] **Step 4: Verify**

```bash
make serve
```

Open `http://localhost:3000/preview.html`, scroll/zoom to the LOCKED / COMPROMISED / OWNED row. Confirm fence density visibly increases locked → compromised → owned, dimmed hue, border brightest.

- [ ] **Step 5: make check + commit**

Run: `make check` → PASS (verify `tests/preview-card-gallery.test.js` still passes; it targets the card gallery, not these nodes, but confirm).

```bash
git add js/ui/preview.js
git commit -m 'feat(preview): access-state fence demo nodes' -m 'Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>'
```

---

## Phase 2 — Action overlays

### Task 6: Verify and tune overlay bloom

The bloom CSS from Task 3 already applies `filter: url(#starnet-bloom)` to `#overlay-layer`, so the probe-sweep / exploit-brackets / ICE-detect / loot-ring overlays glow automatically. This task is verification + light tuning only.

**Files:**
- Possibly modify: `js/ui/overlays/*.js` (stroke widths / colors), only if needed

- [ ] **Step 1: Drive each overlay in the preview harness**

```bash
make serve
```

Open `http://localhost:3000/preview.html` and run each effect via its slider/control: probe sweep, exploit brackets, ICE detect, loot rings, selection reticle. Confirm each blooms consistently with the new node look.

- [ ] **Step 2: Tune only what clashes**

If an overlay's stroke is too thin to bloom well or its color fights the node palette, adjust the stroke width/color in the relevant `js/ui/overlays/<name>.js`. Make the smallest change that harmonizes it. If nothing needs changing, record that in `notes.md` and skip to commit.

- [ ] **Step 3: make check + commit (only if files changed)**

Run: `make check` → PASS

```bash
git add js/ui/overlays
git commit -m 'tune: overlay strokes for vector bloom consistency' -m 'Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>'
```

---

## Phase 3 — Chrome harmonization

### Task 7: Consolidate glow vocabulary; harmonize chrome

**Files:**
- Modify: `css/style.css` (`:root` ~9-25; HUD/log/card glow rules)

The HUD/log/cards use ad-hoc `text-shadow`/`box-shadow` radii (`0 0 4px`/`6px`/`8px`/`12px`). Introduce a small glow scale and apply it to the most visible chrome so the whole UI reads at one bloom intensity. Exhaustive migration of every shadow is out of scope — migrate the prominent ones; leave the rest to opportunistic cleanup.

- [ ] **Step 1: Add glow-scale custom properties**

In `:root` (after line 24, before the closing `}`), add:

```css
  /* Glow scale — keep chrome bloom consistent with the graph's vector bloom. */
  --glow-sm: 0 0 4px;
  --glow-md: 0 0 8px;
  --glow-lg: 0 0 14px;
```

- [ ] **Step 2: Apply the scale to prominent chrome glows**

Migrate the highest-visibility shadows to the scale (color still per-rule). Concretely:

- HUD title/value glows that use `text-shadow: 0 0 8px var(--cyan)` (style.css ~215) → `text-shadow: var(--glow-md) var(--cyan);`
- Alert-red HUD text `text-shadow: 0 0 8px var(--red)` (~897) → `text-shadow: var(--glow-md) var(--red);`
- Log success/failure entries `0 0 4px rgba(...)` (~851-852) → `var(--glow-sm) rgba(...)`.
- Exploit card hover/active `box-shadow` 6px/8px (e.g. ~767, ~836) → `var(--glow-md) <color>`.

Match each replacement to the nearest scale step (4px→sm, 8px→md, 12-14px→lg). Leave 6px-only decorative borders alone if a swap shifts them noticeably.

- [ ] **Step 3: Verify the whole UI reads as one display**

```bash
make serve
```

Open `http://localhost:3000/`. Confirm HUD, log, and hand glows feel consistent with the graph bloom — no element looking flat-and-dull or blown-out relative to the rest.

- [ ] **Step 4: make check + commit**

Run: `make check` → PASS

```bash
git add css/style.css
git commit -m 'style: glow-scale custom properties; harmonize chrome bloom' -m 'Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>'
```

---

## Wrap-up

### Task 8: Manual, notes, screenshots, PR

**Files:**
- Modify: `MANUAL.md` (visual descriptions), `docs/dev-sessions/2026-06-10-1013-vector-crt-rendering/notes.md`

- [ ] **Step 1: Update MANUAL.md**

Scan `MANUAL.md` for visual descriptions that reference solid fills, the scanline, or fill-based state, and update them to describe the vector look (fence-hatch state encoding, bloom, no fills). Only change descriptions that are now inaccurate.

- [ ] **Step 2: Capture before/after-style screenshots**

```bash
make serve
```

Use the Playwright MCP to navigate to `http://localhost:3000/` and `http://localhost:3000/preview.html`, take screenshots, and confirm the look. Save anything worth keeping into the session dir.

- [ ] **Step 3: Write notes.md**

Record: final bloom `stdDeviation` values, fence opacity/width/gaps actually shipped, any overlay tuning, the perf observation, and the documented iteration path (feBlend screen → additive canvas-copy) carried from the spec.

- [ ] **Step 4: Final make check**

Run: `make check`
Expected: PASS.

- [ ] **Step 5: Commit docs and open the PR**

```bash
git add MANUAL.md docs/dev-sessions/2026-06-10-1013-vector-crt-rendering/notes.md
git commit -m 'docs: manual + session notes for vector CRT pass' -m 'Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>'
git push -u origin vector-crt-rendering
gh pr create --title 'Vector CRT rendering pass' --body '...'
```

(Single PR for all three phases, per the spec.)

---

## Self-review notes (planner)

- **Spec coverage:** fence fills (Task 1), no solid fills (Task 2), bloom via SVG filter (Task 3), scanline removal (Task 3), keep grid (untouched — verified in Task 3), keep native border for pulses (Task 2 keeps borders), fill-flash rework (Task 4), preview harness (Task 5), overlay bloom (Task 3 CSS + Task 6 tuning), chrome harmonization (Task 7), three entrypoints (covered by shared CSS + initGraph injection — Tasks 2/3), MANUAL (Task 8), iteration path documented (spec + notes Task 8). All spec sections map to a task.
- **Type consistency:** `nodeFaceDataUri(type, accessLevel)` / `nodeFaceSvg(type, accessLevel)` / `fenceYs(accessLevel)` signatures are consistent across Task 1 (def), Task 2 (call), Task 5 (exercised via updateNodeStyle). Filter id `starnet-bloom` and def container id `starnet-bloom-defs` consistent across Task 3 JS + CSS.
- **No placeholders:** every code step shows the exact code; every run step has expected output.
