# Heat History Strip ("Ember Scope") Implementation Plan

**Goal:** Add a third phosphor strip below HEALTH/DECK in the HUD that renders `state.heat` over
time as a stroke-only vector flame.

**Approach:** New pure geometry module `js/ui/heat-flame.js` (tested) + a thin canvas component
`<starnet-heat-scope>` (canvas/RAF/dpr plumbing, sweep+phosphor loop), mirroring the
`waveform.js` / `<starnet-waveform>` split. The existing heat gauge lamp stays. Y-scale reuses
`HEAT_GAUGE_MAX`. No mechanic changes; read-only visualization.

**Tech stack:** Vanilla ES modules, Lit (light-DOM component base `starnet-element.js`), Canvas 2D,
`node:test` for the pure module. The tuned reference is `heat-strip-lab.html` in this session dir.

---

## Phase 1: Pure flame geometry module + tests

Deliver `js/ui/heat-flame.js` — deterministic, DOM-free geometry + color/alpha for the flame,
with unit tests. This is the testable core; the component (Phase 2) is plumbing over it.

**Files:**
- Create: `js/ui/heat-flame.js`
- Create: `tests/heat-flame.test.js`
- Modify: `js/ui/indicator-glyphs.js` — export the existing scale: `const HEAT_GAUGE_MAX = 12;`
  → `export const HEAT_GAUGE_MAX = 12;` (no value change; Phase 3 imports it).

**Key changes** (all pure; `geom` bundles the per-frame canvas metrics):
```js
// js/ui/heat-flame.js  — @ts-check, no DOM, no Math.random (seeds passed in)

const YELLOW = [255, 225, 55], RED = [255, 40, 40];

/** Deterministic bounded pseudo-noise in (-1, 1) from a frozen column seed r and index k. */
export function flameNoise(r, k) {
  return (Math.sin(r * 12.9898 + k * 4.1414) * 43758.5453) % 1;
}

/** y of contour band j (j=0 = crown/top edge; higher j = lower tongues) for a column.
 *  level = heat fraction 0..1; r = frozen per-column seed; geom = {base, span, gap, jag}. */
export function bandY(level, r, j, { base, span, gap, jag }) {
  const jitMag = flameNoise(r, 1) * jag * 3 * (0.4 + level);
  const jitDamp = Math.max(0, 1 - j * 0.14);   // base is calmer than the crown
  return base - level * span + j * gap - jitMag * jitDamp;
}

/** Does band j have room above the baseline for this column's flame height?
 *  Bands are added/removed ONLY at the bottom → monotone in j and in level. */
export function bandExists(level, j, { span, gap }) {
  return level * span >= j * gap + 0.5;
}

/** Stroke color for band index j: crown (j=0) red → deepest band (j=maxBands-1) yellow. */
export function bandColor(j, maxBands) {
  const u = maxBands > 1 ? 1 - j / (maxBands - 1) : 1;   // 1 red .. 0 yellow
  const c = YELLOW.map((v, i) => Math.round(v + (RED[i] - v) * u));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** Alpha multiplier by band index: crown = 1, lower bands progressively more transparent. */
export function bandAlpha(j, maxBands, fade) {
  if (j === 0) return 1;
  const t = maxBands > 1 ? j / (maxBands - 1) : 0;
  return 1 - fade * t;
}
```

**Tests** (`tests/heat-flame.test.js`, `node:test`):
```js
// flameNoise: deterministic + bounded
assert.equal(flameNoise(0.3, 1), flameNoise(0.3, 1));
assert.ok(Math.abs(flameNoise(0.7, 2)) <= 1);

// bandY: jag=0 → clean geometry; crown = base-span*level; constant gap; band 0 == crown
const g = { base: 40, span: 36, gap: 4, jag: 0 };
assert.equal(bandY(0.5, 0.9, 0, g), 40 - 0.5 * 36);            // crown height
assert.equal(bandY(0.5, 0.9, 2, g) - bandY(0.5, 0.9, 1, g), 4); // fixed spacing
assert.ok(bandY(1, 0.5, 0, g) < bandY(0.2, 0.5, 0, g));         // hotter → higher crown (smaller y)

// bandExists: add-from-bottom invariants
assert.ok(bandExists(1, 0, g));                                 // crown present when hot
assert.ok(!bandExists(0.01, 3, g));                             // no room when cold
// if band j exists, every shallower band exists (monotone in j)
for (const lvl of [0.2, 0.5, 0.9]) for (let j = 1; j < 8; j++)
  if (bandExists(lvl, j, g)) assert.ok(bandExists(lvl, j - 1, g));
// monotone in level for fixed j
assert.ok(!(bandExists(0.3, 4, g) && !bandExists(0.9, 4, g)));

// bandColor: endpoints red crown, yellow base
assert.equal(bandColor(0, 6), "rgb(255,40,40)");
assert.equal(bandColor(5, 6), "rgb(255,225,55)");

// bandAlpha: crown opaque, decreasing, non-negative
assert.equal(bandAlpha(0, 6, 0.6), 1);
assert.ok(bandAlpha(5, 6, 0.6) < bandAlpha(1, 6, 0.6));
assert.ok(bandAlpha(5, 6, 0.6) >= 0);
```

