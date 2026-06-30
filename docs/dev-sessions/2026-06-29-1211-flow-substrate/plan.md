# Session 0: Flow Substrate Implementation Plan

**Goal:** LAN edges carry and render typed, animated packet flows from serializable
`state.flows` — the visual + data foundation for the Flow Subversion pillar. No new player
verbs, no balance change.

**Approach:** Flows are first-class serializable state (`state.flows: Flow[]`), authored in a
network's `meta.flows`. A new edge-anchored, continuously self-animating SVG overlay draws
each flow's packets along the edge between its endpoints, gated by endpoint visibility. Packet
geometry lives in a pure `flow-glyphs.js` module. (See `research.md` for integration points.)

**Tech stack:** Vanilla ES modules, JSDoc `@ts-check`, SVG + SMIL `animateMotion`, Cytoscape
for node positions, `node:test`.

---

## Phase 1: Flow data model + serialization

Add the `Flow` type and a serializable `state.flows`, populated from `meta.flows`. Pure
data — no rendering. (TDD.)

**Files:**
- Modify: `js/types.js` — add `Flow` typedef; `GameState` gains `flows: Flow[]`.
- Modify: `js/core/state/index.js` — add `flows: meta.flows ?? []` to the `ctx.state` object
  literal (currently `state/index.js:157-186`, alongside `nodes`/`adjacency`).
- Test: `tests/flow-substrate.test.js` — new.

**Key changes:**
```js
/**
 * @typedef {Object} Flow
 * @property {string} from        - source node id
 * @property {string} to          - target node id (direction = from→to)
 * @property {'money'|'data'|'audit'|'control'|'credential'} type
 * @property {number} rate        - volume cue (drives packet density/speed); 0..1
 * @property {boolean} [encrypted] - if true, type is concealed until revealed
 */
```
- In `initGame`, the state literal gains one line:
```js
    flows: meta.flows ?? [],   // first-class, serializable (rides ...rest in serializeState)
```
- No serialization changes needed: `serializeState` spreads `...rest` (`state/index.js:361`),
  so a plain array round-trips automatically.

**Test (write first, watch fail):**
```js
// tests/flow-substrate.test.js
import { initGame, getState, serializeState, deserializeState } from "../js/core/state/index.js";
import { buildMinimalLAN } from "./fixtures/minimal-lan.js"; // existing minimal builder
const withFlows = () => {
  const { graphDef, meta } = buildMinimalLAN();
  return { graphDef, meta: { ...meta, flows: [
    { from: "gateway", to: "server", type: "money", rate: 0.8 },
    { from: "gateway", to: "server", type: "audit", rate: 0.3, encrypted: true },
  ] } };
};
test("state.flows is populated from meta.flows", () => {
  initGame(withFlows, "flow-1");
  assert.equal(getState().flows.length, 2);
  assert.equal(getState().flows[0].type, "money");
});
test("flows survive a serialize → JSON → deserialize round-trip", () => {
  initGame(withFlows, "flow-2");
  const snap = JSON.parse(JSON.stringify(serializeState()));
  assert.equal(snap.flows.length, 2);
  deserializeState(snap);
  assert.equal(getState().flows[1].encrypted, true);
});
test("a network with no meta.flows yields an empty array (no crash)", () => {
  initGame(buildMinimalLAN, "flow-3");
  assert.deepEqual(getState().flows, []);
});
```
(If `buildMinimalLAN`'s node ids differ, use its actual ids — execute confirms against the
fixture.)

**Verification — automated:**
- [x] `make test` passes (new `tests/flow-substrate.test.js` green; suite 1468 pass / 0 fail)
- [x] `make lint` passes (new `Flow` typedef type-checks)
- [x] `make check` passes

**Verification — manual:**
- [x] none (no UI yet)

---

## Phase 2: `flow-glyphs.js` pure geometry module

Stroke-only vector packet glyphs per type, mirroring `node-glyphs.js`/`ice-glyphs.js`. Pure,
no DOM. (TDD.)

**Files:**
- Create: `js/ui/flow-glyphs.js`
- Test: `tests/flow-glyphs.test.js` — new.

