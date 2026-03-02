# Plan: Biome Bundle Refactor

## Overview

Seven phases. Each ends with `make check` passing and no orphaned code.
The generator's external API (`generateNetwork`) is unchanged throughout — only
internal structure changes. Snapshot tests act as the regression guard: if the
layer-processor calls `rng()` in a different order than the current hardcoded
`buildNetwork`, snapshots will catch it immediately.

**Key invariant:** preserve the exact sequence of `rng()` calls from the current
`buildNetwork` so snapshot tests remain stable without regeneration.

Current `rng()` call order in `buildNetwork`:
1. Label pool shuffles (all types, in `LABEL_POOLS` key order)
2. `pathGrade()` (randomGrade) for each router
3. `pathGrade()` for fileserver
4. `pick(rng, routerIds)` for fileserver edge (when no firewall or shallow target)
5. Set piece check (`rng() < 0.6`) then `pathGrade()` for base grade
6. `pick(rng, routerIds)` for each workstation edge

Grade calls that do NOT consume rng: `entryGrade`, `softGrade`, `hardGrade`
(all use `shiftGrade` which is deterministic).

---

## Phase 1 — Scaffold + enrich set-pieces

**Builds on:** existing `js/set-pieces.js`.

**After this phase:** set-piece definitions live in their future home, enriched
with `eligible` and `probability` fields for generic engine selection.

### Prompt

1. Create `js/biomes/corporate/` directory.

2. Create `js/biomes/corporate/set-pieces.js`. Copy the `SET_PIECES` registry
   from `js/set-pieces.js` and add two fields to the `"careless-user"` entry:
   ```js
   import { GRADE_INDEX } from "../../grades.js";

   export const SET_PIECES = {
     "careless-user": {
       // ... existing id, nodes, edges, externalAttachments unchanged ...
       eligible: ({ mc, state }) =>
         GRADE_INDEX[mc] >= GRADE_INDEX["C"] && (state.gate?.length ?? 0) > 0,
       probability: 0.6,
     },
   };
   ```

3. In `js/set-pieces.js`: remove the `SET_PIECES` export entirely (or replace with
   a re-export from the biome path if anything else imports it — check first).
   Keep `applySetPiece` — it stays in the engine layer.
   Update the file comment to reflect it now only exports `applySetPiece`.

4. Update `js/network-gen.js` imports:
   ```js
   import { applySetPiece } from "./set-pieces.js";
   import { SET_PIECES } from "./biomes/corporate/set-pieces.js";
   ```

5. `make check` passes.

---

## Phase 2 — `gen-rules.js`: role map + enriched node rules

**Builds on:** Phase 1.

**After this phase:** the biome has a `ROLES` map and `NODE_RULES` table with
`gradeRole`, `fixedGrade`, `labels`, and `minMoneyGrade`. Nothing reads these yet.

### Prompt

Create `js/biomes/corporate/gen-rules.js`.

**`ROLES`** — role name → type string:
```js
export const ROLES = {
  wan:     "wan",
  gateway: "gateway",
  monitor: "security-monitor",
  sensor:  "ids",
  gate:    "firewall",
  routing: "router",
  target:  "fileserver",
  premium: "cryptovault",
  filler:  "workstation",
};
```

**`NODE_RULES`** — absorbs `data/node-type-rules.js` with new fields added.
Carry over all existing fields (`singleton`, `depth`, `connectsTo`, `gateType`,
`leaf`, `security`, `mustBehindGate`, `iceResident`, `minCount`, `maxCount`).
Add per-type:

| type | gradeRole | fixedGrade | minMoneyGrade | labels |
|------|-----------|------------|---------------|--------|
| wan | — | `"D"` | — | `["WAN"]` |
| gateway | `"entry"` | — | — | `["INET-GW-01","INET-GW-02","GW-MAIN","GW-EDGE"]` |
| router | `"path"` | — | — | `["RTR-A","RTR-B","RTR-CORE","RTR-EDGE","RTR-01","RTR-02"]` |
| firewall | `"hard"` | — | — | `["FW-CORE","FW-PERIMETER","FW-DMZ","FW-01"]` |
| workstation | `"soft"` | — | — | `["WS-ALPHA","WS-BETA","WS-GAMMA","WS-DELTA","WS-01","WS-02","WS-03"]` |
| fileserver | `"path"` | — | — | `["FS-VAULT","FS-ARCHIVE","FS-DATA","FS-01","FS-02"]` |
| cryptovault | `"hard"` | — | `"B"` | `["CRYPT-X9","CRYPT-01","VAULT-S","VAULT-01"]` |
| ids | `"above-min"` | — | — | `["IDS-01","IDS-02","IDS-EDGE"]` |
| security-monitor | `"hard"` | — | — | `["SEC-MON","SEC-MON-01","MON-CORE"]` |

