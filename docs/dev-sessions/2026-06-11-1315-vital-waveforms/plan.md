# Vital-Sign Waveforms Implementation Plan

**Goal:** Replace the HUD's HEALTH/DECK bar meters with animated Zoids-style vital-sign
waveforms — green ECG for health, violet square pulse for deck integrity — that degrade
in shape as each value falls.

**Approach:** A pure, testable geometry module (`waveform.js`) produces vertex lists from
`(frac, phase)`; a thin `<starnet-waveform>` Lit component renders them as a single SVG
`<path>` and self-animates the scroll `phase` via `requestAnimationFrame`. All testable
logic lives in the geometry module; the component, preview demo, and HUD wiring are
presentation glue verified manually in the preview harness and browser.

**Tech stack:** Vanilla ES modules, Lit (light-DOM `StarnetElement`), SVG polylines, esbuild
(vendor only — game code unbundled). `make lint` = tsc over JSDoc; `make test` = node:test.

---

## Phase 1: Pure waveform geometry module (TDD)

Deliver `js/ui/waveform.js` — pure functions mapping `(frac, phase, width, height)` to
vertex lists for the two waveforms, plus a path-string serializer. Mirrors the
`vuln-glyphs.js` pure-module + test convention.

**Files:**
- Create: `js/ui/waveform.js`
- Test: `js/ui/waveform.test.js`

**Key changes:**
- `ecgPoints({ frac, phase, width, height }): Array<{x:number,y:number}>` — health waveform.
  Baseline at `height/2`. Beat count across `width` scales up as `frac` falls
  (`beats = round(lerp(MIN_BEATS, MAX_BEATS, 1 - frac))`); each beat is a sharp QRS spike
  (baseline → tall peak → short undershoot → baseline) built from straight segments. `phase`
  scrolls beat positions leftward (`(i * spacing - phase * width) mod width`). As `frac`
  falls, beat spacing and spike height are perturbed by `hash01()` so the trace turns erratic.
  `frac <= 0` returns a flat two-point baseline `[{x:0,y:mid},{x:width,y:mid}]`.
- `pulsePoints({ frac, phase, width, height }): Array<{x:number,y:number}>` — deck waveform.
  A square wave between baseline (`height/2 + amp/2`) and top (`height/2 - amp/2`), where
  `amp = fullAmp * frac`. `phase` scrolls the wave leftward. As `frac` falls, an increasing
  fraction of cells "drop out" (held flat at baseline) chosen by `hash01()` — the glitch gaps.
  `frac <= 0` returns a flat two-point baseline.
- `pointsToPath(points): string` — joins to an SVG path `d` (`M x y L x y …`), rounded to
  2 decimals. Straight segments only.
- `hash01(n): number` — deterministic `[0,1)` mixer (integer bit-mix or `fract(sin)`), used
  for all "erratic"/"dropout" variation so output is a stable function of inputs (no `Math.random`).

```js
// shape of the ECG vertex builder (sketch)
const mid = height / 2;
if (frac <= 0) return [{ x: 0, y: mid }, { x: width, y: mid }];
const beats = Math.round(lerp(MIN_BEATS, MAX_BEATS, 1 - frac)); // fewer when healthy
const pts = [{ x: 0, y: mid }];
for (let i = 0; i < beats; i++) {
  const jitter = (1 - frac) * hash01(i * 7 + 1);           // erratic spacing when hurt
  const cx = mod((i + jitter) * (width / beats) - phase * width, width);
  const peak = mid - (PEAK * (0.6 + 0.4 * frac)) * (1 + (1 - frac) * (hash01(i) - 0.5));
  pts.push({ x: cx - 4, y: mid }, { x: cx, y: peak }, { x: cx + 3, y: mid + UNDERSHOOT }, { x: cx + 6, y: mid });
}
pts.push({ x: width, y: mid });
return pts.sort((a, b) => a.x - b.x);
```

