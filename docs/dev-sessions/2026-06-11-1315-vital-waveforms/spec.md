# Vital-Sign Waveforms Spec

**Goal:** Replace the HUD's two numeric bar meters (HEALTH, DECK) with animated
Zoids-style vital-sign waveforms — a green ECG heartbeat for the decker's health
and a violet square pulse for deck integrity — that degrade in shape as each value
falls, giving an at-a-glance, diegetic read on how the run is going.

**Source:** User request from 2026-06-11 (inspired by the 1986 Zoids C64 game's
dual heart-monitor / square-pulse HUD).

## Current state

- The HUD (`js/ui/components/starnet-hud.js`) shows HEALTH and DECK as horizontal
  bar meters via `_meter(label, current, max)` (`starnet-hud.js:52-62`), called at
  `starnet-hud.js:91-92`. The bar fills a width % and colors green/yellow/red by
  fraction, with the raw number as text.
- The HUD already receives `health` / `healthMax` / `deckIntegrity` /
  `deckIntegrityMax` as Lit properties (`starnet-hud.js:17-20`), fed from state by
  `js/ui/visual-renderer.js`.
- The underlying quantities live in state at `js/core/state/index.js:165-166`:
  `player.health` (`{current, max}`) and `player.deckIntegrity` (`{current, max}`).
  ICE damages them (sentinel→health, spike→deck; see `index.js:200-202`).
- Pure, testable geometry modules are an established convention:
  `js/ui/node-glyphs.js`, `js/ui/ice-glyphs.js`, `js/ui/vuln-glyphs.js` (with
  `vuln-glyphs.test.js`). They export functions returning SVG geometry, consumed by
  both `graph.js` and `preview.js`.
- Visual effects are demoed in the preview harness (`preview.html` / `js/ui/preview.js`).

## Desired end state

- Two animated SVG waveforms render where the HEALTH and DECK bar meters were:
  - **ECG (health):** green polyline (`var(--green)`). `frac = health/healthMax`
    drives **beat rate and jaggedness**. High frac → slow, clean, regular spikes.
    Low frac → fast, erratic, irregular spikes. `frac = 0` → flat line.
  - **Square pulse (deck):** violet polyline. `frac = deckIntegrity/deckIntegrityMax`
    drives **amplitude and dropout glitches**. High frac → crisp full-amplitude square
    wave. Low frac → ragged, lower-amplitude, with dropout gaps. `frac = 0` → flat line.
- Both scroll horizontally (continuous animation). Both are built from straight
  segments only (polylines) — no curves, per the vector-CRT aesthetic rule.
- The raw numeric value remains available on hover via the element `title` attribute;
  `status` continues to report both values (no change there).
- The waveform pair is demoable in the preview harness with sliders for health % and
  deck %, and a toggle between two layout arrangements: **HUD-inline** (current header
  placement) and **Zoids stacked-strip** (ECG above / pulse below the graph panel), so
  the two placements can be compared by eye before committing to one.
- `CLAUDE.md`'s "Out of Scope (Future)" note listing visual effects is updated — visual
  effects are now in scope.

## Design decisions

- **Decision:** Waveforms read `player.health` and `player.deckIntegrity`.
  - **Why:** These are the two existing damage tracks, already shown as the HUD meters
    this feature replaces, and they map 1:1 onto the Zoids pilot-health / machine-health
    pair (both are *yours*, both under attack by ICE).
  - **Rejected:** Mapping to alert/trace ("player exposure vs system defenses"). Those
    aren't single numeric quantities, so the fraction→shape mapping would be fuzzy, and
    it wouldn't replace the meters the user asked to replace.

- **Decision:** Pure geometry module `js/ui/waveform.js` returning vertex-point arrays
  (`ecgPoints`/`pulsePoints`), with a `pointsToPath()` serializer to an SVG path `d` string,
  consumed by a reusable `<starnet-waveform>` Lit component.
  - **Why:** Matches the `*-glyphs.js` convention — geometry stays pure and unit-testable;
    the component is reusable so it drops into either layout placement unchanged.
  - **Rejected:** Canvas rendering. These are small fixed-size widgets; canvas adds an
    imperative draw loop and buys nothing over SVG, and breaks the testable-geometry pattern.

- **Decision:** Erratic/glitch variation is derived *deterministically* from `phase`+`frac`
  (a small hash), not `Math.random`.
  - **Why:** Keeps the geometry function pure and snapshot-testable; produces a stable
    repeating pattern rather than per-frame noise.
  - **Rejected:** `Math.random()` per frame — untestable and visually noisier than wanted.

- **Decision:** The scroll `phase` is render-time presentation state held in the component
  (advanced by `requestAnimationFrame`), NOT in the game state object.
  - **Why:** Per CLAUDE.md, gameplay state must be fully serializable. The scroll cursor is
    ephemeral animation (like a CSS animation tick), exactly like the existing timed overlays;
    the *shape* derives entirely from `frac`, which IS serializable state.
  - **Rejected:** Storing phase in game state — would pollute the save format with animation
    cruft for no gameplay benefit.

- **Decision:** Deck pulse color defaults to violet, not cyan.
  - **Why:** Cyan is already pervasive (nodes, borders); violet reads as a distinct "your
    rig" channel without colliding with hostile red/magenta. Final hue tuned by eye in preview.
  - **Rejected:** Cyan — too easily lost against the existing cyan UI.

## Patterns to follow

- Pure geometry module + test: mirror `js/ui/vuln-glyphs.js` + `js/ui/vuln-glyphs.test.js`.
- Lit component: mirror `js/ui/components/starnet-hud.js` structure (light-DOM
  `StarnetElement` base, `static properties`, `render()` returning `html`).
- Preview demo: add a node/panel + controls in `js/ui/preview.js` following the existing
  effect demos there (per the "new visual effects must be added to the preview harness"
  design principle).
- State→prop bridge: the HUD already gets health/deck props via `visual-renderer.js`;
  no new bridge needed for the inline placement.

## What we're NOT doing

- **Not** changing any gameplay: health/deck damage, ICE behavior, alert, trace, or
  game-over logic are untouched. The waveform only *reflects* state.
- **Not** adding a third/fourth waveform for alert or trace (rejected mapping above).
- **Not** committing to the Zoids stacked-strip layout in this session — we build it as a
  preview-only comparison arrangement; the shipped HUD placement stays inline unless the
  comparison changes our mind (a follow-up decision, not this spec's scope).
- **Not** refactoring the HUD beyond swapping the two `_meter` calls and removing the now-unused
  `_meter` helper if nothing else uses it.
- **Not** adding audio, screenshake, or other juice effects — just the two waveforms.
- **Not** changing `status` / log output or console commands.

## Open questions

- **Final deck pulse hue (exact violet) and waveform tile dimensions.**
  - *Default:* a CSS-variable violet (introduce `--violet` if absent) at the same compact
    height as the current meters; tune by eye in the preview harness during execute.
- **Which layout ships (inline vs stacked-strip).**
  - *Default:* ship HUD-inline (the placement the user confirmed "for now"); stacked-strip
    is built in preview only for comparison and a possible follow-up.