`gradeRole` values for the engine's `resolveGrade` helper (Phase 6):
- `"fixed"` — use `fixedGrade` field (WAN is always grade D)
- `"entry"` / `"soft"` — `shiftGrade(pathGradeMin, -1)` (no rng)
- `"path"` — `randomGrade(rng, pathGradeMin, pathGradeMax)` (consumes rng)
- `"hard"` — `pathGradeMax` (no rng)
- `"above-min"` — `shiftGrade(pathGradeMin, 1)` (no rng)

No runtime logic in this file — pure data. `make check` passes.

---

## Phase 3 — `gen-rules.js`: layer definitions

**Builds on:** Phase 2.

**After this phase:** `LAYERS` encodes the full corporate topology recipe as
behavior atoms. Nothing executes these yet.

### Prompt

Add `LAYERS` export to `js/biomes/corporate/gen-rules.js`.

Import `GRADE_INDEX` from `../../grades.js`.

Layer fields:
- `role` — key into `ROLES`
- `count` — number or `({ tc, mc, state }) => number`
- `depth` — number or `({ tc, mc }) => number`
- `gradeRole` — string
- `connectTo` — role string or `({ tc, mc, state }) => role string | null`
- `alsoConnectFrom` — optional role string: first spawned node of that role gets
  an edge TO each node in this layer (reverse chain)

```js
export const LAYERS = [
  {
    role: "wan",
    count: 1,
    depth: -1,
    gradeRole: "fixed",
    connectTo: null,
  },
  {
    role: "gateway",
    count: 1,
    depth: 0,
    gradeRole: "entry",
    connectTo: null,
    alsoConnectFrom: "wan",          // wan → gateway
  },
  {
    role: "monitor",
    count: 1,
    depth: ({ tc }) => tc.depthBudget,
    gradeRole: "hard",
    connectTo: null,
  },
  {
    role: "routing",
    count: ({ tc }) => tc.depthBudget >= 3 ? 2 : 1,
    depth: 1,
    gradeRole: "path",               // consumes rng — matches current order
    connectTo: "gateway",
  },
  {
    role: "gate",
    count: ({ tc }) => tc.gateCount >= 1 ? 1 : 0,
    depth: 1,
    gradeRole: "hard",               // no rng
    connectTo: "gateway",
  },
  {
    role: "sensor",
    count: 1,
    depth: ({ tc }) => Math.max(1, tc.depthBudget - 1),
    gradeRole: "above-min",          // no rng
    connectTo: "monitor",
    alsoConnectFrom: "routing",      // routing[0] → sensor
  },
  {
    role: "target",
    count: 1,
    depth: ({ tc, mc }) => Math.min(mc.targetDepth, tc.depthBudget),
    gradeRole: "path",               // consumes rng — matches current order
    connectTo: ({ state, mc }) =>
      (state.gate?.length ?? 0) > 0 && mc.targetDepth >= 2 ? "gate" : "routing",
  },
  {
    role: "premium",
    count: ({ mc, state }) =>
      (state.gate?.length ?? 0) > 0 && GRADE_INDEX[mc] >= GRADE_INDEX["B"] ? 1 : 0,
    depth: ({ tc }) => tc.depthBudget,
    gradeRole: "hard",               // no rng
    connectTo: "gate",
  },
  {
    role: "filler",
    count: ({ state }) => state.routing?.length ?? 1,
    depth: 2,
    gradeRole: "soft",               // no rng
    connectTo: "routing",            // pick(rng, ...) in engine — matches current order
  },
];
```

---

## Phase 4 — `validators.js`: biome-aware

**Builds on:** Phase 3.

**After this phase:** validators live in the biome, accept `(network, biome)`,
and reference `biome.roles` instead of hardcoded type strings.

