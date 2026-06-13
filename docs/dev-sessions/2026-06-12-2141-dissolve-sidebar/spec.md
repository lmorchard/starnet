# Spec — Dissolve the sidebar, maximize the graph

**Session:** 2026-06-12-2141-dissolve-sidebar
**Branch:** `worktree-dissolve-sidebar`
**Status:** Draft for review

## Goal

Remove the right sidebar entirely and reclaim its width for the network graph — the
main play surface. The node-detail panel becomes a **node inspector** folded into the
graph-anchored action popup; the sidebar's other tenants (mission, vital traces, exploit
hand) are rehomed elsewhere; the HUD header is decluttered with a hamburger toggle.

The unifying intent: **maximize graph real estate and reduce fixed chrome**, while keeping
every piece of information and every action reachable.

## Background

Today the layout is a HUD header over a two-column `#main`: a `#graph-column` (graph +
log/console stacked) and a fixed-width `#sidebar` (`flex: 0 0 ~400px`) holding, top to
bottom: the vital-sign waveforms (health ECG + deck pulse), `<starnet-mission-pane>`,
`<starnet-node-panel>` (selected-node detail + ICE timers), and `<starnet-hand>` (exploit
cards). Selecting a node already pops `<starnet-context-menu>` anchored beside it — but that
popup holds *actions only*; the node's *info* lives in the far-right sidebar, so the player's
eye ping-pongs between the node and its stats.

This was validated visually in the brainstorming companion: a node-anchored inspector with a
fixed header, pinned actions, and an info footer reads well and keeps actions predictable.

## Decisions made during brainstorming

- **One PR, staged commits with a visual checkpoint per stage.** The overhaul ships as a
  single PR, but is sequenced into logical commits (see Delivery & staging); after each commit
  we review the running game in the browser before moving to the next. Every intermediate stage
  leaves the game runnable. This keeps the one-PR shape while making the diff reviewable and
  bisectable, and catches layout problems stage-by-stage instead of all at the end.
- **Inspector footer truly never scrolls.** It grows freely; positioning relies on flip/clamp.
  *Flagged concern (Les owns it):* a node dense with ICE + vulns + contents can produce a popup
  taller than the viewport, which clamp cannot fully rescue. Mitigation in the design: clamp the
  popup's *top* into view so header + actions are always visible, and only an unusually long
  footer ever runs off the bottom edge. Recorded, accepted.

## The six changes

### 1. Node inspector popup (`<starnet-context-menu>` → inspector)

Restructure the anchored popup into three stacked regions, top to bottom:

1. **Header (fixed height).** `[TYPE] label` on line 1; `GRADE · ACCESS · alert-lamp ALERT`
   on line 2. Fixed height regardless of label length so the action block below it never
   shifts. Alert lamp uses the existing shape-encoded glyph (hexagon → up-triangle →
   inverted-triangle).
2. **Actions (pinned).** The existing action buttons, immediately under the header — so a
   button is always at the same offset from the popup top, independent of footer content.
   Disabled actions still render with their reason (current behavior).
3. **Footer (variable, grows downward).** In order: **ICE/alert timers → vulnerabilities →
   contents**. Sections that don't apply to the node are omitted (an unprobed node shows a
   "Run PROBE…" hint; a node with no ICE omits the ICE section; undumped contents show a hint).

This absorbs everything `<starnet-node-panel>` shows today, including the `<starnet-ice-timers>`
display. `#sidebar-node` / `<starnet-node-panel>` is removed.

**Obscured / unknown nodes** keep their current treatment, rendered in the inspector header:
the `sig-N` alias and the "gain access / run PROBE" hint instead of real identity.

**Empty state:** when no node is selected, no popup shows (current behavior). There is no
longer a sidebar "SELECT A NODE TO BEGIN" placeholder; that affordance is dropped.

### 2. HUD header — mission in, hamburger for buttons

- **Mission moves into the header.** The mission briefing (`// MISSION`, `⬡ targetName`,
  status) relocates from the sidebar into `<starnet-hud>`. Compact horizontal form suited to
  the header bar; status still distinguishes active / complete / failed.
- **Hamburger toggle for buttons.** All header buttons *except* `JACK OUT` (NEW RUN, PAUSE,
  SAVE, LOAD) collapse behind a hamburger control. `JACK OUT` stays always-visible (it's the
  escape hatch). The cheat label and live readouts (alert, wallet, trace) stay in the header.
- The hamburger panel's open/closed state is **persisted in game state** (see State additions).

### 3. Vital traces → floating insets over the graph

The two `<starnet-waveform>` strips (HEALTH ECG, DECK pulse) move out of the sidebar and become
**floating inset panels in the upper-right corner of the graph**, overlaying the network. They
keep their existing autosize/driven-by-`syncVitals` wiring. As graph overlays they must not
swallow graph pan/zoom interaction outside their own bounds (pointer-events scoped to the
panels).

### 4. Exploit hand → split of the terminal, collapsible

- The exploit hand (`<starnet-hand>`) moves from the sidebar into the bottom log/console
  region of `#graph-column`, as a **split alongside the terminal** (reusing the existing
  splitter/resize system).
- Add a **collapse/hide control** on the hand panel. Collapsed state is **persisted in game
  state**.

### 5. Remove `#sidebar`, reflow graph to full width

Once 1–4 have rehomed every tenant, delete the `#sidebar` `<aside>` and its column splitter.
`#main` becomes a single full-width `#graph-column`. Reclaimed width goes to the graph (and
the log/hand row beneath it). Remove now-dead sidebar CSS and the `sidebarW` resize wiring.

### 6. (covered above) HUD hamburger

Folded into change 2.

