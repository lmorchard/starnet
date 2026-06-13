# Access-level chevron glyph in the inspector header — Design

**Date:** 2026-06-13
**Status:** Approved (design); pending implementation plan
**Branch context:** follows the `compromised → open` rename (PR #211)
**Approved mockup:** [`2026-06-13-access-level-chevron-glyph-mockup.html`](./2026-06-13-access-level-chevron-glyph-mockup.html) (Treatment A selected)

## Motivation

The node inspector header (`starnet-context-menu.js`, the `insp-meta` row) shows access
level as plain uppercase text — `GRADE C · OPEN · ▲ GREEN`. Access level is the single most
important "where am I in breaking this node" signal, but as bare text it's not glance-legible.
We want a small stroke-only vector glyph beside the label that encodes the access tier and how
much headroom remains, consistent with the game's existing indicator vocabulary.

## Decisions (settled during brainstorming)

1. **Glyph = three stacked, point-up chevrons.** Reached levels are lit; not-yet-reached levels
   are dim — so the player can see the *ceiling* they can still climb to.
   - `locked` → bottom chevron lit, top two dim
   - `open` → bottom two lit, top dim
   - `owned` → all three lit
   - obscured / unknown access → all three dim
2. **Color = the node's own fence ramp (unified treatment "A").** Lit chevrons all take the
   *current level's* single hue — the glance-legible bright sibling of the node fence color.
   This reuses the access color language already on the graph node and deliberately avoids the
   green/amber/red **alert** ramp shown by the lamp immediately to its right (no semantic clash).
   Shape (chevron count) is the primary colorblind-safe channel; color reinforces.
3. **Integration point = the context-menu inspector header only.** The graph node's fence-hatch
   encoding is unchanged; the HUD is unchanged. (`starnet-node-panel.js` does not exist / does not
   render access, so there is a single integration site.)
4. **The text label stays.** The glyph is reinforcement; keeping the word `OPEN` preserves
   console/LLM-legibility and GUI/console symmetry. No new game event or log line is introduced —
   this visualizes the existing `accessLevel`, whose changes already log via the exploit flow.

## Detailed design

### New pure functions — `js/ui/indicator-glyphs.js`

Add alongside the existing `alertLampSvg` / `tickMeterSvg`, following the same conventions
(stroke-only, `fill="none"`, baked-in phosphene drop-shadow glow, no DOM, deterministic):

```
accessGlyphSvg(accessLevel: string): string        // standalone SVG markup
accessGlyphDataUri(accessLevel: string): string     // <img src>-ready data URI
```

**Access palette** — add bright siblings of the node fence ramp (the fence colors in
`node-glyphs.js` are intentionally dimmed "so the border stays brightest"; the header indicator
must pop). Documented as the bright counterpart so the two ramps stay in the same hue family:

| level   | lit chevrons | hue            |
|---------|--------------|----------------|
| locked  | 1            | `#45c4c4` teal |
| open    | 2            | `#36a6e0` blue |
| owned   | 3            | `#2ad17a` green-teal |
| (other) | 0            | — (all dim)    |

`owned` leans green-*teal* rather than pure green to keep visual distance from the alert lamp's
pure green (`#39ff7a`); the differing shape (3 chevrons vs hexagon) is the real disambiguator.

Dim chevrons reuse the existing `DIM = #2a3a55` constant at a thinner stroke, no glow.

**Geometry** (viewBox `0 0 16 18`, three point-up chevrons, filled bottom-up):

```
top    (level 3): polyline "3,6.5  8,3  13,6.5"
mid    (level 2): polyline "3,11.5 8,8  13,11.5"
bottom (level 1): polyline "3,16.5 8,13 13,16.5"
```

Lit stroke width ~1.8 with a `drop-shadow`/`feDropShadow` glow in the level hue; dim stroke ~1.4,
no glow. Built manually (like `tickMeterSvg`) to allow per-chevron stroke colors under one glow
filter colored by the current level's hue.

**Lit count mapping** — a small internal `{ locked: 1, open: 2, owned: 3 }` lookup; anything else
(including the obscured placeholder `"—"`) → 0 lit. This is the only place that encodes the ladder
order; keep it adjacent to the palette.

### Integration — `js/ui/components/starnet-context-menu.js`

In the `insp-meta` row, the access `<span>` becomes an image + label, mirroring the adjacent
alert-lamp markup (`<img class="nd-lamp" …> GREEN`):

```html
<img class="access-glyph" alt="" src=${accessGlyphDataUri(node.accessLevel)}>
<span class="im-val">${(node.accessLevel || "—").toUpperCase()}</span>
```

Obscured nodes (where `accessLevel` is absent/`"—"`) render the all-dim glyph — consistent with
the existing `"—"` text fallback.

### CSS — `css/style.css`

Add `.access-glyph` mirroring `.nd-lamp` (style.css:838) for inline sizing/vertical-alignment.

### Preview harness — `preview.html` / `js/ui/preview.js`

Per the project rule that new visual effects go in the preview harness: add the three access-glyph
states (locked / open / owned) plus the obscured all-dim state so the chevron geometry and glow can
be tuned without playing to the right game state. Render via the same `accessGlyphSvg` so the harness
and live UI never drift.

### Tests — `js/ui/indicator-glyphs.test.js`

Extend the existing suite (pure function, deterministic output):

- lit-chevron count per level: `locked` → 1 lit, `open` → 2, `owned` → 3, unknown/`"—"` → 0
- correct lit hue per level (teal / blue / green-teal)
- dim chevrons use `#2a3a55`
- stroke-only: no `fill` other than `none`
- output is a well-formed standalone `<svg>` (matches the shape of `alertLampSvg` assertions)

## Non-goals

- No change to the graph node's fence-hatch access encoding.
- No change to the HUD.
- No new game event, state field, or log line (visualizes existing `accessLevel`).
- No change to the access ladder order or values.

## Risks / edge cases

- **Color proximity to alert green** — handled by hue choice (green-teal vs pure green) and, more
  importantly, by shape (chevrons vs hexagon). Verify in the running game, not just the mockup.
- **Obscured nodes** — must render the all-dim glyph, not crash or show a stray lit chevron.
- **Drift between harness and live UI** — both must call the same `accessGlyphSvg`; never hand-author
  the SVG twice.

## Files touched

- `js/ui/indicator-glyphs.js` — new `accessGlyphSvg` / `accessGlyphDataUri` + `ACCESS` palette
- `js/ui/indicator-glyphs.test.js` — new tests
- `js/ui/components/starnet-context-menu.js` — header integration
- `css/style.css` — `.access-glyph`
- `preview.html` / `js/ui/preview.js` — harness demo