### Prompt

Create `js/biomes/corporate/validators.js`.

Move the five validator functions from `network-gen.js`'s `VALIDATORS` array.
Update each to `(network, biome)` signature using `biome.roles`:

```js
// hasAnchors
const types = new Set(network.nodes.map((n) => n.type));
if (!types.has(biome.roles.wan))     return `missing ${biome.roles.wan} node`;
if (!types.has(biome.roles.gateway)) return `missing ${biome.roles.gateway} node`;
if (!types.has(biome.roles.monitor)) return `missing ${biome.roles.monitor} node`;

// idsAdjacentToMonitor
// use biome.roles.monitor and biome.roles.sensor

// missionTargetExists
const lootable = [biome.roles.target, biome.roles.premium].filter(Boolean);
return lootable.some((t) => types.has(t)) ? null : "no lootable node";

// noOrphanNodes — no role references needed (structural only)

// gatewayReachesTarget
// use biome.roles.target and biome.roles.premium
```

Export `VALIDATORS` as an array of these functions.

---

## Phase 5 — `corporate/index.js`: assemble the bundle

**Builds on:** Phases 1–4.

**After this phase:** `CORPORATE_BIOME` is a single importable bundle.

### Prompt

Create `js/biomes/corporate/index.js`:

```js
import { ROLES, NODE_RULES, LAYERS } from "./gen-rules.js";
import { VALIDATORS } from "./validators.js";
import { SET_PIECES } from "./set-pieces.js";

export const CORPORATE_BIOME = {
  id:         "corporate",
  roles:      ROLES,
  nodeRules:  NODE_RULES,
  layers:     LAYERS,
  validators: VALIDATORS,
  setPieces:  SET_PIECES,
};
```

`make check` passes.

---

## Phase 6 — Refactor `buildNetwork` as layer-processor

**Builds on:** Phases 1–5. The main structural change.

**After this phase:** `buildNetwork` is a generic execution engine — no hardcoded
type strings, grade decisions, label pools, or topology logic.

### Prompt

Update `js/network-gen.js`:

**New import:** `import { CORPORATE_BIOME } from "./biomes/corporate/index.js";`
Remove the `SET_PIECES` import (now via biome). Keep `applySetPiece`.

**`generateNetwork`:** add `biome` to options, default to `CORPORATE_BIOME`:
```js
export function generateNetwork(seed, timeCost, moneyCost, options = {}) {
  const biome = options.biome ?? CORPORATE_BIOME;
  // ...
  const candidate = buildNetwork(rng, tc, mc, forcePieces, biome);
```

**Private `resolveGrade(gradeRole, type, ctx)` helper:**
```js
function resolveGrade(gradeRole, type, { pathGradeMin, pathGradeMax, rng, nodeRules }) {
  if (gradeRole === "fixed")                    return nodeRules[type]?.fixedGrade ?? "D";
  if (gradeRole === "entry" || gradeRole === "soft") return shiftGrade(pathGradeMin, -1);
  if (gradeRole === "path")                     return randomGrade(rng, pathGradeMin, pathGradeMax);
  if (gradeRole === "hard")                     return pathGradeMax;
  if (gradeRole === "above-min")                return shiftGrade(pathGradeMin, 1);
  return randomGrade(rng, pathGradeMin, pathGradeMax);
}
```

**Rewrite `buildNetwork(rng, tc, mc, forcePieces, biome)`:**

