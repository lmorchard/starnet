# Plan: Procedural LAN Generation

## Overview

Eight implementation phases, each producing testable, integrated code.
No phase leaves orphaned code — every step wires into the existing engine.

The generator lives in `js/network-gen.js` and produces a NETWORK-shaped object
compatible with the existing `initState(network)` API. It uses its own local seeded
RNG (not the global `js/rng.js`) so it is fully self-contained and does not affect
gameplay randomness.

---

## Phase 1 — `js/grades.js`: Grade Utilities

**Builds on:** nothing new — pure utility module.

**After this phase:** a shared grade vocabulary usable by the generator, future
balance tuning, and any other module that needs to reason about the S/A/B/C/D/F scale.

### Prompt

Create `js/grades.js` with the following exports:

```js
// Ordered ascending: F=0 (easiest) ... S=5 (hardest)
export const GRADES = ["F", "D", "C", "B", "A", "S"];

// Reverse lookup: grade letter → index
export const GRADE_INDEX = Object.fromEntries(GRADES.map((g, i) => [g, i]));

// Parse a grade string, return the canonical letter or null if invalid.
export function parseGrade(s) { ... }

// Return a sub-array of GRADES between minGrade and maxGrade (inclusive).
export function gradeRange(minGrade, maxGrade) { ... }

// Pick a random grade between minGrade and maxGrade using the provided rng() callback.
export function randomGrade(rng, minGrade, maxGrade) { ... }

// Clamp a grade index to valid bounds, return grade letter.
export function clampGrade(index) { ... }

// Return the grade N steps above/below a given grade (clamped).
export function shiftGrade(grade, delta) { ... }
```

Write unit tests in `tests/grades.test.js` covering: GRADES order, gradeRange edge
cases (same min/max, full range, single-grade range), shiftGrade clamping at both ends.

---

## Phase 2 — `data/node-type-rules.js`: Topology Rule Data

**Builds on:** Phase 1 (uses grade constants for defaults).

**After this phase:** the topology grammar is expressed as data. The generator
(Phase 3) reads this file rather than hard-coding structural knowledge.

### Prompt

Create `data/node-type-rules.js` exporting `NODE_GEN_RULES` — a plain object keyed
by node type. Each entry describes how that type participates in generation:

```js
export const NODE_GEN_RULES = {
  wan:              { singleton: true, depth: -1, connectsTo: ["gateway"] },
  gateway:          { singleton: true, depth: 0,  connectsTo: ["router", "firewall", "router"] },
  router:           { depth: 1, connectsTo: ["workstation", "fileserver", "workstation"],
                      minCount: 1, maxCount: 2 },
  firewall:         { gateType: true, depth: 1,
                      connectsTo: ["fileserver", "cryptovault"],
                      minCount: 0, maxCount: 1 },
  workstation:      { leaf: true, depth: 2, minCount: 1, maxCount: 3 },
  fileserver:       { leaf: true, depth: 2, minCount: 1, maxCount: 2 },
  cryptovault:      { leaf: true, mustBehindGate: true, depth: 3,
                      minCount: 0, maxCount: 1 },
  ids:              { security: true, depth: 2,
                      connectsTo: ["security-monitor"] },
  "security-monitor": { singleton: true, security: true, leaf: true,
                        depth: 3, iceResident: true },
};
```

Fields:
- `singleton` — at most one of this type in the network
- `depth` — target depth layer (0 = gateway level); used for layout and grade scaling
- `connectsTo` — downstream node types this type may connect to (weighted by repetition)
- `gateType` — node gates neighbor reveal (matches `gateAccess` in `node-types.js`)
- `leaf` — no outgoing connections to non-security nodes
- `security` — part of the IDS/monitor chain
- `mustBehindGate` — must have a gate-type node on the path from gateway
- `iceResident` — ICE starts here
- `minCount` / `maxCount` — how many of this type the algorithm may place

No runtime logic in this file — pure data.

---

## Phase 3 — `js/network-gen.js`: Core Generator

**Builds on:** Phases 1–2. Produces a valid NETWORK object.

**After this phase:** `generateNetwork("seed", "C", "B")` returns a NETWORK object
that can be passed directly to `initState()`. The static network is still used by
the browser/harness — integration comes in Phases 6–7.

### Prompt

Create `js/network-gen.js`. The generator is self-contained: it includes its own
mini Mulberry32 RNG initialized from the seed string (using djb2 hash), with no
dependency on the global `js/rng.js`.

**RNG helpers (module-private):**

