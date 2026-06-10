# Spec — ICE presence + detection legibility

A small cluster of related ICE-feedback work, surfaced by playtesting after the
#114 pressure-tuning session. Three threads sharing one surface (how ICE
detection is communicated to the player), plus a standing design principle.

## Motivation

- The ICE **presence** indicator is just the text "ICE" in a magenta CSS circle —
  not legible as a hostile entity, and off-aesthetic.
- The ICE **detection-in-progress** indicators are broken:
  - the sidebar `ICE DETECTION: Xs` countdown **lingers after the player leaves
    the node** (detection correctly no-ops, but the timer is never cancelled, so
    it stays visible until it expires);
  - the in-graph detection sweep **never appears** — it's positioned over a
    Cytoscape node id `"ice-0"` that no longer exists (ICE became an HTML overlay).
- We want to start imposing a **retro vector-display aesthetic** — angular forms,
  no easy curves — so new graphics use straight segments/polygons, not arcs.

## Goal

ICE reads as a menacing predator crouched on the node; detection-in-progress is
clearly visible both on the graph and in the sidebar, and clears the instant it
stops being real; both indicators use the angular no-curves vocabulary.

## Decisions (from brainstorm)

- **Presence:** Concept C — "Strike Cage": angular mandibles/jaws snapping shut
  around the node from above. Red (`#ff2a2a`), stroke-only, glow. Subtle slow
  **counter-clockwise** menace pulse (adversarial rotation convention).
- **Detection progress:** a **12-segment polygon** (echoes the node dodecagon)
  whose edges fade in one-by-one **counter-clockwise** as the dwell fills, then
  flash to a full bright cage on detection. Magenta (`#ff00aa`), unchanged.
- **Palette:** red + magenta are the enemy colors; keep both. (Player-palette
  iteration is explicitly future work.)
- **No-curves principle:** recorded as a standing design principle; re-vectoring
  *other* existing graphics is future work, not this session.

## Scope

### 1. Pure SVG-geometry module — `js/ui/ice-glyphs.js`
Mirrors the `js/ui/node-glyphs.js` pattern: pure functions, no DOM/Cytoscape,
unit-testable. Consumed by both `graph.js` and `preview.js`.
- `iceStrikeCage()` → stroke-only SVG markup for the Concept C form. Unlike a
  node-interior glyph, this form **crouches over/around the node**, so it is
  authored on its own viewbox sized to extend above and to the sides of the node
  center (the form's "jaws" reach down onto the node's upper rim), not the
  node-interior `0 0 64 64` glyph box.
- `detectionPolygonSegments(sides = 12, { cx, cy, r })` → array of segment
  endpoints `[{x1,y1,x2,y2}, …]` ordered counter-clockwise from the top, for the
  detection cage. Pure geometry; the renderer maps `progress` → per-segment
  opacity.

### 2. ICE presence (Concept C) — `js/ui/graph.js`
Keep the existing `#ice-overlay` HTML element and all its logic (positioning,
node-to-node movement animation, pan/zoom tracking via `_repositionIceOverlay`,
visibility fade in `syncIceGraph`). Replace only its **content**: remove the
CSS-circle border/radial-gradient + "ICE" text; inject the inline Strike Cage SVG
(red, glow) from `ice-glyphs.js`. Add a subtle CSS `@keyframes` slow CCW pulse on
the form. No change to when/where it shows.

### 3. Detection progress (12-segment polygon) — `js/ui/overlays/ice-detect.js`
Rework the existing `IceDetectOverlay` (a `NodeOverlay`): replace the single
sweeping `<path class="arc">` with 12 `<line>` segments generated from
`detectionPolygonSegments()`. `_render()` maps `this.progress` → per-segment
opacity (gradual fade-in, `op_i = clamp(progress*12 - i, dim, 1)`).
`completeAndClear()` flashes all segments to full before fading. Magenta, CCW.

### 4. Bug fixes (reproduce with a failing test first, per CLAUDE.md)
- **Lingering sidebar timer** (`js/core/ice.js` + wherever player navigation is
  signalled): the `ICE_DETECT` timer is cancelled on `ICE_EJECTED`/`ICE_REBOOTED`
  and on ICE departure, but **not when the player navigates away** from the dwell
  node. Register `handleIceDeparture` (or `cancelIceDwell`) on the player-navigation
  signal so leaving the node cancels the dwell timer (and its visible sidebar
  entry). Test: start a dwell, navigate away, assert no `ICE_DETECT` timer / no
  visible "ICE DETECTION" timer remains. Verify navigating *onto* a node ICE
  already occupies still arms detection (don't regress that).
- **Invisible graph indicator** (`js/ui/visual-renderer.js`): the detection
  overlay is synced to a dead node id `"ice-0"`. Repoint it at the actual dwell
  node (the detecting node — the player's selected node / ICE attention node /
  the `ICE_DETECT` timer's `nodeId`). Fixed as part of rewiring the overlay; add
  a test/assertion that it targets the detecting node, not `"ice-0"`.

### 5. Preview harness — `preview.html` / `js/ui/preview.js`
ICE is not currently demoable in the harness. Add a demo node + controls for:
- the ICE presence form (Concept C) — show/hide, and the pulse;
- the segmented detection fill — a progress slider 0→1 driving the 12-segment
  fade-in, plus a "detection" flash trigger.
Per the project principle that new visual effects must be tunable in the harness.

### 6. Design principle — `CLAUDE.md`
Add to the Design Aesthetic section: *Retro vector display — angular forms, no
easy curves. New graphics use straight segments and polygons (e.g. discrete
fading-in edges) rather than arcs, circles, or smooth sweeps. Existing curved graphics
may be re-vectored over time; do it deliberately, not all at once.*

## Out of scope
- Re-vectoring other existing curved graphics (loot rings, probe sweep, etc.).
- Player-palette revision.
- Any change to ICE detection *mechanics* (grades, thresholds, dwell) — this is
  purely presentation + two feedback bugs.

## Testing
- `ice-glyphs.js` pure functions: unit tests (segment count, ordering, geometry
  bounds) mirroring `node-glyphs` tests.
- Two bug fixes: failing test first, then fix (integration tests).
- `make check` green. Visual verification via the preview harness.

## Acceptance criteria
- [ ] ICE presence renders as the Concept C Strike Cage (red, angular, glow) via
      the HTML overlay; movement/visibility behavior unchanged.
- [ ] Detection progress renders as a 12-segment magenta polygon filling CCW,
      flashing full on detection — visible on the graph over the correct node.
- [ ] Sidebar `ICE DETECTION` countdown clears immediately when the player leaves
      the node (covered by a test).
- [ ] `ice-glyphs.js` is pure and unit-tested; `graph.js` and `preview.js` consume it.
- [ ] Preview harness demos both indicators.
- [ ] CLAUDE.md records the no-curves design principle.
- [ ] `make check` green.