**Key changes:**
```js
// js/ui/flow-glyphs.js
export const FLOW_TYPES = ["money", "data", "audit", "control", "credential"];
/** @type {Record<string,{color:string, body:string}>} */
export const FLOW_GLYPHS = {
  money:      { color: "#ffcf5c", body: `<polygon points="6,2 10,6 6,10 2,6" fill="none" stroke="#ffcf5c" stroke-width="1.4"/>` },      // ◇ diamond
  data:       { color: "#5cd6ff", body: `<rect x="2.5" y="2.5" width="7" height="7" fill="none" stroke="#5cd6ff" stroke-width="1.4"/>` }, // ▢ square
  audit:      { color: "#ff5c5c", body: `<polygon points="6,2 10,9.5 2,9.5" fill="none" stroke="#ff5c5c" stroke-width="1.4"/>` },        // △ triangle
  control:    { color: "#ffa94d", body: `<path d="M3,2 L9,6 L3,10" fill="none" stroke="#ffa94d" stroke-width="1.4"/>` },                 // › chevron
  credential: { color: "#ff6cc7", body: `<polygon points="10,6 8,9.6 4,9.6 2,6 4,2.4 8,2.4" fill="none" stroke="#ff6cc7" stroke-width="1.3"/>` }, // ⬡ hexagon
};
const ENCRYPTED_COLOR = "#5a7f8a";
/** Glyph for a type, or a neutral fallback for unknown types. */
export function flowGlyphFor(type) { return FLOW_GLYPHS[type] ?? { color: ENCRYPTED_COLOR, body: "" }; }
/**
 * Standalone packet SVG (viewBox 0 0 12 12, stroke-only). When encrypted, render the
 * concealed treatment (dim "?" glyph) instead of the type glyph.
 * @param {string} type @param {{encrypted?:boolean}} [opts]
 */
export function flowSvg(type, opts = {}) {
  const inner = opts.encrypted
    ? `<text x="6" y="9" font-size="9" font-family="monospace" text-anchor="middle" fill="${ENCRYPTED_COLOR}">?</text>`
    : flowGlyphFor(type).body;
  return `<svg viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}
```

**Test (write first, watch fail):**
```js
// tests/flow-glyphs.test.js
import { FLOW_TYPES, FLOW_GLYPHS, flowSvg } from "../js/ui/flow-glyphs.js";
test("every flow type has a stroke-only glyph (no fills)", () => {
  for (const t of FLOW_TYPES) {
    const g = FLOW_GLYPHS[t];
    assert.match(g.body, /stroke=/);
    assert.match(g.body, /fill="none"/);
  }
});
test("flowSvg embeds the type's stroke color", () => {
  assert.ok(flowSvg("money").includes("#ffcf5c"));
});
test("encrypted render hides the type glyph behind a ? treatment", () => {
  const enc = flowSvg("money", { encrypted: true });
  assert.ok(enc.includes("?"));
  assert.ok(!enc.includes("#ffcf5c"));
});
test("unknown type falls back without throwing", () => {
  assert.doesNotThrow(() => flowSvg("bogus"));
});
```

**Verification — automated:**
- [x] `make test` passes (`tests/flow-glyphs.test.js` green; suite 1473 pass / 0 fail)
- [x] `make lint` passes
- [x] `make check` passes

**Verification — manual:**
- [x] none (geometry verified in Phase 4 preview)

---

## Phase 3: Edge-anchored flow layer + renderer wiring

A continuously-animating SVG layer that draws each renderable flow's packets along its edge,
repositioned on viewport. New plumbing — no edge overlay exists today (`research.md` §2). TDD
the pure selector; the SMIL/DOM animation is infrastructure (TDD opt-out, manual-verified).

**Files:**
- Create: `js/ui/overlays/flow-layer.js` — the layer (builds + repositions packet animations);
  also exports the pure `renderableFlows(flows, presentNodeIds)` seam.
- Modify: `js/ui/visual-renderer.js` — construct the layer against `#overlay-layer`,
  `refresh(getState().flows, cy)` on `E.STATE_CHANGED` + initial network load, `reposition()`
  on cy `pan`/`zoom` (same viewport signal as `js/ui/overlays/index.js:46`).
- Test: `tests/flow-layer.test.js` — pure selector only.

**Key changes:**
```js
// js/ui/overlays/flow-layer.js — pure selector seam
/** Flows whose BOTH endpoints are currently present (revealed) in the graph. */
export function renderableFlows(flows, presentNodeIds) {
  const present = new Set(presentNodeIds);
  return flows.filter(f => present.has(f.from) && present.has(f.to));
}
```
- Layer class (DOM, opt-out of TDD):
  - `constructor(overlayEl)` — owns one `<svg>` child inside `#overlay-layer`.
  - `refresh(flows, cy)` — `renderableFlows(flows, cy.nodes().map(n => n.id()))`; for each,
    build a `<path>` between the two rendered positions + N `animateMotion` packets
    (`flowSvg(type,{encrypted})`, count/speed derived from `rate`), looping (SMIL self-animates
    — no JS tick). Diff against the previous flow set so unchanged flows aren't rebuilt.
  - `reposition()` — recompute each path's endpoint coords from
    `cy.getElementById(id).renderedPosition()` and apply zoom scale (mirrors
    `node-overlay._anchor`, `overlays/node-overlay.js:15`).
  - Connection line stays neutral; only packets carry type (per spec).
