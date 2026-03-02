# Plan: Procgen Balance Tuning

## Overview

Five phases. The first three build the census tool incrementally (metrics →
resource estimation → report formatting). Phase 4 adds set piece test coverage.
Phase 5 is the tuning pass — driven by census data, not predetermined.

Each phase ends with working code that can be run and verified.

---

## Phase 1 — Topology Metrics Module

**Builds on:** `js/network-gen.js` (generator output).

**After this phase:** a pure-function module that takes a generated network and
returns topology metrics (node counts, critical path, gates on path, grades on
path, set piece detection). No CLI yet — just the analysis functions.

### Prompt

Create `scripts/census-metrics.js`. This module exports analysis functions that
operate on a generated network object (the return value of `generateNetwork`).
No game state needed — these work purely on `{ nodes, edges, startNode, ice }`.

**`analyzeTopology(network)`** returns:

```js
{
  nodeCount:       number,              // network.nodes.length
  nodesByType:     Record<string, number>, // { router: 2, workstation: 3, ... }
  criticalPath:    string[],            // ordered node IDs from startNode to nearest lootable
  critPathLength:  number,              // criticalPath.length
  critPathGrades:  string[],            // grades along critical path (excluding wan/gateway)
  critPathGates:   number,              // firewall count on critical path
  iceGrade:        string,              // network.ice.grade
  setPieceFired:   boolean,             // heuristic: more nodes than layer definitions would produce
}
```

**Critical path:** BFS from `network.startNode` over undirected edges to the
nearest node whose type is `fileserver` or `cryptovault`. Return the path as an
ordered array of node IDs. The path includes the start node and the target.

**Gate detection:** count nodes on the critical path whose type is `firewall`.

**Set piece detection:** the corporate biome's layer definitions produce a
deterministic base node count given the budget parameters. If the actual node
count exceeds this (extra workstation + fileserver + firewall from careless-user),
a set piece fired. A simpler heuristic: check if the network has more than one
firewall when the budget's `gateCount` is 1, or count firewall nodes beyond what
`gateCount` specifies. The simplest approach: count total nodes and compare to
the count without set pieces. For now, use the heuristic "network has nodes of
type `firewall` beyond what `TIME_BUDGET[tc].gateCount` would produce" — this
works for careless-user since it adds a firewall. Accept that this heuristic is
corporate-biome-specific.

Actually, the cleanest approach: run `generateNetwork` normally and note the node
count, then compare with the known layer formulas. But since we're analyzing an
already-generated network, not generating twice, use this heuristic: the
careless-user piece adds exactly 3 nodes (workstation + fileserver + firewall).
Count firewalls in the network vs expected from gateCount. If there are more
firewalls than `gateCount` produced, a set piece likely fired.

Write a test in `scripts/census-metrics.test.js`:
- Build a minimal hand-crafted network object and verify `analyzeTopology`
  returns correct values for node count, path length, and gate count
- Verify BFS finds the shortest path (not just any path)

Run `make check` — new test file needs to match the glob `js/*.test.js` or
`js/**/*.test.js`. Since scripts/ isn't covered, either add the glob to the
Makefile or move the test. Simplest: add `scripts/*.test.js` to the Makefile
test command.

---

## Phase 2 — Resource Estimation

**Builds on:** Phase 1 (topology metrics).

**After this phase:** `estimateResources` takes topology metrics + budget
parameters and returns expected card uses, starting resources, and deficit.

### Prompt

Add `estimateResources(topology, moneyCost)` to `scripts/census-metrics.js`.

This function computes statistical expectations for a skilled player run. It
does NOT import game modules — all constants are inlined or passed as parameters
to keep the census tool self-contained and fast.

**Constants to inline** (from `js/combat.js` and `js/exploits.js`):