## Inspector positioning strategy (the risk area)

This is the part most likely to misbehave across node position, pan, and zoom. Approach,
extending today's `_positionContextMenu`:

- **Horizontal:** keep the current logic — prefer right of the node, flip to the left if the
  popup would clip the container's right edge. Unchanged.
- **Vertical:** change from "center the whole popup on the node" to **anchor the header top
  near the node and let the footer extend downward.** Then **clamp the popup top** so it never
  rises above the container top — guaranteeing header + actions are always on-screen. A footer
  longer than the remaining space simply runs off the bottom edge (rare; accepted per the
  no-scroll decision). This also stops a tall popup from covering its own anchor node, which
  today's centering does once the popup is tall.
- **Off-screen / panned-out node:** clamp the popup to the container edge nearest the node, as
  today's clamp already does.
- Positioning still defers until Lit's `updateComplete` so measured height is real before
  placement (current behavior).

## State additions

Per the "all gameplay-relevant state lives in the state object and round-trips through
save/load" rule, the two new UI toggles are persisted:

- `hud.menuOpen` (or equivalent) — header hamburger panel open/closed.
- `hand.collapsed` (or equivalent) — exploit-hand panel collapsed/shown.

New fields are added to the relevant `@typedef` in `js/types.js`, set via `mutate()` setters
in the appropriate state submodule. (Exact field placement decided in the plan.) These are UI
chrome flags, but they live in state so a save/load reproduces the player's layout exactly.

## Cross-cutting obligations

- **GUI/console symmetry.** Any control reachable by mouse (hamburger toggle, hand collapse)
  must have a console-command equivalent producing identical state + log behavior. The
  `status node <id>` command already covers the inspector's information; verify it still does.
- **LLM legibility.** Removing the sidebar must not remove any information from the textual
  channel — all node detail remains inspectable via `status` and logged as before.
- **MANUAL.md.** Update the UI/layout descriptions: node inspector replaces the sidebar node
  panel; mission in header; vitals as graph overlays; hand in the terminal split; hamburger.
- **Preview/playground harness.** If the context menu / inspector or vitals are demoed in
  `preview.html` / `js/ui/preview.js`, update them to the new structure.
- **types.js.** Run `make check` after state-shape changes.
- **Parallel entry points.** This is UI-only; the bot, playtest harness, and `main.js` share
  engine wiring, not layout. Confirm none of them depend on the removed sidebar elements.

## Delivery & staging

One PR, built as an ordered sequence of commits. Each stage leaves the game runnable and gets
a **visual checkpoint** (review the running game in the browser) before the next begins. Order
is by dependency and risk — the highest-risk, most-validated piece (the inspector) goes first;
the sidebar shell is deleted last, once every tenant has been rehomed.

| Stage | Commit | Visual checkpoint |
|-------|--------|-------------------|
| 1 | **Node inspector** — fold header/actions/footer into the popup; remove `<starnet-node-panel>`. Sidebar still holds mission/vitals/hand. | Select nodes in each state (unprobed, owned, contested-with-ICE, obscured); exercise positioning at graph corners, after pan, at min/max zoom. |
| 2 | **Mission → header + hamburger** — relocate mission into `<starnet-hud>`; add hamburger collapsing all buttons except JACK OUT. | Header readable + uncluttered; mission status reflects active/complete/failed; toggle hides/shows buttons; JACK OUT always present. |
| 3 | **Vitals → floating insets** — reparent the two waveforms to upper-right graph overlays. | Traces animate over the graph; pan/zoom works outside the panels; no occlusion of key graph areas. |
| 4 | **Hand → terminal split + collapse** — move `<starnet-hand>` into the bottom split; add collapse control. | Hand usable in new spot; collapse/expand works; splitter resizes. |
| 5 | **Delete sidebar + reflow** — remove the now-empty `#sidebar` and `sidebarW` splitter; graph goes full-width; drop dead CSS. | Full layout; graph fills reclaimed width; nothing orphaned. |

Save/load round-trip (stages 2 & 4 state flags) and the final `make check` + census smoke run
at the end, before the PR is opened.

## Testing

- New positioning logic gets unit coverage where feasible (pure geometry: given node rendered
  position + popup size + container size, assert the computed top/left and that header+actions
  stay within bounds for tall footers, top/bottom/edge cases).
- Inspector render: header fixed, actions present, footer sections present/omitted per node
  state (unprobed, owned-no-ICE, contested-with-ICE, obscured).
- State round-trip: hamburger + hand-collapse flags survive save/load.
- `make check` (lint + tests) and a `make census SEEDS=10` no-regression smoke (UI change
  shouldn't move balance, but confirms the engine still runs through the harness).

## Out of scope

- Re-theming or re-styling beyond what the relocation requires.
- Changing what actions exist, exploit mechanics, alert/ICE behavior, or any game logic.
- The two-panel (actions-one-side / data-other-side) inspector alternative — considered and
  rejected in favor of the unified single panel (simpler to position).
- Mobile / small-viewport layout.

## Acceptance criteria

1. Selecting a node shows a single anchored inspector: fixed header, pinned actions, footer
   (timers → vulns → contents), with header + actions always fully on-screen across node
   position, pan, and zoom.
2. The `#sidebar` `<aside>` no longer exists; the graph occupies the reclaimed width.
3. Mission is visible in the header; health + deck vitals float over the graph (upper-right);
   the exploit hand sits in the terminal split with a working collapse control.
4. A hamburger in the header toggles all buttons except JACK OUT, which stays visible.
5. Hamburger and hand-collapse states survive save/load.
6. `make check` passes; MANUAL.md and the preview harness reflect the new layout; console
   symmetry and `status` legibility preserved.
