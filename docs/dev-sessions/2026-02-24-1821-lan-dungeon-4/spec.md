# Spec: LAN Dungeon — Session 4 (ICE / Adversarial Presence)

_Session: 2026-02-24-1821-lan-dungeon-4_
_Branch: lan-dungeon-4_

---

## Overview

Introduce a roaming ICE (Intrusion Countermeasure Electronics) program as an active adversarial threat. The player's vulnerability is tied to their **selected node** — wherever their focus is, that's where they can be found. If ICE moves its attention to the same node the player is focused on, discovery becomes possible.

This adds spatial tension: instead of purely managing an abstract alert meter, the player must track a physical threat moving through the graph — and can work to eliminate it at the source.

---

## ICE: Two Locations

ICE has two distinct positions at all times:

- **Resident node**: the node where ICE is *running* — its home base process. This is static (ICE doesn't move its residency).
- **Attention focus**: the node ICE is currently *scanning* — this is what moves through the graph each tick.

The attention focus starts at the resident node and moves outward. These two locations can diverge widely as the run progresses.

---

## Player Presence

- The player's "presence" in the network is defined by the **currently selected node**.
- If no node is selected, the player has no detectable presence.
- Deselecting is a meaningful defensive action — it removes presence and resets any in-progress detection timer, at the cost of losing active focus.

---

## Visibility (Fog of War)

ICE visibility is determined by the **player's access level at the node ICE is currently focused on**:

| ICE attention is on... | Player sees... |
|------------------------|----------------|
| A node the player has **compromised or owned** | ICE attention indicator visible at that node |
| A node the player has **owned** | ICE attention visible *and* a traced path back to the resident node (see below) |
| Any other node | ICE is invisible |

This means the player's owned/compromised footprint is their surveillance network — ICE moving through territory you've claimed is detectable; ICE lurking in unexplored nodes is not.

### Trace-back path (owned nodes only)

When ICE's attention is on an owned node, the player can trace back to the resident node:

- A path is revealed through the graph from the attention focus to the resident node.
- Intermediate nodes along this path become visible as **waypoints** — the player can see that they exist and form a chain, but they remain inaccessible and their contents are unknown (similar to the existing `???` revealed state, but with a distinct "traced path" indicator).
- The **resident node** is distinctly marked as ICE's home base.
- If the path passes through already-known nodes, those are simply highlighted as part of the trace.

---

## ICE Grade

ICE has a grade (D/F/C/B/A/S) that governs movement behavior, detection speed, and movement speed. Grade is defined in the network data as a per-LAN attribute.

### Movement behavior

| Grade | Behavior |
|-------|----------|
| D / F | Random walk — hops to a random adjacent node each tick |
| C / B | Disturbance tracking — moves toward the most recently disturbed node (last probe, failed exploit) |
| A / S | Player-seeking — pathfinds directly toward the player's currently selected node |

Player-seeking ICE uses shortest-path (BFS) through the adjacency graph.

### Movement speed

Movement speed (tick interval) scales with grade. Indicative targets:
- D/F: ~6–8s per hop
- C/B: ~4–5s per hop
- A/S: ~2–3s per hop

Exact values to be tuned during implementation.

### Detection speed (when ICE attention is on player's focused node)

| Grade | Detection behavior |
|-------|-------------------|
| D / F | Dwell timer ~8–10s — player can escape by deselecting before timer expires |
| C / B | Dwell timer ~3–5s |
| A / S | Instant detection |

---

## Spawn

- **For this prototype**: one ICE program spawns at the **start of the run** on a random node (which becomes its resident node). Its attention focus starts at the resident node.
- Grade defined in network data alongside the ICE entry.
- Future: spawn conditions (alert threshold, run timer), spawn count, and grade as per-LAN difficulty attributes.

---

## Detection Consequences

When detection fires (dwell timer expires or instant for A/S grade):

- Escalates global alert via the **existing event-forwarding system** — same propagation path as IDS/security monitor events.
- A player who has already subverted IDS nodes (disabled event forwarding) may absorb the detection event before it reaches a monitor — implicit protection from prior infrastructure work.
- If the event reaches a monitor, global alert escalates normally (potentially triggering trace).

---

## Visual Representation

- ICE is rendered as a **Cytoscape node** overlaid on the graph, positioned at its current **attention focus** coordinates.
- Shape: star/spiky (Cytoscape `star` shape) in a hostile color (red/magenta). Exact styling TBD.
- ICE is only rendered when visible per the fog-of-war rules above.
- **Resident node** is marked distinctly when revealed via trace-back (e.g. a hostile-colored border or icon on the node itself).
- **Trace-back path** shown as highlighted edges and waypoint nodes between attention focus and resident node.
- When ICE **moves**, animate its position along the edge path to its target node.
- When ICE **docks on the player's selected node** (detection window opens):
  - ICE icon and the target node both **pulse** (looping animation).
  - For dwell-based detection: a **countdown** appears in the sidebar (similar to trace countdown in HUD).
  - Log entry: e.g. `// ICE AT [node] — DISENGAGE OR EJECT`.

---

## Player Actions Against ICE

### EJECT (new action on OWNED nodes, when ICE attention is present)

- Available when ICE's attention focus is on the currently selected owned node.
- Effect: ICE attention is immediately moved to a **random adjacent node**.
- No resource cost for this prototype.
- Appears in the sidebar action list contextually.

### Deselect (explicit new action)

- New console command: `deselect` — clears the current node selection entirely (no argument needed).
- New UI affordance: a `[ DESELECT ]` button in the sidebar node header when a node is selected.
- Clicking the currently-selected node on the graph a second time also deselects it.
- Effect: clears `selectedNodeId` to null, removes player presence, resets dwell timers for low/mid-grade ICE.
- High-grade (A/S) instant detection cannot be escaped this way — detection fires before the player can act.

### REBOOT (new action on OWNED nodes, available any time)

- Available on any **owned node**, regardless of whether ICE is present.
- Effect:
  1. ICE attention is immediately sent back to its **resident node**.
  2. The player is **deselected** from the rebooting node (presence cleared).
  3. The node enters a **REBOOTING** state for 1–3 seconds, during which it cannot be selected by the player or targeted by ICE attention.
- This makes REBOOT more powerful than EJECT (which only nudges ICE one hop) but with a real cost: a temporary dead zone in your own footprint.
- Can be used proactively — reboot a node you predict ICE is heading toward to redirect it home before it arrives, or reactively to escape when ICE is already on your focused node.
- Future potential uses: interrupt an in-progress alert timer, reset a node's alert state, other effects TBD.
- No resource cost for this prototype.

### Subvert the resident node (primary win condition against ICE)

- If the player **owns the resident node**, ICE is disabled entirely.
- Owning the resident node uses the standard exploit/escalate flow — no new mechanics required.
- The resident node may be well-defended (high grade, complex vulnerabilities), making this a meaningful late-run objective.

---

## Timer Event System

This session introduces multiple concurrent timed game events:
- ICE movement ticks (repeating, per-ICE)
- ICE dwell/detection countdown (cancellable on deselect)
- REBOOT node lockout (one-shot, per node)
- Trace countdown (already exists — candidate for migration)

Rather than managing these as ad-hoc `setInterval`/`setTimeout` calls scattered across modules, introduce a **centralized timer system** in a new `js/timers.js` module.

### Design

```
scheduleEvent(type, delayMs, payload)  → timerId
scheduleRepeating(type, intervalMs, payload)  → timerId
cancelEvent(timerId)
cancelAllByType(type)
```

On fire, each timer dispatches a DOM custom event (e.g. `starnet:timer:ice-move`, `starnet:timer:ice-detect`, `starnet:timer:reboot-complete`) with the payload as `detail`. Handlers in `main.js` (or wherever appropriate) respond to these events and update state via the normal mutation + `emit()` path.

### Properties
- Single source of truth for all pending timed events — easy to inspect, cancel, and debug
- All timer-triggered logic flows through the existing event dispatch architecture
- Timers are cleared on run end (`endRun`) to prevent stale callbacks firing after game over
- Cheat system can expose pending timers for debugging

### UI visibility

Each timer entry carries a `visible` flag and optional `label`. The timer system exposes a `getVisibleTimers()` function returning active visible timers with their remaining time. UI components (`syncHud`, `renderSidebarNode`, etc.) read from this instead of tracking countdowns independently.

Examples of visible timers:
- ICE dwell detection countdown → sidebar, next to selected node
- REBOOT lockout → on the rebooting node in the graph + sidebar
- Trace countdown → HUD (currently ad-hoc; candidate for migration)

Non-visible timers (e.g. ICE movement ticks) simply omit the `visible` flag and never appear in UI.

### Trace countdown migration
The existing trace countdown uses a `setInterval` in `state.js`. It can be migrated to this system as a follow-on, but is not required for this session.

---

## Disturbance Tracking State

Mid-grade ICE (C/B) tracks the most recently disturbed node. The following actions count as disturbances:

- `probe` on any node
- Failed exploit on any node

State must record `lastDisturbedNodeId` (updated on each disturbance event). ICE uses this for pathfinding.

---

## Deferred (Future Iterations)

- **ICE as combat target**: ICE itself is probe-able and exploitable — it has vulnerabilities, can be attacked directly with exploit cards, and can be damaged, slowed, or destroyed.
- **DENY action**: Spend an exploit card to block ICE from entering an owned node. Creates resource competition between offense and defense.
- **Spawn conditions as LAN attributes**: Spawn on alert threshold, multiple ICE programs, variable grade/count per LAN difficulty.
- **Player damage**: Detection causes player harm (heat, stat degradation) — requires a health/condition system not yet designed.
- **Node type restrictions for ICE residency**: Only compute-capable nodes (e.g. workstations, servers, dedicated security hardware) should be able to host ICE — not storage nodes, routers, or other lightweight types. When node types get more texture/differentiation, this constraint should be enforced in LAN data and potentially hinted to the player (knowing ICE can't live on a fileserver narrows the search).

---

## Acceptance Criteria

- [ ] `js/timers.js` module exists with `scheduleEvent`, `scheduleRepeating`, `cancelEvent`, `cancelAllByType`, `getVisibleTimers`
- [ ] Visible timers carry a label and remaining-time readable by UI components
- [ ] All ICE timers and REBOOT timers use the timer system; no ad-hoc `setInterval`/`setTimeout` for game events
- [ ] All timers cleared on `endRun`
- [ ] ICE spawns at run start; grade and starting node defined in network data
- [ ] ICE has a resident node (static) and an attention focus (moving)
- [ ] ICE attention moves through the graph per tick; movement behavior matches grade
- [ ] ICE is only visible when its attention is on a compromised or owned node
- [ ] When attention is on an owned node, trace-back path to resident node is revealed (waypoints shown, contents unknown)
- [ ] When ICE attention is on the player's selected node, both pulse and dwell countdown appears (or instant detection fires for A/S)
- [ ] Detection escalates global alert via existing event-forwarding system
- [ ] `deselect` console command clears node selection
- [ ] `[ DESELECT ]` button appears in sidebar when a node is selected
- [ ] Clicking an already-selected graph node deselects it
- [ ] EJECT action available on owned nodes when ICE attention is present; moves attention to random neighbor
- [ ] REBOOT action available on any owned node at any time; sends ICE attention home, deselects player, and locks the node for 1–3 seconds
- [ ] Rebooting node cannot be selected by player or targeted by ICE during lockout; distinct visual state shown
- [ ] Owning the resident node disables ICE
- [ ] `lastDisturbedNodeId` tracked in state for mid-grade ICE pathfinding