```js
const GRADE_MODIFIER = { S: 0.05, A: 0.15, B: 0.30, C: 0.50, D: 0.70, F: 0.90 };
const MATCH_BONUS = 0.40;
const SUCCESS_CAP = 0.95;
const EXPLOITS_TO_OWN = 2;  // locked → compromised → owned

const AVG_QUALITY = { common: 0.375, uncommon: 0.60, rare: 0.825 };
const CARD_USES   = { common: 3, uncommon: 5, rare: 8 };

// From network-gen.js
const HAND_BUDGET = {
  F: ["common", "common", "uncommon", "uncommon", "uncommon", "rare"],
  D: ["common", "common", "uncommon", "uncommon", "uncommon", "rare"],
  C: ["common", "common", "uncommon", "uncommon", "uncommon", "rare", "rare"],
  B: ["common", "uncommon", "uncommon", "uncommon", "uncommon", "rare", "rare"],
  A: ["uncommon", "uncommon", "uncommon", "uncommon", "uncommon", "rare", "rare", "rare"],
  S: ["uncommon", "uncommon", "uncommon", "uncommon", "uncommon", "rare", "rare", "rare"],
};
const CASH_BUDGET = { F: 1000, D: 1000, C: 1250, B: 1500, A: 2000, S: 2500 };
const STORE_PRICES = { common: 100, uncommon: 250, rare: 500 };
```

**`estimateResources(topology, moneyCost)`** returns:

```js
{
  // Per-node breakdown on critical path (excluding wan, gateway — those are
  // pre-accessible or trivial)
  perNode: [
    { grade: "C", successProb: 0.70, expectedUses: 2.86 },
    ...
  ],

  // Totals
  totalExpectedUses:  number,   // sum of expectedUses across critical path nodes
  startingUses:       number,   // sum of CARD_USES for each card in starting hand
  cardDeficit:        number,   // max(0, totalExpectedUses - startingUses)
  startingCash:       number,   // CASH_BUDGET[moneyCost]
  handSize:           number,   // HAND_BUDGET[moneyCost].length
  avgCardQuality:     number,   // weighted average quality for the hand
}
```

**Success probability per node:**
```js
const avgQuality = weightedAvgQuality(HAND_BUDGET[moneyCost]);
const prob = Math.min(SUCCESS_CAP, avgQuality * GRADE_MODIFIER[grade] + MATCH_BONUS);
const expectedUses = EXPLOITS_TO_OWN / prob;
```

**Nodes to exclude from critical path cost:** `wan` and `gateway` — the gateway
is the start node (already accessible) and wan is always pre-owned. If the
critical path starts with gateway, skip it. Also skip any node type that doesn't
require exploiting (wan is grade D but the player starts there).

**Note: inlined constants.** The combat math constants (GRADE_MODIFIER,
MATCH_BONUS, card qualities, store prices, hand/cash budgets) are inlined in
this module rather than imported from game modules. This keeps the census tool
self-contained and avoids pulling in game state dependencies. Trade-off: if
combat math changes in a future session, these values need manual sync. Consider
revisiting this if the constants drift or if the game modules become importable
without side effects.

Add tests:
- `estimateResources` with a known topology at F/F should produce low expected
  uses and negative deficit (surplus)
- At S/S should produce high expected uses
- Verify `avgCardQuality` computation against hand calculation

---

## Phase 3 — Census CLI + Report Formatting

**Builds on:** Phases 1–2 (metrics + estimation).

**After this phase:** `node scripts/network-census.js` produces the full report.
This is the main deliverable of the session.

### Prompt

Create `scripts/network-census.js`. This is a CLI script (not a module) that:

1. Parses arguments:
   - `--detail <TC>,<MC>` — show per-seed breakdown for one combo (or `all`)
   - `--seeds <N>` — override sample count (default 10)
   - No args = summary table for all 36 combos

2. For each combo (timeCost × moneyCost, both iterating F/D/C/B/A/S):
   - Generate `N` networks using seeds `census-0` through `census-(N-1)`
   - Run `analyzeTopology` and `estimateResources` on each
   - Collect min/avg/max for numeric metrics

3. Print the report in this format:

**Summary table** (always printed):
```
=== NETWORK CENSUS REPORT ===
Seeds: census-0 through census-9 (10 per combo)

--- SUMMARY TABLE ---
TC  MC  Nodes   CritPath  Gates  CritGrades       EstUses  StartUses  Deficit  Hand  SetPiece%
F   F   avg     avg       avg    most-common      avg      value      avg      size  pct
...
```