```js
function buildNetwork(rng, tc, mc, forcePieces = [], biome) {
  const time  = TIME_BUDGET[tc];
  const money = MONEY_BUDGET[mc];
  const { pathGradeMin, pathGradeMax } = money;
  const gradeCtx = { pathGradeMin, pathGradeMax, rng, nodeRules: biome.nodeRules };

  // Label pools — shuffled copies (preserves rng call order from LABEL_POOLS key order)
  const labelPools = {};
  for (const [type, rule] of Object.entries(biome.nodeRules)) {
    if (rule.labels?.length) {
      labelPools[type] = [...rule.labels];
      shuffleWith(rng, labelPools[type]);
    }
  }
  function nextLabel(type) {
    return labelPools[type]?.length ? labelPools[type].pop() : `${type.toUpperCase()}-X`;
  }

  const nodes = [], edges = [];
  let nodeSeq = 0;
  function makeId(type) { return `${type}-${++nodeSeq}`; }
  function addNode(type, grade, depth) {
    const id = makeId(type);
    nodes.push({ id, type, label: nextLabel(type), grade, _depth: depth });
    return id;
  }
  function addEdge(s, t) { edges.push({ source: s, target: t }); }

  /** @type {Record<string, string[]>} role → [nodeId, ...] */
  const spawnedByRole = {};

  for (const layer of biome.layers) {
    const count = typeof layer.count === "function"
      ? layer.count({ tc: time, mc: money, state: spawnedByRole })
      : (layer.count ?? 1);
    if (count <= 0) continue;

    const type  = biome.roles[layer.role];
    const depth = typeof layer.depth === "function"
      ? layer.depth({ tc: time, mc: money })
      : layer.depth;

    for (let i = 0; i < count; i++) {
      const grade = resolveGrade(layer.gradeRole, type, gradeCtx);
      const id    = addNode(type, grade, depth);
      (spawnedByRole[layer.role] ??= []).push(id);

      if (layer.alsoConnectFrom) {
        const src = spawnedByRole[layer.alsoConnectFrom]?.[0];
        if (src) addEdge(src, id);
      }

      if (layer.connectTo) {
        const targetRole = typeof layer.connectTo === "function"
          ? layer.connectTo({ tc: time, mc: money, state: spawnedByRole })
          : layer.connectTo;
        const targets = spawnedByRole[targetRole] ?? [];
        if (targets.length) addEdge(pick(rng, targets), id);
      }
    }
  }

  // Set pieces
  for (const [pieceId, piece] of Object.entries(biome.setPieces ?? {})) {
    const forced = forcePieces.includes(pieceId);
    const elig = forced || (typeof piece.eligible === "function"
      ? piece.eligible({ mc, state: spawnedByRole })
      : true);
    if (elig && (forced || rng() < (piece.probability ?? 1))) {
      const baseGrade = resolveGrade("path", biome.roles.routing, gradeCtx);
      applySetPiece(piece, { nodes, edges }, rng, baseGrade, nextLabel, makeId);
    }
  }

  const positions = assignPositions(nodes);
  const finalNodes = nodes.map(({ id, type, label, grade, _depth }) => {
    void _depth;
    return { id, type, label, grade, ...(positions.get(id) ?? { x: 400, y: 400 }) };
  });

  return {
    nodes: finalNodes,
    edges,
    startNode:     spawnedByRole.gateway[0],
    startCash:     CASH_BUDGET[mc],
    startHandSpec: HAND_BUDGET[mc],
    ice: {
      grade:     time.iceGrade,
      startNode: spawnedByRole.monitor[0],
    },
  };
}
```

**Update `validate`:**
```js
function validate(network, biome) {
  for (const predicate of biome.validators) {
    const result = predicate(network, biome);
    if (result) return result;
  }
  return null;
}
```
Update its call site: `validate(candidate, biome)`.

**Remove from `network-gen.js`:**
- `LABEL_POOLS` constant
- `entryGrade`, `softGrade`, `pathGrade`, `hardGrade` closures
- `VALIDATORS` array and old `validate` function
- Hardcoded set piece selection block

`make check` passes. If any snapshot drifts, the rng order changed — investigate
before regenerating.

---

## Phase 7 — Clean up retired files + verify

**Builds on:** Phase 6.

**After this phase:** no dead code, no orphaned files. Success criteria met.

### Prompt

1. Delete `data/node-type-rules.js` — absorbed into `js/biomes/corporate/gen-rules.js`.

2. `js/set-pieces.js` now only exports `applySetPiece`. Remove the `SET_PIECES`
   export (already done in Phase 1). Update the file comment. If `applySetPiece`
   is generic enough to live in the engine, consider moving it inline into
   `network-gen.js` and deleting `set-pieces.js` entirely.

3. Check all imports across the codebase for `data/node-type-rules.js` and
   `js/set-pieces.js` — update any that remain.

4. `make check` — 276 tests pass, no snapshot files changed.

5. Verify success criteria:
   - `buildNetwork` contains no hardcoded node type strings
   - Validators reference `biome.roles` rather than literal type strings
   - Adding a new biome = new bundle under `js/biomes/` + pass to `generateNetwork`
