# Vector Indicator Sweep — Implementation Plan

**Goal:** Replace filled-circle lamps and `█`/`░` block meters with stroke-only vector
glyphs from a shared module, across HUD / node panel / cards / mission pane.

**Approach:** New pure `js/ui/indicator-glyphs.js` (mirrors `vuln-glyphs.js`) returns
stroke-only SVG (glow baked in) + `…DataUri()` helpers. Each site swaps its bitmap chrome
for an `<img>` of the glyph. Exact geometry is taken from the locked lab
`tmp/indicator-lab.html` (functions `lampHex`/`lampTri`/`lampTriDown`/`meterTicks`).

**Tech stack:** Vanilla ES modules, `@ts-check` JSDoc lint, node:test. Glyphs are SVG
strings → data URIs (no Lit directive needed). The lab is gitignored — read it for coords,
don't import it.

---

## Phase 1: Shared `indicator-glyphs.js` module + tests (TDD)

**Files:**
- Create: `js/ui/indicator-glyphs.js`
- Test: `js/ui/indicator-glyphs.test.js`

**Key exports** (all stroke-only, `fill="none"`, with a baked SVG glow filter; mirror the
shape coords in `tmp/indicator-lab.html`):
- `alertLampSvg(level)` / `alertLampDataUri(level)` — `level ∈ {"green","yellow","red"}` →
  hexagon / point-up triangle / inverted triangle, stroked in the level color
  (green `#39ff7a`, amber `#c9d11e`, red `#ff5a4d`).
- `connStatusSvg(status)` / `connStatusDataUri(status)` — small stroked hexagon colored by
  status: `passive`→dim, `active`→cyan, `detecting`→red.
- `tickMeterSvg(frac, opts?)` / `tickMeterDataUri(frac, opts?)` — N=5 (default) vertical
  ticks; `round(frac·N)` lit (full height, tier color: `>0.6` green / `>0.3` amber / else
  red), rest dim stubs. `frac` clamped to [0,1].
- `missionMarkSvg(state)` / `missionMarkDataUri(state)` — `"complete"`→stroked check
  polyline, `"failed"`→stroked ✕. Straight segments only.

```js
// stroke-only + baked glow so the data URI is self-contained and correctly colored
function svgWrap(vb, body, color, blur = 1.6) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">`
    + `<defs><filter id="g"><feDropShadow dx="0" dy="0" stdDeviation="${blur}" flood-color="${color}"/></filter></defs>`
    + `<g filter="url(#g)">${body}</g></svg>`;
}
// hexagon / triUp / triDown / tick bodies: copy coords from tmp/indicator-lab.html
// dataUri = "data:image/svg+xml," + encodeURIComponent(svg)  (matches vuln-glyphs.js)
```

**Verification — automated:**
- [ ] `make lint` passes (JSDoc on exports)
- [ ] `make test` passes
- [ ] `node --test js/ui/indicator-glyphs.test.js` — asserts: every glyph SVG contains
  `fill="none"` and NO `fill="#..."` on shapes (stroke-only); `alertLampSvg("green")` emits
  a 6-point polygon, `"yellow"` vs `"red"` are triangles with **opposite vertical
  orientation** (apex y differs); `tickMeterSvg(1)` lights all N, `(0)` none, `(0.5)`
  `round(N/2)`; tier color matches frac band; output deterministic; `…DataUri` starts with
  `data:image/svg+xml,`.

**Verification — manual:** (none — pure module; visual covered in Phase 5 preview)

---

## Phase 2: HUD lamps (alert + connection)

**Files:**
- Modify: `js/ui/components/starnet-hud.js` — replace the `.alert-dot` `<div>` with
  `<img class="hud-lamp" src=${alertLampDataUri(this.alert)}>`; replace the `.hud-conn-dot`
  `<span>` with `<img class="hud-lamp" src=${connStatusDataUri(this.connectionStatus)}>`.
  Import from `../indicator-glyphs.js`.
- Modify: `css/style.css` — remove the `.alert-dot` (`:263`) and `.hud-conn-dot` (`:299`)
  `border-radius:50%` rules; add `.hud-lamp { width:12px; height:12px; vertical-align:middle; }`.
  Keep the red-alert urgency: if the SVG glow alone reads flat, re-add a CSS pulse
  `animation` on the img for the red state.

**Verification — automated:**
- [ ] `make lint` / `make test` pass
- [ ] grep: no `border-radius: 50%` for `.alert-dot` / `.hud-conn-dot`

**Verification — manual:**
- [ ] `/` HUD shows hexagon (green) alert lamp; raising alert → ▲ then ▽; connection glyph
  color tracks passive/active/detecting.

---

## Phase 3: Node-panel alert + mission status

**Files:**
- Modify: `js/ui/components/starnet-node-panel.js:77` — replace `● ${alertState}` with
  `<img class="nd-lamp" src=${alertLampDataUri(<mapped level>)}> ${alertState.toUpperCase()}`
  (map node alert state → green/yellow/red).
- Modify: `js/ui/components/starnet-mission-pane.js:25,28` — replace `██ COMPLETE` /
  `░░ FAILED` with `<img src=${missionMarkDataUri('complete'|'failed')}>` markers.
- Modify: `css/style.css` — small sizing rules for `.nd-lamp` / mission marker img.

**Verification — automated:**
- [ ] `make lint` / `make test` pass
- [ ] grep: no `●` / `██` / `░░` left in these components

**Verification — manual:**
- [ ] node-panel alert row shows the lamp glyph; mission complete/failed shows stroked
  check / ✕.

---

## Phase 4: Meters — health/deck waveform + card quality

**Files:**
- Modify: `js/ui/components/starnet-waveform.js` — in `_meterHeader`, replace the `█/░`
  pip span with `<img class="vital-meter" src=${tickMeterDataUri(frac)}>`.
- Modify: `js/ui/components/exploit-card-view.js:22,40` — replace the `█/░` quality pips
  with `<img class="ec-meter" src=${tickMeterDataUri(card.quality/5)}>`.
- Modify: `css/style.css` — `.vital-meter` / `.ec-meter` sizing; remove the now-unused
  `.ec-pips.qN` color rules (`:817-821`) only after grep confirms no other consumer.

**Verification — automated:**
- [ ] `make lint` / `make test` pass (update any test asserting pip strings, e.g. card view tests)
- [ ] grep: no `█`/`░` left in `starnet-waveform.js` / `exploit-card-view.js`

**Verification — manual:**
- [ ] sidebar vital meters show tick ladders that deplete + ramp color with damage; card
  quality shows a tick ladder matching its quality.

---

## Phase 5: Preview swatch, dead-CSS sweep, docs, verify

**Files:**
- Modify: `preview.html` / `js/ui/preview.js` — add an "Indicators" swatch panel: alert lamp
  at each state, connection states, tick meter at 100/60/30/0, mission marks (per the
  "new visual effects → preview harness" design principle).
- Modify: `css/style.css` — final grep sweep for orphaned `.alert-dot`/`.hud-conn-dot`/
  `.ec-pips` rules; remove.
- Modify: `MANUAL.md` — if it described the alert dot / pips, update to the glyph language.

**Verification — automated:**
- [ ] `make check` passes (lint + full suite)
- [ ] `make bundle-vendor` (browser check has current vendor)
- [ ] repo-wide grep: no `border-radius: 50%` lamps and no `█`/`░` indicators remain
  (`.ec-cancel-x` button intentionally excluded per spec)

**Verification — manual:**
- [ ] `/preview.html` indicator swatch renders all glyphs; `/` and a live run confirm every
  swapped indicator reads correctly with no console errors.
