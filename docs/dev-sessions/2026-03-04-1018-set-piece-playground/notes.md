# Session Notes: Set-Piece Playground & Playthrough Harness

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