Column notes:
- `Nodes`, `CritPath`, `Gates`, `EstUses`, `Deficit` — show average across seeds,
  rounded to 1 decimal
- `CritGrades` — show the grade sequence from the first seed (representative)
- `StartUses` — deterministic per combo (same hand), show once
- `Hand` — card count from `HAND_BUDGET`
- `SetPiece%` — percentage of seeds where set piece fired

**Detail view** (when `--detail` specified):
```
--- DETAIL: B/B (10 seeds) ---
Seed       Nodes  Path  Gates  Grades         EstUses  Piece?
census-0   11     3     1      C,B,A          16.2     no
census-1   14     4     2      C,B,A,B        19.1     yes
...
Min        11     3     1      —              15.8     —
Max        14     4     2      —              19.1     —
Avg        11.8   3.2   1.2    —              17.1     30%
```

4. Add a `census` target to the Makefile:
```make
census:
	node scripts/network-census.js
```

Verify by running: `node scripts/network-census.js` and
`node scripts/network-census.js --detail C,C`.

---

## Phase 4 — Set Piece Snapshot Test

**Builds on:** existing `js/network-gen.test.js`.

**After this phase:** the set piece path has test coverage.

### Prompt

Add a test to `js/network-gen.test.js`:

```js
describe("generateNetwork: set pieces", () => {
  it("deterministic with forcePieces careless-user", () => {
    const a = generateNetwork("sp-test", "B", "B", { forcePieces: ["careless-user"] });
    const b = generateNetwork("sp-test", "B", "B", { forcePieces: ["careless-user"] });
    assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
  });

  it("careless-user adds expected nodes", () => {
    const without = generateNetwork("sp-compare", "B", "B");
    const withPiece = generateNetwork("sp-compare", "B", "B", { forcePieces: ["careless-user"] });
    // careless-user adds 3 nodes: workstation, fileserver, firewall
    assert.ok(withPiece.nodes.length >= without.nodes.length + 3);
    // Should have at least 2 firewalls (1 from gate layer + 1 from set piece)
    const fwCount = withPiece.nodes.filter(n => n.type === "firewall").length;
    assert.ok(fwCount >= 2, `expected ≥2 firewalls, got ${fwCount}`);
  });
});
```

Add a snapshot test for the forced set piece:
- Seed `"sp-snap"`, timeCost `"B"`, moneyCost `"B"`, `forcePieces: ["careless-user"]`
- Same snapshot file pattern as existing tests

`make check` passes.

---

## Phase 5 — Balance Tuning Pass

**Builds on:** Phase 3 (census data).

**After this phase:** budget tables and layer definitions are adjusted based on
census findings. Census is re-run to verify improvements.

### Prompt

This phase is data-driven. The process:

1. Run `node scripts/network-census.js` and `node scripts/network-census.js --detail all`
2. Save the output to `docs/dev-sessions/2026-03-01-1721-procgen-balance-tuning/census-before.txt`
3. Review the data with Les. Identify:
   - Combos where deficit > 0 (player can't complete with starting hand)
   - Combos where node count < 8 (feels too sparse)
   - Combos where node count > 16 (might be too sprawling)
   - Grade sequences that jump abruptly (e.g. F→S on adjacent nodes)
   - Set piece fire rates across the matrix
4. Make changes based on findings. Known candidates:
   - Filler layer: `count: ({ state }) => Math.max(2, state.routing?.length ?? 1)`
   - HAND_BUDGET at A/S: add 1–2 more cards
   - CASH_BUDGET review if deficit is high at mid grades
5. Re-run census. Save to `census-after.txt`
6. Compare before/after
7. Update snapshot tests if budget table changes shifted RNG

**This phase is collaborative** — the specific changes depend on what the census
reveals. The prompt above is a process, not a fixed set of code changes.

After tuning, `make check` must pass (update snapshots if needed).