```js
function djb2(str) { /* standard djb2 hash → int32 */ }
function makeMulberry32(seed32) {
  let s = seed32;
  return () => { /* advance one step, return [0,1) float */ };
}
```

**Budget tables (module-level constants):**

```js
// timeCost grade → { iceGrade, depthBudget, gateCount }
const TIME_BUDGET = {
  F: { iceGrade: "F", depthBudget: 2, gateCount: 0 },
  D: { iceGrade: "D", depthBudget: 2, gateCount: 1 },
  C: { iceGrade: "C", depthBudget: 3, gateCount: 1 },
  B: { iceGrade: "B", depthBudget: 3, gateCount: 2 },
  A: { iceGrade: "A", depthBudget: 4, gateCount: 2 },
  S: { iceGrade: "S", depthBudget: 5, gateCount: 3 },
};

// moneyCost grade → { pathGradeMin, pathGradeMax, targetDepth }
const MONEY_BUDGET = {
  F: { pathGradeMin: "F", pathGradeMax: "D", targetDepth: 1 },
  D: { pathGradeMin: "F", pathGradeMax: "C", targetDepth: 1 },
  C: { pathGradeMin: "D", pathGradeMax: "B", targetDepth: 2 },
  B: { pathGradeMin: "C", pathGradeMax: "A", targetDepth: 3 },
  A: { pathGradeMin: "B", pathGradeMax: "S", targetDepth: 3 },
  S: { pathGradeMin: "A", pathGradeMax: "S", targetDepth: 4 },
};
```

**Label pools (module-level, per node type):**

```js
const LABELS = {
  gateway:          ["INET-GW-01", "INET-GW-02", "GW-MAIN"],
  router:           ["RTR-A", "RTR-B", "RTR-CORE", "RTR-EDGE"],
  firewall:         ["FW-CORE", "FW-PERIMETER", "FW-DMZ"],
  workstation:      ["WS-ALPHA", "WS-BETA", "WS-GAMMA", "WS-DELTA"],
  fileserver:       ["FS-VAULT", "FS-ARCHIVE", "FS-DATA"],
  cryptovault:      ["CRYPT-X9", "CRYPT-01", "VAULT-S"],
  ids:              ["IDS-01", "IDS-02", "IDS-EDGE"],
  "security-monitor": ["SEC-MON", "SEC-MON-01"],
  wan:              ["WAN"],
};
```

**Layout:** use a simple depth-layered layout. For each depth layer, distribute nodes
evenly across a fixed horizontal band. Depth 0 (gateway) at y=50; each additional
depth adds ~140px. Nodes in a layer spaced ~200px apart, centered around x=400.

**`generateNetwork(seed, timeCost, moneyCost)` algorithm:**

1. Validate inputs — `timeCost` and `moneyCost` must be valid grades; throw on invalid.
2. Initialize local RNG from `djb2(seed + "-network")`.
3. Look up `TIME_BUDGET[timeCost]` and `MONEY_BUDGET[moneyCost]`.
4. Assemble fixed anchors: wan (depth -1), gateway (depth 0), security-monitor (deepest layer).
5. Place security chain: ids node at depth (depthBudget − 1), connected to security-monitor.
6. Place routing layer: 1–2 router nodes at depth 1 (count driven by depthBudget/gateCount).
7. Place gate node(s): if gateCount ≥ 1, add a firewall at depth 1 connected to gateway.
8. Place mission target: one fileserver at targetDepth, connected through a router (or
   through the firewall if gateCount ≥ 2 and targetDepth is deep).
9. Optionally place cryptovault behind firewall (if gateCount ≥ 2 and moneyCost ≥ B).
10. Place filler: 1–2 workstations connected through a router.
11. Connect ids to one router (ids watches the routing layer).
12. Assign grades:
    - Gateway: one step below pathGradeMin (always a soft entry).
    - Routers: pathGradeMin.
    - Firewall: pathGradeMax.
    - Fileserver (mission target): randomGrade(rng, pathGradeMin, pathGradeMax).
    - Workstations: grade below pathGradeMin (soft targets).
    - IDS: one step above pathGradeMin.
    - Security-monitor: pathGradeMax.
13. Assign labels from per-type pools (randomPick, no repeats within a run).
14. Compute x/y positions from depth layers.
15. Return:
    ```js
    { nodes, edges, startNode: "gateway", ice: { grade: iceGrade, startNode: <security-monitor id> } }
    ```

Export only `generateNetwork`. No other public exports needed at this stage.

