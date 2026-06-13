# Notes — Dissolve the sidebar / maximize the graph

## Stage 1 — Node inspector (DONE, checkpointed)

The graph-anchored action popup is now a full **node inspector**. Built across plan tasks
6.1 (state.ui toggles), 1.1–1.4, then refined live in-browser with Les. Pushed to PR #208.

### Structure (final)
- **Header section:** top row = `[TYPE]` (small) + `GRADE · ACCESS · ▲ ALERT` meta pushed
  right; the label/id on its own line beneath (long ids no longer break the layout).
- **Action band:** the action buttons, in a magenta-bracketed section.
- **Footer sections (in order):** ICE/action timers → **CONTENTS** → **VULNERABILITIES**.
- Every adjacent section is divided by a **magenta rule** (`.insp-section + .insp-section`).
- Fixed **300px** width (stops content-driven jitter); **40px** gap off the node; always
  left-aligned (no more right-justify on the left side).

### Refinements beyond the original spec (intentional, Les-approved live)
- Spec said footer order `timers → vulns → contents`; **shipped `timers → contents → vulns`**
  per Les.
- Spec said header was a fixed-height identity block; **shipped a compact two-row header**
  (type+meta row, then label) — tighter than the ported sidebar panel.
- **Obscured nodes** reuse the same compact header filled with `[???]` / `sigAlias` / `GRADE ?`
  instead of the old big "UNKNOWN NODE" placeholder; an unreachable obscured node shows a
  one-line "Reach a connected node to probe." in the action band.
- **In-progress actions:** the inspector no longer disappears while a timed action runs
  (probe/xploit/dump/fetch/mine/lie-low/reboot). The action band is replaced by a busy
  indicator `▶ <LABEL>` + a stroked **tick ladder** showing progress. Label/progress derived
  in `visual-renderer.js` (`inProgressFor`) from `TIMED_ACTIONS` + `getTimedActionAttrNames`.
- **Submenu pickers** (xploit cards / exec scripts) no longer hide the inspector; they cascade
  down-right off the inspector's top-left (`_positionActionChoices`) and dismiss on pick/ESC.

### Positioning
- `js/ui/inspector-position.js` — pure `computeInspectorPosition` (TDD, 5 tests). Vertical rule
  anchors header-top + clamps top into view, so header + actions stay on screen and only a long
  footer overflows the bottom (honors the no-scroll decision). GAP=40.

## Stage 2 — Mission → HUD header + hamburger (DONE)
- Mission briefing moved into `<starnet-hud>`; sidebar mission pane deleted.
- `☰` summons a floating **dropdown** of NEW RUN/PAUSE/SAVE/LOAD (not inline). Console `menu` mirrors it. `state.ui.menuOpen` persists.

## Stage 3 — Vitals float (DONE)
- HEALTH/DECK waveforms reparented into `#graph-container`, floating upper-right (`pointer-events:none` so they never block the graph). `syncVitals` unchanged (id-targeted).

## JACK OUT relocation (DONE — designed live with Les)
- Header JACK OUT button removed. A floating control under the vitals shows **VISIT WAN** (selects the WAN node) normally, swapping to a pulsing red **JACK OUT** when alert≠green or a trace is counting (`syncUplink` in visual-renderer; `<starnet-uplink>` dispatches the shared `starnet:action`).
- New **DISCONNECT** EXEC script on the WAN node (`A.DISCONNECT`, `game-types.js` template + `darknet` trait + `createWAN`), effect `ctx-call jackOut` = `endRun("success")` — identical to the button. Global `A.JACKOUT` untouched.
- **Bot guard:** `A.DISCONNECT` added to `puzzleStrategy` `KNOWN_ACTIONS` (the WAN node is always owned, so without this the bot would auto-jackout). Census SEEDS=10 confirms no early-jackout regression (avgTicks ~520).
- `// CHEAT` indicator hidden but preserved (uncalled `_renderCheatLabel`) for a future under-terminal status bar.

## Stage 4 + 5 — Hand split + sidebar removal (DONE, folded together)
- Hand moved into `#bottom-row` beside the terminal (fixed 340px column, `border-left`), with a collapse toggle (`collapsed` reflected attribute; `starnet:toggle-hand` → `toggleHandCollapsed`; console `hand`). `state.ui.handCollapsed` persists.
- `#sidebar` + sidebarW/handH splitters deleted; `#main` is a single full-width `#graph-column`. **Graph reclaims full width** — the overhaul's payoff.
- Hand layout in the new band deferred to a future session (Les).

## Stage 6.2 — Docs + harness (DONE)
- MANUAL.md updated (interface diagram, inspector, hamburger, vitals, uplink, disconnect, `menu`/`hand` commands, jack-out paths).
- Playground checked: loads its own `js/playground/main.js`; visual-renderer guards prevent crashes. Orphaned compat stubs (`#sidebar-node`, `#jack-out-btn`) left in place — filed **issue #209** to retire `playground.html` and fold debug features into the main app.

## Known follow-ups / deferred
- Hand layout/width iteration (future session).
- Minor tech debt: stale `sidebarW`/`handH` axes in `resizers.js` + `layout-store.js` (unused, harmless); collapsed hand panel retains a little side padding.
- Issue #209 — retire playground.html.
- Future: move `// CHEAT` into a planned status bar under the terminal.
