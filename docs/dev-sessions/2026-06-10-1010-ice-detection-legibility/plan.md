# ICE presence + detection legibility — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "ICE-in-a-circle" badge with an angular "Strike Cage" predator form, turn the detection sweep into a 12-segment polygon that fades in CCW, fix two detection-feedback bugs, and record a no-curves design principle.

**Architecture:** A new pure SVG-geometry module (`js/ui/ice-glyphs.js`, mirroring `node-glyphs.js`) is the single source of the ICE forms and is unit-tested. `graph.js` (presence HTML overlay) and `js/ui/overlays/ice-detect.js` (detection NodeOverlay) consume it. Two bugs are UI-layer: the detection overlay is anchored to a dead node id, and `main.js` stops emitting `TIMERS_UPDATED` when the timer count hits zero so the sidebar never clears.

**Tech Stack:** Vanilla JS ES modules, Lit (overlays), Cytoscape (graph), `node:test` (unit), Playwright MCP + `preview.html` (visual QA).

**Testing reality:** `ice-glyphs.js` is pure → real unit tests. The graph overlay, `main.js` tick loop, and `visual-renderer` wiring are DOM/Cytoscape-coupled and have no headless test harness in this repo — they are reproduced and verified with the Playwright MCP against `preview.html` / `index.html`, the project's existing visual-QA path. Each such task says exactly what to click and observe.

---

## File Structure

- **Create** `js/ui/ice-glyphs.js` — pure: `iceStrikeCage()` (presence SVG body) + `detectionPolygonSegments(sides, r)` (segment endpoints). No DOM.
- **Create** `tests/ice-glyphs.test.js` — unit tests for the above.
- **Modify** `js/ui/graph.js` — `addIceNode()`: swap circle+text content for the Strike Cage SVG; add CCW pulse.
- **Modify** `js/ui/overlays/ice-detect.js` — render 12 fading segments instead of the arc path.
- **Modify** `js/ui/visual-renderer.js:115` — sync the detect overlay to the dwell node (`state.selectedNodeId`), not `"ice-0"`.
- **Modify** `js/ui/main.js:93-96` — emit a final `TIMERS_UPDATED` on the falling edge to zero.
- **Modify** `js/ui/preview.js` + `preview.html` — add an ICE-presence demo node + show/hide control.
- **Modify** `CLAUDE.md` — add the no-curves design principle.

---

## Task 1: `ice-glyphs.js` pure geometry module (+ unit tests)

**Files:**
- Create: `js/ui/ice-glyphs.js`
- Test: `tests/ice-glyphs.test.js`

- [ ] **Step 1: Write the failing test** — `tests/ice-glyphs.test.js`

```js
import test from "node:test";
import assert from "node:assert/strict";
import { iceStrikeCage, detectionPolygonSegments } from "../js/ui/ice-glyphs.js";

test("iceStrikeCage returns stroke-only SVG markup (no curves)", () => {
  const s = iceStrikeCage();
  assert.match(s, /<svg[\s>]/, "is an svg");
  assert.ok(/polyline|line|polygon/.test(s), "uses straight primitives");
  assert.ok(!/<(path|circle|ellipse)\b/.test(s), "no curved primitives (no-curves principle)");
});

test("detectionPolygonSegments returns `sides` segments forming a closed ring", () => {
  const segs = detectionPolygonSegments(12, 30);
  assert.equal(segs.length, 12);
  // each segment connects to the next (chain closes)
  for (let i = 0; i < segs.length; i++) {
    const next = segs[(i + 1) % segs.length];
    assert.ok(Math.hypot(segs[i].x2 - next.x1, segs[i].y2 - next.y1) < 1e-6,
      `segment ${i} end meets segment ${i + 1} start`);
  }
});

test("detectionPolygonSegments vertices sit on radius r about the origin", () => {
  const r = 30;
  for (const s of detectionPolygonSegments(12, r)) {
    assert.ok(Math.abs(Math.hypot(s.x1, s.y1) - r) < 1e-6, "vertex on radius");
  }
});

test("detectionPolygonSegments ordering is counter-clockwise from the top", () => {
  const segs = detectionPolygonSegments(12, 30);
  // first vertex at top (0,-r); next vertex moves to -x (screen CCW)
  assert.ok(Math.abs(segs[0].x1) < 1e-6 && segs[0].y1 < 0, "starts at top");
  assert.ok(segs[0].x2 < 0, "proceeds counter-clockwise (toward -x)");
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `node --test tests/ice-glyphs.test.js`
Expected: FAIL — module not found / functions undefined.

- [ ] **Step 3: Implement** — `js/ui/ice-glyphs.js`

```js
// @ts-check
// ICE forms — pure SVG generation, no DOM. Mirrors node-glyphs.js. All forms are
// stroke-only / straight-segment (retro vector display, no curves — see CLAUDE.md).
// Consumed by graph.js (presence overlay) and overlays/ice-detect.js (detection),
// and demoed in preview.js.