**Verification — automated:**
- [x] `make lint` passes (JSDoc types on all exports)
- [x] `make test` passes
- [x] `node --test js/ui/waveform.test.js` — new suite covers:
  - `frac = 0` → both functions return a 2-point flat baseline (all `y === height/2`)
  - `frac = 1` ECG → vertex count > 2 and max `|y - mid|` > 0 (visible spikes)
  - `frac = 1` pulse → max `|y - mid|` equals full amplitude; lower `frac` → strictly smaller amplitude
  - lower `frac` ECG → more beats than higher `frac` (count distinct peaks)
  - determinism: identical args → identical output (deep-equal across two calls)
  - all points within `[0,width] × [0,height]` bounds

**Verification — manual:** (none — pure module)

---

## Phase 2: `<starnet-waveform>` component (TDD opt-out: DOM/rAF glue)

Deliver a reusable Lit component that renders one waveform and self-animates. No pure logic
of its own (all geometry is Phase 1, tested there), so this phase is verified visually in
Phase 3's preview rather than unit-tested — consistent with the other DOM-only components
(`starnet-hud.js` etc. have no unit tests).

**Files:**
- Create: `js/ui/components/starnet-waveform.js`
- Modify: `index.html` — add `<script type="module" src="js/ui/components/starnet-waveform.js">` beside the other component tags (after `starnet-hud.js`, line ~67)

**Key changes:**
- `class StarnetWaveform extends StarnetElement` (light DOM base), `customElements.define("starnet-waveform", …)`.
- `static properties = { kind: {type:String}, frac: {type:Number}, color: {type:String}, w: {type:Number}, h: {type:Number}, label: {type:String} }`.
  Defaults: `kind="ecg"`, `frac=1`, `color="var(--green)"`, `w=120`, `h=28`.
- Internal `_phase` (plain field, NOT a reactive prop and NOT game state — ephemeral scroll cursor).
- `connectedCallback()` starts a `requestAnimationFrame` loop that advances `_phase`
  (steady scroll rate; beat *rate* comes from geometry, scroll is constant)
  and calls `this.requestUpdate()`. `disconnectedCallback()` cancels it (`cancelAnimationFrame`).
- `render()` picks `ecgPoints`/`pulsePoints` by `kind`, builds the `d` via `pointsToPath`, returns
  an `<svg viewBox="0 0 w h">` with one `<path stroke=color fill=none>`, wrapped in a span whose
  `title` is `${label}: ${Math.round(frac*100)}%` for hover legibility.

```js
import { html } from "lit";
import { StarnetElement } from "./starnet-element.js";
import { ecgPoints, pulsePoints, pointsToPath } from "../waveform.js";
// render(): const pts = this.kind === "pulse" ? pulsePoints(args) : ecgPoints(args);
// return html`<span class="hud-waveform" title="${this.label}: ${Math.round(this.frac*100)}%">
//   <svg viewBox="0 0 ${this.w} ${this.h}" width="${this.w}" height="${this.h}">
//     <path d="${pointsToPath(pts)}" fill="none" stroke="${this.color}" stroke-width="1.5"/></svg></span>`;
```

**Verification — automated:**
- [x] `make lint` passes
- [x] `make test` passes (no new tests; confirm nothing regressed)

**Verification — manual:**
- [ ] Component verified in Phase 3 preview (deferred to that phase)

---

## Phase 3: Preview harness demo + layout comparison

Deliver a preview panel with health%/deck% sliders driving a live `<starnet-waveform>` pair,
plus a toggle between **inline** and **stacked-strip** arrangements — the tuning and
decision surface. Satisfies the "new visual effects must be added to the preview harness"
design principle.

**Files:**
- Modify: `preview.html` — add a `<div id="waveform-demo">` control group with two range sliders
  (`#wave-health`, `#wave-deck`, 0–100), value labels, and a `#wave-layout-toggle` button;
  add `<script type="module" src="js/ui/components/starnet-waveform.js">`
- Modify: `js/ui/preview.js` — mount two `<starnet-waveform>` els into `#waveform-demo`
  (ecg/green + pulse/violet), wire sliders to set `.frac`, wire the toggle to switch a CSS
  class (`.layout-inline` ↔ `.layout-strip`) on the demo container
- Modify: `css/style.css` — add `:root { --violet: #b06cff; }` (tune by eye), `.hud-waveform`
  sizing, and `#waveform-demo.layout-strip` (full-width stacked rows) vs `.layout-inline`
  (compact side-by-side) styles