---

## Phase 4 — Validator Predicates

**Builds on:** Phase 3. Wraps the generator in a retry loop.

**After this phase:** the generator is robust — it retries on structurally invalid
output and throws a clear error if all attempts fail.

### Prompt

Add a private `validate(network)` function to `js/network-gen.js` that runs a set
of predicate checks on the generated network. Each predicate returns `null` on pass
or a string description of the failure:

```js
const VALIDATORS = [
  hasAnchors,           // wan, gateway, security-monitor all present
  idsAdjacentToMonitor, // at least one ids node connects to security-monitor
  missionTargetExists,  // at least one fileserver or cryptovault present
  noOrphanNodes,        // every node has at least one edge
  gatewayReachesTarget, // BFS from gateway reaches at least one lootable node
];
```

Implement `gatewayReachesTarget` as a BFS over the edges array — does not need to
simulate gating, just structural reachability.

In `generateNetwork`, wrap the build algorithm in a retry loop (max 10 attempts).
On each attempt, run `validate()`. If all validators pass, return the network.
If all attempts fail, throw an error listing the last failure reason.

Add tests in `tests/network-gen.test.js`:
- All validators pass for a minimal hand-built valid network
- `idsAdjacentToMonitor` fails when ids is not connected to security-monitor
- `gatewayReachesTarget` fails when target is disconnected

---

## Phase 5 — Set Piece: `careless-user`

**Builds on:** Phase 3–4. Adds the set piece facility and the first concrete piece.

**After this phase:** `generateNetwork` can optionally embed the `careless-user`
subgraph, blending it into the node/edge arrays before validation runs.

### Prompt

Create `js/set-pieces.js`. A set piece is a plain object:

```js
{
  id: "careless-user",
  // Nodes local to the set piece (ids relative to the piece, not the full network)
  nodes: [
    { localId: "ws", type: "workstation", gradeOffset: -1 },   // soft — below base grade
    { localId: "fs", type: "fileserver",  gradeOffset: 0  },   // at base grade
    { localId: "fw", type: "firewall",    gradeOffset: +1 },   // hardened
  ],
  // Edges internal to the set piece
  edges: [
    { source: "ws", target: "fs" },   // the exposure
    { source: "fw", target: "fs" },   // the firewall still protects (hard path)
  ],
  // How the set piece attaches to the main graph
  // type: the node type in the main graph to attach to
  // localId: which piece node gets the external connection
  externalAttachments: [
    { attachTo: "router",  localId: "ws", direction: "downstream" },
    { attachTo: "gateway", localId: "fw", direction: "downstream" },
  ],
}
```

Export `SET_PIECES` (the registry) and `applySetPiece(piece, network, rng, baseGrade)`
which:
1. Instantiates piece nodes with real ids (e.g. `sp-ws-1`, `sp-fs-1`, `sp-fw-1`)
2. Assigns grades using `gradeOffset` relative to `baseGrade` (clamped to valid range)
3. Assigns labels from per-type pools (same label pools as the generator)
4. Attaches to the main graph via `externalAttachments` (finds a matching node by type,
   adds an edge from that node to the piece node)
5. Merges the piece's nodes and edges into the network's arrays
6. Returns the mutated network

In `js/network-gen.js`, add set piece selection: if `moneyCost ≥ C` and `rng() < 0.6`,
apply the `careless-user` piece using the routing layer grade as `baseGrade`. If the
set piece fileserver is the only fileserver, it becomes the mission target.

---

## Phase 6 — Harness Integration

**Builds on:** Phases 3–5. Wires the generator into `scripts/playtest.js`.

**After this phase:** the harness can generate and play through a procedural LAN
from the command line.

### Prompt

Update `scripts/playtest.js`:

1. Add `--time <grade>` and `--money <grade>` to the argument parser (alongside the
   existing `--seed` and `--state` flags).

2. At the top of the file, after argument parsing, determine which network to use:
   ```js
   import { generateNetwork } from "../js/network-gen.js";
   // ...
   const network = (timeArg && moneyArg)
     ? generateNetwork(seedArg ?? "default", timeArg, moneyArg)
     : NETWORK;
   ```

3. Replace all hardcoded `NETWORK` references in the file with the `network` variable.

4. Update the `reset` command output to report generation parameters when present:
   ```
   [SYS] Initialized. Seed: "abc". Network: 9 nodes (generated: time=C money=B).
   ```

5. Update the usage/help block to document the new flags.

