# Preview Harness: Modular Overlay Animations + Card Gallery — Implementation Plan

**Goal:** Replace the six hardcoded node-overlay effects with light-DOM Lit components driven by a single registry (dispatch / pan-zoom / RUN_STARTED / preview all iterate it), kill the duplicated SVG markup, and add a card/hand gallery to the preview harness.

**Approach:** Each effect becomes a `NodeOverlay extends StarnetElement` component owning its SVG skeleton (`render()`) and per-frame imperative geometry (`_render()`), with loop effects owning their RAF/interval as instance fields. A pure `registry.js` of descriptors is the single source; a browser-only barrel mounts the elements and returns lookup maps. Big-bang migration (all six), one combined PR. Then a deterministic mock-card matrix mounts `<starnet-hand>` in the preview for design iteration.

**Tech stack:** Vanilla ES modules, Lit (light DOM via `StarnetElement`), Cytoscape (via `getCy()`), `node:test`.

**Testing note:** No jsdom — the overlay components and Lit elements cannot be imported in node tests (`HTMLElement` undefined). Pure modules (`registry.js`, the mock-card matrix data) ARE tested. Visual parity for the six effects + the card gallery is verified manually in a browser (the harness's purpose). Each phase below marks its TDD status explicitly.

---

## Phase 1: Overlay base class + pure registry (foundation, no wiring)

Establishes the new system without touching the running app. New files are unused until Phase 2, so the game is unchanged and verifiable as a clean baseline. Structural test locks the registry invariant.

**Files:**
- Create: `js/ui/overlays/registry.js` — pure descriptors + lookup helper (`@ts-check`, no DOM/Lit imports).
- Create: `js/ui/overlays/node-overlay.js` — `NodeOverlay` base class.
- Test: `tests/overlay-registry.test.js` — structural invariants.

**Key changes:**

`registry.js` (pure — safe to import in node):
```js
// @ts-check
import { A } from "../../core/action-ids.js";

/**
 * @typedef {{ key: string, action: string|null, tag: string, label: string,
 *   driver: "action-feedback"|"ice-timer", demo: { type: string, grade: string } }} OverlayDescriptor
 */

/** @type {OverlayDescriptor[]} */
export const OVERLAY_DESCRIPTORS = [
  { key: "probe",   action: A.PROBE,  tag: "probe-sweep-overlay",      label: "PROBE",   driver: "action-feedback", demo: { type: "router",      grade: "C" } },
  { key: "mine",    action: A.MINE,   tag: "mine-scan-overlay",        label: "MINE",    driver: "action-feedback", demo: { type: "cryptovault", grade: "A" } },
  { key: "read",    action: A.DUMP,   tag: "read-sectors-overlay",     label: "DUMP",    driver: "action-feedback", demo: { type: "fileserver",  grade: "C" } },
  { key: "loot",    action: A.FETCH,  tag: "loot-rings-overlay",       label: "FETCH",   driver: "action-feedback", demo: { type: "fileserver",  grade: "B" } },
  { key: "exploit", action: A.XPLOIT, tag: "exploit-brackets-overlay", label: "XPLOIT",  driver: "action-feedback", demo: { type: "firewall",    grade: "B" } },
  { key: "ice",     action: null,     tag: "ice-detect-overlay",       label: "ICE DET", driver: "ice-timer",       demo: { type: "ids",         grade: "A" } },
];

/** @param {string} action @returns {OverlayDescriptor|null} */
export function overlayDescriptorForAction(action) {
  return OVERLAY_DESCRIPTORS.find((d) => d.driver === "action-feedback" && d.action === action) ?? null;
}
```

`node-overlay.js` (base class — anchoring + show/hide + sync/clear/reposition contract):
```js
// @ts-check
import { html } from "lit";
import { StarnetElement } from "../components/starnet-element.js";
import { getCy } from "../graph.js";

export class NodeOverlay extends StarnetElement {
  constructor() {
    super();
    this.nodeId = null;
    this.progress = 0;
    this._ready = false;
  }

  firstUpdated() { this._ready = true; this._render(); }

  /** Resolve {pos, r} for the anchored node, or null if missing. */
  _anchor() {
    const cy = getCy();
    if (!cy || !this.nodeId) return null;
    const node = cy.getElementById(this.nodeId);
    if (!node || node.length === 0) return null;
    return { pos: node.renderedPosition(), r: node.renderedWidth() / 2 };
  }

  /** Position+show the root <svg>, sized to (r+pad)*2 centered on the node. */
  _place(svg, pos, r, pad = 0) {
    const half = r + pad;
    svg.style.width = `${half * 2}px`;
    svg.style.height = `${half * 2}px`;
    svg.style.left = `${pos.x - half}px`;
    svg.style.top = `${pos.y - half}px`;
    svg.style.opacity = "1";
  }

  _svg() { return this.querySelector("svg"); }

  sync(nodeId, progress) {
    this.nodeId = nodeId;
    this.progress = Math.max(0, Math.min(1, progress));
    if (this._ready) this._render();
  }

  /** Re-anchor on pan/zoom without changing progress. */
  reposition() { if (this._ready) this._render(); }

  clear() {
    this.nodeId = null;
    this.progress = 0;
    const svg = this._svg();
    if (svg) svg.style.opacity = "0";
  }

  /** Subclass: imperative geometry. Must early-return if !this.nodeId or _anchor() is null (hide svg). */
  _render() {}

  // Subclass overrides render() to return the static <svg> skeleton via html``.
  render() { return html``; }
}
```

**Verification — automated:**
- [x] `make lint` passes (registry.js + node-overlay.js both type-check clean — the `@ts-nocheck` fallback was NOT needed; `getCy()` returns `any` so the Cytoscape surface is fine for tsc)
- [x] `make test` passes (644 tests, +5 new in `tests/overlay-registry.test.js`)
- [x] `node --test tests/overlay-registry.test.js` green (5/5)

**Test content (`tests/overlay-registry.test.js`):**
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { OVERLAY_DESCRIPTORS, overlayDescriptorForAction } from "../js/ui/overlays/registry.js";
import { A } from "../js/core/action-ids.js";

test("registry has six overlays", () => {
  assert.equal(OVERLAY_DESCRIPTORS.length, 6);
});

test("action-feedback overlays map 1:1 to the five timed actions", () => {
  const af = OVERLAY_DESCRIPTORS.filter((d) => d.driver === "action-feedback");
  const actions = af.map((d) => d.action).sort();
  assert.deepEqual(actions, [A.PROBE, A.XPLOIT, A.DUMP, A.FETCH, A.MINE].sort());
  assert.equal(new Set(actions).size, actions.length, "no duplicate action mappings");
});

test("ice-detect is the lone timer-driven sibling", () => {
  const ice = OVERLAY_DESCRIPTORS.filter((d) => d.driver === "ice-timer");
  assert.equal(ice.length, 1);
  assert.equal(ice[0].key, "ice");
  assert.equal(ice[0].action, null);
});

test("overlayDescriptorForAction resolves and rejects correctly", () => {
  assert.equal(overlayDescriptorForAction(A.PROBE)?.key, "probe");
  assert.equal(overlayDescriptorForAction(A.MINE)?.key, "mine");
  assert.equal(overlayDescriptorForAction(A.JACKOUT), null);
  assert.equal(overlayDescriptorForAction("nonsense"), null);
});

test("every descriptor is well-formed", () => {
  for (const d of OVERLAY_DESCRIPTORS) {
    assert.match(d.tag, /-overlay$/);
    assert.ok(d.label && typeof d.label === "string");
    assert.ok(d.demo?.type && d.demo?.grade);
  }
});
```

**Verification — manual:**
- [x] Game still runs unchanged — confirmed structurally: `grep` shows no production file imports `overlays/registry`, `overlays/node-overlay`, or `overlays/index`, so the game bundle/behavior is byte-identical (dormant files)

---

## Phase 2: Port six effects to overlay components + switch the GAME over

The big-bang switchover for the running game. Each effect's existing render/loop math is ported verbatim into a component; the registry-driven barrel mounts them; `visual-renderer.js` dispatch / RUN_STARTED / ICE-timer path iterate the registry; `graph.js` loses the six effect functions + module globals (keeps reticle + ICE-overlay + adds a viewport-listener hook); `index.html` drops the six effect SVG blocks and the elements are mounted by JS. ICE detect ported but stays timer-driven.

**Files:**
- Create: `js/ui/overlays/probe-sweep.js`, `mine-scan.js`, `read-sectors.js`, `loot-rings.js`, `exploit-brackets.js`, `ice-detect.js` — one `NodeOverlay` subclass each.
- Create: `js/ui/overlays/index.js` — browser-only barrel: imports the six (registers custom elements) + `mountOverlays(container)`.
- Modify: `js/ui/graph.js` — delete the six `sync*`/`clear*`/`_render*`/loop functions + their module globals (state lines ~37-52 for the six effects; effect bodies 864-1351 except reticle); remove their calls from `onPanZoom` (191-196); add `onViewport(fn)` registration + invoke registered listeners in `onPanZoom`. Keep `syncReticle`, `_repositionIceOverlay`, `flashNode`, `getCy`, `syncSelection`, etc.
- Modify: `js/ui/visual-renderer.js` — replace the six effect imports with `mountOverlays`/registry; rewrite the `ACTION_FEEDBACK` dispatch, `RUN_STARTED` reset, and ICE-detect handlers to use the mounted overlay map; register an `onViewport` callback that repositions all overlays.
- Modify: `index.html` — remove the six effect `<svg>` blocks (keep `selection-reticle`); add an empty `<div id="overlay-layer">` inside `#graph-container`; load the overlay barrel via a `<script type=module>` (or import it from `main.js`). Keep the existing `lit` importmap.

**Key changes:**

Each component ports its current `_render` body verbatim, scoping DOM queries to `this`. Example — `probe-sweep.js`:
```js
// @ts-check
import { html } from "lit";
import { NodeOverlay } from "./node-overlay.js";

class ProbeSweepOverlay extends NodeOverlay {
  render() {
    return html`
      <svg style="position:absolute; opacity:0; pointer-events:none; overflow:visible; z-index:5; transition:opacity 0.15s ease;">
        <path class="fill" fill="rgba(0,255,255,0.18)"></path>
        <circle class="ring" fill="none" stroke="#00ffff" stroke-width="1" stroke-opacity="0.45"></circle>
      </svg>`;
  }

  _render() {
    const svg = this._svg();
    if (!svg) return;
    const a = this._anchor();
    if (!a) { svg.style.opacity = "0"; return; }
    const { pos, r } = a;
    this._place(svg, pos, r);
    const ring = svg.querySelector(".ring");
    ring.setAttribute("cx", r); ring.setAttribute("cy", r); ring.setAttribute("r", r - 1);
    const fill = svg.querySelector(".fill");
    const p = this.progress;
    if (p <= 0) { fill.setAttribute("d", ""); }
    else if (p >= 1) {
      fill.setAttribute("d", `M ${r},${r} m 0,-${r} a ${r},${r} 0 1,1 0,${r*2} a ${r},${r} 0 1,1 0,-${r*2} Z`);
    } else {
      const angle = p * 2 * Math.PI;
      const endX = r + r * Math.sin(angle), endY = r - r * Math.cos(angle);
      fill.setAttribute("d", `M ${r},${r} L ${r},${0} A ${r},${r} 0 ${p>0.5?1:0},1 ${endX},${endY} Z`);
    }
  }
}
customElements.define("probe-sweep-overlay", ProbeSweepOverlay);
```

Port notes per effect (preserve math byte-for-byte from cited lines):
- **mine-scan.js** (graph.js:920-982): reseed Lissajous params (`_fx/_fy/_phase` instance fields) in `sync()` when `nodeId !== this.nodeId`; same amplitude `r*0.62*(1-p*p)` lock-on math; `<line class="h">`, `<line class="v">`, `<rect class="box">`.
- **read-sectors.js** (graph.js:984-1063): `_count`/`_order` instance fields, reseeded on new target; same Fisher-Yates + 0.9 scaling.
- **loot-rings.js** (graph.js:1066-1163): owns `_intervalId` instance field. `sync()` starts `setInterval(() => this._spawn(), 200)` if not running; `clear()` clears interval + fades + clears rings via `setTimeout`. `_spawn()` ports `_spawnLootRing` (per-ring RAF). SVG root padded by 12 (use `_place(svg, pos, r, 12)` + viewBox).
- **exploit-brackets.js** (graph.js:1172-1293): owns `_zapIntervalId`, `_zapNextCorner`, `_zapTicksToFire` instance fields + `_startZaps`/`_stopZaps`/`_tickZaps` methods (ports lines 1179-1241). `sync()` calls `_render()` + `_startZaps()`; `clear()` calls `_stopZaps()` + opacity 0 + reset rotation. Keep `<defs><filter id="zap-bloom">` (single instance → id unique); scope `setLine` to `this`.
- **ice-detect.js** (graph.js:1295-1351): CCW arc math verbatim. Add `completeAndClear()` method (snap progress=1, render, then clear) replacing `completeAndClearIceDetectSweep`. `<path class="arc" stroke="#ff00aa" ...>`.

`overlays/index.js` (browser-only barrel):
```js
// @ts-check
import "./probe-sweep.js"; import "./mine-scan.js"; import "./read-sectors.js";
import "./loot-rings.js"; import "./exploit-brackets.js"; import "./ice-detect.js";
import { OVERLAY_DESCRIPTORS } from "./registry.js";

/**
 * Create one element per descriptor, append into `container`, return lookup maps.
 * @returns {{ byKey: Map<string,any>, byAction: Map<string,any> }}
 */
export function mountOverlays(container) {
  const byKey = new Map(), byAction = new Map();
  for (const d of OVERLAY_DESCRIPTORS) {
    const el = document.createElement(d.tag);
    container.appendChild(el);
    byKey.set(d.key, el);
    if (d.driver === "action-feedback" && d.action) byAction.set(d.action, el);
  }
  return { byKey, byAction };
}
```

`graph.js` viewport hook (replaces the six `_render*` calls in `onPanZoom`):
```js
const viewportListeners = [];
export function onViewport(fn) { viewportListeners.push(fn); }
// inside onPanZoom(), where the six _render*() calls were:
for (const fn of viewportListeners) fn();
```

`visual-renderer.js` dispatch rewrite (replaces line 14 effect imports + handlers 66-158):
```js
import { mountOverlays } from "./overlays/index.js";
import { onViewport } from "./graph.js"; // alongside existing graph.js imports
// ... in initVisualRenderer(), after graph init so getCy() is ready:
const layer = document.getElementById("overlay-layer");
const overlays = mountOverlays(layer);
onViewport(() => overlays.byKey.forEach((o) => o.reposition()));

const activeNodeIds = new Map(); // action -> nodeId
on(E.ACTION_FEEDBACK, ({ nodeId, action, phase, progress }) => {
  const ov = overlays.byAction.get(action);
  if (!ov) return;
  if (phase === "start") { activeNodeIds.set(action, nodeId); }
  else if (phase === "progress" && activeNodeIds.get(action)) {
    ov.sync(activeNodeIds.get(action), progress);
    if (action === A.XPLOIT) updateExploitProgress(progress); // hand-pane bar, not overlay
  } else if (phase === "complete" || phase === "cancel") {
    ov.clear(); activeNodeIds.delete(action);
  }
});
on(E.RUN_STARTED, () => { overlays.byKey.forEach((o) => o.clear()); activeNodeIds.clear(); });

const ice = overlays.byKey.get("ice");
on(E.ICE_DETECTED,     () => ice.completeAndClear());
on(E.ICE_MOVED,        () => ice.clear());
on(E.ICE_EJECTED,      () => ice.clear());
on(E.ICE_REBOOTED,     () => ice.clear());
on(E.PLAYER_NAVIGATED, () => ice.clear());
// in the TIMERS_UPDATED handler, replacing syncIceDetectSweep/clearIceDetectSweep:
const iceDetect = getVisibleTimers().find((t) => t.label === "ICE DETECTION");
if (iceDetect) ice.sync("ice-0", iceDetect.progress); else ice.clear();
```
Ordering: `mountOverlays` runs after graph init (so `getCy()` resolves) and before any ACTION_FEEDBACK; overlay elements no-op until `firstUpdated` sets `_ready`, so an early `sync()` is safe. The existing `RUN_STARTED` handler at line 57 (context-menu/choices) stays; only the effect-clearing `RUN_STARTED` at 131-136 is replaced.

**Verification — automated:**
- [x] `make lint` passes (one fix needed: cast the `.zap` element to `SVGElement` in exploit-brackets `_tickZaps` for `.style` access; no `@ts-nocheck` fallback needed)
- [x] `make test` passes (644 tests, no regressions)
- [x] `make check` passes

**Verification — manual** (verified in-browser via Playwright against `index.html` on a local server; bundle built with `make bundle-vendor`):
- [x] Probe → cyan CW pie sweep (screenshot: gateway shows filled pie at ~65%); driven by real `ACTION_FEEDBACK` start→progress→complete
- [x] Xploit → magenta brackets converge at corners (screenshot: wan node); `updateExploitProgress` call preserved in dispatch (sets `hand-strip.execProgress`)
- [x] Dump → read-sectors renders (opacity 1, fill path non-empty) via real DUMP feedback
- [x] Fetch → loot rings render (opacity 1, ring spawned) via real FETCH feedback
- [x] Mine → mine-scan crosshair renders (opacity 1, line content) via real MINE feedback
- [x] ICE detection → magenta CCW arc renders on `sync`; `completeAndClear()` snaps + clears
- [x] Pan during active effect → overlay re-anchors (`cy.panBy({x:60,y:40})` shifted svg left/top by exactly (60,40) via `onViewport`→`reposition`)
- [x] `RUN_STARTED` mid-effect → all six overlays cleared to opacity 0
- [x] No real console errors on `index.html` (the lone error is from a stale port-3000 server running the old pre-refactor preview)

---

## Phase 3: Preview harness auto-discovers effects from the registry

Replace the hand-maintained `EFFECTS` array and the duplicated per-effect SVG/control markup in the preview with registry-driven discovery. Adding a future effect now requires zero preview edits.

**Files:**
- Modify: `js/ui/preview.js` — import `mountOverlays` + `OVERLAY_DESCRIPTORS` + `onViewport`; mount overlays into the graph container; build demo nodes from descriptors; generate per-effect control rows from descriptors; wire scrub/play/reset against `overlays.byKey`. Remove the six effect imports + `EFFECTS` array.
- Modify: `preview.html` — remove the six effect `<svg>` blocks (keep `selection-reticle`); add `<div id="overlay-layer">` in `#graph-container`; replace the hardcoded per-effect control HTML (lines ~235-299) with a single `<div id="overlay-controls">` container; add the `lit` importmap (copy index.html:9-14).

**Key changes:**

`preview.js` demo nodes + controls from registry:
```js
import { mountOverlays } from "./overlays/index.js";
import { OVERLAY_DESCRIPTORS } from "./overlays/registry.js";
import { onViewport } from "./graph.js";

// demo nodes laid out in a row from descriptors (replaces hardcoded EFFECT_NODES)
const EFFECT_NODES = OVERLAY_DESCRIPTORS.map((d, i) => ({
  id: `demo-${d.key}`, label: d.label, type: d.demo.type, grade: d.demo.grade,
  x: 150 + i * 130, y: 120,
}));
// (keep demo-select, demo-flash, SHAPE_NODES, ALERT_NODES as-is)

// after initGraph(...) + getCy():
const overlays = mountOverlays(document.getElementById("graph-container"));
onViewport(() => overlays.byKey.forEach((o) => o.reposition()));

// generate controls into #overlay-controls
const controls = document.getElementById("overlay-controls");
for (const d of OVERLAY_DESCRIPTORS) {
  controls.insertAdjacentHTML("beforeend", `
    <h3>${d.label}</h3>
    <div class="effect-row">
      <label>progress</label>
      <input type="range" id="slider-${d.key}" min="0" max="1" step="0.01" value="0">
      <span class="val" id="val-${d.key}">0.00</span>
    </div>
    <div class="btn-row">
      <button id="btn-${d.key}-play">PLAY</button>
      <button id="btn-${d.key}-reset">RESET</button>
    </div>`);
}
// wiring loop iterates OVERLAY_DESCRIPTORS:
//   sync = (id, t) => overlays.byKey.get(d.key).sync(`demo-${d.key}`, t)
//   clear = () => overlays.byKey.get(d.key).clear()
// reused by per-effect slider/play/reset and by PLAY ALL / RESET ALL.
// animateEffect() unchanged (still drives slider 0→1 calling sync).
```

**Verification — automated:**
- [x] `make lint` passes
- [x] `make test` passes (644)
- [x] `make check` passes

**Verification — manual** (verified in-browser via Playwright on preview.html):
- [x] All six effect control rows render (PROBE/MINE/DUMP/FETCH/XPLOIT/ICE DET), generated from the registry (`#overlay-controls` has 6 sliders: slider-probe…slider-ice)
- [x] Slider scrub drives the matching overlay (slider-probe→0.5 fired input → probe svg opacity 1, fill non-empty); ICE arc + others render
- [x] Selection reticle toggle works (dashed reticle visible on demo-select); PLAY/RESET wiring uses the same overlay.sync/clear closures
- [x] Node flash buttons present (SUCCESS/FAILURE/REVEAL)
- [x] No duplicated effect SVG markup remains: `git grep -l "probe-sweep-fill" preview.html index.html` returns nothing
- [x] No console errors on preview.html

---

## Phase 4: Card / hand component gallery in the preview (#118)

Mount real `<starnet-hand>` instances fed a deterministic mock-card matrix spanning rarity × quality × wear × match, plus a mock probed node for match testing. Cards only this session.

**Files:**
- Create: `js/ui/preview-cards.js` — pure mock-data builders (`cardGalleryGroups()`, `MOCK_SELECTED_NODE`) + a browser-only `mountCardGallery(container)`. Data builders are DOM-free so the test can import them; only `mountCardGallery` touches the DOM.
- Test: `tests/preview-card-gallery.test.js` — asserts the matrix covers all rarities + wear states and includes match + no-match cards vs the mock node.
- Modify: `preview.html` — (importmap added in Phase 3) add `<script type="module" src="js/ui/components/starnet-hand.js">`; add `<div class="section"><h2>Card Gallery</h2><div id="card-gallery"></div></div>` to the control panel.
- Modify: `js/ui/preview.js` — import + call `mountCardGallery(document.getElementById("card-gallery"))`.

**Key changes:**

`preview-cards.js`:
```js
// @ts-check
/** @typedef {import('../core/types.js').ExploitCard} ExploitCard */

const RARITIES = ["common", "uncommon", "rare"];
const WEARS = ["fresh", "worn", "disclosed"];
const QUALITY = { low: 0.2, mid: 0.55, high: 0.9 };
const USES = { common: 3, uncommon: 5, rare: 8 };

let _id = 0;
/** @returns {ExploitCard} */
function mockCard({ rarity = "common", quality = 0.55, wear = "fresh", vuln = "unpatched-ssh", name } = {}) {
  return {
    id: `mock-${_id++}`,
    name: name ?? `${rarity} exploit`,
    rarity, quality,
    targetVulnTypes: [vuln],
    decayState: wear,
    usesRemaining: wear === "disclosed" ? 0 : USES[rarity],
  };
}

/** Mock probed node: knows about unpatched-ssh + weak-auth. */
export const MOCK_SELECTED_NODE = {
  probed: true,
  vulnerabilities: [
    { id: "unpatched-ssh", patched: false, hidden: false },
    { id: "weak-auth",     patched: false, hidden: false },
  ],
};

/** Groups of cards, each rendered as one <starnet-hand>. */
export function cardGalleryGroups() {
  return [
    { title: "Rarity × Quality", selectedNode: null,
      cards: RARITIES.flatMap((r) => Object.entries(QUALITY).map(([q, v]) => mockCard({ rarity: r, quality: v, name: `${r} ${q}` }))) },
    { title: "Wear states", selectedNode: null,
      cards: WEARS.map((w) => mockCard({ rarity: "uncommon", wear: w, name: `uncommon ${w}` })) },
    { title: "Match vs node", selectedNode: MOCK_SELECTED_NODE,
      cards: [
        mockCard({ rarity: "rare", vuln: "unpatched-ssh", name: "match (ssh)" }),
        mockCard({ rarity: "common", vuln: "sql-injection", name: "no-match (sqli)" }),
      ] },
  ];
}

export function mountCardGallery(container) {
  for (const g of cardGalleryGroups()) {
    const h = document.createElement("h3"); h.textContent = g.title; container.appendChild(h);
    const hand = /** @type {any} */ (document.createElement("starnet-hand"));
    hand.cards = g.cards;
    hand.selectedNode = g.selectedNode;
    hand.selectedNodeId = g.selectedNode ? "mock-node" : "";
    container.appendChild(hand);
  }
}
```

**Verification — automated:**
- [x] `make lint` passes
- [x] `make test` passes including `tests/preview-card-gallery.test.js` (647 tests, +3)
- [x] `node --test tests/preview-card-gallery.test.js` green (3/3)

**Test content (`tests/preview-card-gallery.test.js`):**
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { cardGalleryGroups, MOCK_SELECTED_NODE } from "../js/ui/preview-cards.js";

const groups = cardGalleryGroups();
const all = groups.flatMap((g) => g.cards);

test("cards are well-formed ExploitCards", () => {
  for (const c of all) {
    assert.ok(c.id && c.name);
    assert.ok(["common","uncommon","rare"].includes(c.rarity));
    assert.ok(c.quality >= 0 && c.quality <= 1);
    assert.ok(Array.isArray(c.targetVulnTypes) && c.targetVulnTypes.length >= 1);
    assert.ok(["fresh","worn","disclosed"].includes(c.decayState));
    assert.equal(typeof c.usesRemaining, "number");
  }
});

test("matrix covers all rarities and wear states", () => {
  assert.deepEqual([...new Set(all.map((c) => c.rarity))].sort(), ["common","rare","uncommon"]);
  assert.deepEqual([...new Set(all.map((c) => c.decayState))].sort(), ["disclosed","fresh","worn"]);
});

test("match group has a match and a no-match vs the mock node", () => {
  const known = MOCK_SELECTED_NODE.vulnerabilities.filter((v) => !v.patched && !v.hidden).map((v) => v.id);
  const matchGroup = groups.find((g) => g.selectedNode);
  const matches = matchGroup.cards.filter((c) => c.targetVulnTypes.some((t) => known.includes(t)));
  const noMatches = matchGroup.cards.filter((c) => !c.targetVulnTypes.some((t) => known.includes(t)));
  assert.ok(matches.length >= 1, "at least one matching card");
  assert.ok(noMatches.length >= 1, "at least one non-matching card");
});
```

**Verification — manual** (verified in-browser via Playwright on preview.html):
- [x] "Card Gallery" shows three labeled groups (Rarity × Quality / Wear states / Match vs node) with 9 / 3 / 2 real `<starnet-hand>` cards
- [x] Rarity × Quality: rare cards show magenta borders; quality pip bars increase low→high; USES = 3/5/8 by rarity
- [x] Wear group: fresh → "5", worn → "5 (worn)", disclosed → "DISCLOSED" + `disclosed` class
- [x] Match group: "match (ssh)" has `match` class, "no-match (sqli)" has `no-match` class (vs the mock probed node)
- [x] Cards use the in-game CSS (light-DOM mount inherits style.css); no console errors

---

## Plan self-review

**Spec coverage:**
- #116 base class → Phase 1 (`NodeOverlay`). Six subclasses → Phase 2. Registry → Phase 1 (data) + Phase 2 (wiring). Dispatch/panzoom/RUN_STARTED iterate registry → Phase 2. No duplicated SVG → Phase 2 (index) + Phase 3 (preview). Preview auto-discovery → Phase 3. ICE as timer-driven sibling sharing the contract → Phase 2. Behavior parity → manual verification each phase.
- #118 card gallery, fixed matrix, cards only → Phase 4.
- "What we're NOT doing": no visual changes (ports are verbatim), no canvas, ICE stays timer-driven, no components beyond hand, no #117 work, event contract unchanged. ✓

**Placeholder scan:** no TBD/TODO; every phase has concrete code + real test code. ✓

**Type/name consistency:** `OVERLAY_DESCRIPTORS` / `overlayDescriptorForAction` / `mountOverlays` / `onViewport` / `completeAndClear` / `cardGalleryGroups` / `MOCK_SELECTED_NODE` / `mountCardGallery` used consistently across phases. Overlay tags match the registry (`*-overlay`). `byKey`/`byAction` map names consistent. ✓

**Known risks flagged inline:** tsc on Cytoscape `any` (fallback: `@ts-nocheck` + Makefile exclude); async first-render (base class `_ready` guard); `mountOverlays` ordering vs graph init.
```

---

## Follow-on improvements (added mid-session, after Phases 1–4 verified)

Agreed with Les after reviewing the refactor. Each its own commit.

### Phase 5: Overlays follow node drag

Latent gap preserved for parity: `cy.on("position", "node", …)` repositioned only
the reticle + ICE marker, not the new overlays (they only re-anchor on pan/zoom via
`onViewport`). Dragging a node mid-effect left the overlay behind.

- Modify: `js/ui/graph.js` — node-position handler also fires `viewportListeners`.

- [x] `make check` passes (647)
- [x] Verified by construction: the position handler now fires the same `viewportListeners` whose reposition was Playwright-confirmed in Phase 2 (panBy shifted overlays by the exact delta)

### Phase 6: Extract + test the ACTION_FEEDBACK dispatch

The start→progress→complete state machine + `activeNodeIds` tracking was only
Playwright-verified. Extract it into a pure function and node-test it (the wiring
most likely to regress across the three parallel entry points).

- Create: `js/ui/overlays/dispatch.js` — `dispatchActionFeedback(byAction, activeNodeIds, payload, { onXploitProgress })` pure state machine over fake overlay objects.
- Modify: `js/ui/visual-renderer.js` — ACTION_FEEDBACK handler delegates to it.
- Test: `tests/overlay-dispatch.test.js` — start tracks node; progress syncs; complete/cancel clears + forgets; unknown action ignored; XPLOIT fires the progress hook.

- [x] failing test first (7 tests), then pass
- [x] `make check` passes (654)
- [x] In-browser: rewired live handler still drives overlays (probe renders/clears); XPLOIT hook set `hand-strip.execProgress`

### Phase 7: Migrate the selection reticle to a NodeOverlay component

The reticle is the last duplicated overlay SVG (both HTML files) + last module-global
overlay. Make it a `SelectionReticle extends NodeOverlay` (selection-driven, not in the
action registry). `graph.js` keeps `currentSelectedNodeId` + the select-and-fit refit
logic but delegates the visual via a registered ref; the reticle re-anchors via
`onViewport` like the effects.

- Create: `js/ui/overlays/selection-reticle.js` — `<selection-reticle>` component (ports `syncReticle` math) + `mountReticle(container)`.
- Modify: `js/ui/graph.js` — remove `syncReticle()`; add `setReticleOverlay(el)`; `syncSelection` delegates to the ref; drop explicit `syncReticle()` from onPanZoom + node-drag (rides `viewportListeners`).
- Modify: `js/ui/visual-renderer.js` + `js/ui/preview.js` — mount the reticle, `setReticleOverlay`, register `onViewport` reposition.
- Modify: `index.html` + `preview.html` — remove the `<svg id="selection-reticle">` block.
- Modify: `css/style.css` — `#selection-reticle`/`#reticle-group` → `.selection-reticle`/`.reticle-group` (match the class-based pattern).

- [x] `make check` passes (654)
- [x] index.html (Playwright): `syncSelection(id)` shows reticle (ring r=44.5), `.reticle-group` resolves `reticle-spin` animation, pan repositions, `syncSelection(null)` clears
- [x] preview.html (Playwright): reticle toggle ON→opacity 1 / OFF→opacity 0; no console errors
- [x] No overlay SVG markup remains in either HTML file (`git grep` for selection-reticle/reticle-group/probe-sweep-fill → none)
