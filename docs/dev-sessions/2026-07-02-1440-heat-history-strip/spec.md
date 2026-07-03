# Heat History Strip ("Ember Scope") Spec

**Goal:** Give the player a scrolling-phosphor sense of `state.heat` *over time* — a stroke-only
vector "flame" strip below the HEALTH/DECK vital waveforms — so the rise toward the (hidden) heat
alarm and the decay after lying low are legible and anticipatable, not just an instantaneous gauge.

**Source:** Issue #295 + live design session in the visual companion (see `heat-strip-lab.html`
in this session dir — the tuned reference implementation).

## Current state

- Heat is modeled in game state and already has ONE HUD display: the `heat-gauge` lamp
  (`starnet-hud.js:95-97`, geometry in `indicator-glyphs.js`), a stroke-only tick-ladder showing
  *instantaneous* heat on a fixed scale `HEAT_GAUGE_MAX = 12` (`indicator-glyphs.js:191`). It
  cannot show trajectory.
- Vital waveforms are a proven standing-oscilloscope pattern: pure geometry in `js/ui/waveform.js`,
  a thin canvas component `<starnet-waveform>` (`starnet-waveform.js`) with a sweep-head +
  time-stamped buffer + age→alpha phosphor redraw, placed in `#vital-stack` (`index.html:43-52`),
  fed `frac` by `syncVitals()` (`visual-renderer.js:406`) on `E.STATE_CHANGED`.
- See `research.md` for the load-bearing `file:line` pointers.

## Desired end state

A third strip in `#vital-stack` (order: HEALTH → DECK → **HEAT** → uplink button), same
204×44 footprint and phosphor sweep mechanic as the vitals, rendering heat as a vector flame:

- **Crown:** a jagged stroked contour rides the current heat height (heat/`HEAT_GAUGE_MAX`,
  clamped to 0..1), swept left→right with the same wrap + phosphor-fade as the vitals. A heat
  change ripples in behind the sweep head.
- **Body:** discrete contour lines stacked below the crown at a **fixed pixel gap** (~4px).
  Lines are added/removed **only at the bottom** as the flame grows/shrinks — they never
  redistribute. Capped at a max count (~12; rarely binds at 44px).
- **Color:** red crown → yellow base progression, keyed to band index (stable, so lines don't
  shimmer color as they add/remove). Lower lines progressively more transparent.
- **No trip line / threshold marker** is shown to the player (the alarm threshold stays hidden,
  per the heat design). The flame height is relative to the fixed gauge scale, same as the lamp.
- The strip animates continuously (phosphor keeps sweeping even when heat is static), like the
  vitals. It reads as adversarial (warm palette) next to the green/violet vitals.
- The existing `heat-gauge` lamp **stays** (instantaneous readout); the strip adds the trend view.
- A preview-harness demo with a heat slider exists in `preview.html` / `preview.js`.
- The final tuned constants match the lab defaults: band gap 4px, max bands 12, jaggedness ~0.5,
  transparency falloff ~0.6, sweep speed ~90 px/s, trail ~0.9, bloom ~6. These are the starting
  values; fine-tuning happens live in-game.

## Design decisions

- **Decision:** New dedicated component `<starnet-heat-scope>` + pure geometry module
  `js/ui/heat-flame.js`, mirroring the `waveform.js` + `starnet-waveform.js` split.
  - **Why:** The flame needs a different per-column buffer (`{x, level, r, t, gap}` with a frozen
    jitter seed) and a multi-band draw — folding that into `<starnet-waveform>` via a new `kind`
    would heavily branch `_frame` and couple two unrelated render concerns in one growing file.
    A focused component keeps each file doing one thing (CLAUDE.md: large file = doing too much).
  - **Rejected:** (a) extend `<starnet-waveform>` with `kind:"ember"` — bloats the shipped
    component, risks regressing the vitals. (b) Extract a shared sweep-engine module used by both
    — a bigger refactor of shipped code for marginal DRY gain; the sweep bookkeeping duplicated
    is small. Deferred as a possible follow-up, noted in NOT-doing.
- **Decision:** Y-scale = `heat / HEAT_GAUGE_MAX` (reuse the gauge's constant; export it from
  `indicator-glyphs.js`).
  - **Why:** The strip and the lamp then agree on "how hot is hot" — one mental scale for the
    player, no second magic number to tune.
  - **Rejected:** grade-scaling the strip to the run's hidden `HEAT_ALARM_THRESHOLD`. It would
    make "full flame ≈ about to trip," but it desyncs from the lamp and leaks the hidden threshold
    through the visual. Keep the threshold hidden.
- **Decision:** Fixed-gap, crown-anchored bands (add/remove at bottom), not count-scaled even
  spacing.
  - **Why:** Even redistribution makes every line jump when the count changes; fixed-gap lines
    translate smoothly and only the bottom line pops in/out. (Settled by eye in the lab.)
  - **Rejected:** `nb = round(heat/trip * MAX)` with fractions `j/nb` — the jumpy version.
- **Decision:** Band color keyed to band index (capped), not to current visible count.
  - **Why:** Keeps a given line's color stable as lines add/remove — no shimmer. A tall flame
    reveals the full red→yellow spectrum; a short one is all-red crown.
- **Decision:** Pure geometry (band Y offsets, existence test, color ramp, per-column jitter) lives
  in `heat-flame.js` and is unit-tested; the component owns only canvas/RAF/dpr plumbing.
  - **Why:** Matches the vector-glyph pattern (testable geometry, thin renderer) and lets us test
    the add-from-bottom / no-negative / ramp-endpoint invariants without a browser.

## Patterns to follow

- Sweep + phosphor loop, dpr canvas setup, color-var resolution, leading head dot:
  `js/ui/components/starnet-waveform.js:111-222`.
- Pure-geometry-module split: `js/ui/waveform.js` consumed by the component.
- HUD placement + autosize strip: `index.html:43-52`, `.vital-strip` / `#vital-stack` in
  `css/style.css`.
- Frac sync on `STATE_CHANGED`: `js/ui/visual-renderer.js:406-436` (`syncVitals`) — add the heat
  strip's `frac = clamp(state.heat / HEAT_GAUGE_MAX)` alongside the ecg/deck sets.
- Preview demo: `js/ui/preview.js:403-417` (waveform demo) — mirror with a heat slider.
- Testing UI modules in node: pure module tested directly; component geometry via the exported
  functions (see project memory "Testing js/ui/ modules in node").

## What we're NOT doing

- **Not** removing or changing the existing `heat-gauge` lamp — both displays coexist.
- **Not** showing the alarm threshold / trip line to the player.
- **Not** changing any heat *mechanics* (costs, decay, thresholds, trip/discharge) — this is a
  pure read-only visualization of existing `state.heat`.
- **Not** refactoring `<starnet-waveform>` or extracting a shared sweep-engine — the small
  duplication of the sweep bookkeeping is accepted for now (possible later cleanup).
- **Not** touching the bot / playtest / engine dispatch — no gameplay surface changes.
- **Not** adding a numeric heat readout or a colorblind shape-channel to the strip (the lamp
  already carries the redundant/legible readout; the strip is mood+trend). Revisit only if
  playtest says the strip is illegible without color.

## Open questions

_Both resolved with the user before planning:_

- **Palette:** red crown → yellow base (as tuned in the lab). Confirmed.
- **Placement:** third waveform in the upper-right `#vital-stack`, between the DECK waveform and
  the VISIT WAN (uplink) button. Confirmed.