export const ICE_RED = "#ff2a2a";
export const ICE_MAGENTA = "#ff00aa";

/**
 * "Strike Cage" ICE presence form — angular mandibles snapping shut around a
 * node from above (brainstorm concept C). Node center sits at the SVG center
 * (50,58); the cage crouches above it. overflow:visible lets the jaws extend
 * past the node. Authored stroke-only.
 * @returns {string} an <svg> string
 */
export function iceStrikeCage() {
  const seg = `fill="none" stroke="${ICE_RED}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;
  return `<svg viewBox="0 0 100 100" overflow="visible" style="overflow:visible">
    <g class="ice-cage" style="filter:drop-shadow(0 0 3px ${ICE_RED}) drop-shadow(0 0 8px ${ICE_RED}bb)">
      <polyline ${seg} points="18,20 50,10 82,20"/>
      <polyline ${seg} points="18,20 30,30 25,48 37,58"/>
      <polyline ${seg} points="82,20 70,30 75,48 63,58"/>
      <polyline ${seg} points="30,30 39,41"/>
      <polyline ${seg} points="70,30 61,41"/>
    </g>
  </svg>`;
}

/**
 * Endpoints for an `sides`-gon of radius `r` centered on the origin, ordered
 * counter-clockwise from the top (adversarial rotation convention). Each entry
 * is one polygon edge; the renderer maps dwell progress → per-segment opacity.
 * @param {number} sides
 * @param {number} r
 * @returns {{x1:number,y1:number,x2:number,y2:number}[]}
 */
export function detectionPolygonSegments(sides = 12, r = 30) {
  const pts = [];
  for (let i = 0; i <= sides; i++) {
    const a = (90 + (360 / sides) * i) * Math.PI / 180; // top, increasing → CCW on screen
    pts.push({ x: r * Math.cos(a), y: -r * Math.sin(a) });
  }
  const segs = [];
  for (let i = 0; i < sides; i++) {
    segs.push({ x1: pts[i].x, y1: pts[i].y, x2: pts[i + 1].x, y2: pts[i + 1].y });
  }
  return segs;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `node --test tests/ice-glyphs.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add js/ui/ice-glyphs.js tests/ice-glyphs.test.js
git commit -m 'feat(ui): ice-glyphs pure module — strike-cage + detection polygon geometry'
```

---

## Task 2: Detection overlay → 12-segment polygon + fix dead-node anchor

**Files:**
- Modify: `js/ui/overlays/ice-detect.js`
- Modify: `js/ui/visual-renderer.js` (line ~113-118)

- [ ] **Step 1: Rewrite the overlay render** — replace the `render()` and `_render()` in `js/ui/overlays/ice-detect.js`. Keep the class name, `customElements.define`, and `completeAndClear()` contract.

```js
// @ts-check
// ICE DETECTION: a 12-segment polygon around the node whose edges fade in
// counter-clockwise (adversarial convention) as the dwell timer fills, then
// flash to a full bright cage on detection. Angular / no-curves (see CLAUDE.md).

import { html } from "lit";
import { NodeOverlay } from "./node-overlay.js";
import { detectionPolygonSegments, ICE_MAGENTA } from "../ice-glyphs.js";

const RING_GAP = 10;   // px screen-space gap outside the node
const SIDES = 12;
const DIM = 0.06;      // resting opacity of an unlit segment

class IceDetectOverlay extends NodeOverlay {
  // ICE_DETECTED: flash all segments to full, then fade out.
  completeAndClear() {
    if (this.nodeId) {
      this.progress = 1;
      if (this._ready) this._render();
    }
    this.clear();
  }

  render() {
    // SIDES static <line> segments; geometry + opacity set per-frame in _render().
    const lines = Array.from({ length: SIDES }, () =>
      html`<line class="seg" stroke="${ICE_MAGENTA}" stroke-width="3" stroke-linecap="round"></line>`);
    return html`
      <svg style="position:absolute; opacity:0; pointer-events:none; overflow:visible; z-index:5;
                  transition:opacity 0.15s ease; filter:drop-shadow(0 0 4px ${ICE_MAGENTA});">
        ${lines}
      </svg>`;
  }

  _render() {
    const svg = this._svg();
    if (!svg) return;
    const a = this._anchor();
    if (!a) { svg.style.opacity = "0"; return; }
    const { pos, r } = a;
    const rRing = r + RING_GAP;
    this._place(svg, pos, r, RING_GAP);

    // Local SVG origin is the node center at (rRing, rRing) after _place().
    const ox = rRing, oy = rRing;
    const segs = detectionPolygonSegments(SIDES, rRing);
    const lines = svg.querySelectorAll(".seg");
    const p = this.progress;
    lines.forEach((ln, i) => {
      const s = segs[i];
      ln.setAttribute("x1", (ox + s.x1).toFixed(2));
      ln.setAttribute("y1", (oy + s.y1).toFixed(2));
      ln.setAttribute("x2", (ox + s.x2).toFixed(2));
      ln.setAttribute("y2", (oy + s.y2).toFixed(2));
      // Gradual per-segment fade-in as progress sweeps CCW; all full at p>=1.
      const o = Math.max(DIM, Math.min(1, p * SIDES - i));
      ln.setAttribute("stroke-opacity", o.toFixed(3));
    });
  }
}

customElements.define("ice-detect-overlay", IceDetectOverlay);
```

- [ ] **Step 2: Fix the dead-node anchor** — in `js/ui/visual-renderer.js`, the `E.TIMERS_UPDATED` handler currently syncs to `"ice-0"` (a Cytoscape node that no longer exists since ICE became an HTML overlay). Point it at the dwell node, which is always the selected node during detection.

Change:
```js
    const iceDetect = getVisibleTimers().find((t) => t.label === "ICE DETECTION");
    if (iceDetect) {
      iceOverlay.sync("ice-0", iceDetect.progress);
    } else {
      iceOverlay.clear();
    }
```
to:
```js
    const iceDetect = getVisibleTimers().find((t) => t.label === "ICE DETECTION");
    if (iceDetect && state.selectedNodeId) {
      // Dwell always happens on the player's selected node (checkIceDetection only
      // arms when ice.attentionNodeId === selectedNodeId). Anchor the overlay there.
      iceOverlay.sync(state.selectedNodeId, iceDetect.progress);
    } else {
      iceOverlay.clear();
    }
```

- [ ] **Step 3: Verify the overlay registry still resolves** (the overlay is registry-driven; this guards the descriptor wiring).

Run: `node --test tests/overlay-registry.test.js tests/overlay-dispatch.test.js`
Expected: PASS (unchanged — class name + custom element tag preserved).

- [ ] **Step 4: Visual verify in the preview harness (Playwright MCP).**
  - Start the dev server: `make serve` (http://localhost:3000) and ensure `make bundle-vendor` has been run.
  - Navigate to `http://localhost:3000/preview.html`.
  - Find the `ice-detect` effect control row (auto-generated from the registry), drag its slider 0→1: assert segments light up one-by-one counter-clockwise from the top and the full 12-gon shows at 1.0. Click PLAY: assert the animated fill. Screenshot for the notes.

- [ ] **Step 5: Commit**

```bash
git add js/ui/overlays/ice-detect.js js/ui/visual-renderer.js
git commit -m 'feat(ui): ICE detection as 12-segment CCW polygon; anchor to dwell node (#detection-legibility)'
```

---

## Task 3: ICE presence → Strike Cage (Concept C)

**Files:**
- Modify: `js/ui/graph.js` (`addIceNode`, ~line 653-678)
- Modify: `css/style.css` (pulse keyframes)

- [ ] **Step 1: Swap the overlay content** — in `js/ui/graph.js`, replace the body of `addIceNode()` that builds the magenta circle + "ICE" text. Import the form at the top of the file (`import { iceStrikeCage } from "./ice-glyphs.js";`). New element setup:

```js
  const el = document.createElement("div");
  el.id = "ice-overlay";
  el.style.cssText = `
    position: absolute; pointer-events: none; z-index: 10;
    width: 40px; height: 40px; margin-left: -20px; margin-top: -20px;
    overflow: visible;
    transition: opacity 0.3s ease;
    opacity: 0;
  `;
  el.innerHTML = iceStrikeCage();
  el.classList.add("ice-presence");   // hook for the pulse animation
```
(Remove the old `border`, `border-radius`, `background`, `box-shadow`, flex/text styling and `el.textContent = "ICE"`.) Leave `_repositionIceOverlay`, `syncIceGraph`, and the movement-animation logic untouched — they operate on the element's position/opacity, not its content.

- [ ] **Step 2: Add the menace pulse** — in `css/style.css`, a slow counter-clockwise breathing pulse (adversarial convention):

```css
@keyframes ice-menace {
  0%   { transform: rotate(0deg)   scale(1);    opacity: 0.85; }
  50%  { transform: rotate(-6deg)  scale(1.06); opacity: 1;    }
  100% { transform: rotate(0deg)   scale(1);    opacity: 0.85; }
}
#ice-overlay .ice-cage { transform-box: fill-box; transform-origin: 50% 60%; animation: ice-menace 2.4s ease-in-out infinite; }
```
(Counter-clockwise = negative rotation. `.ice-cage` is the `<g>` inside `iceStrikeCage()`.)

- [ ] **Step 3: Visual verify (Playwright MCP).**
  - `preview.html` after Task 5 will host a presence demo; for now verify in-game: start the server, open `http://localhost:3000`, start a run on a network with ICE (corporate-foothold has gentle ICE), navigate so ICE is on a controlled node, and confirm the red Strike Cage renders crouched over the node and pulses. Screenshot.

- [ ] **Step 4: Commit**

```bash
git add js/ui/graph.js css/style.css
git commit -m 'feat(ui): ICE presence as red Strike Cage with menace pulse (#detection-legibility)'
```

---

## Task 4: Fix lingering sidebar timer (falling-edge TIMERS_UPDATED)

**Files:**
- Modify: `js/ui/main.js` (~line 93-96)

- [ ] **Step 1: Reproduce (Playwright MCP).** Server up, open `http://localhost:3000`, start a run with ICE. Target a node, let ICE move onto it → sidebar shows `⚠ ICE DETECTION: Xs`. Target a *different* node with no ICE (or untarget). **Observe the bug:** the `ICE DETECTION` line stays in the sidebar indefinitely. Note it in `notes.md` as the confirmed repro.

- [ ] **Step 2: Root cause confirmed (no code yet).** `main.js` only emits `TIMERS_UPDATED` while `getVisibleTimers().length > 0`. When the dwell timer is cancelled (core does this correctly on `PLAYER_NAVIGATED`) the count hits 0, so the final clearing event never fires and `syncIceTimers()` never refreshes the (now-empty) list.

- [ ] **Step 3: Fix** — change `js/ui/main.js`:

```js
  let prevVisibleCount = 0;
  setInterval(() => {
    tick(1);
    const count = getVisibleTimers().length;
    // Emit on the falling edge to zero too, so timer-driven UI (e.g. the sidebar
    // ICE DETECTION countdown) clears when the last visible timer is cancelled.
    if (count > 0 || prevVisibleCount > 0) emitEvent(E.TIMERS_UPDATED, getState());
    prevVisibleCount = count;
  }, TICK_MS);
```
(Replaces the existing `setInterval(() => { tick(1); if (getVisibleTimers().length > 0) emitEvent(...); }, TICK_MS);`.)

- [ ] **Step 4: Verify (Playwright MCP).** Repeat Step 1's repro: the `ICE DETECTION` line now disappears immediately when you leave the node. Also confirm normal countdown still shows while dwelling. Screenshot for notes.

- [ ] **Step 5: Commit**

```bash
git add js/ui/main.js
git commit -m 'fix(ui): clear timer-driven sidebar when last visible timer is cancelled (#detection-legibility)'
```

---

## Task 5: Preview-harness demo for ICE presence

**Files:**
- Modify: `js/ui/preview.js`
- Modify: `preview.html`

Note: the **detection** overlay is registry-driven and already auto-demoed (Task 2 Step 4). Only the **presence** form (the non-registry HTML overlay) needs a demo.

- [ ] **Step 1: Add a presence demo node + render.** In `js/ui/preview.js`, after the existing demo-node setup, add a dedicated node and render the Strike Cage SVG over it as a standalone HTML overlay (independent of graph.js's in-game machinery):

```js
import { iceStrikeCage } from "./ice-glyphs.js";
// ICE presence demo: a node with the Strike Cage crouched over it.
const ICE_NODE = { id: "demo-ice", label: "ICE", type: "router", grade: "C",
  x: 150 + (OVERLAY_DESCRIPTORS.length + 2) * 130, y: 120 };
// (add ICE_NODE to the elements array used to init the preview Cytoscape graph)
```
After the graph mounts, position an `.ice-presence` div (using `iceStrikeCage()`) over `demo-ice` via its rendered position (reuse the same pattern as the in-game `#ice-overlay`: 40px, `margin -20`, `overflow:visible`, centered on the node), and re-anchor it in the existing `onViewport(...)` callback.

- [ ] **Step 2: Add a control.** In `preview.html`, add a control row with a checkbox/button `ICE presence: show / hide` and a `pulse` toggle that adds/removes the `.ice-presence` animation class, mirroring the existing control-row markup.

- [ ] **Step 3: Verify (Playwright MCP).** Open `preview.html`: the Strike Cage demo node shows the red pulsing cage; toggling show/hide and pulse works. Screenshot for notes.

- [ ] **Step 4: Commit**

```bash
git add js/ui/preview.js preview.html
git commit -m 'feat(preview): ICE presence (Strike Cage) demo in the harness'
```

---

## Task 6: Record the no-curves design principle

**Files:**
- Modify: `CLAUDE.md` (Design Aesthetic section)

- [ ] **Step 1: Add the principle** under `## Design Aesthetic` in `CLAUDE.md`:

```markdown
### Retro vector display — no easy curves

The graph aesthetic is a retro vector CRT that can't comfortably draw curves.
New graphics use straight segments and polygons — e.g. a many-sided polygon whose
edges fade in, rather than an arc that sweeps closed; angular ideographs rather
than circles. Hostile/enemy elements use red (`#ff2a2a`) and magenta (`#ff00aa`).
Existing curved graphics may be re-vectored over time, but do it deliberately, one
effect at a time — not as a sweeping refactor. Geometry lives in pure, testable
modules (`js/ui/node-glyphs.js`, `js/ui/ice-glyphs.js`) consumed by both `graph.js`
and `preview.js`.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m 'docs: record retro vector / no-curves design principle'
```

---

## Task 7: Closeout

- [ ] **Step 1:** `make check` — expect green (new `ice-glyphs` unit tests pass; nothing else regressed).
- [ ] **Step 2:** Full visual pass in `preview.html` (both ICE indicators) and one in-game run on `corporate-foothold` (presence + detection visible; sidebar clears on leave). Capture screenshots in `notes.md`.
- [ ] **Step 3:** Write the session summary in `notes.md`; confirm every spec acceptance criterion. Open a PR to `main`.

## Self-review notes
- Spec §1 → Task 1; §2 → Task 3; §3 → Task 2; §4 lingering → Task 4, §4 invisible → Task 2 Step 2; §5 → Tasks 2 (auto) + 5; §6 → Task 6. All covered.
- `iceStrikeCage` / `detectionPolygonSegments` names consistent across Tasks 1, 2, 3, 5.
- Honesty: only `ice-glyphs` is unit-tested; DOM-layer changes are Playwright-MCP-verified (no headless DOM harness exists) — stated up front and per task.
