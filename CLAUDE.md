# Starnet — CLAUDE.md

## Project Overview

Starnet is a cyberpunk nethacking game with an interplanetary setting. Its core is the **LAN dungeon mechanic** — a network graph puzzle the player navigates by exploiting vulnerabilities, subverting security systems, and looting macguffins for cash.

It began as a single-mechanic HTML prototype and has since grown into an actively-developed game: procedural network generation, hand-authored set-piece puzzles, multiple ICE behaviors, a darknet store, health/deck loss-clock pressure, and a headless bot/census harness all ship today. "Prototype" no longer describes the scope — treat it as a maturing game in active development. (The early experiment sketches that seeded it are still listed under "Experiments / prototypes" in `docs/SPEC.md` for historical context.)

See `docs/SPEC.md` for the full game design document.

## Tech Stack

- **Vanilla HTML/CSS/JS** — no framework
- **Cytoscape.js + layout extensions** — bundled locally via esbuild (see below)
- ES modules via `<script type="module">` for game code — no bundler for `js/`
- **JSDoc `@ts-check`** — type annotations without a build step; see `js/types.js`

## Makefile

```
make serve         — start local dev server at http://localhost:3000
make lint          — run tsc type checker (JSDoc annotations, no emit)
make test          — run unit + integration tests
make check         — lint + test (run both)
make bundle-vendor — build dist/vendor.js (Cytoscape + layout extensions)
make census        — run bot census (50 seeds, default grades; override with SEEDS=100 THREAT=B)
```

**`dist/vendor.js` must be built before opening the game in a browser.** It is
gitignored (build artifact). Run `make bundle-vendor` after cloning or after
updating vendor dependencies in `package.json`.

The GitHub Pages deploy workflow runs `make bundle-vendor` automatically.

### Bundling philosophy

- **Vendor code** — bundled with esbuild into `dist/`:
  - `js/vendor.js` → `dist/vendor.js` (IIFE) — Cytoscape.js + layout extensions.
    Sets `window.cytoscape`.
  - `js/lit-vendor.js` → `dist/lit.js` (ESM) — Lit library + directives
    (`repeat`, `classMap`, `ifDefined`). Components import from `/dist/lit.js`.

- **Game code (`js/`)** — **not bundled.** The game is plain ES modules with no
  npm dependencies. The browser handles a few dozen small files fine over HTTP/2,
  and keeping them unbundled means no build step during development — just edit
  and reload. Revisit if game code ever gains npm dependencies.

Run `make check` after any changes to state shapes, event payloads, or data types in `js/types.js`.

When you notice a command being run frequently during development, consider adding it as a named Makefile target so it's easy to discover and reuse.

## Architecture

### File Structure

```
index.html              — entry point, layout, loads dist/vendor.js + main.js
preview.html            — visual preview harness (effects, shapes, alerts — no game engine)
css/style.css           — all styles (cyberpunk vector phosphene aesthetic)
js/
  types.js              — JSDoc @typedef definitions (no runtime code)
  events.js             — pub/sub event bus + event type catalog (E.*)
  state.js              — re-export shim for state/ module
  state/
    index.js            — state object, initState, getState, mutate(), getVersion()
    node.js             — node state mutations (visibility, access, alert, probed, etc.)
    ice.js              — ICE state mutations (attention, detection, disturbance)
    alert.js            — global alert / trace state mutations
    player.js           — player state mutations (cash, hand, exploit execution)
    game.js             — game-level state mutations (selection, phase, cheating)
  main.js               — app init, action event wiring (@ts-nocheck)
  graph.js              — Cytoscape.js init and node style sync (@ts-nocheck)
  visual-renderer.js    — event→component property bridge (graph overlays + component sync)
  log-renderer.js       — subscribes to events, sets <starnet-log> entries
  console.js            — keyboard input, command dispatch, tab completion
  components/
    starnet-element.js  — LitElement base class (light DOM, no shadow DOM)
    starnet-log.js      — log pane
    starnet-hud.js      — header bar (alert, wallet, trace, buttons)
    starnet-context-menu.js — action menu overlay on graph
    starnet-mission-pane.js — mission briefing sidebar
    starnet-node-panel.js   — sidebar node detail (contains ice-timers)
    starnet-ice-timers.js   — timer display in sidebar
    starnet-hand.js     — exploit card hand
    starnet-end-screen.js   — game over overlay
    starnet-store.js    — darknet broker modal
    starnet-level-select.js — new run form
  exploits.js           — vulnerability types, exploit card generator
  combat.js             — exploit vs node resolution (probability + flavor)
  loot.js               — macguffin types and node assignment
  ice.js                — ICE AI movement, detection, dwell timer logic
  rng.js                — seeded PRNG (Mulberry32, named streams, helpers)
  timers.js             — centralized timer system (scheduleEvent, repeating)
  cheats.js             — playtesting cheat commands (lazy-loaded)
data/
  network.js            — static hand-crafted LAN network definition
docs/
  SPEC.md               — full game design document
  dev-sessions/         — session documentation (spec, plan, notes per session)
```

