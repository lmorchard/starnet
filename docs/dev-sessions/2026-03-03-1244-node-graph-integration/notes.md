# Session Notes: Node Graph Integration

## Session Retro

### Summary

Integrated the reactive node graph runtime as the authoritative source of node
state and behavior in the game engine. This is essentially a 2.0 redesign —
the old node-type registry, behavior atom system, procgen, and static network
were all replaced by NodeDef-based definitions with operators, actions,
triggers, and set-piece circuits. The game runs on NodeGraph end-to-end.

**63 commits, 86 files changed, +10,763 / -4,342 lines.**

### Key Actions

**Planned phases (1-10) — all completed:**
1. Runtime extensions (setNodeAttr, init, onEvent, $nodeId placeholder)
2. Game node type factories (8 types + shared action templates)
3. Strawman networks (3 hand-crafted from set-pieces + 2 new filler set-pieces)
4. CtxInterface bridge (real game callbacks)
5. initGame() with bidirectional state sync + tick wiring
6. Action dispatch through NodeGraph (old NODE_ACTIONS deleted)
7. Event-driven renderer (NODE_STATE_CHANGED subscriptions)
8. Save/load with graph snapshot round-trip
9. Playtest harness --network flag
10. Cleanup — deleted initState, node-types.js, procgen, bot scripts, static network

**Beyond-plan work:**
- Graph message bridge (probe-noise, alert, exploit → graph messages)
- Dynamic Cytoscape node addition (nodes added when disclosed, not at init)
- ICE as HTML overlay (not a Cytoscape node)
- Incremental layout with locked existing nodes
- createGameNode composition system (replaced enrichWithGameActions)
- Dynamic console commands per node selection
- Full test rewrite with purpose-built minimal LAN fixtures
- Set-piece bug fixes (deadman heartbeat source, encrypted vault timing)
- Multiple balance tuning passes on set-piece tick periods

### Divergences from Plan

1. **Cytoscape rendering** was not anticipated as a major challenge. The
   `display: none` nodes + cola layout bounding box crash consumed significant
   time. The solution (dynamic node addition) was a better architecture than
   the plan's approach of hiding nodes with CSS.

2. **ICE rendering** required three iterations: Cytoscape polygon node (crashed),
   Cytoscape diamond node (layout island), HTML overlay (correct). The plan
   didn't address ICE at all.

3. **Action refactor** was flagged by Les as in-scope mid-session. The plan had
   it as Phase 10 cleanup but it became a first-class refactor: old NODE_ACTIONS
   deleted, all actions route through graph, createGameNode replaces
   enrichWithGameActions.

4. **Test rewrite** was much larger than expected. Every integration test needed
   purpose-built LAN fixtures instead of depending on the old static network
   topology. This was the right call — tests are now self-contained.

5. **Set-piece timing** was not in the plan but emerged from playtesting. The
   deadman circuit needed a heartbeat source, and all tick periods needed
   real-world-playable values.

### Insights & Lessons

- **Bidirectional state sync was the key architectural decision.** The bridge
  between NodeGraph attributes and state.nodes let us migrate incrementally
  without a big-bang rewrite. Each subsystem could move to graph reads at its
  own pace.

- **Cytoscape is for topology only.** Trying to use it for entity rendering
  (ICE) and UI overlays doesn't work with dynamic graphs. HTML overlays
  positioned via renderedPosition() are the right pattern.

- **Set-piece circuits work as designed** when properly wired. The IDS relay
  chain, nth alarm, and probe burst alarm all fired correctly through the
  graph bridge with no circuit-level bugs. The runtime built in the previous
  session proved solid.

- **Test fixtures beat shared networks.** Purpose-built minimal LANs using
  the type factories are faster, clearer, and don't break when network
  topology changes. Every test should construct exactly what it needs.

- **Les's push against backward-compat hedging was right.** Every try/catch
  wrapper and legacy fallback I added was eventually replaced by the proper
  fix. Going direct saved time overall.

- **Surprisingly few integration bugs** for a 2.0 redesign. The node-graph
  runtime's clean separation (headless, no DOM, pure functions) made it
  composable with the existing game systems without deep entanglement.

### Follow-Up Work Identified

**Architecture (next sessions):**
- Composable traits system (hackable, lootable, detectable, relay, etc.)
- Unified timed action system (all actions take time, generic progress animation)
- Migrate core mechanics into node-graph (loot/macguffins, combat/exploit
  resolution, probe, read)
- Grade-scaled timing for set-piece tick periods
- WAN commands as node-specific actions (not global)

**Polish:**
- Set-piece timing/difficulty tuning sweep
- Gate-access tests for graph subsections
- MANUAL.md update
- Bot player rebuild for new system
- ICE visual refinement (the HTML overlay works but could look better)

### Stats

- **Commits:** 63 (34 this session specifically for integration, rest from
  prior node-graph runtime sessions on the same branch)
- **Tests:** 492 passing, 0 failures
- **Lines:** +10,763 / -4,342 net across 86 files
- **Deleted:** ~3,244 lines of old systems (initState, node-types, procgen,
  bot scripts, static network)
- **New files:** game-types.js, game-ctx.js, graph-bridge.js, dynamic-actions.js,
  3 network definitions, 2 new set-pieces, playtest-graph.js
- **Conversation turns:** ~200+ (extremely long session)
- **Biggest time sinks:** Cytoscape rendering/layout issues (~20% of session),
  test migration and fixture rewrite (~15%), ICE rendering iterations (~10%)

### Process Observations

- **Parallel agents** worked well for the test migration — launched a background
  agent to rewrite 10 test files while continuing other work. Saved ~10 minutes.

- **Playwright MCP playtesting** was invaluable for catching rendering bugs that
  headless tests couldn't. The select → probe → wait → screenshot cycle found
  real issues (missing edges, ICE positioning, layout glitches).

- **Incremental commits** (one per fix) made it easy to track what changed and
  roll back if needed. The 63-commit history is a clean record.

- **Les's real-time feedback** during browser playtesting drove several important
  fixes that wouldn't have surfaced from automated tests alone (ICE animation
  on pan, edge visibility, layout jarring, trace HUD persistence).
