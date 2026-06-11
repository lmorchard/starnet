# Graph Degradation Overlays Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** As the player's HEALTH / DECK INTEGRITY pools deplete, the network-graph panel
visibly degrades — health → organic "neural turbulence" hallucination, deck → digital
"signal corruption" — pushing the player toward the console while text surfaces stay clean.

**Architecture:** A pure intensity-mapping module (`graph-degradation-params.js`, fully
unit-tested) maps the pools → effect params. A WebGL overlay module
(`graph-degradation.js`) injects a transparent `<canvas>` into `#graph-container`, runs one
fragment shader compositing both colored layers, and applies a health-driven CSS filter
chain to `#cy` for the real-graph haze. `visual-renderer` drives it from `STATE_CHANGED`;
the preview harness drives it from dummy sliders. Decoupled v1 — never reads Cytoscape
pixels; no animated SVG filters.

**Tech Stack:** Vanilla ES modules, WebGL1, `node:test`, JSDoc `@ts-check`. `make check`
= lint + tests; `make serve` for the browser.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `js/ui/graph-degradation-params.js` | Pure: pools → effect params + CSS filter string | **Create** |
| `js/ui/graph-degradation-params.test.js` | Unit tests for the pure module | **Create** |
| `js/ui/graph-degradation.js` | WebGL overlay canvas + shader + rAF + `#cy` filter; `init` / `updateFromState` | **Create** |
| `js/ui/visual-renderer.js` | Init the overlay; drive it on `STATE_CHANGED` | **Modify** |
| `js/ui/preview.js` | Dummy health/deck sliders driving the overlay | **Modify** |
| `preview.html` | Slider markup for the harness | **Modify** |
| `MANUAL.md` | Note graph degradation under low health/deck | **Modify** |

No `index.html` / `playground.html` / `css/style.css` edits — the module injects its own
canvas (styled inline) and composes the `#cy` filter in JS, mirroring how `ensureBloomFilter`
self-injects.

---

## Task 1: Pure intensity-mapping module

**Files:**
- Create: `js/ui/graph-degradation-params.js`
- Test: `js/ui/graph-degradation-params.test.js`

- [ ] **Step 1: Write the failing test**

Create `js/ui/graph-degradation-params.test.js`:

```js
// @ts-check
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { degradationParams, buildGraphFilterString, HEALTH_THRESHOLD } from "./graph-degradation-params.js";

const st = (h, d) => ({ player: { health: { current: h, max: 100 }, deckIntegrity: { current: d, max: 100 } } });

describe("degradationParams severity", () => {
  it("is zero at full health and deck", () => {
    const p = degradationParams(st(100, 100));
    assert.equal(p.health.severity, 0);
    assert.equal(p.deck.severity, 0);
    assert.equal(p.health.overlayOpacity, 0);
    assert.equal(p.deck.overlayOpacity, 0);
  });

  it("is zero at exactly the threshold and below-threshold-only ramps", () => {
    const atThresh = degradationParams(st(70, 100)); // 70% == threshold 0.7
    assert.equal(atThresh.health.severity, 0);
    const below = degradationParams(st(35, 100)); // halfway from threshold to 0
    assert.ok(below.health.severity > 0.4 && below.health.severity < 0.6);
  });

  it("reaches 1 at empty", () => {
    const p = degradationParams(st(0, 0));
    assert.equal(p.health.severity, 1);
    assert.equal(p.deck.severity, 1);
  });

  it("increases monotonically as a pool drops", () => {
    const a = degradationParams(st(60, 100)).health.severity;
    const b = degradationParams(st(40, 100)).health.severity;
    const c = degradationParams(st(10, 100)).health.severity;
    assert.ok(a < b && b < c);
  });

  it("pools are independent", () => {
    const p = degradationParams(st(10, 100));
    assert.ok(p.health.severity > 0);
    assert.equal(p.deck.severity, 0);
  });

  it("clamps and tolerates missing/zero-max state", () => {
    assert.equal(degradationParams(st(150, 100)).health.severity, 0); // over max
    assert.equal(degradationParams({}).health.severity, 0);           // missing player
    assert.equal(degradationParams({ player: { health: { current: 5, max: 0 } } }).health.severity, 0); // zero max
  });
});

describe("buildGraphFilterString", () => {
  it("returns bloom only at zero severity", () => {
    assert.equal(buildGraphFilterString(degradationParams(st(100, 100)).health), "url(#starnet-bloom)");
  });
  it("adds blur/hue/contrast when health is degraded", () => {
    const s = buildGraphFilterString(degradationParams(st(10, 100)).health);
    assert.match(s, /^url\(#starnet-bloom\) blur\([\d.]+px\) hue-rotate\([\d.]+deg\) contrast\([\d.]+\)$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test js/ui/graph-degradation-params.test.js`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the module**