### State Management

All game state lives in `js/state/` as a single plain object. **The entire game
state MUST be fully encapsulated in this object so that the game can be
saved, loaded, and reconstituted at any instant.** No gameplay-relevant state
may live outside the state object (e.g. in module-level variables, DOM, or
closures). If serializing the state object and deserializing it doesn't
perfectly reproduce the game, that is a bug.

Rules:

- **All mutations go through `mutate()`** — the wrapper in `state/index.js` that
  increments a monotonic version counter. Submodule setters (e.g. `setNodeProbed`,
  `setGlobalAlert`) use `mutate()` internally.
- **No direct state mutation outside `js/state/`** — callers use the setter functions
  exported by submodules. `getState()` returns the raw object for reads, but writing
  to it directly is forbidden by convention.
- **`STATE_CHANGED` fires at cycle boundaries only** — at the end of `tick()` in
  `timers.js` and after `action.execute()` in `action-context.js`, gated by
  `getVersion()` before/after comparison. No scattered `emit()` calls.
- **State submodules are pure data** — they don't emit game events or contain
  orchestration logic. Event emission happens in the caller layer (ice.js, alert.js,
  combat.js, etc.).
- `visual-renderer.js` and `log-renderer.js` subscribe to `E.STATE_CHANGED` and typed game events
- User actions dispatch DOM custom events upward (e.g. `starnet:action:probe`) which `main.js` handles

**Canonical type definitions live in `js/types.js`.** The `GameState`, `NodeState`, `IceState`, `ExploitCard`, `Vulnerability`, `Macguffin`, and all event payload shapes are defined there as JSDoc `@typedef`s. Import them with:
```js
/** @typedef {import('./types.js').GameState} GameState */
```

## Game Loop

1. Player starts at gateway node (accessible); neighbors revealed as `???`
2. **Probe** a node → reveals vulnerabilities, raises local alert
3. **Xploit** → pick a card → resolve success/failure vs node grade + vuln match
4. On success: node access level rises (locked → open → owned)
5. **Dump** an open/owned node → reveals macguffins
6. **Fetch** from an owned node → collects macguffins, adds cash to wallet
7. **Corrupt** an IDS node → disables alert event forwarding to security monitor
8. Global alert rises as detection nodes fire events to security monitors
9. At TRACE: countdown begins (30–90s by threat grade) — jack out or lose your score

## Alert System (two sensors, one ladder)

Global alert (`green → yellow → red → trace`) is driven by two independent sensors that share
the same ladder and trace clock. It only escalates, never de-escalates (below trace), except
the deliberate cancel paths (own the monitor → `cancelTrace`; jack out). Both sensors live in
`js/core/alert.js` and call into the trace-countdown machinery there.

