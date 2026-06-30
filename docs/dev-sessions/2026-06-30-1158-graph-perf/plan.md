# Graph Render Performance — Implementation Plan

**Goal:** Stop alerted nodes from forcing a continuous full-canvas Cytoscape redraw (the
confirmed ~48%-CPU cause). Replace the perpetual alert-pulse `node.animate` loop with a static
alert border. Fancier (overlay/CSS) alert representation is deferred per Les.

**Root cause (confirmed):** `redPulse`/`yellowPulse` (`graph.js:110-128`) recurse `node.animate`
forever while a node stays yellow/red. Cytoscape's animation system redraws the whole canvas
every frame while any element animates; alerts don't clear below trace, so it never idles.
`_cy.elements().stop()` restored 110fps in-browser — confirmed.

## Phase 1: Static alert border (drop the perpetual pulse)

**Files:**
- Modify: `js/ui/graph.js`

**Key changes:**
- Remove `redPulse` / `yellowPulse` (the two `createPulseAnimator` instances, ~`110-128`) and
  their membership sets `pulsingNodes` / `yellowPulsingNodes` (`70-71`). Keep `createPulseAnimator`
  and `rebootPulse` (reboot is transient — out of scope, revisit later).
- In `updateNodeStyle` (`~688-701`): keep the class management
  (`removeClass("alert-yellow alert-red")` + conditional `addClass`), and **delete** the
  `redPulse.start/stop` / `yellowPulse.start/stop` block. Alert state now reads purely from the
  static class.
- Bump the static selectors so alerts still read strongly without the strobe peak:
  - `node.accessible.alert-yellow` (`~533`): `border-color "#ffcc00"`, `border-width 2`.
  - `node.accessible.alert-red` (`~541`): `border-color "#ff3030"`, `border-width 2`.
  - Update the "strobe-blinked by JS animation" comments to "static" (no longer animated).

**Verification — automated:**
- [x] `make check` passes (1465 tests, 0 fail).
- [x] `grep -n "pulsingNodes\|yellowPulsingNodes\|redPulse\|yellowPulse" js/ui/graph.js` → no hits.

**Verification — manual (with Les, in-browser):** ✅ confirmed — alert fix landed, fps holds.
- [x] Trigger an alert (fail an exploit, or `cheat alert`) so a node goes yellow/red.
- [x] The node shows a clear solid colored border (amber/red) glowing under the bloom — no strobe.
- [x] fps **holds** with the alert active — the drop is gone.
- [x] `_cy.animated()` is `false` while sitting with an alert up (no perpetual animation).

> TDD opt-out: this is a rendering change in a `@ts-nocheck`, DOM/Cytoscape-coupled module with no
> pure-logic seam; verified by `make check` (no breakage) + the in-browser perf/visual checks above.

## Phase 2: cheaper overlay glow (fix the xploit/action-animation dip)

Action overlays (esp. exploit-brackets) animate every frame under the heavy `#starnet-bloom`
(2-radius, 3-pass merge), which re-rasterizes per frame because the bracket geometry changes
(rotate + converge). Transient dip during the animation; recovers after. Same family as the alert
bug — an animation re-rasterizing a costly filter every frame.

**Files:** `js/ui/graph.js` (filter def + ), `css/style.css` (overlay filter), `js/ui/overlays/exploit-brackets.js`.

**Key changes:**
- Add a lighter, color-preserving `#overlay-bloom` filter in `ensureBloomFilter` (single
  `feGaussianBlur` merged under the source — one blur pass vs three).
- Point `#overlay-layer > * { filter: ... }` at `#overlay-bloom` (keep `#cy` on the heavy
  `#starnet-bloom` — it's mostly static now that alerts don't redraw it).
- exploit-brackets: drop the redundant per-zap `filter="url(#zap-bloom)"` + its `<defs>` (the
  overlay glow now covers the zaps), and remove the `getBoundingClientRect()` forced reflow in
  `_fireZap` (a per-zap synchronous layout, ~33×/sec).

**Verification — automated:**
- [ ] `make check` passes.

**Verification — manual (with Les):** ✅ confirmed — no dramatic xploit dip now.
- [x] xploit a node: fps **holds** through the bracket animation (no dip), recovers as before.
- [x] The brackets/zaps still read as glowing magenta vector effects (lighter halo is acceptable).
- [x] Other overlays (probe sweep, reticle, ICE) still look right with the lighter glow.

## Phase 3: glow consolidation (light) — guardrail + dedupe

A game-wide glow audit found **no remaining double-blooms** (Phase 2 removed the last). Remaining
work is anti-recurrence + dedupe (the three glow mechanisms can't be unified — different
pipelines; a full rewrite isn't worth it).

**Files:** `js/ui/indicator-glyphs.js`, `CLAUDE.md`.

**Key changes:**
- `indicator-glyphs.js`: extract one `glowDefs(color)` + `GLOW_BLUR` token; route `svgWrap` and
  the two hand-inlined filter `<defs>` (tick meter, access glyph) through it. Unifies the blur
  (was 1.6/1.6/1.4 → 1.6; access glyph gains a hair of glow, imperceptible). Drops the unused
  `blur` param on `svgWrap`.
- `CLAUDE.md`: add a "Glow / bloom — one owner per layer, never stacked" rule documenting the
  ownership map (`#starnet-bloom`=canvas, `#overlay-bloom`=overlays, `--glow-*`=DOM, `glowDefs`=
  glyphs, canvas shadow=vitals) and the guardrails (no per-frame animation/heavy-filter on
  animating elements; no element-filter stacked under a layer-filter).

**Verification — automated:**
- [x] `make check` passes (1465, 0 fail); no tests assert the old per-glyph blur.
- [x] `grep "filter id=" js/ui/indicator-glyphs.js` → only the single `glowDefs` definition.

**Verification — manual (with Les):**
- [ ] HUD indicator glyphs (alert lamp, conn status, tick meter, access glyph) still glow
      correctly (the access glyph's glow is marginally stronger: blur 1.4→1.6).

## What we're NOT doing

- Not touching the reboot pulse (transient; same pattern but bounded — note for the later revisit).
- Not building the overlay/CSS pulsing glow yet (deferred design choice).
- Not changing alert *semantics* — only how an alerted node is drawn.

## Follow-ons (later session)

- Re-represent alert glow as a node-anchored CSS/overlay throb (smooth + cheap), and apply the
  same treatment to reboot.
- Re-represent **deck damage** off the cy model (it jitters node positions → same redraw cost).
