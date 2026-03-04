# Session Notes: Set-Piece Playground & Playthrough Harness

## Session Retro

### Summary

Built a browser-based interactive playground for inspecting, debugging, and
playtesting node graph circuits in isolation. Extended the playtest harness
with set-piece and ad-hoc JSON modes. Clean, fast session — all 7 phases
completed with no regressions.

**6 commits, 10 files changed, +1,640 / -7 lines.**

### Key Actions

1. Mini-network builder (shared module for wrapping set-pieces in playable micro-networks)
2. playground.html with full game init, Cytoscape rendering, console
3. 9 debug commands (inject, set, inspect, triggers, messages, qualities, graph, nodes, edges)
4. Inspector panel + JSON viewer
5. Message propagation highlights + trace logging
6. playtest.js --piece and --graph flags
7. Fix: dynamic action discovery after state restore

### Divergences from Plan

- **Phases 2-3 and 5 merged.** The playground page, game init, console, inspector, and
  JSON viewer all landed in one pass. The natural unit of work was "page that works"
  rather than "page that renders" → "page that has a console" → "page that has an
  inspector."

- **Phase 5 (inspector) was already done** in the Phase 2+3 implementation. The
  inspector was built into main.js from the start since it was a natural part of
  the layout.

### Insights & Lessons

- **Reusing game systems worked well.** The playground imports initGraph, initConsole,
  initVisualRenderer, initLogRenderer, buildActionContext, initActionDispatcher directly.
  No duplication — just a different init sequence. The modular architecture from previous
  sessions paid off.

- **Dynamic action discovery has a state-restore gap.** When playtest.js loads saved
  state, dynamic commands (probe, read, loot, etc.) aren't registered because no
  STATE_CHANGED event fires. Fix: emit STATE_CHANGED after deserializeState. This is
  a pre-existing issue surfaced by the --piece flag.

- **The visual-renderer expects DOM stubs.** The playground needs hidden stub elements
  (#jack-out-btn) for visual-renderer compat. A future cleanup could make the renderer
  more defensive about missing elements.

- **SVG overlays needed for game rendering compat.** The playground includes all the
  same SVG overlay elements as the game page (probe sweep, exploit brackets, etc.)
  so visual-renderer.js works unchanged. This is code reuse via HTML duplication —
  could be extracted into a shared template fragment.

### Stats

- **Commits:** 6
- **Tests:** 505 passing (8 new mini-network tests)
- **Lines:** +1,640 / -7 net across 10 files
- **New files:** playground.html, css/playground.css, js/playground/main.js,
  js/playground/debug-commands.js, js/core/node-graph/mini-network.js,
  js/core/node-graph/mini-network.test.js
- **Conversation turns:** ~30

### Process Observations

- **Fast session.** Planning was light (the spec and plan were written quickly because
  the scope was well-defined). Execution was mostly writing new code with minimal
  conflicts with existing code — the playground is additive, not a refactor.

- **Playwright browser testing** validated the playground immediately. Could see the
  graph render, type commands, verify inspector output — all without leaving the
  development flow.

---

## Phase-by-Phase Notes

## Phase 1: Mini-Network Builder ✓

- Created `js/core/node-graph/mini-network.js` with buildMiniNetwork, buildSetPieceMiniNetwork, listSetPieces
- buildMiniNetwork wraps raw NodeGraphDef with gateway + WAN + createGameNode
- buildSetPieceMiniNetwork instantiates a named set-piece, wraps nodes, connects gateway to external ports
- All 15 set-pieces wrap successfully without error
- 8 unit tests, all 505 tests pass

## Phase 2+3: Playground Page + Game Init ✓

- Created playground.html with toolbar (source dropdown, tick controls, toggles),
  graph panel, message log, game log + console, inspector, JSON viewer, hand strip
- Created css/playground.css for playground-specific styles
- Created js/playground/main.js — full game init with Cytoscape, console, action
  dispatcher, timers, graph bridge, dynamic actions, visual renderer
- Dropdown populates from listSetPieces() + network registry
- Inspector panel shows selected node's full state, operators, actions
- Message trace log wired to NODE_STATE_CHANGED and MESSAGE_PROPAGATED events
- JSON inspector with refresh button
- Tick controls (×1, ×10, ×100, auto, pause)
- Toggle checkboxes for messages, internal state, hidden attrs
- All game actions work (select, probe, exploit, etc.)
- URL params: ?piece=, ?network=, ?file=
- Browser-tested: idsRelayChain loads, gateway selectable, inspector works

## Phase 4: Debug Commands ✓

- Created js/playground/debug-commands.js with inject, set, inspect, triggers,
  messages, qualities, graph, nodes, edges commands
- Value parsing for set command (bool, number, null, string)
- Browser-tested: nodes, triggers, set, inject all work correctly

## Phase 6: Dev Overlay Toggles ✓

- Toggle checkboxes wired in Phase 2 (messages, internal state, hidden attrs)
- Added message propagation highlights (flashNode on message delivery)
- Added ACTION_RESOLVED logging in message trace
- Filter init/tick noise from trace

## Phase 7: playtest.js Extensions ✓

- Added --piece and --graph flags to playtest.js
- --piece wraps named set-piece via buildSetPieceMiniNetwork
- --graph loads JSON file via buildMiniNetwork
- Fixed dynamic action discovery after state restore (emit STATE_CHANGED)
- Tested: `node scripts/playtest.js --piece idsRelayChain reset` → 4 nodes, probe works
- All 505 tests pass
