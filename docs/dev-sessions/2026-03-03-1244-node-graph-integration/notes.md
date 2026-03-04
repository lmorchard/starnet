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
- `getNodeType()` returns null for unknown types (not throw) — set-piece nodes have types outside the old registry
- `enrichWithGameActions()` deduplicates by action id — set-piece actions win over generic game actions
- `initState()` clears graph refs to prevent cross-test contamination
- Gateway gateAccess is "probed" (reveals neighbors on probe), router is "compromised" (reveals on exploit)
- All networks include a WAN node for darknet store access
- Default layout changed to breadthfirst (works better with incremental reveals)
