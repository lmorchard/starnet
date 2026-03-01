# Spec: Procedural LAN Generation

## Goal

Replace the single hand-crafted `data/network.js` with a generator that produces a
`NETWORK`-shaped object from three parameters: `seed`, `timeCost`, and `moneyCost`.
The generated LAN is fully deterministic — same inputs always produce the same network.
The static `data/network.js` is preserved as a fallback when no parameters are provided.

---

## Inputs

| Parameter   | Type            | Description |
|-------------|-----------------|-------------|
| `seed`      | string          | Passed to `js/rng.js` — determines all random choices in generation |
| `timeCost`  | grade (S–D, F)  | Controls how time-expensive the LAN is to complete |
| `moneyCost` | grade (S–D, F)  | Controls how money-expensive the LAN is to complete |

Grade scale (ascending difficulty): **F < D < C < B < A < S**

URL parameter form: `?seed=abc123&time=B&money=C`

Harness flag form: `--seed abc123 --time B --money C`
(`--seed` already exists; `--time` and `--money` are new)

---

## Output

A `NETWORK`-shaped object — identical schema to what `data/network.js` currently
exports. No new required fields in the first pass. Any schema additions must be
backward-compatible with the existing game engine.

The object includes:
- `nodes[]` — array of node definitions with `id`, `type`, `grade`, `label`, `x`, `y`
- `edges[]` — array of `{ source, target }` pairs
- `startNode` — id of the gateway node
- `iceGrade` — grade of the ICE entity (if present)

---

## Difficulty Budget Model

The two cost axes drive different aspects of network composition:

### Time Cost (ICE grade, depth, gate count)

| timeCost | ICE grade | Network depth | Gate density |
|----------|-----------|---------------|--------------|
| F        | F         | Shallow (2–3 hops from gateway to target) | 0–1 gates |
| D        | D         | Shallow–medium | 1 gate |
| C        | C         | Medium (3–4 hops) | 1–2 gates |
| B        | B         | Medium–deep | 2 gates |
| A        | A         | Deep (4–5 hops) | 2–3 gates |
| S        | S         | Deep | 3+ gates |

*Gates: firewall, IDS, security-monitor nodes that require owning before revealing connections.*

### Money Cost (node grades on critical path, mission target depth)

| moneyCost | Critical path grades | Target depth |
|-----------|---------------------|--------------|
| F         | F–D                 | Shallow (1–2 nodes from gateway) |
| D         | D–C                 | Shallow |
| C         | C–B                 | Medium |
| B         | B–A                 | Medium–deep |
| A         | A–S                 | Deep |
| S         | S                   | Deep (hardest nodes between player and target) |

### Interaction

ICE grade has a **secondary money cost** — ICE interruptions consume card uses without
progress. High timeCost indirectly raises money pressure. The axes are not fully
independent, but they represent the primary drivers of each cost type.

---

## Architecture: Rules, Algorithm, Validators, Set Pieces

The generator is structured as four distinct layers:

1. **Data-driven topology rules** — declarative facts about node types: what they connect
   to, what gate level they require, what depth range they belong in. Extensible without
   touching generator code. New node type = new rule entry.

2. **Generator algorithm** — procedural code that consults the topology rules to build a
   candidate network. The algorithm is stable; the rules it reads are not hard-coded into it.

3. **Validator predicates** — functions that *check* structural properties of a generated
   candidate (e.g. `missionTargetReachable`, `idsAdjacentToMonitor`). Run after generation;
   trigger a retry if any fail. Composable and easy to add without modifying the algorithm.

4. **Set pieces** — handcrafted subgraphs for topologies too complex or narratively specific
   to express as data rules. Set pieces are the escape hatch: anything that would require
   behavioral logic in the rules layer gets expressed as a set piece instead. They participate
   in macro topology as a unit (a "super-node") and may intentionally violate standard rules.

This split keeps the rules system simple, the algorithm stable, and complex cases handled
manually — rather than making the rules system Turing-complete.

---

## Topology Rules

The generator uses these rules to assemble the network. They formalize what is currently
implicit in the static `data/network.js`.

**Fixed anchors (always present):**
- One `wan` node — always accessible, connects only to the gateway
- One `gateway` node — player entry point, connects to wan and to the first routing layer
- One `security-monitor` node — the ICE resident, at the deep end of the security chain

**Structural rules:**
- `router` nodes connect between the gateway and workstations/fileservers
- `firewall` nodes gate access to high-value nodes (fileserver, cryptovault); connections
  beyond a firewall are not revealed until the firewall is owned
- `ids` nodes must be adjacent to a `security-monitor`; they watch the routing layer
  (connected to at least one router or similar mid-tier node)
- `cryptovault` nodes must be behind at least one gate (firewall preferred)
- `security-monitor` connects only to `ids` nodes (dead end for the player)
- No direct gateway → cryptovault edge
- The mission target must be reachable via a chain of nodes all owned by the player

**Grade placement:**
- Nodes near the gateway tend toward lower grades (soft entry)
- Nodes deeper in the network scale up toward the configured `moneyCost` grade range
- ICE grade is set directly from `timeCost`

---

## Set Pieces

Set pieces are named, parameterized prefab subgraphs. They participate in macro-level
topology as a unit (a "super-node") and may intentionally violate standard topology rules
to represent interesting real-world configurations.

### In scope: `careless-user`

A workstation that has been inadvertently bridged to a fileserver that is otherwise
protected by a firewall. The workstation connects to the gateway (or a router near
the gateway), bypassing the firewall's gate. This creates a soft alternate path into
a node that should be hard to reach.

**Nodes:** `workstation` (low grade) + `fileserver` (medium grade) + `firewall`
(present but not required to reach the fileserver via this path)

**Connections:**
- `workstation` ← router/gateway (standard)
- `workstation` → `fileserver` (the exposure — bypasses firewall)
- `fileserver` ← `firewall` (still present; players who don't find the exposure face the hard path)

**Topology rule violation:** fileserver is normally behind a gate; here it is also
accessible via a soft path. This is the intentional narrative point.

**Parameters:** workstation grade, fileserver grade, firewall grade (tuned by moneyCost)

### Future set pieces (out of scope for this session)

- **Workstation array** — multiple low-grade workstations behind a router for methodical looting
- **Lucky break** — a low-grade firewall in front of a cryptovault (the corp cut corners)
- **Security theater** — low-grade fileservers behind a high-grade firewall (counting on the perimeter)

---

## Fallback Behaviour

When no generation parameters are provided:
- Browser: static `data/network.js` is used
- Harness: static `data/network.js` is used (existing behaviour preserved)

When parameters are provided, the generator runs and its output replaces the static network.

---

## Testing

**Determinism:** The same `{ seed, timeCost, moneyCost }` must always produce an
identical `NETWORK` object. Verified by snapshot tests.

**Snapshot tests:** Capture the generated network for a set of representative
`{ seed, timeCost, moneyCost }` combinations and assert the output does not drift
across code changes.

**Headless playtesting:** After generation, run representative scenarios through the
playtest harness:
- F/F (easy): should be completable quickly with a default hand
- B/B (medium): should require some card management and ICE avoidance
- S/S (hard): should require the darknet store and careful routing

**Structural validation:** The generator must produce a network that passes basic sanity
checks — connected graph, reachable mission target, no orphaned nodes.

---

## Out of Scope

- Biome system (node type palette, flavor, set piece selection by biome)
- Solvability guarantees (the darknet store is the escape valve for bad hands)
- Multiple ICE instances or ICE type variants
- Additional set pieces beyond `careless-user`
- Overworld integration
- Grade scale expansion (E grade, etc.)