- **Security grid (passive).** On a *failed* exploit (the graph bridge's `ACTION_RESOLVED`
  handler, `XPLOIT` with `success:false` — routine probing does NOT trip the grid), the bridge
  broadcasts an `alert` message to every `ids` node. Each IDS relays it to its `security-monitor`
  via the `relay` operator — *unless corrupted* (`forwardingEnabled:false`, set by the
  `corrupt`/CORRUPT action). The monitor's `report` operator calls `recordMonitorAlert`,
  which accumulates per-monitor and climbs the ladder, starting the trace at a grade-scaled count
  (`MONITOR_TRACE_THRESHOLD`). Grid-wide sensing, subversion-scoped: corrupt an IDS to blind its
  monitor.
- **ICE (active).** `recordIceDetection` — detections climb the same ladder and start the trace
  at a grade-scaled count. Owned by the ICE subsystem.
- An ICE-less LAN relies entirely on the grid — its only failure clock.

Escalation lives in `recordMonitorAlert` / `recordIceDetection` (+ set-piece `startTrace`
alarms). There is no node-`alertState`-counting global recompute — that legacy layer was
retired in #173. (Node `alertState` is now purely the per-node visual alert glow.)

**Cooldown (grid-only, below-trace; #174).** The grid can be pushed back down via `coolGrid` in
`alert.js`: `scrubLogs(monitorId)` (a `scrub-logs` action on an open monitor — resets that
monitor's `alertCount`, eases the level one step) and `lieLow(wanNodeId)` (a timed `lie-low` action
on every WAN node via the shared `LIE_LOW_OPERATOR`/`LIE_LOW_ATTRS` — fully calms the grid to green,
limited to a couple of uses/run via `lieLowUsesRemaining`/`lieLowExhausted`). Both no-op at trace and
never touch ICE `detectionCount`. Emits `ALERT_COOLED`. Numbers are tuned by feel/playtest — the bot
doesn't use these levers, so census only confirms no-regression, not their value.

## Branching and Pull Requests

**Always start work in a git worktree.** This repo is frequently worked by multiple
agents/sessions at once that share the same checkout, so doing your work in an isolated
worktree (e.g. `.claude/worktrees/<slug>/`) is mandatory, not optional — it keeps a
parallel session from switching branches or resetting `main` out from under you (which
*has* happened: a mid-session branch tangle traced straight back to sharing the main
checkout). Create the worktree first, then create your branch inside it. If your harness
has a native worktree tool, use it; otherwise `git worktree add`.

**Never commit feature or bugfix work directly to `main`.** Whenever starting a new arc
of development or bugfixing — even a small one — create a branch first:

```bash
git checkout -b short-descriptive-slug
```

Work on the branch, then open a PR to merge it into `main`. Even if we end up merging
it ourselves at the end of a session, the PR gives us a clean record of what changed and
why. Derive the branch name from the session slug where possible.

The only commits that may land directly on `main` are pure documentation changes (like
this one) that don't touch game logic.

### Squash before merge

**Prefer squashing a PR's commits into one clean commit once review comments are
addressed, before merging.** The incremental "fix review comment" / "address feedback"
commits are useful while iterating, but they're noise in `main`'s history. After the
review is settled and the branch is green, collapse the branch into a single commit
(`git reset --soft $(git merge-base origin/main HEAD)` then recommit, or GitHub's
"Squash and merge") with a message that describes the change as shipped, not the path
it took to get there.

### Git commit messages

**Use single-quoted `-m` strings for commit messages**, not `$(cat <<EOF ...)`
heredocs. The `$()` command substitution triggers permission prompts in
sandboxed environments. For multi-line messages, use multiple `-m` flags:

```bash
git commit -m 'Short summary line' -m 'Longer body paragraph here.

Co-Authored-By: ...'
```

## Dev Sessions

> **Session directory override:** `docs/dev-sessions/` (not `.claude/dev-sessions/`)
> Session artifacts are tracked in git alongside source code.

Session docs live in `docs/dev-sessions/{timestamp}-{slug}/` with `spec.md`, `plan.md`, `notes.md`.

**Always commit session docs (spec + plan) before beginning execution.** This keeps the
planning artifacts in git history independent of the implementation commits, and gives a
clean restore point if execution needs to be abandoned mid-session.

Most recent session: `docs/dev-sessions/2026-02-27-1423-wan-node-darknet-store/` (WAN node + darknet broker store)

## Headless Playtest Harness

`scripts/playtest.js` is a single-command REPL for balance testing, bug reproduction, and regression checks — no browser required.

**Before spinning up Playwright or a browser, try the harness first.** It's faster and produces a clean transcript.

**`scripts/playtest.js` and `js/main.js` are parallel entry points.** They share the same timer wiring and action dispatcher (`buildActionContext` + `initActionDispatcher`). When changing either file's wiring, check the other. A regression in the harness may not surface in tests if `reset`/`tick`/`status` still work — those bypass `dispatch()` entirely.

### Usage

```bash
node scripts/playtest.js reset                         # fresh game, saves to scripts/playtest-state.json
node scripts/playtest.js "status"                      # print current state summary
node scripts/playtest.js "status full"                 # full state dump (network, hand, ICE, mission)
node scripts/playtest.js "target gateway"              # target a node
node scripts/playtest.js "probe"                       # probe targeted node
node scripts/playtest.js "xploit 2"                   # xploit with card #2 (targeted node)
node scripts/playtest.js "xploit ids-1 AuthBrute"    # explicit node + card
node scripts/playtest.js "tick 100"                    # advance 100 virtual ticks (10 real-seconds)
node scripts/playtest.js "actions"                     # list all valid actions with context
node scripts/playtest.js "jackout"                     # end run

# Named state files — start from a checkpoint, run parallel scenarios
node scripts/playtest.js --state /tmp/scenario.json reset
node scripts/playtest.js --state /tmp/scenario.json "probe gateway"

# JSON mode — structured output for scripts and LLMs
node scripts/playtest.js --json "status"              # { events, state, log }
node scripts/playtest.js --json "tick 50"             # captures all events during ticks
```

### How it works

- State persists in a JSON file between invocations (default: `scripts/playtest-state.json`)
- Each invocation: load state → run one command → print all events → save state → exit
- `tick N` advances the virtual clock by N ticks (1 tick = 100ms real-time); ICE moves, trace countdown ticks, reboots complete
- State is fully serializable: nodes, adjacency, ICE position, timers, player hand — everything
- Different LAN graphs produce different serialized states; the state file is self-contained (no network file reference needed)

### Status subcommands

```
status            — alias for "status summary"
status summary    — alert, ICE, selection, network counts, hand, mission
status full       — complete dump of all state
status ice        — ICE grade, position, detection count
status hand       — exploit cards with match indicator for selected node
status alert      — global alert level, trace countdown, security node list
status mission    — mission target, value, location, collected?
status node <id>  — single node detail
```

### Typical workflow

```bash
node scripts/playtest.js reset
node scripts/playtest.js "status full"
node scripts/playtest.js "target gateway"
node scripts/playtest.js "probe"
node scripts/playtest.js "actions"          # see what cards match
node scripts/playtest.js "xploit 4"        # use card #4
node scripts/playtest.js "status summary"
node scripts/playtest.js "tick 50"          # let ICE move
node scripts/playtest.js "status ice"
```

### Notes

- **Seeded RNG** — `js/rng.js` provides Mulberry32 PRNG with 5 named streams (exploit, combat, ice, loot, world). String seeds hashed via djb2. All gameplay randomness is deterministic for a given seed. Use `--seed "value"` for reproducible runs.
- `console.js` is DOM-coupled and not used by the harness; command dispatch is inline in `playtest.js`
- Cheat commands are not yet supported in the harness

---

## Bot Player and Census

`scripts/bot/cli.js` runs an automated game-playing agent for balance testing
(the bot logic lives across `scripts/bot/*.js`). `scripts/bot/census.js` runs it
across many seeds and produces LLM-readable reports. See `docs/BOT-PLAYER.md` for
full documentation.

**The bot (`scripts/bot/`, entry `scripts/bot/cli.js`), `scripts/playtest.js`, and
`js/main.js` are three parallel entry points** into the same game engine. All three
share timer wiring, action dispatch, and event handling. When changing game mechanics,
check all three.

**Keep the bot working when changing game mechanics.** The bot reads game state directly
(`accessLevel`, `visibility`, `vulnerabilities`, `macguffins`) and dispatches actions
via `emitEvent("starnet:action", ...)`. Changes that affect the bot:

- **New action types** → bot won't use them automatically, but shouldn't break. Consider
  whether the bot should learn the new action (add to strategy) or ignore it (note in
  `docs/BOT-PLAYER.md` "What the bot does NOT do").
- **Changed event names or payloads** → bot stat tracking may miss events. Check the
  `on(E.*)` handlers in `runBot()`.
- **New node types** → bot may skip or mishandle them. Check `pickNextNode()` and the
  `SECURITY_TYPES` / `LOOTABLE_TYPES` sets.
- **New timed actions** → need `tickUntilEvent` support and timer handler wiring in the
  one-time init block.
- **Timer handler changes** → the bot's init block must register the same handlers as
  `playtest.js`. If a new TIMER type is added, add it to both.

**Run `make census` after balance changes** to verify the difficulty curve hasn't
regressed. A quick smoke test: `make census SEEDS=10` (override grades with
`THREAT=` / `WEALTH=` / `COMPLEXITY=` / `DEPTH=`). There's no fixed pass threshold —
compare `successRate` / `traceFiredRate` against a same-seed run on `main` rather than
an absolute number.

---

## Player Manual

`MANUAL.md` is the player-facing documentation for the game and the **canonical reference
for intended game behavior.**

**Consult MANUAL.md before implementing any feature that touches existing mechanics.**
If the spec or plan conflicts with what the manual describes, surface the discrepancy
before writing code — not after.

**Update MANUAL.md as part of completing any feature**, not as an afterthought. Treat
it as a checklist item in the session retro: if a mechanic was added, changed, or removed,
the manual must reflect it before the session is considered done.

Specifically, update when:

- New node types → add to the node types table
- New actions → add to the node actions reference and console commands
- Changes to exploit card mechanics (decay, rarity, targeting) → update the Exploit Cards section
- Changes to alert system, ICE behavior, or trace mechanics → update those sections
- New game loop steps (missions, scoring, etc.) → update The Core Loop and related sections

The manual describes the game as it currently exists, not future plans.

**If the game behaves differently from what the manual describes, that is a bug** —
either in gameplay or in the manual. Both are worth filing and fixing.

---

## Testing Practices

- **Bugs found through playtesting must be reproduced with a failing test before being fixed.**
  Write the test first, confirm it fails due to the bug, apply the fix, then confirm the test passes.
  Integration tests live in `tests/integration.test.js`. Keep new test suites focused: describe the
  scenario, set up state directly, emit the triggering event, assert the outcome.

- **Always pass an explicit seed to `initGame()` in tests.** Without one, `initGame` seeds the
  RNG from `Math.random()`, so any roll a test does not force (via `_forceNext`) varies per run —
  silently flaky. A successful exploit *from a locked node* consumes three `RNG.COMBAT` rolls
  (success, flavor pick, skip-to-owned); forcing only the first two leaves the skip roll seeded.
  See the roll-consumption block in `js/core/combat.js` and issue #109.

### Node graph / set-piece test honesty

These rules exist because it's easy to write set-piece tests that pass while the circuit is
partially or completely broken. A test that sets intermediate state manually and then checks
it is set is not testing the circuit — it's testing that assignment works.

- **Trace the full signal path before calling a test honest.** Follow each input message through
  atoms → edges → receiving nodes → triggers → effects → ctx calls. If any link in that chain
  is absent or broken, the test may pass for the wrong reason.

- **Assert the observable consequence, not intermediate state.** Prefer checking
  `ctx.calls.setGlobalAlert?.length` over `alarm-flag.triggered === true`. An intermediate
  attribute can be set correctly even when the downstream circuit is broken.

- **No manual state resets between steps of the same scenario.** If you reset an atom attribute
  mid-test (e.g. `node.triggered = false`) to enable a second assertion, the trigger isn't
  cycling correctly — fix the atom/trigger, don't paper over it.

- **One-shot triggers on repeating behaviors are almost always bugs.** If a set-piece claims
  "fires every time X happens," the trigger must be `repeating: true` with an effect that resets
  the watch condition. A one-shot trigger fires exactly once, no matter how many times X happens.

- **Every node in a set-piece must be on an active signal path.** If a node's atoms produce no
  outputs reaching a trigger or external port, it is dead code — it looks like a puzzle element
  to the player but does nothing. Remove it or wire it up.

- **`destinations` override is internal-only.** Never use `config.destinations` to create a
  connection invisible to the player. All node-to-node relationships the player needs to reason
  about must appear as `internalEdges`.

---

## Design Principles

- **New visual effects must be added to the preview harness.** When adding an SVG overlay, node animation, or other graph-level visual effect, add a demo node and controls for it in `preview.html` / `js/ui/preview.js`. The harness lets us test and tune effects without playing through to the right game state.

- **Every visual game event must have a corresponding console log entry.** If the player can see something happen on the graph or HUD, there must be a matching textual record in the log. This is both an accessibility and a game-feel requirement — the log is the player's "decker readout" and should be a complete record of what the system is doing.

- **The console must be LLM-legible.** The log + command interface should be sufficient for an LLM to fully observe and play the game without access to the visual graph. This means: complete state inspectable via `status`, all game events logged as text, all actions issuable as console commands. This serves both automated playtesting and future AI-driven gameplay features.

- **GUI and console are symmetric input channels.** Clicking a button and typing its equivalent command must produce identical outcomes — same log entry, same history entry, same state change. The visual UI is an alternative way to issue commands, not a separate system. A player should be able to switch freely between mouse and keyboard mid-run without any difference in behavior or feedback.

## Design Aesthetic

- Dark background (`#0a0a0f`), glowing neon vector phosphene look
- Cyan nodes/borders, terminal-green text, magenta for selection, violet for deck integrity
- Alert states: green glow → yellow → red pulse
- Scanline overlay on graph panel (CSS `::after`)
- Monospace font throughout
- Vector visual effects are an active part of the aesthetic — graph degradation (health bloom, deck corruption) and HUD vital-sign waveforms have shipped. Specific effects still to come: screenshake, bloom, glitches on countermeasure hits.

### Rotation direction convention

Sweeping arcs and radial animations use direction to signal agency:

- **Clockwise** = player action (probe sweep, exploit brackets converging)
- **Counter-clockwise** = adversarial/system action (ICE detection closing in)

This is a soft convention, not enforced by code — but new animations should follow it.

### Retro vector display — no easy curves

The graph aesthetic is a retro vector CRT that can't comfortably draw curves.
New graphics use straight segments and polygons — e.g. a many-sided polygon whose
edges fade in, rather than an arc that sweeps closed; angular ideographs rather
than circles. Hostile/enemy elements use red (`#ff2a2a`) and magenta (`#ff00aa`).
Existing curved graphics may be re-vectored over time, but do it deliberately, one
effect at a time — not as a sweeping refactor. Geometry lives in pure, testable
modules (`js/ui/node-glyphs.js`, `js/ui/ice-glyphs.js`) consumed by both `graph.js`
and `preview.js`.

### Vector UI vocabulary — strokes, not fills or bitmap chrome

The display is a vector beam: it draws **outlines and strokes**, never filled regions
or raster textures. This governs HUD/UI chrome, not just the graph.

- **No fills.** Glyphs and indicators are stroke-only, lit by a phosphene glow
  (CSS `filter: drop-shadow`, or SVG drop-shadow). A solid filled shape reads as raster,
  not vector. Stroke + glow, not fill.
- **No bitmap / textmode idioms.** Banned because they clash with the beam: filled
  circles (`border-radius: 50%` "lamps"), block/dither meters (`█` / `░`), ordered-dither
  shading, solid filled glyphs. If you reach for one, reach for stroked geometry instead.
- **Indicators encode state in SHAPE, not color alone** (colorblind redundancy). The
  canonical status lamp escalates by *form*: **hexagon (green, safe) → point-up triangle
  (yellow, warning) → inverted triangle (red, danger)**, all stroked — legible with no
  color perception (hexagon vs triangle, then up vs down), and it borrows the universal
  warning-triangle iconography. Apply the same shape-channel thinking to any new indicator.
- **Magnitude meters** are stroked **tick ladders** or outlined segment bars — count is
  the colorblind-safe channel, with the green→amber→red ramp layered on top. Never `█/░`
  pips.
- Same discipline as the glyphs: indicator geometry lives in a pure, testable module and
  is consumed by both the live UI and `preview.js`.

When in doubt: would an oscilloscope or a vector arcade cabinet draw it that way? If it
needs a fill, a circle, or a dither, it's the wrong primitive.

### Glow / bloom — one owner per layer, never stacked

The phosphene glow is produced by three different rendering mechanisms (they can't be unified
into one — different pipelines), so the rule is **one owner per layer, and never two glows on
the same element**:

- **Graph canvas (`#cy`)** → the heavy `#starnet-bloom` SVG filter (3-pass merge), defined once in
  `graph.js` `ensureBloomFilter()`. It's suspended during pan/zoom and ramped back (re-rastering
  a full-screen filter every frame is expensive).
