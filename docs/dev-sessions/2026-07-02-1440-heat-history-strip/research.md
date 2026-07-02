# Research — heat history strip (Ember Scope)

Factual pointers gathered before writing the spec. `file:line` refs reflect the codebase at
session start (branch `heat-history-strip`, off `origin/main` @ 4782763).

## Heat model (game state)

- `state.heat` (number, no hard cap) + `state.heatDecayTimerId` — `js/core/state/index.js:169-170`.
- Mutations: `addHeat` / `decayHeat` / `setHeatDecayTimerId` — `js/core/state/flow.js:31-51`.
- Orchestration: `recordHeat` (trip ratchet), `startHeatDecay`, `handleHeatDecay` —
  `js/core/alert.js:174-206`.
- Constants — `js/core/balance.js:79-84`:
  - `HEAT_COST = { probe:1, xploit:2, sniff:1, replay:3, sweep:2 }`
  - `HEAT_ALARM_THRESHOLD = { S:4, A:5, B:7, C:9, D:12, F:15 }` (hidden, grade-keyed)
  - `HEAT_DECAY_PER_TICK = 0.6`, `HEAT_DECAY_MS = 1000`, `HEAT_DISCHARGE_FRAC = 0.5`,
    `LIE_LOW_HEAT_DROP = 6`
- Events: `HEAT_CHANGED`, `HEAT_ALARM`.

## Existing heat display (the gauge — stays)

- `heat-gauge` lamp in HUD — `js/ui/components/starnet-hud.js:95-97`; fed by `hudEl.heat = state.heat`
  in `js/ui/visual-renderer.js:436`.
- Gauge geometry — `js/ui/indicator-glyphs.js`: `heatGaugeSvg` (215), `heatZone` (203),
  `heatGaugeDataUri` (237). **Fixed visual scale `HEAT_GAUGE_MAX = 12`** (line 191, currently a
  private const — will export to share with the strip so both agree on scale).

## Vital waveforms (the pattern to mirror)

- Component `<starnet-waveform>` — `js/ui/components/starnet-waveform.js`. Standing-oscilloscope
  sweep: head advances `speed` px/s, wraps at width, samples current shape into a time-stamped
  buffer, redraws every frame with age→alpha phosphor banding (`NB=12`, `STEP=2`). `_frame` at
  lines 159-222; per-band batched stroke at 197-207; leading head dot 211-220; dpr canvas setup
  `_setupCanvas` (119-140); color-var resolution `_resolveColor` (111-117).
  - Props: `kind` (`ecg`|`pulse`), `frac` 0..1, `color`, `w`/`h`, `label`, `speed`, `trail`,
    `bloom`, `autosize`, `meter`.
- Pure geometry lives in a separate module `js/ui/waveform.js` (`ecgPoints`, `pulsePoints`,
  `sampleY`) — this is the split to mirror (pure module + thin canvas component).
- HUD markup — `index.html:43-52`: `#vital-stack` contains `#vital-ecg`, `#vital-deck`,
  then `<starnet-uplink id="uplink-btn">`.
- CSS — `css/style.css`: `#vital-stack` (absolute top-right, 220px, flex column, gap 4px,
  pointer-events:none) and `.vital-strip`.
- Data flow — `js/ui/visual-renderer.js`: `syncVitals(state)` (406) sets `frac` on the vital
  elements on `E.STATE_CHANGED` (called at 55). Line 436 already sets `hudEl.heat`.

## Preview harness

- `js/ui/preview.js:403-417` — waveform demo (creates `<starnet-waveform>` ecg + pulse). Mirror
  this for a heat-scope demo + a heat slider. (CLAUDE.md: new visual effects MUST be added to the
  preview harness.)

## Aesthetic constraints (CLAUDE.md)

- Stroke-only vector beam: no fills, no bitmap idioms, no easy curves. Straight segments/polygons.
- Hostile/enemy elements use red `#ff2a2a` / magenta `#ff00aa`.
- Geometry in pure, testable modules (cf. `js/ui/node-glyphs.js`, `js/ui/ice-glyphs.js`),
  consumed by both live UI and `preview.js`.
- Glow ownership: canvas vitals use `ctx.shadowBlur`/`shadowColor` (not a stacked SVG filter).

## Gotchas (from project memory)

- Worktree Read/Edit needs FULL worktree paths.
- `visual-renderer` has multiple HTML entrypoints (index/preview/playground) — the heat strip
  lives in `#vital-stack` (index only), but the preview needs its own demo instance.
- Bot/playtest/main are three parallel entry points — this is a pure UI/render change (reads
  `state.heat`), so it touches none of the engine dispatch; no bot changes expected.