Create `js/ui/graph-degradation-params.js`:

```js
// @ts-check
// Pure intensity-mapping for the graph-degradation overlays. No DOM, no WebGL,
// no state imports — maps the player resource pools to effect parameters so the
// math is unit-testable; the WebGL/CSS application lives in graph-degradation.js.

/** Below this fraction of a pool the effect is invisible; it ramps from here to empty. */
export const HEALTH_THRESHOLD = 0.7;
export const DECK_THRESHOLD = 0.7;

// Tuned maxima reached at empty (severity 1). These + the thresholds are the knobs
// #141 will tune by hand in the preview harness.
const HEALTH_MAX = { overlayOpacity: 0.7, blurPx: 2.5, hueDeg: 40, minContrast: 0.65 };
const DECK_MAX = { overlayOpacity: 0.8, chromaticPx: 6, tearRate: 1, blockRate: 1 };

/** @param {number} cur @param {number} max @param {number} threshold @returns {number} 0..1 */
function severity(cur, max, threshold) {
  if (!max || max <= 0) return 0;
  const frac = Math.max(0, Math.min(1, cur / max));
  return Math.max(0, Math.min(1, (threshold - frac) / threshold));
}

/**
 * @param {{player?:{health?:{current:number,max:number},deckIntegrity?:{current:number,max:number}}}} state
 * @returns {{health:object, deck:object}}
 */
export function degradationParams(state) {
  const h = state?.player?.health ?? { current: 100, max: 100 };
  const d = state?.player?.deckIntegrity ?? { current: 100, max: 100 };
  const hs = severity(h.current, h.max, HEALTH_THRESHOLD);
  const ds = severity(d.current, d.max, DECK_THRESHOLD);
  return {
    health: {
      severity: hs,
      overlayOpacity: hs * HEALTH_MAX.overlayOpacity,
      blurPx: hs * HEALTH_MAX.blurPx,
      hueDeg: hs * HEALTH_MAX.hueDeg,
      contrast: 1 - hs * (1 - HEALTH_MAX.minContrast),
    },
    deck: {
      severity: ds,
      overlayOpacity: ds * DECK_MAX.overlayOpacity,
      chromaticPx: ds * DECK_MAX.chromaticPx,
      tearRate: ds * DECK_MAX.tearRate,
      blockRate: ds * DECK_MAX.blockRate,
    },
  };
}

/**
 * Compose the CSS filter chain for #cy: always the base bloom reference, plus
 * health-driven haze when degraded. (Coupled by design to the #starnet-bloom id
 * injected by graph.js — that is the established graph bloom filter.)
 * @param {{severity:number, blurPx:number, hueDeg:number, contrast:number}} health
 * @returns {string}
 */
export function buildGraphFilterString(health) {
  const base = "url(#starnet-bloom)";
  if (!health || health.severity <= 0) return base;
  return `${base} blur(${health.blurPx.toFixed(2)}px) hue-rotate(${health.hueDeg.toFixed(1)}deg) contrast(${health.contrast.toFixed(3)})`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test js/ui/graph-degradation-params.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/ui/graph-degradation-params.js js/ui/graph-degradation-params.test.js
git commit -m 'feat(ui): pure intensity-mapping for graph degradation overlays'
```

---

## Task 2: WebGL overlay module

Browser-verified (no WebGL unit harness in node). The implementer writes the code, keeps
lint clean, and confirms `make test` shows no regressions; the controller does the visual
check in Task 6.

**Files:**
- Create: `js/ui/graph-degradation.js`

- [ ] **Step 1: Write the module**

Create `js/ui/graph-degradation.js`:

