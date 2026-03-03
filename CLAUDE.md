# Starnet — CLAUDE.md

## Project Overview

Starnet is a cyberpunk nethacking game with an interplanetary setting. The immediate focus is a web-based HTML prototype of the core **LAN dungeon mechanic** — a network graph puzzle the player navigates by exploiting vulnerabilities, subverting security systems, and looting macguffins for cash.

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
```

**`dist/vendor.js` must be built before opening the game in a browser.** It is
gitignored (build artifact). Run `make bundle-vendor` after cloning or after
updating vendor dependencies in `package.json`.

The GitHub Pages deploy workflow runs `make bundle-vendor` automatically.

### Bundling philosophy

- **Vendor code (`js/vendor.js` → `dist/vendor.js`)** — bundled with esbuild.
  Cytoscape and its layout extensions are npm packages loaded as a single IIFE
  that sets `window.cytoscape`. Bundling eliminates CDN round-trips, pins
  versions, and reduces requests from 13 to 1.

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
  visual-renderer.js    — subscribes to events, drives graph + HUD rendering
  log-renderer.js       — subscribes to events, owns log buffer + pane
  console.js            — keyboard input, command dispatch, tab completion
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
3. **Exploit** → pick a card → resolve success/failure vs node grade + vuln match
4. On success: node access level rises (locked → compromised → owned)
5. **Read** a compromised/owned node → reveals macguffins
6. **Loot** an owned node → collects macguffins, adds cash to wallet
7. **Reconfigure** an IDS node → disables alert event forwarding to security monitor
8. Global alert rises as detection nodes fire events to security monitors
9. At TRACE: 60-second countdown begins — jack out or lose your score

## Alert System (Two-Layer)

- **Detection nodes** (type: `ids`): raise alert on exploit failures, propagate events to connected security monitors
- **Security monitors** (type: `security-monitor`): aggregate detection events, drive global alert
- **Global alert** recomputes from monitor/detector states; only escalates, never de-escalates
- Subverting an IDS (`eventForwardingDisabled: true`) severs the chain

## Branching and Pull Requests

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
node scripts/playtest.js "select gateway"              # select a node
node scripts/playtest.js "probe"                       # probe selected node
node scripts/playtest.js "exploit 2"                   # exploit with card #2 (selected node)
node scripts/playtest.js "exploit ids-1 AuthBrute"    # explicit node + card
node scripts/playtest.js "tick 100"                    # advance 100 virtual ticks (10 real-seconds)
node scripts/playtest.js "actions"                     # list all valid actions with context
node scripts/playtest.js "jackout"                     # end run

# Named state files — start from a checkpoint, run parallel scenarios
node scripts/playtest.js --state /tmp/scenario.json reset
node scripts/playtest.js --state /tmp/scenario.json "probe gateway"
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
node scripts/playtest.js "select gateway"
node scripts/playtest.js "probe"
node scripts/playtest.js "actions"          # see what cards match
node scripts/playtest.js "exploit 4"        # use card #4
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

`scripts/bot-player.js` is an automated game-playing agent for balance testing.
`scripts/bot-census.js` runs it across many seeds and produces LLM-readable reports.
See `docs/BOT-PLAYER.md` for full documentation.

**`scripts/bot-player.js`, `scripts/playtest.js`, and `js/main.js` are three parallel
entry points** into the same game engine. All three share timer wiring, action dispatch,
and event handling. When changing game mechanics, check all three.

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

**Run `make bot-census` after balance changes** to verify the difficulty curve hasn't
regressed. A quick smoke test: `node scripts/bot-census.js --time F --money F --seeds 10`
should show ~80% success.

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

- **Every visual game event must have a corresponding console log entry.** If the player can see something happen on the graph or HUD, there must be a matching textual record in the log. This is both an accessibility and a game-feel requirement — the log is the player's "decker readout" and should be a complete record of what the system is doing.

- **The console must be LLM-legible.** The log + command interface should be sufficient for an LLM to fully observe and play the game without access to the visual graph. This means: complete state inspectable via `status`, all game events logged as text, all actions issuable as console commands. This serves both automated playtesting and future AI-driven gameplay features.

- **GUI and console are symmetric input channels.** Clicking a button and typing its equivalent command must produce identical outcomes — same log entry, same history entry, same state change. The visual UI is an alternative way to issue commands, not a separate system. A player should be able to switch freely between mouse and keyboard mid-run without any difference in behavior or feedback.

## Design Aesthetic

- Dark background (`#0a0a0f`), glowing neon vector phosphene look
- Cyan nodes/borders, terminal-green text, magenta for selection
- Alert states: green glow → yellow → red pulse
- Scanline overlay on graph panel (CSS `::after`)
- Monospace font throughout
- Planned (future): screenshake, bloom, vector glitches on countermeasure hits

### Rotation direction convention

Sweeping arcs and radial animations use direction to signal agency:

- **Clockwise** = player action (probe sweep, exploit brackets converging)
- **Counter-clockwise** = adversarial/system action (ICE detection closing in)

This is a soft convention, not enforced by code — but new animations should follow it.

## What's In Scope (Current Prototype)

- Single static LAN dungeon, hand-crafted
- Freeform macguffin hunting (no mission objectives)
- Probe → Exploit → Read → Loot → Jack Out loop
- Two-layer alert system with IDS subversion puzzle
- Exploit card decay (use/disclosure)

## Out of Scope (Future)

- Procedural network generation
- Missions / quest objectives
- Sprites, daemons, machine elves
- Player progression between runs
- Wider world (galaxy, planets, cities)
- Visual effects (screenshake, bloom, glitches)
- Audio

## Backlog

See `docs/BACKLOG.md` for the full deferred ideas inventory.
