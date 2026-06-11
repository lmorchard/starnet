# Spec — Graph degradation overlays (health hallucination + deck corruption)

**Issue:** #134 — expanded from "plasma overlay driven by health" to a two-layer
graph-degradation system driven by **both** resource pools.
**Branch:** `worktree-graph-degradation-overlays` (worktree off `main`).
**Depends on:** #133 (the `health` / `deckIntegrity` pools, now merged).

## Concept

As the player's resource pools deplete, the **network-graph panel** visibly degrades —
two distinct, stacking effects, one per pool:

- **HEALTH → neural turbulence** (organic hallucination). Fiction: brain injury — the
  world swims. Domain-warped fractal tendrils in the phosphene palette, plus the graph
  itself hazing/warping.
- **DECK INTEGRITY → signal corruption** (digital glitch). Fiction: the deck's render
  pipeline failing — chromatic aberration, horizontal tearing, block glitch.

The two speak deliberately different visual languages (organic vs digital) so the player
can tell **at a glance which system is failing** — and they stack: low on both means
hallucinating *and* glitching at once.

### Design intent: push toward the console

The effects are **confined to the graph panel**. HUD, sidebar, log, and console text are
never touched. As health/deck fall, the graph (the spatial GUI) becomes harder to trust,
while the cold text feed stays reliable — so the player naturally **falls back to the
console**. This leverages a principle the project already commits to (the console is a
complete, authoritative, LLM-legible interface) and turns it into diegetic fiction:
"your augmented HUD is glitching — read the raw stream." It also gives the health/deck
loss-clocks *visible teeth* (felt immediately) even while the damage numbers stay gentle
(see #141), and it sidesteps the "console must stay legible" rule by construction.

## Scope

### 1. Two visual layers (decoupled v1)

A single WebGL `<canvas>` layered inside `#graph-container` (above `#cy` /
`#overlay-layer`, `pointer-events: none`) runs one fragment shader compositing both
**colored** layers:

- **Neural turbulence (health):** additive domain-warped fbm tendrils, magenta/teal
  phosphene palette, intensifying opacity + writhe speed as health drops.
- **Signal corruption (deck):** chromatic RGB static, horizontal tear bands, occasional
  block-glitch, intensifying as deck integrity drops.

The **real graph's degradation** (health only) comes from a JS-composed **CSS filter
chain on `#cy`**, composed with the existing bloom reference:

- health → `url(#starnet-bloom) blur(…) hue-rotate(…) contrast(…)` — graph hazes/swims as
  health drops; reverts to plain `url(#starnet-bloom)` at full health.
- deck → **no filter on the graph in v1.** The deck-corruption look (chromatic fringing,
  horizontal tear bands, block glitch) is drawn by the WebGL overlay *over* the graph,
  occluding/corrupting its appearance without touching Cytoscape's pixels.

**Decoupled** = the overlay never reads Cytoscape's pixels, and no animated SVG filter is
used (CSS `blur`/`hue-rotate` are cheap and jank-free; animated `feDisplacementMap` is
not). Caveat: C's exact "graph split into clean RGB ghosts" from the mockup is *suggested*
by the overlay's chromatic tear bands rather than a true pixel-level split. Accepted for
v1; the true split is part of the deferred option-2 below.

### 2. Intensity mapping (pure, unit-testable core)

`js/ui/graph-degradation-params.js` — a pure module:

```
degradationParams({ health, healthMax, deck, deckMax }) → {
  health: { severity, overlayOpacity, blurPx, hueJitter, speed },
  deck:   { severity, overlayOpacity, chromaticPx, tearRate, blockRate },
}
```

- **Per-pool severity:** `severity = clamp((THRESHOLD - pool/max) / THRESHOLD, 0, 1)`
  with `THRESHOLD = 0.7` — i.e. **zero above 70% of a pool**, ramping to 1 at empty. Early
  damage is clean; the effect *arrives* as you get hurt and screams near flatline.
- Each effect param is `severity` scaled to a tuned max (e.g. opacity 0→0.7, blur 0→2.5px,
  chromatic 0→6px). These maxes + the threshold are module constants — the knobs **#141**
  will tune by hand in the preview harness.
- Pure and synchronous: no DOM, no WebGL, no state imports. Fully unit-tested.

### 3. Rendering module

`js/ui/graph-degradation.js`:

- Creates/owns the overlay `<canvas>` in `#graph-container` and the WebGL program (one
  full-screen quad, one fragment shader with `u_health`, `u_deck`, `u_time`, `u_res`).
- Injects/owns the SVG degradation filter defs (mirrors `ensureBloomFilter`).
- `updateFromState(state)` — pulls `player.health` / `player.deckIntegrity`, runs
  `degradationParams`, sets shader uniforms + filter params + the graph-layer CSS filter.
- Owns its own `requestAnimationFrame` loop for `u_time` (continuous animation); reads the
  latest params set by `updateFromState`.
- `start()` / `stop()` lifecycle; no-op safely if WebGL is unavailable (graceful
  degradation — the game stays fully playable without the effect).

### 4. Integration

- **`visual-renderer.js`** calls `graphDegradation.updateFromState(state)` from its
  `STATE_CHANGED` handler (same pattern as the HUD sync). No new game state — reads the
  existing pools — so save/load is unaffected.
- **Three HTML entrypoints** (`index.html`, `preview.html`, `playground.html`) get the
  overlay canvas in `#graph-container` and load the module (the known three-entrypoint
  gotcha — all must be updated together).
- **Preview harness** (`preview.html` / `js/ui/preview.js`): dummy **health** and **deck**
  sliders driving the overlay, so the look is tunable without a playthrough (per the
  "new visual effects must be demoable in the preview harness" design rule).

## Supersedes / relates to

- **Supersedes** the `setBloomIntensity` "crank bloom on deck injury" seam — chromatic
  corruption is better fiction than blur. Bloom stays purely for the base CRT look.
- **Atmospheric MVP precursors:** this whole-panel, single-integer-pool effect is the
  atmospheric precursor to the *textured* enrichments — #102 (per-subsystem deck glitches)
  and #103 (per-wound health debuffs) — exactly as the MVP pools preceded those.

## Non-goals (deferred)

- **Post-process fidelity (option 2):** capturing Cytoscape's canvas into a GL texture to
  warp / RGB-split the *actual* graph pixels (pixel-exact mock fidelity), and/or true
  per-channel displacement of the graph for deck corruption. Noted as a future iteration if
  the decoupled approximation disappoints. Out of v1.
- Per-subsystem deck glitches (#102) and per-wound health debuffs (#103).
- Any effect over text surfaces (HUD/log/console/sidebar) — explicitly excluded.
- Audio.

## Testing / verification

- **`degradation-params` pure module** → `node:test`: zero at full health/deck; monotonic
  increase as a pool drops; clamped to [0,1] and to the param maxes; the 70% threshold
  respected; both pools independent.
- **WebGL rendering** → browser-verified (no WebGL/Lit unit harness): preview-harness
  sliders + Playwright screenshots at representative levels (full, mid, near-flatline, both
  low). Assert: no shader/console errors; text surfaces unaffected; graph clean at full
  health; effect present and escalating as pools drop; graceful no-op if WebGL missing.
- **Perf** → single quad + cheap filters; confirm smooth animation, no WebGL context leak
  across re-inits (e.g. new run / preview reloads).
- **`make check`** green throughout (pure-JS test suite unaffected; baseline at branch
  point passes).

## Note on process

Spec → plan → implementation are being run autonomously at Les's request (he's away). The
usual "user reviews spec before planning" gate is waived by that go-ahead; Les will review
the resulting PR.
