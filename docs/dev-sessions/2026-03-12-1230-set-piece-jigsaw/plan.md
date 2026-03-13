# Plan: Set-Piece Jigsaw for Procedural Generation

## Overview

11 phases, building bottom-up: directory restructure → metadata schema →
annotate existing pieces → create atomics → biome catalog → budget tables →
skeleton generator → slot filler → assembly + output → validation →
integration + smoke test.

Each phase is testable independently and builds on the previous one.

## Directory Structure

The set-piece catalog and procgen system get their own top-level directory,
separate from the node-graph runtime:

```
js/core/network/
  set-pieces.js      — catalog (moved from node-graph/set-pieces.js)
  atomics.js         — gateway, router, firewall, workstation, fileserver
  budget.js          — grade tables, tag weights, cost budget
  skeleton.js        — skeleton generator (pass 1)
  slot-filler.js     — slot filling (pass 2)
  assemble.js        — grade scaling, vulns, ICE, output assembly
  validate.js        — structural validators
  generate.js        — top-level entry point with retry

data/biomes/
  corporate.js       — corporate biome catalog
```

`js/core/node-graph/` stays focused on the runtime: operators, triggers,
effects, actions, conditions, graph execution. The `instantiate()` function
stays with the set-piece catalog (it rewrites set-piece IDs, not a runtime
concern). `game-types.js` stays in `node-graph/` since it's trait resolution
machinery that the generator imports from.

---

## Phase 0: Directory Restructure

**Goal:** Move set-pieces out of `node-graph/` into `js/core/network/` before
adding new code. Clean separation of runtime vs content/generation.

**Tasks:**

1. Create `js/core/network/` directory.

2. Move `js/core/node-graph/set-pieces.js` → `js/core/network/set-pieces.js`.
   This carries the set-piece catalog, the `instantiate()` function, and all
   `SetPieceDef` / `SetPieceInstance` typedefs.

3. Move `js/core/node-graph/set-pieces.test.js` → `tests/network/set-pieces.test.js`
   (or equivalent test location).

4. Update all imports across the codebase:
   - `data/networks/corporate-foothold.js`
   - `data/networks/research-station.js`
   - `data/networks/corporate-exchange.js`
   - Any test files that import set-pieces
   - Any other files referencing `node-graph/set-pieces`

5. Verify nothing else in `node-graph/` directly imports from set-pieces
   (the dependency should be one-way: set-pieces imports from node-graph,
   not the reverse).

**Verify:** `make check` passes. All three hand-crafted networks still work.
Playtest harness works. Game loads in browser.

---

## Phase 1: Metadata Schema + Types

**Goal:** Define the JSDoc typedefs for the new metadata fields so everything
that follows has a shared vocabulary.

**Context:** The existing `SetPieceDef` type (now in `js/core/network/set-pieces.js`
after Phase 0) has `id`, `description`, `nodes`, `internalEdges`, `triggers`,
`externalPorts`. We're adding `tags`, `cost`, `ports`, and `requires` alongside
the existing fields (not replacing them — `externalPorts` stays for backward compat).

**Tasks:**

1. In `js/core/network/set-pieces.js`, extend the `SetPieceDef` typedef:
   - `tags: string[]` — role tags (entry, spine, filler, treasure, etc.)
   - `cost: string` — grade F through S
   - `ports: Port[]` — typed connection points
   - `requires?: Dependency[]` — long-range companion requirements

