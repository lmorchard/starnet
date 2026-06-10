# Spec — Vector CRT Rendering Pass

## Goal

Push the network graph's visual flavor toward a glowing **vector CRT display** —
the look of Atari *Asteroids*, *Tempest*, and *Black Widow*. Bright blooming
strokes on near-black, no solid fills, no raster scanline. State is encoded by
stroke and fence-hatch, the way a real vector system would have had to fake a
"fill."

This is a presentation-layer change only. No gameplay, state, or event logic
changes. The console/log channel and all command behavior stay identical.

## Aesthetic decisions (validated via mockups)

- **No solid fills.** A real vector CRT couldn't draw filled regions.
- **Fence-hatch fills**, dimmed-hue variant: horizontal hatch lines clipped to
  the dodecagon, drawn in a *desaturated/darker* shade of the state color so the
  **border stays the brightest element**.
- **Density encodes access state:** locked = sparse, compromised = medium,
  owned = tight. (Density carries the meaning; color tracks it secondarily.)
- **Bloom on every stroke** — node borders, glyphs, fence lines, edges, and the
  action-animation overlays all glow.
- **Scanline removed.** The raster `repeating-linear-gradient` overlay is deleted.
- **Reference grid: keep.** The faint cyan playfield grid reads as space
  (Tempest-like), not as a raster artifact, and gives a useful stationary
  reference pattern for motion in the graph. It stays — dimmed only if it
  visibly competes with the bloom.

## Bloom mechanism

**Chosen approach: CSS `filter: url(#bloom)` → inline SVG `<filter>`.**

A single inline SVG `<filter>` (`feGaussianBlur` + `feMerge` of the blurred copy
under `SourceGraphic`) applied to the `#cy` canvas layer and the `#overlay-layer`.
The browser flattens Cytoscape's stacked canvases into one image, blurs a copy,
and merges it under the crisp original — colored halo, GPU-composited, zero JS,
trivially reversible.

This is the same filter used in the brainstorming mockups.

**Why not the alternatives (recorded for iteration):**

- `filter: drop-shadow()` — monochrome halo only; loses per-color glow. Rejected.
- **Manual second-canvas copy + additive composite** — `drawImage` Cytoscape's
  stacked canvases into a second canvas (hooked via `cy.on('render')` or rAF),
  blur it, composite *under* the original with `globalCompositeOperation =
  'lighter'` (or `mix-blend-mode: screen`). This is the only path to true
  **additive over-bright blowout** (overlapping glows accumulate past white — the
  signature vector-CRT phosphor flare), which the alpha-merged SVG filter does not
  give for free. `feBlend mode="screen"` in the SVG filter is a lighter-weight
  middle step toward the same effect.

  **Iteration path:** ship the SVG filter first. If the glow reads flat and we
  want accumulating flare, escalate — first try `feBlend mode="screen"` in the
  filter, then the manual additive canvas-copy as a contained follow-up. Do not
  build the heavier machinery up front.

**Perf risk to watch:** a full-canvas SVG blur re-composites on every redraw. At
prototype scale (dozens of nodes) this should be fine; verify no stutter during
animations (probe sweep, pulses, layout). Fallback if it stutters: reduce blur
radius, or drop to `drop-shadow`.

## Scope — three phases

### Phase 1 — Core graph

- Extend `js/ui/node-glyphs.js`: add `nodeFaceDataUri(type, accessLevel)` (or
  equivalent) producing one **stroke-only** SVG data-URI containing the
  **dodecagon-clipped fence hatch** (density by access level, dimmed hue) **+ the
  type glyph**. Keep `node-glyphs.js` pure and unit-testable.
- Wire that into `js/ui/graph.js` where the glyph `background-image` is set
  (currently graph.js:526). The face image now carries fence + glyph.
- Drop the solid `background-color` fills (graph.js:291/319/337/344/385) to
  transparent / none.
- **Keep the native Cytoscape dodecagon border** so the existing alert / ICE /
  reboot border pulses keep working and the border stays the brightest element.
- Add the SVG bloom `<filter>` def to the DOM and apply `filter: url(#bloom)` to
  `#cy` in CSS.
- Delete the scanline overlay (`#graph-container::after`, style.css:136).
- Dim the reference grid (style.css:78–81) if it competes with the bloom.
- **Rework the three fill-flash animations** (reboot pulse / movement ping,
  graph.js:989–1013) that animate `background-color` — flash border or a brief
  glow instead, since fills are now transparent.

### Phase 2 — Action overlays

- Apply `filter: url(#bloom)` to `#overlay-layer`.
- The probe-sweep, exploit-brackets, ICE-detect, and loot-ring overlays
  (`js/ui/overlays/`) are already stroke SVG; confirm they bloom correctly and
  tune stroke widths / colors for consistency with the new node look.

### Phase 3 — Chrome harmonization

- Audit the existing `text-shadow` / `box-shadow` glow on HUD / log / cards
  against the new graph bloom so the whole UI reads as one vector display.
- Consolidate the glow vocabulary into a small set of CSS custom properties
  (e.g. `--glow-sm`, `--glow-lg`) and apply consistently.

## Cross-cutting requirements

- **Three HTML entrypoints** mount `#cy` + `#overlay-layer` and must each get the
  bloom filter def + scanline removal: `index.html`, `preview.html`, and the
  playground entrypoint. (See memory: visual-renderer-three-entrypoints.)
- **Preview harness** (`preview.html` / `js/ui/preview.js` / `preview-cards.js`)
  must show the new node faces (all three access states) and the bloom so we can
  tune fence density / opacity / blur radius without playing through. New visual
  effects must be demoable in the harness (project rule).
- **MANUAL.md**: update any visual descriptions that no longer match.
- **`make check`** (tsc + tests) must pass. `node-glyphs.js` additions get unit
  coverage.
- **Bot / playtest / console parity unaffected** — this is presentation only; the
  log + `status` channel is untouched.

## Out of scope

- Additive / over-bright bloom (documented above as the iteration upgrade).
- Any gameplay, state, event, or balance change.
- Screenshake, glitch, or other new effects beyond the bloom treatment.
- Audio.

## Success criteria

- The graph reads as a glowing vector display: blooming strokes, no solid fills,
  fence-hatch state encoding, no scanline.
- All three access states are legible at a glance (density + border).
- Alert / ICE / reboot states still pulse and read clearly.
- No stutter during animations at prototype graph scale.
- `make check` passes; preview harness shows the new look; manual is current.
- Console/log/command behavior is byte-for-byte unchanged.

## Delivery

All three phases land in a **single PR** off branch `vector-crt-rendering`.
Phases structure the work and commit history, not separate reviews.