**Verification — automated:**
- [x] `node --test tests/heat-flame.test.js` passes (11/11)
- [x] `make check` passes (lint + full test suite; 1389 tests)

**Verification — manual:**
- [x] (none — pure module; visual verification in Phase 2)

---

## Phase 2: `<starnet-heat-scope>` component + preview demo

Deliver the canvas component and wire it into the preview harness so the flame is viewable and
tuneable in isolation (CLAUDE.md: new visual effects MUST be added to the preview harness).

**Files:**
- Create: `js/ui/components/starnet-heat-scope.js`
- Modify: `preview.html` — add a "Heat Scope" section mirroring the "Vital Waveforms" panel
  (`preview.html:268-300`): a `#heat-scope-demo` mount + a HEAT slider (`#heat-scope-val`) and
  optional SPEED/BLOOM/GAP sliders.
- Modify: `js/ui/preview.js` — mirror the waveform demo (`preview.js:403-430`): create a
  `<starnet-heat-scope>`, wire the HEAT slider to its `frac`.
- Modify: `preview.html` — add `<script type="module" src="js/ui/components/starnet-heat-scope.js"></script>`
  alongside the other component scripts (and it will be loaded on index in Phase 3).

**Key changes** — component mirrors `<starnet-waveform>` (`starnet-waveform.js:111-222`) for dpr
setup, color-var resolution, the RAF loop, sweep-head advance (`STEP=2`), trail cutoff, and
age-band batching (`NB=12`). Differences: buffer schema and the multi-band draw via `heat-flame`.

```js
// js/ui/components/starnet-heat-scope.js
import { html, nothing } from "lit";
import { StarnetElement } from "./starnet-element.js";
import { bandY, bandExists, bandColor, bandAlpha } from "../heat-flame.js";

const STEP = 2, NB = 12, CEIL = 12;

class StarnetHeatScope extends StarnetElement {
  static properties = {
    frac: { type: Number }, label: { type: String },
    w: { type: Number }, h: { type: Number },
    speed: { type: Number }, trail: { type: Number }, bloom: { type: Number },
    bandGap: { type: Number }, maxBands: { type: Number }, jag: { type: Number }, fade: { type: Number },
    autosize: { type: Boolean },
  };
  constructor() {
    super();
    this.frac = 0; this.label = "HEAT";
    this.w = 204; this.h = 44;
    this.speed = 90; this.trail = 0.9; this.bloom = 6;         // tuned defaults (lab)
    this.bandGap = 4; this.maxBands = 12; this.jag = 0.5; this.fade = 0.6;
    this.autosize = false;
    this._buf = []; this._head = 0; this._lastTs = null; this._rafId = null; this._ctx = null;
    this._W = this.w; this._H = this.h; this._ro = null;
  }
  render() {
    return html`
      ${this.label ? html`<div class="vital-head"><span class="vital-label">${this.label}</span></div>` : nothing}
      <span class="hud-waveform"><canvas></canvas></span>`;
  }
  // firstUpdated/updated/connected/disconnected/_setupCanvas/_startLoop/_stopLoop:
  //   copy verbatim from starnet-waveform.js:82-157 (no color-var needed → drop _resolveColor).
  _frame(ts) {
    // 1. advance sweep head, pushing {x, level: frac, r: Math.random(), t: now, gap} each STEP px
    //    (frozen r per column so phosphor holds still); drop buf entries older than trail cutoff.
    // 2. clear; for j = maxBands-1 .. 0: batch columns by age band into one path per band,
    //    skipping p.gap and columns where !bandExists(p.level, j, {span, gap}); stroke with
    //    strokeStyle/shadowColor = bandColor(j, MAXB), globalAlpha = bandAlpha(j,MAXB,fade)*ageAlpha.
    // 3. leading head dot at bandY(head.level, head.r, 0, geom), color bandColor(0, MAXB).
    // Geometry: base = H-3, span = (H-3) - 4, gap = bandGap, jag = jag; MAXB = min(CEIL, maxBands).
    // Exact draw is ported from heat-strip-lab.html (frameScope) in this session dir.
  }
}
customElements.define("starnet-heat-scope", StarnetHeatScope);
```

