# Notes: LAN Dungeon Prototype

_Session: 2026-02-24-1503-lan-dungeon-prototype_

## Session Log

### Brainstorm Phase

Started with Les's `docs/SPEC.md` brain dump covering wide worldbuilding ideas (solar system exploration, factions, galactic economies). Agreed to scope down to a smaller, focused prototype: a single LAN dungeon focused on network intrusion heist mechanics. This let us validate the core loop before tackling the broader game.

Q&A surfaced the key design decisions:

- **Genre framing**: Heist/puzzle/race hybrid, starting with heist feel
- **UI pattern**: Graph view with progressive node revelation; selecting a node opens a detail/action panel
- **Alert system**: Two-layer — per-node alert states + global dungeon security level managed by IDS/security-monitor nodes
- **Exploit mechanics**: Card-based inventory with rarity tiers (common/uncommon/rare), matched against vulnerability grades (S-F) and types; chance-based resolution
- **Exploit decay**: Cards degrade through use (usesRemaining) and disclosure risk
- **Loot**: Macguffins as cash-value items; voluntary jack-out to convert to score
- **Tech stack**: Vanilla JS + Cytoscape.js, no bundler, no framework
- **Aesthetic**: Cyberpunk neon vector phosphene — phosphor green on black, cyan accents, magenta highlights, scanline overlay

Referenced two prior sketches on GitHub for inspiration:
- A bitecs + pixi.js + springy.js network graph prototype (ECS architecture, progressive revelation)
- A hack combat prototype (S-F grading system, rarity tiers, disclosure mechanics)

These informed the design but we started clean.

### Plan Phase

10-phase plan. Notable note added: Web Components as a potential architecture direction for future sessions, but plain DOM rendering used for this prototype to keep scope tight.

Phases:
1. Project scaffold + Cytoscape.js graph
2. Node visibility/state system (state.js)
3. Node detail panel (sidebar)
4. Exploit card data + hand display
5. Action menu + Probe action
6. Exploit combat resolution
7. Alert propagation
8. Macguffins + looting
9. Jack out + end screen
10. Aesthetic polish + CLAUDE.md

### Execute Phase

Phases executed roughly in order with two deliberate merges:
- Phases 2+3 done together (state and detail panel were too tightly coupled to separate)
- Phases 7+9 done together (endRun and trace countdown emerged naturally from alert work)

Post-phase polish:
- Font bumped 13px → 15px → 17px (two rounds, Les found it hard to read)
- Sidebar widened 320px → 360px → 400px
- Log separated out of sidebar into a dedicated horizontal pane below the graph (cleaner visual separation, better use of space)
- CLAUDE.md created with project architecture docs

## Retrospective

### What Went Well

**Scope discipline held.** Starting with a static 10-node LAN was the right call. Kept implementation focused and meant we had a playable prototype by the end rather than half a feature.

**Plan phases were appropriately granular.** Each phase had a clear deliverable. The two merges (2+3, 7+9) were sensible judgment calls, not scope creep.

**Event-driven state pattern worked cleanly.** Centralizing all mutations in `state.js` with `starnet:statechange` dispatches kept rendering logic out of game logic. The sidebar and HUD re-rendered off the same event without coordination overhead.

**Aesthetic came together fast.** The CSS custom property palette (cyan/green/magenta on near-black) plus scanline overlay and text-shadow glows gave the phosphene feel without much effort. Cytoscape styling stayed coherent with the overall theme.

**Old sketches were useful references.** The prior GitHub prototypes provided validated design patterns (grade system, rarity tiers, disclosure) without locking us into their architecture choices.

### Divergences from Plan

- **Web Components**: Noted as a potential architecture but not implemented. Plain DOM rendering was the right call for prototype speed. Worth revisiting if the sidebar grows complex.
- **Procedural network generation**: Plan noted it as a stretch goal; we used a static 10-node network instead. Correct call for prototype — proved the UI mechanics without requiring generation.
- **Phases 2+3 merged**: State and detail panel couldn't be cleanly separated at implementation time. Not a problem.
- **Phases 7+9 merged**: Alert system and endRun were functionally entangled; merging was the obvious move.

### Technical Insights

**Cytoscape.js quirks discovered:**
- `shadow-*` style properties not supported in 3.30.2 — removed them; border color changes convey alert state adequately
- `:not(.hidden)` selector syntax invalid in Cytoscape — changed to `.accessible, .revealed` for `cy.fit()` calls
- Mouse click coordinates never triggered `cy.on('tap')` via Playwright — Cytoscape canvas is opaque to synthetic mouse events; workaround was `node.emit('tap')` via `page.evaluate()`. Real user mouse clicks work fine.

**`window._cy` and `window._starnetState` exposure** was valuable for both Playwright testing and browser-console debugging. Worth keeping in development builds.

**Log pane separation** was a good UI call. The sidebar is for node context; the log is a stream. Treating them as separate UI zones felt more natural after the change.

### What to Improve

- **Playwright test reliability**: The `node.emit('tap')` workaround is workable but fragile. Worth documenting it in CLAUDE.md so it doesn't get rediscovered.
- **Commit message clarity**: Some phases had terse messages. Adding a brief description of what changed would help archaeology.
- **Font sizing should have been set earlier**: Two rounds of bumping suggests the initial target was too low. Should default to larger for terminal-style UIs.

### Efficiency

9 commits across a full working prototype from zero — spec, plan, scaffold, 10 phases, UI polish. Conversation turns were dense but productive. No major dead ends or rework except the font sizing iterations.

### Ideas for Next Session

- **Interactive console**: Les mentioned making the log pane an interactive terminal from which keyboard commands can be issued. Strong idea — would reinforce the CLI/hacker aesthetic and open up a command vocabulary.
- **Procedural network generation**: Random LAN topologies with seeded RNG for reproducibility (roguelike runs)
- **Visual effects**: Screenshake on jack-out, bloom/glitch on trace countdown, node flash on exploit success
- **Deeper exploit mechanics**: Chaining exploits, privilege escalation requiring sequential steps, countermeasures
- **Web Components refactor**: If sidebar complexity grows, component-ize it for cleaner state→render boundaries

## Final Summary

Full playable LAN dungeon prototype built in one session. Core loop works: explore the network graph, probe nodes, exploit vulnerabilities with your card hand, loot macguffins, jack out before trace completes. Alert system propagates through IDS → security monitor → global level. Two-layer alert drives the tension. Aesthetic is cohesive and legible.

Stack: vanilla HTML/CSS/JS + Cytoscape.js, no bundler, no framework, works as a static file served from disk.

9 commits. Clean foundation for next session.
