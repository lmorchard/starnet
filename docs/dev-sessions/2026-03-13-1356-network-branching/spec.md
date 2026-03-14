# Network Branching & Hierarchical Generation — Spec

## Problem

Generated networks tend toward long, unbranching linear paths. Each piece has one
inbound and one outbound port, creating corridors rather than trees. This is
especially noticeable when hunting for scattered nodes and at higher difficulties
where networks should feel larger and more complex.

Three compounding root causes:
1. **Budget exhaustion** — a C-grade network gets ~12 skeleton slots, not enough for width
2. **`branchCount()` weighted toward 1** — low budget always returns single child per slot
3. **Opportunistic filler capped at 1** — pieces with 3 outbound ports only get 1 extra branch

## Design

### Hierarchical Skeleton

Replace the current flat skeleton tree with a two-level hierarchy:

- **Backbone** — a spine of chokepoint nodes connecting the entry point to wing
  entrances. The backbone is the "lobby" or "core network." Generated from its own
  tagged set-piece pool (backbone-tagged pieces): mostly plain routers in a chain,
  with occasional firewalls or rarer pieces. Nothing hardcoded — the backbone is
  piece-driven like everything else.
- **Wings** — sub-networks generated recursively behind each chokepoint. Each wing
  gets its own budget slice, branching rolls, and piece selection. Wings can have
  their own internal topology (hub, tree, linear) driven by piece selection.

The metaphor by grade tier:
- **F/D (small office)** — below the threshold for hierarchical generation. Uses the
  existing flat skeleton (tuned for slightly better branching). One big room,
  8-12 nodes, no wings or backbone.
- **C/B (multi-story building)** — hierarchical: backbone + 2-3 wings. A lobby
  branching to floors/wings, each with a few rooms. 15-25 nodes.
- **A/S (corporate campus)** — hierarchical: longer backbone + 3-5 wings. Multiple
  buildings off a central spine, each building is its own mini-network. 30-40+ nodes.

Wing count scales with the complexity grade.

Chokepoints (routers, firewalls, switchArrangement set-pieces) gate further wings
of the LAN. Players see the gate, know there's more behind it, but must crack it to
discover what's inside.

### Security Infrastructure Across Wings

No special cross-wing wiring or post-generation passes. Security works emergently
from topology + relay operators:

1. The security-ops wing places IDS + monitor as required pieces (normal set-piece
   placement)
2. Other wings may place their own IDS nodes (part of their sub-biome catalog)
3. Backbone pieces (routers, firewalls) include relay operators that forward
   alert-type messages
4. Alert signals propagate naturally: wing IDS → wing edge → backbone router →
   backbone relay chain → security-ops wing → monitor

This is the same relay-chain propagation that IDS → monitor already uses in the
current flat network — just across a longer, more interesting topology.

The player can sever a wing's alert chain by reconfiguring any relay-capable node
along the path: the wing's local IDS, a backbone router, or a chokepoint firewall.
This creates readable, per-wing security puzzles without any special-case generator
logic.

### Multi-Port Slot Consumption

Rework the slot-filler so pieces with multiple outbound ports create real skeleton
branches instead of wasting ports. Currently `consumeOutboundPort()` pops one port
and the opportunistic filler adds at most 1 extra. After this change, all outbound
ports on a piece can connect to skeleton children or filler branches.

### Budget & Grade Scaling

**LAN-level grade as offset.** The overall LAN has a grade (F through S). This
grade applies as an offset to all wing base grades:

| LAN grade | Offset |
|-----------|--------|
| F         | +0     |
| D         | +0     |
| C         | +1     |
| B         | +1     |
| A         | +2     |
| S         | +2     |

Sub-biomes declare base grades. The LAN offset raises them. A "weak" wing (base F)
in an S-rank LAN becomes grade C. Grades cap at S — offset never pushes beyond it.
This means sub-biome authors think in relative difficulty, not absolute.

**Expanded budgets.** Budget pools grow with grade to support larger networks:
- F/D: ~8-12 total slots (small office)
- C/B: ~15-25 total slots (multi-story building)
- A/S: ~30-40+ total slots (corporate campus)

Budget is divided between backbone and wings. The backbone gets a fixed slice; wings
divide the remainder based on their sub-biome's grade profile.

### Biome Recipe System

The top-level biome defines **recipe variants** — different flavors of the same
biome that produce structurally distinct networks.

**Recipe structure:**
- A recipe specifies mandatory wings (always present) and a weighted optional pool
  (picked based on available budget and randomness)
- Different recipes within the corporate biome represent different corporation types:
  defense contractors (heavy security), fashion brands (light security, more loot),
  tech companies (high complexity puzzles), etc.

