# Spec: Node Visual Indicators

## Problem

Node visual states are hard to read at a glance. The most important properties —
access level (player territory), alert state (threat level), and current selection —
are all encoded in the border, which means they collide and overwrite each other.
Access level is especially important: it represents the player's progress through the
LAN and their claimed territory. It needs to be the dominant visual signal.

## Core Narrative

The network should feel like a reactive system. Before the player touches a node, it
is silent and inert. Player interaction disturbs it — the alert state activates and
escalates. As the player wins nodes, they shift from absent/foreign infrastructure to
claimed territory. The visual language should tell this story at a glance.

## Visual Channel Assignments

### Fill → Access Level

The node body (fill/background) is the most prominent visual channel and should be
dedicated to access level — the most important player-facing property.

| Access Level  | Fill Treatment                                | Meaning                     |
|---------------|-----------------------------------------------|-----------------------------|
| `locked`      | Dark / near-background — nearly invisible     | Absent, foreign, not yours  |
| `compromised` | Muted/partial — a foothold, contested         | Partial claim, bridgehead   |
| `owned`       | Bright, lit — clearly territory               | Yours, controlled, lit up   |

The progression should read as a network incrementally claimed by the player.

### Border → Alert State

The border communicates threat level — how much the network is reacting to the
player's presence. It should only become visually significant once the player has
started interacting with the node (probe raises alert from green to yellow).

| Alert State | Border Treatment                        | Meaning                              |
|-------------|-----------------------------------------|--------------------------------------|
| `green`     | Subtle / minimal — nearly invisible     | Quiet, undisturbed                   |
| `yellow`    | Amber, visible                          | Disturbed — system is aware          |
| `red`       | Red, prominent, pulsing                 | Hostile — full intrusion response    |

### Reticle → Selection

Selection currently uses a magenta border override, which overwrites access level and
alert state simultaneously. Instead, selection should use a visual element that is
*around* the node rather than *on* it — keeping the node's own properties readable
at all times.

**Design:** a slowly, subtly rotating animated ring/reticle around the selected node.
The reticle represents the player's active presence at that node — their vulnerability
to ICE detection. It should feel alive (animated) but not aggressive.

**Implementation note:** Cytoscape doesn't have a native rotating ring primitive.
Likely approach: a ghost overlay node (or CSS animation on a separate element)
positioned concentrically.

### Node Type → Shape

Node type continues to be communicated via shape. The fill channel is now reserved
for access level, so type-by-color is not available.

**Immediate fix:** IDS and security-monitor currently share the hexagon shape and are
visually indistinguishable. They need distinct shapes.

## Out of Scope

- **Grade on graph** — grade is sidebar-only; no change this session
- **Reconfigured IDS visual state** — reconfigure doesn't feel impactful yet; defer
  to the node types session where cross-node interactions will be addressed
- **Deeper node type differentiation** — shape collision fix only; full type flavor
  (color coding, icons, etc.) deferred to a dedicated node types session
- **ICE visual states** — not changed this session

## Acceptance Criteria

1. Access level is readable on every node at a glance, including when a node is
   selected and when it is in alert state
2. Alert state (green/yellow/red) is visually distinct and does not overwrite access
   level information
3. Selected node has a visually distinct indicator that does not collide with access
   level or alert state
4. IDS and security-monitor nodes have distinct shapes
5. The overall visual language reads as a network that is: silent before interaction,
   hostile under disturbance, claimed as the player wins territory

## Future Session: Node Types

A follow-up session should address:
- Distinct visual treatment for reconfigured/subverted nodes (IDS, security-monitor)
- Richer node type differentiation (attributes, flavor, cross-node interactions)
- Potentially: grade surfaced on graph (pip meter or color tint on label)

## Future Session: Graph Layout

The LAN graph is currently hand-crafted with fixed node positions. This has caused
confusion during play — crossing/overlapping edges make some nodes appear connected
when they aren't. Consider migrating to an auto-layout algorithm.

Cytoscape.js has several built-in layouts (`cose`, `breadthfirst`, `circle`, `grid`)
and supports external layout extensions (e.g. Springy.js via `cytoscape-springy`,
or the Cola constraint-based layout). `cose` (force-directed) is the most likely
candidate for organic-feeling network graphs.

Tradeoffs to evaluate:
- Auto-layout may conflict with the hand-crafted topology (e.g. gateway near the
  player edge, security monitor deep in the network) — may need layout constraints
- Procedural generation would benefit more from auto-layout than the current static
  network; this may be worth deferring until procedural graphs are in scope
- Fixed positions are deterministic and easier to reason about for playtesting
