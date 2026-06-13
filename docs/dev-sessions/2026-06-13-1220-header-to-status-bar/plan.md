# Plan: Eliminate top header → bottom status bar

Small, contained change: one component `render()`, one DOM move, one CSS block.

## Steps

### 1. `index.html` — move the element
- Remove the `<!-- HUD -->` block (`<starnet-hud id="hud">`) from the top of
  `#app` (between the opening `#app` and `<main id="main">`).
- Re-insert `<starnet-hud id="hud">` inside `#graph-column`, *after* the
  `.splitter` and *before* `<div id="bottom-row">`, so it spans the full width
  of the bottom section.

### 2. `js/ui/components/starnet-hud.js` — render changes
- Drop the `<span class="hud-title">★ STARNET</span>` line.
- Re-add `${this._renderCheatLabel()}` to `render()` (update the stale comment
  block above it).
- Order within the bar: connection · alert · wallet · trace · mission · cheat ·
  (spacer) · `☰` menu-wrap.

### 3. `css/style.css` — restyle `#hud`
- `#hud`: change `border-bottom` → `border-top`; drop `z-index:10` (it's now in
  normal flow within `#graph-column`, not floating over the graph). Keep
  `flex:0 0 auto`, `display:flex`, `align-items:center`, compact padding.
- Replace the title's right-push: remove `.hud-title { margin-right:auto }`
  (rule can go, title is gone) and add `margin-left:auto` to `.hud-menu-wrap` so
  status items stay left-aligned and `☰` floats to the far right.
- `#hud-menu`: flip `top: calc(100% + 0.4rem)` → `bottom: calc(100% + 0.4rem)`
  so the dropdown opens upward. Keep its `z-index` so it layers above the graph.
- Verify `.hud-cheat-label` styling still reads in the bar (it already has a rule).

### 4. Verify
- `make check` (tsc/JSDoc) — must pass.
- `make test` — must pass.
- `make serve` + browser: confirm header band is gone, status bar sits above the
  terminal, dropdown opens upward and is clickable over the graph, all menu
  actions work.

### 5. Docs
- Update `MANUAL.md` if it describes the old top header / title placement.
- Write `notes.md` summary.

### 6. PR
- Commit, push branch, open PR into `main`.

## Risk / rollback
- Public property API of `starnet-hud` is unchanged → `syncHud()` and `main.js`
  wiring untouched, so blast radius is render markup + CSS only.
- If the dropdown clips or the bar misaligns, it's isolated to the `#hud` CSS
  block. Clean restore point: the spec+plan commit before execution.