**Key changes:**
- `preview.js`: follow the existing `degrade-health`/`degrade-deck` slider wiring (`preview.js:337-345`).
  ```js
  const ecg = document.createElement("starnet-waveform");
  ecg.kind = "ecg"; ecg.color = "var(--green)"; ecg.label = "HEALTH";
  const pulse = document.createElement("starnet-waveform");
  pulse.kind = "pulse"; pulse.color = "var(--violet)"; pulse.label = "DECK";
  // slider input → ecg.frac = v/100 (or pulse.frac); toggle → container.classList.toggle
  ```

**Verification — automated:**
- [x] `make lint` passes
- [x] `make test` passes

**Verification — manual:**
- [ ] `make serve`, open `/preview.html`: both waveforms animate (scroll)
- [ ] Health slider 100→0: ECG goes slow/clean → fast/erratic → flatline at 0
- [ ] Deck slider 100→0: pulse goes crisp → ragged/glitchy/low-amp → flatline at 0
- [ ] Layout toggle switches inline ↔ stacked-strip cleanly; eyeball which we prefer
- [ ] Violet reads as distinct from the surrounding cyan; tune `--violet` if not

---

## Phase 4: Wire into the HUD, ship inline (TDD opt-out: DOM wiring)

Replace the two `_meter(...)` calls in the HUD with `<starnet-waveform>` elements bound to
the existing health/deck Lit properties. State→prop bridge already exists
(`visual-renderer.js:358-361`), so no renderer change is needed.

**Files:**
- Modify: `js/ui/components/starnet-hud.js` — replace `_meter("HEALTH", …)`/`_meter("DECK", …)`
  (lines 91-92) with two `<starnet-waveform>` els; delete the `_meter` helper (52-62) if now
  unused (grep confirms no other caller)
- Modify: `css/style.css` — remove `.hud-meter*` rules only if `_meter` is gone and nothing else
  uses them; otherwise leave untouched

**Key changes:**
- In `render()`:
  ```js
  <span class="hud-label">HEALTH:</span>
  <starnet-waveform kind="ecg" color="var(--green)" label="HEALTH"
    .frac=${this.healthMax > 0 ? this.health / this.healthMax : 0}></starnet-waveform>
  <span class="hud-label">DECK:</span>
  <starnet-waveform kind="pulse" color="var(--violet)" label="DECK"
    .frac=${this.deckIntegrityMax > 0 ? this.deckIntegrity / this.deckIntegrityMax : 0}></starnet-waveform>
  ```

**Verification — automated:**
- [x] `make lint` passes
- [x] `make test` passes
- [x] `make bundle-vendor` (so the browser check below has current vendor bundle)

**Verification — manual:**
- [ ] `make serve`, open `/`: HUD shows the two waveforms in place of the old bars
- [ ] Take damage (cheat or play): waveforms degrade live as HEALTH/DECK fall; flatline at 0
- [ ] Hover a waveform: `title` shows `HEALTH: NN%` / `DECK: NN%`
- [ ] `node scripts/playtest.js reset` then `status` still reports health/deck numerically (unchanged)

---

## Phase 5: Docs — CLAUDE.md scope + MANUAL.md HUD (TDD opt-out: docs)

Bring the docs in line: visual effects are in scope, and the HUD shows waveforms.

**Files:**
- Modify: `CLAUDE.md` — remove "Visual effects (screenshake, bloom, glitches)" from the
  "Out of Scope (Future)" list (graph-degradation already shipped it; this seals it); adjust the
  "Design Aesthetic → Planned (future)" line accordingly
- Modify: `MANUAL.md` — update the HUD description (line 64) and the "HEALTH and DECK INTEGRITY"
  section (lines 496+) to describe the ECG / square-pulse waveforms instead of "color-ramping meters"
- Modify: `docs/dev-sessions/2026-06-11-1315-vital-waveforms/notes.md` — final session summary

**Verification — automated:**
- [x] `make check` passes (lint + test, full suite)

**Verification — manual:**
- [ ] MANUAL.md HUD/HEALTH-DECK sections match what the game now shows
- [ ] CLAUDE.md no longer lists visual effects as out of scope