2. Add new typedefs in the same file (or in `types.js` if that's cleaner):
   ```js
   /** @typedef {Object} Port
    *  @property {string} nodeId
    *  @property {"inbound"|"outbound"|"lateral"} direction
    *  @property {string[]} wantsTags
    *  @property {boolean} required
    */

   /** @typedef {Object} Dependency
    *  @property {string} role — identifier for linking (quality counter name)
    *  @property {string[]} tags — what the companion piece should have
    *  @property {number} count — how many companions needed
    *  @property {"deeper"|"shallower"|"any"} placement
    */
   ```

3. Add a `BiomeDef` typedef:
   ```js
   /** @typedef {Object} BiomeDef
    *  @property {string} id
    *  @property {{ threat: string, wealth: string, complexity: string, depth: string }} defaultBudget
    *  @property {SetPieceDef[]} catalog
    */
   ```

4. Add a `NetworkSpec` typedef:
   ```js
   /** @typedef {Object} NetworkSpec
    *  @property {string} threat — grade
    *  @property {string} wealth — grade
    *  @property {string} complexity — grade
    *  @property {string} depth — grade
    *  @property {{ tags: string[], placement: string }|null} [missionTarget]
    */
   ```

**Verify:** `make lint` passes (no type errors from new typedefs).

---

## Phase 2: Annotate Existing Set-Pieces with Metadata

**Goal:** Add `tags`, `cost`, and `ports` to all 16 existing set-piece
definitions. This validates the schema against real content.

**Context:** Each set-piece currently defines `externalPorts` as a flat array
of node ID strings. The new `ports` array carries the same node IDs but with
direction, wantsTags, and required metadata. Both fields coexist.

**Tasks:**

For each of the 16 existing set-pieces in `set-pieces.js`, add metadata
following the classification table from the spec. Example for `idsRelayChain`:

```js
tags: ["defense"],
cost: "C",
ports: [
  { nodeId: "ids", direction: "inbound", wantsTags: [], required: true },
  { nodeId: "monitor", direction: "outbound", wantsTags: ["filler", "treasure"], required: false },
],
```

Work through all 16 pieces:
- `idsRelayChain` — defense, cost C
- `nthAlarm` — pressure/trap, cost C
- `combinationLock` — puzzle/treasure/gate, cost B
- `deadmanCircuit` — pressure/trap, cost B
- `switchArrangement` — filler/puzzle, cost D
- `multiKeyVault` — puzzle/treasure, cost D (add `requires` for long-range variant)
- `honeyPot` — trap, cost A
- `encryptedVault` — puzzle/treasure, cost B
- `cascadeShutdown` — pressure/puzzle, cost A
- `tripwireGauntlet` — pressure, cost B
- `probeBurstAlarm` — pressure/defense, cost A
- `noisySensor` — defense/pressure, cost C
- `tamperDetect` — defense/puzzle, cost B
- `serverBank` — filler/treasure, cost D
- `officeCluster` — filler/treasure, cost D

For each, decide:
- Which node is the inbound port (the one that connects toward gateway)?
- Which nodes are outbound ports (connect to deeper content)?
- What tags should outbound ports want?

**Verify:** `make check` passes. Existing hand-crafted networks still work
(metadata is additive, doesn't change behavior).

---

## Phase 3: Create Atomic Set-Pieces

**Goal:** Create the small, single-node (or few-node) set-pieces needed to
fill the "everything is a set-piece" model: gateway+WAN, router, firewall,
workstation, single fileserver.

**Context:** The hand-crafted networks currently create these via
`createGateway()`, `createRouter()`, etc. from `game-types.js`. We need
equivalent set-piece definitions so the generator can place them uniformly.

**Tasks:**

1. Create `entryPoint` set-piece:
   - Nodes: gateway (type: gateway, visibility: accessible) + wan (type: wan)
   - Internal edge: gateway → wan
   - Tags: `["entry"]`, cost: `"F"`
   - Ports: gateway outbound (wantsTags: ["spine", "gate"], required: true)

2. Create `singleRouter` set-piece:
   - Nodes: router (type: router)
   - Tags: `["spine", "gate"]`, cost: `"F"`
   - Ports: inbound (required: true), 2-3 outbound (wantsTags: [], required: false)

3. Create `singleFirewall` set-piece:
   - Nodes: firewall (type: firewall)
   - Tags: `["gate"]`, cost: `"D"`
   - Ports: inbound (required: true), 1 outbound (wantsTags: ["treasure", "puzzle"], required: true)

4. Create `singleWorkstation` set-piece:
   - Nodes: workstation (type: workstation)
   - Tags: `["filler"]`, cost: `"F"`
   - Ports: inbound (required: true), no outbound

5. Create `singleFileserver` set-piece:
   - Nodes: fileserver (type: fileserver)
   - Tags: `["filler", "treasure"]`, cost: `"F"`
   - Ports: inbound (required: true), no outbound

**Verify:** Each atomic piece can be instantiated and passed to NodeGraph
without errors. `make check` passes.

---

## Phase 4: Biome Catalog — Corporate

**Goal:** Assemble the annotated set-pieces into a corporate biome catalog.

**Context:** A biome is `{ id, defaultBudget, catalog }`. The catalog is the
array of all available set-pieces. This is the data the generator will draw
from.

**Tasks:**

1. Create `data/biomes/corporate.js`:
   ```js
   export const CORPORATE_BIOME = {
     id: "corporate",
     defaultBudget: { threat: "C", wealth: "B", complexity: "C", depth: "C" },
     catalog: [ ...all annotated set-pieces + atomics ],
   };
   ```

2. Import all set-pieces from `set-pieces.js` and atomics from Phase 3.

3. Export a helper `getCatalogByTags(tags)` that filters the catalog — this
   will be used heavily by the generator.

**Verify:** Import the biome, verify catalog length, verify filtering by
each tag returns expected pieces.

---

## Phase 5: Budget Tables + Grade Utilities

**Goal:** Define the grade-to-number mappings and budget arithmetic the
generator needs.

**Context:** The spec uses S/A/B/C/D/F grades for 4 axes. The generator needs
to convert these to numbers for comparison and arithmetic. The existing
`js/core/grades.js` may already have grade utilities.

**Tasks:**

1. Check existing `js/core/grades.js` for reusable utilities (grade ordering,
   comparison, shift).

2. Create `js/core/network/budget.js`:
   - Grade-to-number map: `{ F: 1, D: 2, C: 3, B: 4, A: 5, S: 6 }`
   - `gradeToNumber(grade)` / `numberToGrade(n)` conversion
   - `DEPTH_TABLE`: depth grade → max hop count
     (F: 2, D: 3, C: 4, B: 5, A: 6, S: 7)
   - `TAG_WEIGHTS`: how each budget axis maps to tag preferences
     ```js
     threat:     { defense: 3, pressure: 2, trap: 1 }
     wealth:     { treasure: 3, filler: 1 }
     complexity: { puzzle: 3, gate: 2 }
     ```
   - `GRADE_MODIFIER_TABLE`: network budget → grade offset for node scaling
     (F: -2, D: -1, C: 0, B: +1, A: +2, S: +3) — averaged across threat
     and complexity axes
   - `START_CASH_TABLE`: wealth grade → starting cash
   - `costBudget(spec)`: total cost points available for a given network spec
     (higher budgets = more/bigger pieces allowed)

**Verify:** Unit tests for grade conversion and budget calculation.

---

## Phase 6: Skeleton Generator (Pass 1)

**Goal:** Given a NetworkSpec, produce a tree of tag-slots representing the
abstract shape of the network.

**Context:** This is the core planning algorithm. It decides branching
structure, tag assignment per slot, and long-range dependency placement —
all without knowing which concrete set-pieces will fill each slot.

**Tasks:**

1. Create `js/core/network/skeleton.js`:

2. Define the skeleton node (slot) shape:
   ```js
   /** @typedef {Object} SkeletonSlot
    *  @property {string} id — unique slot identifier
    *  @property {string[]} tags — required tags for this slot
    *  @property {number} depth — hop distance from entry
    *  @property {SkeletonSlot[]} children — child slots
    *  @property {string|null} parentId — parent slot ID
    *  @property {boolean} isLeaf — no children expected
    *  @property {{ role: string, ownerSlotId: string }|null} [dependency]
    *      — if this slot fulfills a long-range dependency
    */
   ```

3. Implement `generateSkeleton(spec, biome, rng)`:
   - Precompute a **tag coverage map** from `biome.catalog` — for each tag and
     tag pair, which pieces exist? This prevents assigning unfillable slots.
   - Create root slot: `tags: ["entry"]`, depth 0
   - Compute max depth from `spec.depth`
   - For depth 1: always place a `spine` slot (the first router/switch)
   - For each subsequent depth level up to max:
     - Decide branching factor (1-3) based on budget magnitude and RNG
     - Assign tags to each branch based on weighted draw from TAG_WEIGHTS:
       - High threat: bias toward defense/pressure/trap
       - High wealth: bias toward treasure at leaves
       - High complexity: bias toward puzzle/gate
     - At least one branch at max depth should lead to a treasure slot
   - If `spec.missionTarget` is set, ensure a slot matching its tags exists
     at the specified placement
   - Cap all leaf slots with terminal tags (treasure or filler)

4. Implement long-range dependency placement:
   - After initial skeleton, walk the tree looking for slots whose tags match
     pieces with `requires`
   - For each dependency, add companion slots in appropriate branches at
     the required depth relationship

**Verify:** Unit test: given a spec, generates a valid tree. Check depth
limits, tag distribution, leaf capping. Test determinism: same seed + spec
→ same skeleton.

---

## Phase 7: Slot Filler (Pass 2)

**Goal:** Walk the skeleton tree and fill each slot with a concrete set-piece
from the biome catalog.

**Context:** This is where abstract tags meet concrete set-piece definitions.
The filler matches slots to pieces, instantiates them, and wires their ports
together.

**Tasks:**

1. Create `js/core/network/slot-filler.js`:

2. Implement `fillSkeleton(skeleton, biome, spec, rng)`:
   - Walk the skeleton depth-first
   - For each slot:
     a. Filter `biome.catalog` by:
        - Slot's tags (primary constraint — piece must have ALL slot tags)
        - Cost fits remaining budget
        - Piece has at least one inbound port
     b. If parent slot is filled, additionally filter by parent piece's
        outbound port `wantsTags` (compatibility filter)
     c. Pick from candidates (weighted by cost fit + RNG)
     d. Instantiate the piece with a unique prefix (slot ID as prefix)
     e. Apply `createGameNode()` to each instantiated node — this resolves
        traits, adding gameplay actions (probe, exploit, read, loot, etc.)
        and attributes (accessLevel, probed, visibility, etc.)
     f. Record which port is inbound, which are outbound
     g. Wire: parent piece's outbound port → this piece's inbound port
   - If a placed piece has more outbound ports than skeleton children:
     opportunistically fill extras with filler/treasure if budget remains
   - If a slot has no matching pieces in the catalog, generation fails (retry)

3. Return the accumulated nodes, edges, and triggers from all instantiated pieces.

**Important:** The skeleton generator (Phase 6) must only assign tag
combinations that exist in the biome catalog. Before assigning multi-tag
slots (e.g. `["defense", "puzzle"]`), verify at least one catalog piece
matches. Otherwise, fall back to single-tag slots.

**Verify:** Unit test: given a skeleton and biome catalog, produces a valid
filled network. All slots filled. All edges connect real node IDs.

---

## Phase 8: Assembly + Output

**Goal:** Wire the filled skeleton into a complete network output matching the
existing `{ graphDef, meta }` shape.

**Context:** After slot filling, we have a bag of instantiated nodes, edges,
and triggers. We need to apply grade scaling, assign vulnerabilities and
macguffins, determine ICE placement, compute starting cash, and produce the
recommended starting hand.

**Tasks:**

1. Create `js/core/network/assemble.js`:

2. Implement `assembleNetwork(filledPieces, spec, biome, rng)`:
   a. **Collect** all nodes, edges, triggers from filled pieces into flat arrays
   b. **Grade scaling**: compute grade modifier from spec (avg of threat +
      complexity axes). Apply offset to each node's base grade using
      `shiftGrade()`. Clamp to F-S range.
   c. **Vulnerability assignment**: for each hackable node, assign
      vulnerabilities based on final grade. Use existing vuln generation
      logic (currently in `initGame()` — extract into a shared helper).
      Higher grades → rarer/fewer vulns. Lower grades → more common vulns.
   d. **Macguffin assignment**: for each lootable node, generate macguffins
      using existing `generateMacguffin()`. Cash values scale with grade
      and depth. Extract from `initGame()` into shared helper.
   e. **ICE placement**: if threat grade >= B, find the security-monitor node
      (from a defense-tagged piece) and configure ICE there. ICE grade =
      threat grade.
   f. **Starting cash**: look up from wealth grade via START_CASH_TABLE
   g. **Recommended hand**: scan early-network nodes (depth 0-2), collect
      their actual assigned vulnerability IDs, pick 4-6 matching vuln IDs.
      (This works because vulns are now assigned during assembly, not later.)
   h. **Mission target**: if `spec.missionTarget` was set, find the matching
      node and flag its macguffin; otherwise leave null for `initGame()` to
      pick randomly.

3. Produce the output object:
   ```js
   {
     graphDef: { nodes, edges, triggers },
     meta: { networkName, networkType: "generated", biome, seed, spec,
             startCash, moneyCost, iceConfig, recommendedHand, missionTarget }
   }
   ```

4. **Refactor `initGame()`** in `js/core/state/index.js`:
   - Extract vuln assignment and macguffin generation into shared helpers
     (e.g. `js/core/network/assign-vulns.js`, `js/core/network/assign-loot.js`)
   - Generator calls these helpers during assembly
   - `initGame()` calls the same helpers for hand-crafted networks (which
     don't pre-assign vulns/macguffins)
   - If a node already has vulns/macguffins (from generator), `initGame()`
     skips assignment for that node
   - Net effect: hand-crafted networks behave identically; generated networks
     arrive fully populated

**Verify:** This phase touches `initGame()` which is critical path for ALL
networks. Verification must be thorough:
- `make check` passes (all 523+ existing tests)
- All 3 hand-crafted networks play correctly via playtest harness:
  ```bash
  node scripts/playtest.js --network corporate-foothold reset && node scripts/playtest.js "status full"
  node scripts/playtest.js --network research-station reset && node scripts/playtest.js "status full"
  node scripts/playtest.js --network corporate-exchange reset && node scripts/playtest.js "status full"
  ```
- Verify vulns and macguffins are assigned (not empty) on hand-crafted networks
- Bot still runs against all 3 hand-crafted networks with same results as before
- Generated network output passes through `initGame()` without errors

---

## Phase 9: Validation (Pass 3)

**Goal:** Verify the assembled network meets structural and gameplay
invariants.

**Tasks:**

1. Create `js/core/network/validate.js`:

2. Implement validators:
   - `reachability(graphDef)` — BFS from gateway reaches at least one node
     with the lootable trait
   - `missionTargetExists(graphDef)` — at least one node has macguffins
   - `defenseCoverage(graphDef, spec)` — if threat >= C, at least one
     defense-tagged piece exists (check for IDS or security-monitor node)
   - `noDanglingDeps(filledPieces)` — all long-range dependencies were placed
   - `budgetAdherence(filledPieces, spec)` — total cost within 150% of budget

3. Implement `validate(graphDef, filledPieces, spec)`:
   - Run all validators, collect errors
   - Return `{ valid: boolean, errors: string[] }`

4. Create the top-level generator entry point `js/core/network/generate.js`:
   - `generateNetwork(seed, spec, biome)`:
     - For attempt 1..10:
       - Create seeded RNG from `"${seed}-network-${attempt}"`
       - Generate skeleton
       - Fill skeleton
       - Assemble network
       - Validate
       - If valid, return output
     - If all attempts fail, throw with collected errors

**Verify:** Unit test validators individually. Integration test: generate a
network from the corporate biome and verify all validators pass.

---

## Phase 10: Integration + Smoke Test

**Goal:** Wire the generator into the game so generated networks are playable,
and verify with the bot player.

**Tasks:**

1. Create `data/networks/generated.js`:
   ```js
   import { generateNetwork } from '../../js/core/network/generate.js';
   import { CORPORATE_BIOME } from '../biomes/corporate.js';

   export function buildNetwork(seed, spec) {
     return generateNetwork(seed, spec ?? CORPORATE_BIOME.defaultBudget, CORPORATE_BIOME);
   }
   ```

2. Wire into the bot CLI (`scripts/bot/cli.js`):
   - Add `--generated` flag that uses the generator instead of hand-crafted
   - Accept `--threat`, `--wealth`, `--complexity`, `--depth` grade flags
   - Bot uses `meta.recommendedHand` to self-award starting cards

3. Wire into the playtest harness (`scripts/playtest.js`):
   - Add `--generated` flag with same grade options
   - Use recommended hand for starting cards

4. Wire into browser level-select (`js/ui/main.js` or equivalent):
   - Add a "Generate Network" option alongside existing hand-crafted choices
   - Default to biome's default budget; allow grade overrides

5. **Smoke test with bot:**
   ```bash
   node scripts/bot/cli.js --generated --seed test-1 --verbose
   node scripts/bot/cli.js --generated --threat B --wealth A --seed test-2
   ```
   - Verify bot can play to completion (or at least make meaningful progress)
   - Run 10 seeds, check for crashes, hangs, and degenerate networks
   - Compare bot performance against hand-crafted network baselines

6. **Smoke test in browser:**
   - Generate a network, play it manually
   - Verify graph renders, all actions work, ICE behaves, mission completes

7. Update Makefile:
   - Add `make generate` target for quick generator testing
   - Update `make bot-run` to support `--generated` flag

**Verify:** `make check` passes. Bot completes at least some generated
networks. Browser play works end-to-end.

---

## Phase Summary

| Phase | Module | Depends On | Key Output |
|-------|--------|-----------|------------|
| 0 | Directory restructure | — | `js/core/network/set-pieces.js` moved |
| 1 | Metadata types | Phase 0 | Port, Dependency, BiomeDef, NetworkSpec typedefs |
| 2 | Annotate set-pieces | Phase 1 | 16 pieces with tags, cost, ports |
| 3 | Atomic set-pieces | Phase 1 | 5 new atomic pieces |
| 4 | Biome catalog | Phases 2-3 | `data/biomes/corporate.js` |
| 5 | Budget tables | — | Grade mappings, tag weights, cost budget |
| 6 | Skeleton generator | Phases 4, 5 | `generateSkeleton()` |
| 7 | Slot filler | Phases 4, 5, 6 | `fillSkeleton()` |
| 8 | Assembly + output | Phase 7 | `assembleNetwork()` with grade scaling, vulns, ICE |
| 9 | Validation + entry point | Phase 8 | `generateNetwork()` with retry |
| 10 | Integration | Phase 9 | Playable in bot + browser |

Phase 0 is a pure refactor (move + repoint imports).
Phases 1-3 can be done in sequence quickly (mostly data annotation).
Phases 4-5 are small standalone modules.
Phases 6-9 are the core algorithm, each building on the previous.
Phase 10 is integration and testing.

---

## Risk Notes

- **Catalog coverage**: If the biome catalog doesn't have pieces matching a
  skeleton slot's tags, generation fails. Mitigation: the atomics (Phase 3)
  provide fallback pieces for every tag except `trap` (only `honeyPot` fills
  that). Ensure skeleton doesn't require tags with thin coverage unless budget
  demands it.

- **Budget tuning**: The grade-to-number tables will need iteration. Initial
  values are educated guesses. The bot is the primary tuning tool — run many
  seeds and adjust tables.

- **Set-piece port decisions**: Annotating ports (Phase 2) requires judgment
  about which node is inbound vs outbound. Getting this wrong means the
  generator wires pieces backward. Review carefully.

- **Long-range dependencies**: The `multiKeyVault` is the only current piece
  that would use `requires`. Keep the dependency system simple for v1 —
  one test case is enough to validate the mechanism.
