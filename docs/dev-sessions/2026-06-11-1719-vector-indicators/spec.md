# Vector Indicator Sweep Spec

**Goal:** Replace the bitmap/textmode status chrome (filled-circle "lamps", `█`/`░`
block-pip meters) with a coherent vector vocabulary — stroke-only glyphs with a phosphene
glow — applied consistently across the HUD, node panel, exploit cards, and mission pane.

**Source:** User request from 2026-06-11, following the vector-CRT aesthetic codified in
`CLAUDE.md` ("Vector UI vocabulary — strokes, not fills or bitmap chrome"). Vocabulary
locked by eye in a throwaway lab (`tmp/indicator-lab.html`).

## Current state

Non-vector indicators found in the audit:
- **Round filled lamps** (`border-radius:50%`): `.alert-dot` (`css/style.css:263`),
  `.hud-conn-dot` (`:299`) — both in `js/ui/components/starnet-hud.js`; and the
  `● {alertState}` bullet in `js/ui/components/starnet-node-panel.js:77`.
- **Block/dither meters** (`█`/`░`): the health/deck meter header in
  `js/ui/components/starnet-waveform.js` (`_meterHeader`); the exploit-card quality pips in
  `js/ui/components/exploit-card-view.js:22` (colors via `.ec-pips.q0..q4`, `css/style.css:817-821`);
  and mission status `██ COMPLETE` / `░░ FAILED` in
  `js/ui/components/starnet-mission-pane.js:25,28`.
- Pure-glyph convention to mirror: `js/ui/vuln-glyphs.js` — stroke-only SVG returned as a
  string + `…DataUri()` for `<img src>`, with a unit test (`vuln-glyphs.test.js`).

## Desired end state

A new pure module **`js/ui/indicator-glyphs.js`** (mirroring `vuln-glyphs.js`) exporting
stroke-only SVG generators with a baked-in glow (SVG `feDropShadow`/blur filter so the
data-URI is self-contained and correctly colored), plus `…DataUri()` helpers:

- **Alert lamp** — shape encodes state (colorblind-safe), per CLAUDE.md:
  `green` → **hexagon** (safe), `yellow` → **point-up triangle** (warning),
  `red` → **inverted triangle** (danger). All stroked, color-ramped.
- **Tick-ladder meter** — N short vertical strokes; `round(frac·N)` lit (full-height,
  bright, tier color green>0.6 / amber>0.3 / red), rest dim stubs. Count is the
  colorblind-safe channel.
- **Binary status markers** (mission): stroked **check** (complete) and stroked **✕**
  (failed) — straight segments only.

Applied at every site above; the round-dot CSS and `█/░` strings are removed.

## Design decisions

- **Decision:** Stroke-only SVG via data-URI `<img>` (mirror `vuln-glyphs`), glow baked
  into the SVG filter.
  - **Why:** matches the established glyph convention, works in any component without a Lit
    directive (no `unsafeSVG`/bundling change), correct per-state glow color.
  - **Rejected:** inline `unsafeSVG` (needs adding the directive to the lit-vendor bundle);
    CSS `drop-shadow` on `<img>` (can't pick up the per-state color cleanly).
- **Decision:** Alert lamp = hexagon → ▲ → ▽ (the locked, lab-confirmed scheme).
  - **Why:** distinct by *form* (hexagon vs triangle, then up vs down) → survives
    colorblindness; warning-triangle iconography is universal.
- **Decision:** Connection status dot (`.hud-conn-dot`) is vectorized as a single stroked
  glyph **colored by status** (passive=dim, active=cyan, detecting=red), NOT shape-by-state.
  - **Why:** connection status is a different semantic axis than the alert ramp; reusing the
    alert shapes would imply a danger level that isn't meant. Removing the filled circle is
    the goal; a simple stroked mark (small hexagon/`◇`) colored by status suffices.
  - **Rejected:** mapping it onto the hex/△/▽ set — wrong semantics.
- **Decision:** Health/deck meter and exploit-card quality both use the shared tick-ladder.
  - **Why:** both are 0..N magnitudes; one meter primitive, consistent read. The card's
    existing `.ec-pips.qN` color ramp is replaced by the meter's tier ramp.

## Patterns to follow

- Pure module + test: mirror `js/ui/vuln-glyphs.js` (+ `vuln-glyphs.test.js`) — `@ts-check`,
  JSDoc, returns SVG string + `…DataUri()`.
- Lab reference for exact geometry/proportions: `tmp/indicator-lab.html` (gitignored; the
  `lamp*`/`meter*` functions there are the source of truth for shape coordinates).
- Component usage: set the glyph as an `<img class="…">` src (like the vuln glyph on cards).

## What we're NOT doing

- **Not** changing what the indicators *mean* or any game logic — purely how they're drawn.
- **Not** redesigning the alert/connection/quality state machines — same states, new glyphs.
- **Not** vectorizing the `.ec-cancel-x` round *button* background (`css/style.css:964`) —
  it's a button affordance, not a readout indicator; deferred as a follow-up.
- **Not** touching the waveform traces themselves (just the pip meter in their header).
- **Not** adding animation to the lamps beyond the existing pulse/glow.

## Open questions

- **Connection-dot glyph shape (small hexagon vs `◇`) and mission marker exact forms.**
  - *Default:* connection = small stroked hexagon (neutral "node" mark) colored by status;
    mission complete = stroked check polyline, failed = stroked ✕. Tune by eye in preview;
    all are straight-segment stroked glyphs so any choice stays on-aesthetic.