Preview wiring:
```js
// js/ui/preview.js — after the waveform demo block
const heatDemo = $("heat-scope-demo"), heatSlider = $("heat-scope"), heatVal = $("heat-scope-val");
if (heatDemo && heatSlider) {
  const scope = document.createElement("starnet-heat-scope");
  scope.frac = 0.4; scope.style.width = "204px"; scope.className = "vital-strip";
  heatDemo.append(scope);
  heatSlider.addEventListener("input", () => {
    scope.frac = +heatSlider.value / 100;            // slider 0..100 = frac 0..1 (HEAT_GAUGE_MAX scale)
    if (heatVal) heatVal.textContent = String(heatSlider.value);
  });
}
```

**Test opt-out:** The component is canvas/RAF/dpr plumbing with no logic beyond what Phase 1
already unit-tests; `getContext("2d")` isn't available under `node:test`. Verified manually in the
preview harness instead. (Documented per plan TDD opt-out for rendering scaffolding.)

**Verification — automated:**
- [x] `make check` passes (lint sees the new component + preview edits; 1389 tests)

**Verification — manual:** _(self-verified via headless-Chrome screenshot of a focused mount at
frac 0.25 / 0.6 / 0.95 + a 520×110 zoom; awaiting Les's live confirmation in `/preview.html`)_
- [x] Heat Scope panel shows a swept flame
- [x] Crown rises with heat; lines add **only at the bottom** (no redistribution)
- [x] Red crown → yellow base; lower lines more transparent
- [x] Reads legibly at the 204×44 strip size

---

## Phase 3: Live HUD integration + manual

Mount the strip in `#vital-stack` between DECK and the VISIT WAN button, drive its `frac` from
`state.heat`, style it, and document it.

**Files:**
- Modify: `index.html` — add the component script tag; add the strip markup in `#vital-stack`
  (`index.html:43-52`) between `#vital-deck` and `<starnet-uplink>`:
  ```html
  <starnet-heat-scope id="vital-heat" class="vital-strip" autosize
    label="HEAT" h="44" speed="90" trail="0.9" bloom="6"></starnet-heat-scope>
  ```
- Modify: `js/ui/visual-renderer.js` — in `syncVitals` (`:406`), set the heat strip frac:
  ```js
  import { HEAT_GAUGE_MAX } from "./indicator-glyphs.js";   // top of file
  // inside syncVitals:
  const heatEl = /** @type {any} */ (document.getElementById("vital-heat"));
  if (heatEl) heatEl.frac = Math.max(0, Math.min(1, (state.heat || 0) / HEAT_GAUGE_MAX));
  ```
- Modify: `css/style.css` — the heat scope reuses `.vital-strip` (already `width:100%`, dark bg,
  border) and `.vital-head`/`.vital-label`; no new rule required unless the label header needs a
  warm tint. If tinting: add `#vital-heat .vital-label { color: #b5794a; }` near the vital CSS
  (`:1782`). Verify no layout regression in `#vital-stack`.
- Modify: `MANUAL.md` — in the heat/HUD section, document the HEAT strip: a scrolling flame
  showing heat over time (rises with activity, decays when you lie low); complements the heat lamp;
  does not reveal the alarm threshold.

**Verification — automated:**
- [x] `make check` passes (1389 tests, lint clean)
- [x] `make census SEEDS=10` shows no regression (10/10 complete; pure-UI change, bot path untouched)

**Verification — manual:**
- [x] HEAT strip sits between DECK and VISIT WAN (headless hub screenshot: HEALTH → DECK → HEAT order,
  warm-tinted HEAT label; empty at heat=0 as expected)
- [x] Strip never blocks graph interaction (`#vital-stack` is `pointer-events:none`; unchanged CSS)
- [x] No trip/threshold line is visible (component never draws one — `drawTrip` was not ported)
- [ ] _Les to confirm live:_ probing/xploiting raises the flame; waiting/lie-low lowers it (matches
  the heat lamp's direction)

---

## Notes

- One commit per phase (`Phase N: <name>`). Session docs (spec+plan) committed before execution.
- Palette (red crown/yellow base) and placement (between DECK and VISIT WAN) are locked per spec.
- Fine-tuning of bloom/speed/gap/fade happens live in-game after landing; defaults are the lab values.
