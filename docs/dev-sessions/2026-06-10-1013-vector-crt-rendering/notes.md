# Notes — Vector CRT Rendering Pass

## Summary

Reworked the network-graph presentation into a glowing **vector CRT display**
(Asteroids / Tempest / Black Widow): blooming strokes on near-black, no solid
fills, fence-hatch state encoding, no raster scanline, faceted (12-gon) overlay
effects, straight edges, and a runtime-adjustable bloom.

Done on branch `worktree-vector-crt-display` (an isolated worktree — see
"Branch collision" below). Presentation-only: no gameplay/state/event changes;
console + log channel untouched; `make check` green throughout (700 tests).

## What shipped

**Core graph**
- `node-glyphs.js`: `nodeFaceDataUri(type, accessLevel)` — one stroke-only SVG =
  dodecagon-clipped fence hatch (density encodes access level, dimmed hue) + the
  type glyph. Derived from the existing `CONTAINER_POLYGON_POINTS`.
- `graph.js`: nodes use the face; solid `background-color` fills → transparent;
  native Cytoscape border kept (so alert/ICE/reboot pulses still work and the
  border stays the brightest element).
- Bloom via CSS `filter: url(#starnet-bloom)` on `#cy` + `#overlay-layer`; the
  SVG `<filter>` (feGaussianBlur ×2 + feMerge, wide halo merged twice) is injected
  once by `ensureBloomFilter()` in `initGraph` — covers all three entrypoints.
- Scanline (`#graph-container::after`) removed. Reference grid kept.
- `flashNode` → expanding faceted "ripple" ping in the overlay layer (was a
  border-color flash; before that, a solid-fill flash).

**Dynamic bloom** (added mid-session at Les's request)
- `setBloomIntensity(mult)` / `getBloomIntensity()` rescale the live filter; base
  radii are module constants. Exposed on `window` for experimentation. Seam for a
  future **deck-damage** mechanic (crank bloom toward illegible on injury). The
  multiplier's source of truth should live in game state when that's built.

**Effects coherence pass** (added mid-session — "no curves, no fills")
- New pure helper `js/ui/overlays/facet.js` (`facetVertices`/`ringPoints`/
  `arcPoints`, 12-gon, vertex at 12 o'clock) + tests.
- Edges: `curve-style` bezier → straight.
- `probe-sweep`: filled pie + circle → **chunky LED segments** (12 dodecagon
  edges brighten from dim to lit as the CW sweep front crosses them) + radial hand.
- `read-sectors`: filled pie wedges → the 12 facets light up (stroke-only wedge
  outlines) in random order.
- `ice-detect`: smooth arc → faceted CCW polyline arc.
- `selection-reticle`: `<circle>` → dashed faceted 12-gon (spin/ticks kept).
- `loot-rings`: expanding circles → thin faceted "ripple" rings; spawn cadence
  thins as the node drains (dense when full → sparse). (`exploit-brackets` and
  `mine-scan` were already line-based and left as-is.)

**Chrome**
- `--glow-sm/md/lg` glow scale in `:root`; prominent HUD/log/card glows migrated
  to it. A few off-scale ambient/escalation glows intentionally left.

**Preview harness**: access-state demo nodes (locked/compromised/owned) so the
fence density is tunable without playing through.

**MANUAL.md**: updated the node-state and DUMP descriptions (fill → fence/facets).

## Tuning values (as shipped — all easily adjustable)

- Bloom: `BLOOM_WIDE=5`, `BLOOM_TIGHT=2`, filter region `-80%/260%`, wide halo
  merged twice. `setBloomIntensity(1)` default.
- Fence: `FENCE_OPACITY=0.42`, width `0.8`; gaps locked 11 / compromised 7 /
  owned 4.5; dimmed hues locked `#246060`, compromised `#1c6a85`, owned `#1c8a4a`.
- Loot ripples: stroke `1.5 + rand*0.7` (crisp, not soft), opacity `0.95`,
  `PAD=20` travel, spawn delay `100 + progress*500` ms.
- Flash ripple: 2 staggered rings, `DUR=420ms`, `STAGGER=120ms`, `PAD=18`.

## Decisions

- **No solid fills, no smooth curves.** A real vector CRT can't fill regions or
  hold curves; fence-hatch fakes "fill," and all rings/arcs are faceted 12-gons
  matching the node container.
- **Bloom mechanism**: CSS → inline SVG `<filter>` (true colored halo, ~zero JS).
  Rejected `drop-shadow` (monochrome). **Iteration path for more punch** (not built):
  `feBlend mode="screen"` for additive, then a manual second-canvas copy with
  `globalCompositeOperation='lighter'` for true accumulating phosphor blowout.
- **State pulses** kept on the native Cytoscape border rather than baked into the
  face image, so smooth alert/ICE/reboot animation still works.

## The overlay-anchoring bug (root-caused, fixed)

After adding the bloom filter, all action animations rendered ~one graph-height
**below** their nodes. Root cause: `#overlay-layer` had no `position`, so it was
`static` and sat after the full-height `#cy` in normal flow (origin at the bottom
of the graph). The `filter` made it the **containing block** for its absolutely-
positioned overlay `<svg>`s — at that wrong bottom origin. Verified empirically
(overlay svg center y=965 vs node y=65, off by exactly the 900px graph height).
Fix: `#overlay-layer { position:absolute; inset:0; pointer-events:none }` so the
containing block shares `#cy`'s origin. Re-verified anchoring dx=dy=0 with bloom
on, and node clicks still reach the canvas. The code reviewer had predicted this
exact failure mode for the filter change.

## Verification note

Most logic is covered by `node:test` (facet + node-glyphs geometry). The
CSS-layout/overlay-anchoring bug and the visual look are **browser-verified via
Playwright** (measuring overlay anchoring, LED opacities, bloom filter scaling),
not node-unit-tested — they're layout/visual properties with no logic surface.

## Process

- Brainstormed look via the visual companion (fence-fill, dimmed-hue, density=state).
- Subagent-driven execution: implementer + spec + code-quality review per task;
  visual iteration done inline with Playwright screenshots (subagents can't see).
- **Branch collision**: a second concurrent session was committing an unrelated
  "ICE legibility" feature onto the originally-shared `vector-crt-rendering`
  branch. Moved this work into an isolated worktree (`worktree-vector-crt-display`)
  and cherry-picked the 4 vector-CRT commits onto a clean branch off `main`,
  leaving the other session untouched.

## Scope growth (vs original spec)

Original spec = nodes/bloom/scanline/overlays-tune/chrome. Grew mid-session, all
on the same vector-CRT surface: (1) runtime-adjustable bloom for future deck
damage, (2) full effects-coherence rework (facet helper + 6 effects + straight
edges), (3) iterative effect tuning (loot ripples, probe LEDs, flash ripples).

## Backlog / follow-ups

- Additive over-bright bloom (feBlend screen → canvas-copy `lighter`) if we want
  more phosphor blowout.
- Wire `setBloomIntensity` to a real deck-damage stat in game state.
- `glyphDataUri`/`glyphSvg` are now production-dead (only `nodeFaceDataUri` is
  used + their own tests) — retained as standalone glyph helpers; remove if they
  stay unused.
- `ice-detect` is still a continuous faceted sweep; could become LED-segment to
  match probe if we want the two sweeps to share a language.