```js
// @ts-check
// Graph-panel degradation overlay. Injects a transparent WebGL canvas into
// #graph-container and composites two colored layers — neural turbulence (health)
// and signal corruption (deck) — over the graph. Health also drives a CSS filter
// chain on #cy (haze). Decoupled v1: never reads Cytoscape pixels. Graceful no-op
// if there's no #graph-container or no WebGL.

import { degradationParams, buildGraphFilterString } from "./graph-degradation-params.js";

let gl = null, canvas = null, program = null, raf = 0;
let uniforms = null;
// Latest params (set by updateFromState; read by the rAF loop).
let cur = { health: { severity: 0, overlayOpacity: 0 }, deck: { severity: 0, overlayOpacity: 0, chromaticPx: 0, tearRate: 0, blockRate: 0 } };
let curFilter = "url(#starnet-bloom)";

const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
const FRAG = `
precision highp float;
uniform vec2 u_res; uniform float u_t;
uniform float u_hop;   // health overlay opacity
uniform float u_dop;   // deck overlay opacity
uniform float u_tear;  // deck tear rate
uniform float u_block; // deck block rate
float hash(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));
 return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vnoise(p);p*=2.03;a*=.5;}return s;}
void main(){
  vec2 uv=gl_FragCoord.xy/u_res;
  vec2 auv=uv; auv.x*=u_res.x/u_res.y;
  // health — neural turbulence (organic, magenta/teal)
  float t=u_t*0.25;
  vec2 q=vec2(fbm(auv*3.+t), fbm(auv*3.+vec2(5.2,1.3)+t));
  vec2 r=vec2(fbm(auv*3.+q*2.5+vec2(1.7,9.2)+t*1.3), fbm(auv*3.+q*2.5+vec2(8.3,2.8)-t));
  float f=fbm(auv*3.+r*2.5);
  vec3 hcol=mix(vec3(0.5,0.0,0.6), vec3(0.0,0.9,0.7), f);
  hcol=mix(hcol, vec3(0.9,0.1,0.5), clamp(length(r)-0.4,0.,1.));
  float ha=u_hop*smoothstep(0.15,0.85,f);
  // deck — signal corruption (digital tear/static/blocks)
  float row=floor(uv.y*70.);
  float tear=(hash(vec2(row,floor(u_t*6.)))-0.5)*u_tear;
  float blk=step(0.985,hash(vec2(floor(uv.x*9.),floor(u_t*5.))))*u_block;
  vec3 dcol=vec3(0.9,0.3,1.0)*abs(tear)*4.0 + vec3(0.2,1.0,1.0)*blk;
  dcol+=(hash(uv*vec2(800.,400.)+u_t)-0.5)*vec3(1.0,0.4,1.0);
  float da=u_dop*clamp(abs(tear)*6.0+blk+0.12,0.0,1.0);
  vec3 col=hcol*ha+dcol*da;
  float a=clamp(ha+da,0.0,0.95);
  gl_FragColor=vec4(col,a);
}`;

function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.warn("graph-degradation shader:", gl.getShaderInfoLog(s));
  }
  return s;
}

function resize() {
  if (!canvas || !gl) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth * dpr, h = canvas.clientHeight * dpr;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w; canvas.height = h;
    gl.viewport(0, 0, w, h);
  }
}

function loop(now) {
  if (!gl) return;
  resize();
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  // Skip drawing entirely when fully healthy — keeps the canvas a true no-op.
  if (cur.health.overlayOpacity > 0 || cur.deck.overlayOpacity > 0) {
    gl.useProgram(program);
    gl.uniform2f(uniforms.res, canvas.width, canvas.height);
    gl.uniform1f(uniforms.t, now / 1000);
    gl.uniform1f(uniforms.hop, cur.health.overlayOpacity);
    gl.uniform1f(uniforms.dop, cur.deck.overlayOpacity);
    gl.uniform1f(uniforms.tear, cur.deck.tearRate);
    gl.uniform1f(uniforms.block, cur.deck.blockRate);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  raf = requestAnimationFrame(loop);
}

/** Inject the canvas + compile the program. Idempotent; safe no-op without DOM/WebGL. */
export function initGraphDegradation() {
  if (canvas) return; // already initialized
  const container = document.getElementById("graph-container");
  if (!container) return;
  canvas = document.createElement("canvas");
  canvas.id = "graph-degradation-layer";
  Object.assign(canvas.style, {
    position: "absolute", inset: "0", width: "100%", height: "100%",
    pointerEvents: "none", zIndex: "5",
  });
  container.appendChild(canvas);
  gl = canvas.getContext("webgl", { premultipliedAlpha: false, alpha: true });
  if (!gl) { console.warn("graph-degradation: WebGL unavailable; overlay disabled"); return; }
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program); gl.useProgram(program);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  uniforms = {
    res: gl.getUniformLocation(program, "u_res"),
    t: gl.getUniformLocation(program, "u_t"),
    hop: gl.getUniformLocation(program, "u_hop"),
    dop: gl.getUniformLocation(program, "u_dop"),
    tear: gl.getUniformLocation(program, "u_tear"),
    block: gl.getUniformLocation(program, "u_block"),
  };
  raf = requestAnimationFrame(loop);
}

/** Pull the live pools from game state and apply params (uniforms + #cy filter). */
export function updateFromState(state) {
  const p = degradationParams(state);
  cur = p;
  const filter = buildGraphFilterString(p.health);
  if (filter !== curFilter) {
    curFilter = filter;
    const cy = document.getElementById("cy");
    if (cy) cy.style.filter = filter;
  }
}

/** Stop the rAF loop (e.g. teardown). */
export function stopGraphDegradation() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}
```