**Example recipes (corporate biome):**
- **Defense contractor** — mandatory: security-ops, security-ops. Optional pool
  weighted toward server-room.
- **Fashion brand** — mandatory: security-ops. Optional pool weighted toward
  office-floor, executive-suite.
- **Tech company** — mandatory: security-ops. Optional pool weighted toward
  server-room with high complexity.

The recipe system is fully built — data structure, selection logic, backbone
integration. Multiple recipe variants are authored for the corporate biome.

**Recipe selection:** player-chosen for now (from a mission briefing or similar).
Eventually recipe selection will be overworld-driven.

### Sub-Biomes

Sub-biomes are curated filters over the biome's full set-piece catalog, with
bundled grade tendencies. The biome maintains one big catalog of all pieces;
sub-biomes reference pieces by ID/name to define their palette.

Each sub-biome defines:
- A **piece filter** (list of set-piece IDs eligible for placement in this wing)
- **Required pieces** (must-have set-pieces that are always placed in this wing,
  e.g., security-ops requires a security monitor set-piece)
- **Base grades** for threat, wealth, complexity, depth (before LAN offset)

**Initial set (3-4, proving the system):**

| Sub-biome       | Character                        | Required pieces        | Base grades (T/W/C/D) |
|-----------------|----------------------------------|------------------------|-----------------------|
| Security ops    | IDS, monitors, ICE host, traps   | security monitor chain | High T, low W         |
| Server room     | Fileservers, cryptovaults, hubs  | —                      | Low T, high W         |
| Office floor    | Workstations, mixed loot         | —                      | Low T, low W, low C   |
| Executive suite | High-value targets, gated access | —                      | Mid T, high W, high C |

These are starting points — exact grades, piece palettes, and required pieces will
be tuned during implementation and playtesting.

Security infrastructure is not hardcoded at the system level. If a recipe includes
a security-ops wing, that wing's required pieces guarantee a monitor exists. A
recipe without security-ops would produce an unmonitored LAN — a valid (easy)
configuration.

### Scattered Nodes Across Wings

Scattered set-pieces (switch-hunting, key distribution) scatter across the whole
network, including across wing boundaries. This creates the "explore broadly"
motivation — the player must crack multiple chokepoints to find all switches.

Future consideration: constraints ensuring scattered pieces land in different wings
for maximum spread, with care not to deadlock gates that guard each other's keys.

### Layout & UX

- **Wing clustering** — wings should visually separate as clusters in the Cytoscape
  layout. The existing layout engine likely handles this naturally; may need
  iteration.
- **Select-and-fit** — when the player selects a node, the camera pans and zooms to
  center that node and fit at least the nearest 1-2 revealed neighbors as context.
  Important at 30+ node scale where the full network doesn't fit on screen.
- **Natural discovery** — no special visibility treatment for wings. As players
  navigate, probe, and own nodes, connections reveal gradually. The wing structure
  is invisible to the player — they just experience a network with interesting
  topology.
- **Layout direction** — networks can spread in all directions rather than the
  current depth-layered column.

## Not In Scope

- **ICE changes** — defer to ICE System Overhaul session. Single ICE patrols the
  whole network for now.
- **Multi-ICE per wing** — requires ICE singleton→collection refactor.
- **Bot census tuning** — bot census is a future tuning tool, not a validation gate
  for this session.
- **Minimap** — interesting future idea, deferred.
- **Lateral ports** — declared in the port system but not wired. Not tackling in
  this session.
- **Message routing** — destination-aware pathfinding. Relay-chain propagation
  through backbone routers handles cross-wing communication; explicit routing is
  a future consideration if relay chains prove insufficient.

## Testing Strategy

1. **Unit tests** — hierarchical skeleton generation, budget allocation and
   division, recipe selection, multi-port slot consumption, sub-biome piece
   filtering
2. **Playtest harness** — smoke tests via `scripts/playtest.js` to verify generated
   networks are playable end-to-end
3. **Playwright MCP** — visual verification that layouts look good, wings cluster
   properly, select-and-fit works
4. **Manual playtesting** — hands-on play to check feel, pacing, discovery

## Future Directions

- More sub-biomes and recipe variants as content
- Lateral ports for cross-wing connections
- Multi-ICE per wing (ICE overhaul)
- Bot census for difficulty tuning at new network sizes
- Minimap for large network navigation
- Non-corporate biomes (military, black market, research facility)
- Message routing system for cross-wing communication
- Scatter constraints (different wings, deadlock prevention)
- Generator interface evolution as recipe system matures
