# Spec: Node Graph Integration

## Goal

Integrate the reactive node graph runtime (`js/core/node-graph/`) as the authoritative
source of truth for node state in the game engine. Tear out the old node-types system
and procgen; replace with NodeDef-based node definitions and hand-crafted strawman
networks built from set-pieces. Further decouple the visual renderer from game state
as a foundation for a future Storybook-style preview harness.

## Scope

### In scope

1. **NodeGraph as state authority** — `NodeGraph` owns all node attributes
   (`accessLevel`, `visibility`, `probed`, `forwardingEnabled`, etc.). The old
   `js/core/state/node.js` setters are retired. All reads of node state go through
   `graph.getNodeState(nodeId)`.

2. **Retire `node-types.js`** — Node type behaviors (relay, latch, flag, watchdog,
   etc.) and player actions (probe, exploit, read, loot, reconfigure) move into NodeDef
   `operators` and `actions` fields on each node definition. `node-types.js` is deleted.

3. **Tear out procgen** — `js/core/network/network-gen.js` and its biome system are
   removed. In their place: 2-3 hand-crafted strawman networks built from set-pieces,
   sufficient to drive playtesting until a new procgen session.

4. **Action dispatch through NodeGraph** — `initActionDispatcher` routes player actions
   through `graph.getAvailableActions(nodeId)` and `graph.executeAction(nodeId, actionId)`.
   The `starnet:action` event shape is unchanged; only the routing changes.

5. **Ctx interface wired to game functions** — `CtxInterface` implemented with real
   game callbacks: `startTrace` -> alert/trace system, `setGlobalAlert` -> alert state,
   `spawnICE` -> ICE system, `giveReward` -> cash delta, `revealNode`/`enableNode` ->
   visibility, `log` -> event bus.

6. **Visual renderer decoupled from state** — renderer subscribes to semantic events
   emitted by NodeGraph (via the event bus) rather than reading `getState()` directly.
   NodeGraph emits typed events on state transitions:
   - `E.NODE_STATE_CHANGED` -> `{ nodeId, attributes }` on any attribute mutation
   - `E.MESSAGE_PROPAGATED` -> `{ path, type }` for edge animations (signal flow)
   - `E.QUALITY_CHANGED` -> `{ name, value }` on quality store mutations
   This event shape is designed for a future Storybook preview harness — the renderer
   becomes a pure event consumer with no direct state coupling.

7. **Init lifecycle** — `graph.init()` dispatches `{ type: 'init' }` to all nodes
   after construction. Macguffin assignment and ICE spawning happen via ctx callbacks
   during init. The existing seeded RNG streams are used.

8. **Save/load** — `graph.snapshot()` / `graph.fromSnapshot()` wired into
   `js/ui/save-load.js`. NodeGraph state serializes alongside the rest of game state.

9. **Tick wiring** — `graph.tick(1)` called from `timers.js` each virtual tick.

10. **Playtest and bot harness updated** — `scripts/playtest.js` and
    `scripts/bot-player.js` wired to use NodeGraph for state access and action dispatch.

### Out of scope (future sessions)

- New procedural network generator (set-piece assembly, placement, biome palettes)
- Named states / statechart transitions on nodes
- Player quality store (persisting qualities across LANs)
- BFS message dispatch (defer unless ordering issues surface)
- Multiple ICE instances
- Storybook preview harness (this session lays the foundation; the harness is next)

## Strawman Networks

Two hand-crafted networks built from set-pieces to replace the current static and
procedural networks. Temporary scaffolding — solvable, interesting enough to drive
playtesting, replaced when procgen lands.

### Network A: "Corporate Foothold" (simple, tutorial-adjacent)

A small 10-12 node network introducing the basic loop:
- `idsRelayChain` — one IDS + monitor; player must reconfigure IDS to silence alerts
- `nthAlarm` — a sensor that starts a trace on the 3rd probe; teaches probe economy
- `multiKeyVault` — two key servers + vault; primary loot target
- Plain fileserver/workstation nodes for early loot

### Network B: "Research Station" (structural defense, no ICE)

A 15-18 node network with complex circuit puzzles and no ICE. Player has time to
think. Composed of:
- `deadmanCircuit` — heartbeat relay the player must not interrupt
- `combinationLock` — three switches requiring coordinated activation
- `encryptedVault` — timing pressure: extract key before next clock cycle
- `tamperDetect` — sequencing puzzle: neutralize relay before reconfiguring IDS

### Network C: "Corporate Exchange" (ICE pressure, simple circuits)

A 12-15 node network with aggressive ICE and simple structural defense. Move fast
or get caught. Composed of:
- `idsRelayChain` — standard IDS chain
- `noisySensor` — debounce-rate-limited sensor; teaches the quiet-window mechanic
- `probeBurstAlarm` — ICE spawns every 3rd probe; drives pace pressure
- `honeyPot` — punishes naive exploitation

## Node Type Definitions

The eight existing game node types re-expressed as NodeDef templates with operators
and actions. The `type` field is retained as metadata for the renderer (visual
styling) but behavior comes entirely from operators and actions.

Types to define:
- `gateway` — entry point; no operators, basic probe/exploit actions
- `router` — relay node; `relay` operator, probe/exploit/reconfigure actions
- `ids` — `relay(filter:"alert")` + `flag(on:"alert", attr:"alerted")` operators;
  probe/exploit/reconfigure actions
- `security-monitor` — `flag(on:"alert", attr:"alerted")` + ctx alert callback;
  probe/exploit actions
- `fileserver` — lootable; probe/exploit/read/loot actions, loot trigger
- `cryptovault` — lootable, quality-gated; probe/exploit/read/loot actions
- `firewall` — high-grade barrier; probe/exploit actions, no relay behavior
- `wan` — darknet store access; probe/exploit/store actions

## Architecture Notes

### State ownership

`NodeGraph` is the single source of truth for node attributes. `js/core/state/node.js`
is retired. The remaining state submodules (`ice.js`, `alert.js`, `player.js`,
`game.js`) are kept for ICE position, global alert level, player cash/hand, and
game-level state (selection, phase) — these are not node attributes and stay in the
existing state system for now.

### Event bus contract

NodeGraph interacts with the rest of the game via two channels:
1. **Ctx callbacks** — `CtxInterface` methods for discrete game actions
   (startTrace, spawnICE, giveReward, etc.)
2. **Event bus emissions** — NodeGraph emits events the renderer subscribes to
   (`E.NODE_STATE_CHANGED`, `E.MESSAGE_PROPAGATED`, `E.QUALITY_CHANGED`)

The renderer subscribes to event bus events only — it never reads NodeGraph state
directly. This is the foundation for the Storybook preview harness: feed the same
events from a test fixture and visual state is fully reproducible without a running
game engine.

### Tick integration

`timers.js` calls `graph.tick(1)` at each virtual tick alongside existing timer
processing. NodeGraph internal timers (clock, delay, watchdog, debounce) advance
within the same virtual clock as ICE movement and exploit execution.

### Save/load

NodeGraph serializes to a plain JSON object via `graph.snapshot()`, stored as a
`nodeGraph` field on the saved state envelope. On load, `graph.fromSnapshot(data)`
reconstitutes the full graph state including operator internal state.
