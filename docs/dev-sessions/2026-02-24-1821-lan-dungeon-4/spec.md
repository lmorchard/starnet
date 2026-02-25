# Spec: LAN Dungeon — Session 4 (ICE / Adversarial Presence)

_Session: 2026-02-24-1821-lan-dungeon-4_
_Branch: lan-dungeon-4_

---

## Overview

Introduce a roaming ICE (Intrusion Countermeasure Electronics) program as an active adversarial threat. The player's vulnerability is tied to their **selected node** — wherever their focus is, that's where they can be found. If ICE moves to the same node the player is focused on, discovery becomes possible.

This adds spatial tension to the run: instead of purely managing an abstract alert meter, the player must also track a physical threat moving through the graph.

---

## Player Presence

- The player's "presence" in the network is defined by the **currently selected node**.
- If no node is selected, the player has no presence — they cannot be directly detected.
- Deselecting a node is a meaningful defensive action: it breaks ICE's lock on your location, at the cost of losing your active focus and any in-progress action context.

---

## ICE Entity

### Spawn
- One ICE program spawns at the **start of the run** on a random accessible node.
- Its grade is defined in the network data (per-LAN attribute, like node grade).

### Grade
ICE has a grade (D/F/C/B/A/S) that governs two things: **movement behavior** and **detection speed**.

#### Movement behavior (grade-based AI)
| Grade | Behavior |
|-------|----------|
| D / F | Random walk — hops to a random adjacent node each tick |
| C / B | Disturbance tracking — moves toward the most recently disturbed node (probe, failed exploit) |
| A / S | Player-seeking — pathfinds directly toward the player's currently selected node |

#### Movement speed
- Movement speed (tick interval) scales with grade: higher grade = faster ticks.
- Specific values TBD during implementation; aim for D/F ~5–8s per hop, A/S ~2–3s.

#### Detection speed (when ICE is on player's focused node)
| Grade | Detection behavior |
|-------|-------------------|
| D / F | Dwell timer ~8–10 seconds — player can escape by deselecting before timer expires |
| C / B | Dwell timer ~3–5 seconds |
| A / S | Instant detection |

---

## Visibility (Fog of War)

ICE position is only partially visible to the player:

- **ICE on an OWNED node**: fully visible — ICE icon shown on the graph at that node.
- **ICE adjacent to an OWNED node**: vague warning — an indicator that ICE is "nearby" (e.g. a dim pulse on the owned node's border, or a log message), but the specific adjacent node is not revealed.
- **ICE elsewhere in the network**: completely invisible.

This mirrors the existing network fog-of-war and means owned nodes serve dual purpose: loot territory and surveillance.

---

## Visual Representation

- ICE is rendered as a **Cytoscape node** overlaid on the graph, positioned at its current node's coordinates.
- Shape: spiky/star (Cytoscape `star` shape) in a hostile color (red/magenta). Exact styling TBD.
- When ICE **moves**, animate its position along the edge path to its target node.
- When ICE **docks on the player's selected node**:
  - ICE icon and the target node both **pulse** (visual flash/animation loop).
  - If a dwell timer applies, a **countdown** appears in the sidebar (similar to trace countdown in HUD).
  - Log entry: e.g. `// ICE DETECTED AT [node label] — DISENGAGE OR EJECT`.

---

## Detection Consequences

When detection fires (dwell timer expires, or instant for A/S grade):

- Escalates global alert via the **existing event-forwarding system** — same path as IDS/security monitor events.
- This means a player who has already subverted IDS nodes (disabled event forwarding) gets implicit protection: the detection event may be absorbed before reaching a security monitor.
- If the event propagates to a monitor, global alert escalates normally (potentially triggering trace).

---

## Player Actions Against ICE

### EJECT (new action on OWNED nodes)
- Available on any **owned node** when ICE is currently present at that node.
- Effect: ICE is immediately moved to a **random adjacent node** (the player cannot choose which).
- No resource cost for the prototype; may gain a cost in future iterations.
- Appears in the sidebar action list when the selected node is owned and ICE is present there.

### Deselect (existing mechanic, new defensive use)
- Deselecting the focused node removes the player's presence, immediately breaking ICE's lock.
- Low-grade ICE detection timers reset when the player deselects.
- High-grade ICE that detects instantly cannot be escaped this way.

---

## Deferred (Future Iterations)

- **ICE as combat target**: ICE is probe-able and exploitable — it has vulnerabilities the player can attack with exploit cards, gaining a chance to damage, slow, or destroy it.
- **DENY action**: Spend an exploit card to block ICE from entering an owned node. Creates hand-resource competition between offense and defense.
- **Spawn conditions as LAN attributes**: ICE could spawn on alert threshold (yellow, red) rather than at run start; spawn count, timing, and grade as per-LAN difficulty settings.
- **Multiple ICE programs**: Multiple simultaneous ICE with different grades and behaviors.
- **Player damage**: ICE detection could damage the player (heat, burn, stat degradation) rather than just escalating alert — requires a player health/condition system not yet designed.

---

## Acceptance Criteria

- [ ] ICE spawns on a random node at run start; grade defined in network data
- [ ] ICE moves through the graph on a timer; movement behavior matches grade (random / disturbance-tracking / player-seeking)
- [ ] ICE is visible on the graph (as a node icon) only when on or adjacent to an owned node
- [ ] When ICE is on the player's selected node, both pulse and a dwell countdown appears in sidebar (or instant detection fires for A/S grade)
- [ ] Detection escalates global alert via existing event-forwarding system
- [ ] EJECT action appears on owned nodes when ICE is present; moves ICE to a random neighbor
- [ ] Deselecting removes player presence and resets dwell timer for slow-grade ICE
