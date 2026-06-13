# Spec: Eliminate top header → bottom status bar

## Goal

Maximize the graph view by removing the top HUD header entirely. Drop the game
title. Relocate the remaining status elements into a full-width status bar that
sits directly above the terminal (and hand strip), with the hamburger menu at
the bar's right end.

This continues the ongoing UI-compaction arc (recent: #208 sidebar dissolved).

## Background

The top header is a single `<starnet-hud>` custom element pinned at the top of
`#app`. It renders: `★ STARNET` title, connection status, alert lamp + level,
wallet, trace countdown, mission block, and the hamburger `☰` button + dropdown
(NEW RUN / PAUSE / SAVE / LOAD).

Data flows in via `syncHud()` in `js/ui/visual-renderer.js` (sets properties on
`#hud`). Menu actions flow out as `hud-action` CustomEvents handled in
`js/ui/main.js`. A `// CHEAT` label already exists in the component, currently
not rendered, with a code comment noting it was preserved for "a planned status
bar under the terminal" — this is that status bar.

## Decisions (from brainstorming)

- **Layout: Option A** — the status bar spans the full width of the bottom
  section, above both the terminal (`#log-pane`) and the hand strip.
- **Hamburger: right end of the status bar** (not inside the input field). Keeps
  `starnet-hud` a single component with no wiring split. The dropdown opens
  *upward* since the bar is now at the bottom of the screen.
- Keep `starnet-hud` as one component; its public property API is unchanged, so
  `syncHud()` and the `main.js` `hud-action` wiring require **no changes**.

## Scope

### In scope
- Remove `<starnet-hud>` from the top of `#app`; re-insert it inside
  `#graph-column`, below the splitter and above `#bottom-row`.
- Remove the `★ STARNET` title from the component render.
- Restore the `// CHEAT` label into the bar.
- Flip the menu dropdown to open upward.
- Restyle `#hud` from a top header (`border-bottom`, `z-index:10`) into a bottom
  status strip (`border-top`), and push the hamburger to the far right
  (`margin-left:auto` on `.hud-menu-wrap`, replacing the title's `margin-right:auto`).
- Update `MANUAL.md` if it describes the old top header.

### Out of scope
- No change to the floated graph `#vital-stack` (HEALTH/DECK waveforms + uplink).
- No change to `syncHud()`, `main.js` action wiring, or the menu's actions.
- No hand-strip redesign (still a work in progress, per Les).
- No new `preview.html` entry — this relocates existing chrome, not a new effect.

## Success criteria

- Top header band is gone; the graph occupies that space.
- Status elements (connection, alert, wallet, trace, mission, cheat) render in a
  full-width bar directly above the terminal + hand strip.
- Hamburger `☰` sits at the bar's right end; its dropdown opens upward and
  remains clickable above the graph.
- `make check` and `make test` pass.
- GUI/console parity and all menu actions (new run, pause, save, load) behave
  identically to before.
