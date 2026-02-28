# Starnet — CLAUDE.md

## Project Overview

Starnet is a cyberpunk nethacking game with an interplanetary setting. The immediate focus is a web-based HTML prototype of the core **LAN dungeon mechanic** — a network graph puzzle the player navigates by exploiting vulnerabilities, subverting security systems, and looting macguffins for cash.

See `docs/SPEC.md` for the full game design document.

## Tech Stack

- **Vanilla HTML/CSS/JS** — no framework, no build tooling
- **Cytoscape.js** (CDN) — network graph rendering and interaction
- ES modules via `<script type="module">`
- No bundler — open `index.html` directly via a local static server
- **JSDoc `@ts-check`** — type annotations without a build step; see `js/types.js`

## Makefile

```
make serve   — start local dev server at http://localhost:3000
make lint    — run tsc type checker (JSDoc annotations, no emit)
make test    — run unit + integration tests
make check   — lint + test (run both)
```

Run `make check` after any changes to state shapes, event payloads, or data types in `js/types.js`.

When you notice a command being run frequently during development, consider adding it as a named Makefile target so it's easy to discover and reuse.

## Architecture

### File Structure

```
index.html              — entry point, layout, loads Cytoscape.js + main.js
css/style.css           — all styles (cyberpunk vector phosphene aesthetic)
js/
  types.js              — JSDoc @typedef definitions (no runtime code)
  events.js             — pub/sub event bus + event type catalog (E.*)
  state.js              — central game state + all mutation functions
  main.js               — app init, action event wiring (@ts-nocheck)
  graph.js              — Cytoscape.js init and node style sync (@ts-nocheck)
  visual-renderer.js    — subscribes to events, drives graph + HUD rendering
  log-renderer.js       — subscribes to events, owns log buffer + pane
  console.js            — keyboard input, command dispatch, tab completion
  exploits.js           — vulnerability types, exploit card generator
  combat.js             — exploit vs node resolution (probability + flavor)
  loot.js               — macguffin types and node assignment
  ice.js                — ICE AI movement, detection, dwell timer logic
  timers.js             — centralized timer system (scheduleEvent, repeating)
  cheats.js             — playtesting cheat commands (lazy-loaded)
data/
  network.js            — static hand-crafted LAN network definition
docs/
  SPEC.md               — full game design document
  dev-sessions/         — session documentation (spec, plan, notes per session)
```

### State Management

All game state lives in `js/state.js` as a plain object. Rules:
- **Never mutate state directly** — always use exported functions
- After every mutation, `emit()` calls `emitEvent(E.STATE_CHANGED, state)`
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

- **Seeded RNG not yet implemented** — `Math.random()` is used in combat, exploits, and ICE; runs are probabilistic and not fully reproducible from a saved state. Seeded RNG is a future backlog item.
- `console.js` is DOM-coupled and not used by the harness; command dispatch is inline in `playtest.js`
- Cheat commands are not yet supported in the harness

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