Verify by running:
```bash
node scripts/playtest.js --seed test --time F --money F reset
node scripts/playtest.js --seed test --time F --money F "status full"
node scripts/playtest.js --seed test --time C --money B reset
node scripts/playtest.js --seed test --time C --money B "status full"
```

---

## Phase 7 — Browser URL Parameter Integration

**Builds on:** Phase 6. Wires the generator into the browser entry point.

**After this phase:** opening `index.html?seed=abc&time=C&money=B` loads a generated
LAN. No params = static `data/network.js` as before.

### Prompt

Update `js/main.js`:

1. Import `generateNetwork` from `js/network-gen.js`.
2. Add a `getNetworkParams()` helper that reads URL search params:
   ```js
   function getNetworkParams() {
     const p = new URLSearchParams(location.search);
     const seed  = p.get("seed");
     const time  = p.get("time")?.toUpperCase();
     const money = p.get("money")?.toUpperCase();
     if (seed && time && money) return { seed, timeCost: time, moneyCost: money };
     return null;
   }
   ```
3. In the `init()` function (and `run-again` handler), determine which network to use:
   ```js
   const params = getNetworkParams();
   const network = params
     ? generateNetwork(params.seed, params.timeCost, params.moneyCost)
     : NETWORK;
   initState(network, params?.seed);
   ```
4. If `generateNetwork` throws (invalid params), fall back to the static network and
   log a warning to the browser console.

Test by opening the browser at:
- `index.html` — static network, no change
- `index.html?seed=hello&time=F&money=F` — easy generated network
- `index.html?seed=hello&time=B&money=B` — medium generated network

---

## Phase 8 — Snapshot & Structural Tests

**Builds on:** Phases 3–5. Locks determinism and structural correctness.

**After this phase:** a failing snapshot or structural test means the generator
drifted — caught before the change lands.

### Prompt

Create `tests/network-gen.test.js`:

**Determinism tests:**
- Call `generateNetwork("testseed", "C", "B")` twice in the same test and assert
  the two results are deeply equal (JSON.stringify comparison is fine).
- Repeat for ("abc", "F", "F") and ("xyz", "S", "S").

**Structural tests (run for each of F/F, C/C, B/B, S/S):**
- Network has a `wan`, `gateway`, and `security-monitor` node
- Network has at least one `fileserver` or `cryptovault`
- `security-monitor` is adjacent to an `ids` node (check edges)
- All nodes referenced in edges exist in the nodes array
- BFS from `startNode` reaches at least one lootable node type

**Snapshot tests:**
For each of the following parameter sets, generate a network and compare against
a stored JSON snapshot:
- `("snap-seed", "F", "F")`
- `("snap-seed", "C", "C")`
- `("snap-seed", "B", "B")`
- `("snap-seed", "S", "S")`

On first run, write the snapshot to `tests/snapshots/network-gen-{params}.json`.
On subsequent runs, compare and fail if the output differs.

Use Node's `fs` module to read/write snapshots. If the file doesn't exist, create it
(test passes on first run). If it exists, assert equality.

---

## Phase 9 — Headless Playtesting & Balance Notes

**Builds on:** Phase 6 (harness flags). Human-driven validation.

**After this phase:** we have documented evidence that generated LANs at F/F and B/B
are actually playable, and notes on what to tune.

### Prompt

Run each scenario below through the playtest harness and record observations in
`docs/dev-sessions/2026-03-01-1458-procedural-lan-gen/notes.md`.

**Easy run (F/F):**
```bash
node scripts/playtest.js --seed "easy-test" --time F --money F reset
node scripts/playtest.js --seed "easy-test" --time F --money F "status full"
# play through: probe gateway, exploit nodes, loot mission target, jackout
```
Questions to answer: Is the network reachable with a default hand? Is it too easy
(too few nodes, trivial ICE)? Does the careless-user set piece appear and is it
noticeable?

**Medium run (B/B):**
```bash
node scripts/playtest.js --seed "mid-test" --time B --money B reset
node scripts/playtest.js --seed "mid-test" --time B --money B "status full"
# play through: probe, exploit, manage ICE, use cheat give matching if needed
```
Questions to answer: Does ICE B-grade pressure feel meaningful? Are the critical path
grades appropriately hard? Is the network depth satisfying to explore?

**Regression check:**
Run `make check` and confirm all 224+ tests pass. Confirm snapshot tests capture
consistent output. Run both scenarios twice with the same seed to confirm determinism.

Record any balance observations, bugs, or design notes in `notes.md` for the retro.