- **Graph overlays (`#overlay-layer > *`)** → the lighter single-pass `#overlay-bloom`, also in
  `ensureBloomFilter()`. Overlays animate every frame, so they must use the cheap filter — and an
  overlay element must **not** carry its own `filter="url(...)"` on top of the layer filter
  (stacking re-rasterizes two filters per frame; this caused real fps drops — see the
  `graph-perf` session).
- **HUD / DOM chrome** → CSS `--glow-sm/--glow-md/--glow-lg` (`style.css`) via `text-shadow` /
  `box-shadow`. Use these tokens, don't hand-roll blur radii.
- **Indicator glyphs** (`indicator-glyphs.js`) → the shared `glowDefs()` / `GLOW_BLUR` baked-in
  `feDropShadow`. One definition; don't re-specify the filter per glyph.
- **Canvas vitals** (`starnet-waveform.js`) → `ctx.shadowBlur`/`shadowColor`.

**Guardrails:** never apply a continuous `node.animate`/`cy.animate` loop or a heavy filter to an
element that animates every frame — drive perpetual visual effects off the cy model and off the
heavy bloom (overlays/canvas, cheap filter). New glow goes through one of the owners above, not a
fresh ad-hoc filter.

## What's Shipped (Current Build)

- Probe → Xploit → Dump → Fetch → Jack Out core loop
- Procedural network generation (skeleton → slot-filler → assemble) plus hand-crafted
  named networks and hand-authored set-piece puzzles (biomes)
- Node-graph runtime: nodes as composable atoms/operators/triggers driving reactive behavior
- Alert + trace system and ICE (multiple instances, grade-scaled behavior, detection/dwell)
- Darknet store, exploit card decay (use/disclosure), health/deck loss-clock pressure
- Headless playtest harness + automated bot + census for balance testing
- Reactive procedural music (Tone.js): two-axis (progress/threat) layered scores, 8 selectable
  Corporate variants, section-breakdown automation; see `docs/audio-direction.md`
- Synthesized event SFX (Tone.js): one-shot cues on game events, own always-available bus +
  on/off toggle, independent of music; see `docs/audio-direction.md`

## Out of Scope (Future)

- Missions / quest objectives (freeform macguffin hunting today)
- Sprites, daemons, machine elves
- Full player progression / persistent meta-loop between runs (overworld is early)
- Wider world (galaxy, planets, cities)
- Audio: vocal-texture / sample one-shots (music + event SFX have shipped; sample-based one-shots
  deferred — see the fast-follows in `docs/audio-direction.md`)

## Backlog

See `docs/BACKLOG.md` for the full deferred ideas inventory.
