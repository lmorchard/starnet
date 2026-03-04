# Session Notes: Node Graph Integration

## Summary

Integrated the reactive node graph runtime as the authoritative source of node
behavior in the game engine. The old node-type registry + behavior atom system
is largely replaced by NodeDef-based node definitions with operators, actions,
triggers, and set-piece circuits.

## What Was Built

### Core Integration (Phases 1-6)
- **Runtime extensions**: `setNodeAttr()`, `init()`, `onEvent` callback, `$nodeId` placeholder, `getNode()`/`getNodeIds()`/`getEdges()` convenience API
- **Game node type factories**: 8 types (gateway, router, ids, security-monitor, fileserver, cryptovault, firewall, wan) with shared action templates (probe, exploit, read, loot, cancel-*, eject, reboot)
- **Strawman networks**: 3 hand-crafted networks from set-pieces (corporate-foothold, research-station, corporate-exchange)
- **CtxInterface bridge**: Real game callbacks wired to NodeGraph ctx
- **initGame()**: NodeGraph-based game initialization with bidirectional state sync
- **Action dispatch**: All node actions route through NodeGraph — old NODE_ACTIONS array deleted

### Additional Set-Pieces
- `serverBank` — cluster of lootable fileservers
- `officeCluster` — workstations + fileserver, exploration filler

### Browser Integration (Phase 7-11)
- **Event-driven renderer**: NODE_STATE_CHANGED subscriptions for targeted updates
- **Save/load**: Graph snapshot round-trips correctly
- **Playtest harness**: `--network` flag for headless testing
- **Graph message bridge**: Translates NODE_PROBED/NODE_ALERT_RAISED/EXPLOIT events into graph messages so set-piece circuits fire
- **Layout fixes**: Deferred layout, visible-only layout to avoid Cytoscape bounding box crash with display:none nodes

### Cleanup
- Removed node-types.js dependency from alert, combat, probe, lifecycle, console
- alert.js uses direct type checks (DETECTOR_TYPES, MONITOR_TYPES sets)
- node-lifecycle.js uses direct type checks for onOwned hooks
- main.js uses initGame with graph networks by default
- Old NODE_ACTIONS array and getNodeActions() deleted entirely

## What Works (Verified in Browser)
- Full game loop: select → probe → exploit → read → loot → jackout
- IDS relay chain circuit: probe IDS → alert propagates to monitor → global alert YELLOW
- Nth alarm circuit: 3 probes near sensor → counter reaches threshold → TRACE INITIATED
- Graph layout with incremental node reveal (breadthfirst)
- Card sorting, vulnerability display, alert escalation
- Set-piece circuits running in background (clocks, watchdogs)
- Cheat commands work with graph nodes
- WAN node + darknet store on all networks
- Save/load preserves graph state

## Known Issues / Follow-up Work

### Must Fix
- **ICE visual**: Diamond shape is a workaround — polygon SVG crashes Cytoscape render loop. Need to investigate the hasMiterBounds bug
- **Action refactor incomplete**: Les wants ALL actions to be NodeDef actions natively, removing the wrapper layer. Probe/exploit/read/loot are currently NodeDef actions that call ctx methods, but the exploit special case (exploitId payload) is handled in the wrapper
- **Bot player broken**: Uses old procgen/initState — needs migration to initGame
- **Old procgen/node-types files not deleted**: Still imported by legacy initState used by some tests

### Should Fix
- Probe-noise bridge sends to neighbors, not the probed node itself — check if set-pieces need the message at the probed node too
- No "reconfigure" action appears in browser UI for IDS nodes (need to verify enrichWithGameActions includes it)
- Old integration tests still use initState — should migrate to initGame

### Design Decisions Made
- `createGameNode()` composes set-piece nodes with game-type factories — replaces `enrichWithGameActions()`
- `initState()` deleted — all init goes through `initGame()`
- Gateway gateAccess is "probed" (reveals neighbors on probe), router is "compromised" (reveals on exploit)
- All networks include a WAN node for darknet store access
- ICE rendered as HTML overlay, not a Cytoscape node
- Cytoscape reserved for topology (nodes + edges); all entity/UI overlays are HTML
- Nodes added to Cytoscape dynamically when disclosed, spawning near parent
- Incremental layout: new nodes settle via cola with existing nodes locked

### Follow-Up: Composable Traits System

The current node-graph uses operators for reactive message processing but lacks a
clean composition model for game behaviors. A **traits system** would let common
behaviors be attached to any node declaratively:

- `lootable(config)` — adds loot actions, macguffin storage, lootCount config
- `detectable` — adds alert propagation to security monitors
- `relay(filter?)` — adds message forwarding (already an operator, but could be a trait)
- `qualityGated(name, threshold)` — adds a quality condition to an action
- `iceResident` — marks a node as ICE home, adds disable-on-own behavior

Traits would replace the per-type factory functions with a more flexible composition:
```
createNode("vault", [lootable({ count: [1, 3] }), qualityGated("auth-tokens", 2)])
```

This also enables macguffin assignment as a trait rather than a special case in
`initGame()`. The trait would define an init operator that generates macguffins
using the seeded RNG.

### Follow-Up: Tab Completion for Node-Graph Actions

Console tab completion doesn't include node-graph-specific actions (unlock-vault,
extract-token, activate, etc.). The completion system needs to query
`getAvailableActions` for the selected node and include those action IDs.

### Follow-Up: Set-Piece Timing/Difficulty Tuning Sweep

All set-piece tick periods need a playtesting pass to tune difficulty against
practical exploit and action timing. Current values are first-pass estimates:
- deadmanCircuit: heartbeat 30 ticks (3s), watchdog 50 ticks (5s)
- encryptedVault: key cycle 100 ticks (10s)
- tripwireGauntlet: delay 6 ticks (600ms)
- cascadeShutdown: watchdog 4 ticks (400ms) — probably too fast
- noisySensor: debounce 4 ticks (400ms)

These should be tuned against the actual probe/exploit/action durations so the
puzzles create meaningful time pressure without being impossible. A dedicated
balance session with bot-player metrics would be ideal.

**Grade-scaled timing:** Tick periods should scale with LAN or node grade.
A grade-S network has faster clocks and shorter watchdog windows; grade-F
gives more breathing room. This could be a multiplier table on the set-piece
config (e.g. `basePeriod: 50, gradeScale: { S: 0.3, ..., F: 2.0 }`), applied
when the set-piece is instantiated for a network of a given difficulty. Ties
into the composable traits system — a `timedThreat` trait would compute
actual tick period from base × grade multiplier.

### Follow-Up: WAN Node Commands

access-darknet, store, and buy should be actions attached to the WAN node
specifically, not global console commands. When WAN is selected, these
become available as dynamic commands via the node-graph action system.