- [ ] **Step 2: Lint + regression check**

Run: `make lint` (expect exit 0) and `make test 2>&1 | tail -5` (all pass — the params
test from Task 1 included; no other suite touched).

- [ ] **Step 3: Commit**

```bash
git add js/ui/graph-degradation.js
git commit -m 'feat(ui): WebGL graph-degradation overlay (turbulence + corruption)'
```

---

## Task 3: Wire into visual-renderer

**Files:**
- Modify: `js/ui/visual-renderer.js`

- [ ] **Step 1: Import + init + drive**

At the top of `js/ui/visual-renderer.js`, add to the imports:

```js
import { initGraphDegradation, updateFromState as updateGraphDegradation } from "./graph-degradation.js";
```

In `initVisualRenderer` (the exported init function — find it; it registers the event
handlers), add a call so the overlay canvas is injected once at startup. Place it after the
handlers are registered:

```js
  initGraphDegradation();
```

In the `on(E.STATE_CHANGED, (state) => { ... })` handler, alongside the existing
`syncHud(state);` call, add:

```js
    updateGraphDegradation(state);
```

- [ ] **Step 2: Lint + regression check**

Run: `make check 2>&1 | tail -5`
Expected: lint clean, all tests pass (no behavior change to the pure-JS suite).

- [ ] **Step 3: Commit**

```bash
git add js/ui/visual-renderer.js
git commit -m 'feat(ui): drive graph degradation from STATE_CHANGED'
```

---

## Task 4: Preview-harness sliders

**Files:**
- Modify: `preview.html`
- Modify: `js/ui/preview.js`

- [ ] **Step 1: Add slider markup to `preview.html`**

The harness uses `<div class="section"><h2>…</h2>…<div class="btn-row">…</div></div>`
blocks. Add a new section immediately after the "Overlay Effects" `</div>` section
(the one containing `id="overlay-controls"`), before the "Node Flash" section:

```html
      <!-- Graph degradation overlay — health/deck sliders (js/ui/preview.js). -->
      <div class="section">
        <h2>Graph Degradation</h2>
        <div class="btn-row">
          <label>HEALTH</label>
          <input type="range" id="degrade-health" min="0" max="100" step="1" value="100">
          <span id="degrade-health-val">100</span>
        </div>
        <div class="btn-row">
          <label>DECK</label>
          <input type="range" id="degrade-deck" min="0" max="100" step="1" value="100">
          <span id="degrade-deck-val">100</span>
        </div>
      </div>
```

- [ ] **Step 2: Wire the sliders in `js/ui/preview.js`**

Add near the top imports:

```js
import { initGraphDegradation, updateFromState as updateGraphDegradation } from "./graph-degradation.js";
```

At the end of the file's setup (after the existing control wiring), add:

```js
// Graph degradation overlay — driven by dummy health/deck sliders.
initGraphDegradation();
const degH = document.getElementById("degrade-health");
const degD = document.getElementById("degrade-deck");
const degHVal = document.getElementById("degrade-health-val");
const degDVal = document.getElementById("degrade-deck-val");
function syncDegrade() {
  const h = +degH.value, d = +degD.value;
  degHVal.textContent = String(h);
  degDVal.textContent = String(d);
  updateGraphDegradation({ player: {
    health: { current: h, max: 100 },
    deckIntegrity: { current: d, max: 100 },
  }});
}
if (degH && degD) {
  degH.addEventListener("input", syncDegrade);
  degD.addEventListener("input", syncDegrade);
  syncDegrade();
}
```

- [ ] **Step 3: Verify the harness loads**

Run: `make lint` (expect exit 0). (Visual check happens in Task 6.)

- [ ] **Step 4: Commit**

```bash
git add preview.html js/ui/preview.js
git commit -m 'feat(preview): health/deck sliders for graph degradation overlay'
```

---

## Task 5: MANUAL.md note

