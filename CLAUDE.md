# Starnet — CLAUDE.md

## Project Overview

Starnet is a cyberpunk nethacking game with an interplanetary setting. The immediate focus is a web-based HTML prototype of the core **LAN dungeon mechanic** — a network graph puzzle the player navigates by exploiting vulnerabilities, subverting security systems, and looting macguffins for cash.

See `docs/SPEC.md` for the full game design document.

## Tech Stack

- **Vanilla HTML/CSS/JS** — no framework, no build tooling
- **Cytoscape.js** (CDN) — network graph rendering and interaction
- ES modules via `<script type="module">`
- No bundler — open `index.html` directly via a local static server (e.g. `npx serve .`)

## Architecture

### File Structure

```
index.html          — entry point, layout, loads Cytoscape.js + main.js
css/style.css       — all styles (cyberpunk vector phosphene aesthetic)
js/
  main.js           — app init, event wiring, sidebar/HUD rendering
  state.js          — central game state + all mutation functions
  graph.js          — Cytoscape.js init and node style sync
  exploits.js       — vulnerability types, exploit card generator
  combat.js         — exploit vs node resolution (probability + flavor)
  loot.js           — macguffin types and node assignment
data/
  network.js        — static hand-crafted LAN network definition
docs/
  SPEC.md           — full game design document
  dev-sessions/     — session documentation (spec, plan, notes per session)
```

### State Management

All game state lives in `js/state.js` as a plain object. Rules:
- **Never mutate state directly** — always use exported functions
- After every mutation, `emit()` dispatches `starnet:statechange` on `document`
- Components/UI listen for `starnet:statechange` and re-render from `evt.detail`
- User actions dispatch custom events upward (e.g. `starnet:action:probe`) which `main.js` handles

State shape (top level):
```js
{
  nodes: { [id]: NodeState },   // per-node game state
  adjacency: { [id]: [id] },    // neighbor lookup
  player: { cash, hand },       // player wallet + exploit cards
  globalAlert,                  // 'green' | 'yellow' | 'red' | 'trace'
  traceSecondsRemaining,        // null or countdown integer
  selectedNodeId,
  phase,                        // 'playing' | 'ended'
  runOutcome,                   // 'success' | 'caught'
  log,                          // recent action messages
}
```

### Node State Shape

```js
{
  id, type, label, grade,
  visibility,           // 'hidden' | 'revealed' | 'accessible'
  accessLevel,          // 'locked' | 'compromised' | 'owned'
  alertState,           // 'green' | 'yellow' | 'red'
  probed,               // bool — vulnerabilities revealed
  read,                 // bool — contents scanned
  looted,               // bool — macguffins collected
  vulnerabilities,      // [{id, name, rarity, patched}]
  macguffins,           // [{id, name, cashValue, collected}]
  eventForwardingDisabled, // bool — IDS subverted
}
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

## Dev Sessions

Session docs live in `docs/dev-sessions/{timestamp}-{slug}/` with `spec.md`, `plan.md`, `notes.md`.

Note: this project uses `docs/dev-sessions/` (not `.claude/dev-sessions/`) so session artifacts are tracked in git alongside the source.

Current session: `docs/dev-sessions/2026-02-24-1615-lan-dungeon-prototype-2/`

## Design Principles

- **Every visual game event must have a corresponding console log entry.** If the player can see something happen on the graph or HUD, there must be a matching textual record in the log. This is both an accessibility and a game-feel requirement — the log is the player's "decker readout" and should be a complete record of what the system is doing.

- **The console must be LLM-legible.** The log + command interface should be sufficient for an LLM to fully observe and play the game without access to the visual graph. This means: complete state inspectable via `status`, all game events logged as text, all actions issuable as console commands. This serves both automated playtesting and future AI-driven gameplay features.

## Design Aesthetic

- Dark background (`#0a0a0f`), glowing neon vector phosphene look
- Cyan nodes/borders, terminal-green text, magenta for selection
- Alert states: green glow → yellow → red pulse
- Scanline overlay on graph panel (CSS `::after`)
- Monospace font throughout
- Planned (future): screenshake, bloom, vector glitches on countermeasure hits

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