- Wiring in `visual-renderer.js`: instantiate once; on `E.STATE_CHANGED` call
  `layer.refresh(getState().flows, getCy())`; bind `cy.on("pan zoom", () => layer.reposition())`.

**Test (pure selector, write first):**
```js
// tests/flow-layer.test.js
import { renderableFlows } from "../js/ui/overlays/flow-layer.js";
const flows = [
  { from: "a", to: "b", type: "money", rate: 1 },
  { from: "a", to: "c", type: "data", rate: 1 },
];
test("only flows with both endpoints present are renderable", () => {
  assert.equal(renderableFlows(flows, ["a", "b"]).length, 1);
  assert.equal(renderableFlows(flows, ["a", "b", "c"]).length, 2);
  assert.equal(renderableFlows(flows, ["a"]).length, 0);
});
```
> TDD opt-out (documented): the SMIL/DOM animation + `visual-renderer` wiring is rendering
> infrastructure with no pure-logic seam beyond `renderableFlows`; verified manually in a
> browser + the Phase 4 preview, per the feel-driven guidance.

**Verification — automated:**
- [x] `make test` passes (`tests/flow-layer.test.js` green; suite 1476 pass / 0 fail)
- [x] `make lint` passes (`@ts-check` on new modules)
- [x] `make check` passes

**Verification — manual:**
- [x] `make serve`, load a network authored with flows (Phase 4): packets animate along
      visible edges; the line itself carries no type color.
- [x] Pan/zoom keeps packets aligned to their edges (zoom-tracking confirmed by Les).
- [ ] Fog-of-war: a flow whose endpoint is still hidden does NOT render; it appears once both
      endpoints are revealed.
- [x] A flows-less network renders normally (census + other networks ran clean, no errors).

---

## Phase 4: Preview demo + one authored network (feel-driven tuning)

Demo every packet type (incl. a mixed-type edge and an encrypted edge) in the preview harness
with controls, and author `meta.flows` into one network so flows are visible in a real run.
Visual-only; no balance change. (TDD opt-out — preview wiring + feel tuning.)

**Files:**
- Modify: `js/ui/preview.js` + `preview.html` — add a Flow Types demo section + controls
  (mirror the demo pattern at `preview.js:87-94`, `:191-245`).
- Modify: one network builder's `meta` to add `flows` (default: the corporate-exchange network
  builder) — visual-only, parallel to `meta.ice`, using that network's real node ids.

**Key changes:**
- `preview.js`: add `FLOW_NODES` (two owned/accessible demo nodes) + a demo edge; a `flow-layer`
  instance fed a control-driven flow set; controls = a toggle per packet type, a density slider
  (→ `rate`), an "encrypted" toggle, and one mixed-type edge carrying money + audit at once.
- chosen network builder: `meta.flows = [{from, to, type, rate, encrypted?}, ...]` (e.g. a money
  artery toward the gateway + an audit flow toward a monitor). Authored by eye; tuned in the loop.

**Verification — automated:**
- [x] `make check` passes (suite 1476 pass / 0 fail)
- [x] `make census SEEDS=10` runs clean (traceFiredRate 0.8, avgNodesOwned 3.8); flows consume
      no RNG and the bot ignores `state.flows`, so balance is unchanged by construction.

**Verification — manual (with Les — feel-driven):**
- [x] Preview shows all five packet glyphs animating; shapes/colors read at a glance.
- [x] The mixed-type edge clearly shows two packet types sharing one line (parallel lanes).
- [ ] The encrypted edge reads as concealed (dim/`?`) and distinct from the five types.
- [x] Density slider visibly changes packet volume; cadence feels right.
- [x] In a real run (`make serve`) the authored network shows flows on revealed edges.
- [x] Final tuned look locked with Les (rim inset, jitter, lanes, glow, stroke).

---

## Plan self-review

- **Spec coverage:** `Flow` typedef + `state.flows` (P1) ✓; serializable round-trip (P1) ✓;
  pure `flow-glyphs.js` (P2) ✓; animated edge packets — shape/density/direction/encrypted,
  neutral line (P3) ✓; JSON round-trip test (P1) ✓; preview demo incl. mixed + encrypted (P4)
  ✓; one authored network (P4) ✓. NOT-doing list (no verbs/economy/scoring/operator-driven
  emission/balance change) respected throughout.
- **Placeholder scan:** no TBD/TODO; test code and signatures are concrete.
- **Type consistency:** `Flow {from,to,type,rate,encrypted?}` used identically in P1/P3/P4;
  `renderableFlows`, `flowSvg`, `FLOW_GLYPHS` names consistent across phases.
- **Carried to execute:** confirm `buildMinimalLAN`'s real node ids for the P1 test fixture,
  and which builder gets authored flows in P4 (default: corporate-exchange).
