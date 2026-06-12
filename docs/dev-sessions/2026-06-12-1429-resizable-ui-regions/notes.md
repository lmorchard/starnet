# Notes — Drag-resizable UI regions

Issue: #181 · Branch: `resizable-ui-regions`

## What shipped

Three drag-resizable borders, each adjusting one CSS custom property on `#app`:

- **Sidebar width** (`--sidebar-w`) — vertical splitter between graph-column and sidebar.
- **Graph ↔ log height** (`--log-h`) — horizontal splitter above the log/console.
- **Hand height** (`--hand-h`) — horizontal splitter above the exploit hand.

Sizes persist to `localStorage["starnet:layout"]` via a new `layout-store.js`,
kept deliberately OUT of the game state object (UI chrome, not gameplay).
Double-click a splitter resets that axis to its default.

## Files

- `js/ui/layout-store.js` (new) — `DEFAULT_LAYOUT`, `SIZE_BOUNDS`, pure `clampSize`
  + `normalizeLayout`, `loadLayout` / `saveLayout`. Unit-tested (`layout-store.test.js`, 10 tests).
- `js/ui/resizers.js` (new) — `initResizers()`: applies the loaded layout, wires
  the three splitters with Pointer Events (+ `setPointerCapture`), clamps to live
  viewport-relative maxima, debounced save, `lostpointercapture` cleanup, double-click reset.
- `css/style.css` — flex bases via the three vars; `#log-pane`/`#log-entries`
  refactor (pane carries the basis, entries fill + scroll, console row pinned);
  removed the `#hand-strip { max-height: 33% }` cap from #182 (the clamp's
  ~60%-of-sidebar max now serves that "don't crowd the node panel" intent);
  `.splitter` styles (stroke-only hairline, cyan glow on hover/drag, 10px hit zone).
- `index.html` — three `<div class="splitter" data-resize="…">` elements.
- `js/ui/main.js` — `initResizers()` called in `init()` after `initConsole()`.
- `MANUAL.md` — THE INTERFACE section notes the resizable borders + double-click reset.

## Defaults chosen

`{ sidebarW: 400, logH: 260, handH: 200 }` px. `sidebarW: 400` matches the
historical fixed width. Static persistence bounds: sidebar 280–1200, log 64–1200,
hand 80–1200; live drag maxima are 50vw / 60vh / 60%-of-sidebar.

## Process

Brainstorm → spec → plan → subagent-driven execution (2 implementer units +
two-stage spec/quality review each). The touch-cancel fix (`lostpointercapture`)
came out of the code-quality review.

## Follow-on bug fix folded in (deck-pulse stretch)

Playtesting the splitters surfaced a real bug: the DECK vital waveform's pulse
stretched as the sidebar widened. `pulsePoints` hardcoded `CYCLES = 4` across the
strip width, whereas `ecgPoints` anchors its period to height (wider strip = more
beats). Fixed `pulsePoints` the same way (`CYCLE_W = H * 2.05`, cycle count snapped
to tile the width) — at default strip dimensions it still yields 4 cycles, so the
look is unchanged; it just adds cycles when wider instead of stretching. Reproduced
with a failing test first (`waveform.test.js`: a 4×-wider strip must yield more
vertices). Folded into this branch because the splitter is the natural repro.
(The waveform restart-on-drag flicker is separate autosize re-init — left as-is.)

## Deferred / noted

- Full 4-way sidebar section resize (vital-stack / mission / node) — the rest of #181.
- `role="separator"` + `aria-*` on the splitters for screen-reader operability
  (raised in review; out of this pass's spec — worth a small follow-up).
- A global "reset all layout" affordance.

## Verification

`make check` clean (1055 tests). Live browser verification of the drag behavior
done against a local server (Playwright Firefox won't launch in this environment,
so the visual confirm was manual).