**Files:**
- Modify: `MANUAL.md`

- [ ] **Step 1: Document the effect**

In the section describing HEALTH / DECK INTEGRITY (added in #133, under "THE ALERT
SYSTEM"), append a short paragraph:

```markdown
As either pool falls past about two-thirds, the **network graph itself begins to
degrade** — low HEALTH bleeds an organic, hallucinatory turbulence across the graph and
hazes it; low DECK INTEGRITY corrupts it with digital tearing and chromatic glitch. The
effect is confined to the graph — your log and console stay perfectly legible, so when
your eyes can't be trusted, read the raw stream.
```

- [ ] **Step 2: Commit**

```bash
git add MANUAL.md
git commit -m 'docs(manual): graph degradation under low health/deck'
```

---

## Task 6: Browser verification + notes (controller)

This task is done by the controller (browser + judgment), not a subagent.

- [ ] **Step 1: `make check`** — lint clean, all tests pass (params suite included).

- [ ] **Step 2: Preview-harness visual check** — `make bundle-vendor` if stale, `make serve`
  (use a free port if 3000 is taken), open `preview.html`. Drag the HEALTH slider down:
  confirm organic turbulence bleeds in + the graph hazes (CSS blur/hue on `#cy`), arriving
  only below ~70 and escalating to near-flatline. Drag DECK down: confirm digital
  tear/chromatic-static/glitch. Both down: both stack. At 100/100: canvas is a clean no-op
  (no overlay, `#cy` filter is just bloom). Screenshot full / mid / both-low.

- [ ] **Step 3: In-game check** — open `index.html`, start a B+ run, drive health/deck down
  (via the console/cheats or by getting hit), confirm the graph degrades in real play and
  HUD/log/console text stays crisp. Confirm no console/shader errors.

- [ ] **Step 4: Perf / leak** — confirm smooth animation; reload / start a new run and
  confirm only one `#graph-degradation-layer` canvas exists (init is idempotent), no WebGL
  context warnings.

- [ ] **Step 5: Write `notes.md`** in the session dir — what shipped, tuning values as
  shipped, the decoupled-v1 caveat + option-2 follow-up, screenshots, and the #141 tie-in
  (these curves are the tuning knobs).

- [ ] **Step 6: Commit notes**

```bash
git add docs/dev-sessions/2026-06-10-1829-graph-degradation-overlays/notes.md
git commit -m 'docs: session notes — graph degradation overlays'
```

---

## Self-Review

**Spec coverage:**
- Two layers (health turbulence / deck corruption) → Task 2 shader ✓
- Graph-panel confined, text clean → injected canvas inside `#graph-container`, `#cy`-only filter (Tasks 2-3) ✓
- Decoupled v1 (no Cytoscape pixels, no animated SVG) → Task 2 (overlay + CSS filter) ✓
- Intensity mapping, 70% threshold, pure testable → Task 1 ✓
- visual-renderer drive on STATE_CHANGED → Task 3 ✓
- Preview-harness sliders → Task 4 ✓
- No new game state / save-load safe → reads pools only (Tasks 1-3) ✓
- Graceful no-op without WebGL → Task 2 `initGraphDegradation` guard ✓
- MANUAL update → Task 5 ✓
- Verification (make check, browser, perf) → Task 6 ✓
- Supersedes bloom-for-deck seam → no deck filter added; bloom untouched (note in notes) ✓

**Placeholder scan:** none — full module + shader + test code provided. Tuning constants are
concrete values (flagged as #141 knobs), not placeholders.

**Type/signature consistency:** `degradationParams(state)` and `buildGraphFilterString(health)`
defined in Task 1, imported with those names in Tasks 2/4. `initGraphDegradation()` /
`updateFromState(state)` / `stopGraphDegradation()` defined in Task 2, imported (aliased
`updateGraphDegradation`) in Tasks 3/4. Canvas id `graph-degradation-layer`, filter id
`starnet-bloom` consistent throughout.

**Known soft spots (call out, don't hide):**
- Tasks 2/4 have no automated test (no WebGL/jsdom harness) — browser-verified in Task 6
  with screenshots in notes.
- Verified against the repo: preview.html uses `.section` / `h2` / `btn-row` (Task 4 markup
  matches); `visual-renderer.js` exports `initVisualRenderer()` at line 32 with the
  `STATE_CHANGED` handler calling `syncHud(state)` (Task 3's two call sites). The implementer
  should still read both files to place inserts precisely; the slider ids, the import names,
  and the two added call sites are the contract.
