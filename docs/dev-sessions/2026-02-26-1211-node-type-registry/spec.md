# Spec: Node Type Registry & Behavior System

## Problem

Node-type-specific logic is scattered across at least 7 files with no central registry:

- `alert.js` — `DETECTION_TYPES` / `MONITOR_TYPES` sets, propagation logic
- `ice.js` — resident node check on `NODE_ACCESSED`
- `visual-renderer.js` — action button gating per type
- `console.js` — same action gates duplicated
- `loot.js` — `LOOT_CONFIG` per type
- `state.js` — `eventForwardingDisabled` initialized on all nodes even though only IDS uses it

Adding a new node type requires touching many files. The action gating in `visual-renderer.js`
and `console.js` has already drifted (the `cancel-trace` bug). Node lifecycle behaviors like
"disable ICE when security-monitor is owned" are implicit and hard to discover.

## Goal

Introduce a **data-driven node type registry** with composable **behavior atoms** and a
**game systems layer** that dispatches to them. All node-type-specific logic consolidates into
one place; existing files become consumers of the registry rather than owners of scattered type
knowledge.

## Architecture

### Behavior Atoms

Small, reusable logic bundles. Each atom is a plain object with optional lifecycle hook
functions. Atoms have no state of their own — they operate on node state and game state passed
as arguments.

```js
// Example atom shape
export const detectionBehavior = {
  id: "detection",
  // Called when this node's alert level rises
  onAlertRaised: (node, state) => { ... },
  // Per-node state fields to initialize (merged into NodeState at init)
  stateFields: {
    eventForwardingDisabled: false,
  },
};
```

### Combat & Vuln Config Per Node Type

The global grade tables in `combat.js` (`GRADE_MODIFIER`, `DISCLOSURE_CHANCE`, `PATCH_LAG`)
and `exploits.js` (`VULN_CONFIG`) become **defaults**. Node type definitions can override
specific values via `combatConfig` and `vulnConfig` fields:

```js
"cryptovault": {
  behaviors: ["lootable"],
  lootConfig: { count: [1, 3] },
  // Cryptovaults are hardened — harder to crack, more aggressive disclosure at every grade
  combatConfig: {
    gradeModifier:    { S: 0.03, A: 0.10, B: 0.20, C: 0.40, D: 0.60, F: 0.80 },
    disclosureChance: { S: 0.95, A: 0.80, B: 0.65, C: 0.45, D: 0.25, F: 0.10 },
  },
}
```

Resolution: `resolveNode(node).combatConfig` merges type-level overrides onto global defaults
field-by-field (and grade-by-grade within each field). Most types carry no override and use
defaults unchanged — backward-compatible by construction.

Same pattern for `vulnConfig` — a type can override vuln count ranges or rarity pools.

**Planned atoms (minimum viable set):**
- `detection` — IDS alert propagation to monitors; `onAlertRaised` fires
  `propagateAlertEvent`; contributes `eventForwardingDisabled` stateField
- `monitor` — security-monitor aggregation; `onOwned` cancels trace and resets global alert
  to green; contributes to global alert recompute
- `lootable` — node can hold macguffins; `onInit` reads `typeDef.lootConfig` (a `count`
  range defined at the type level, not inside the atom) to assign macguffins
- `iceResident` — ICE home node; `onOwned` calls `stopIce` / `disableIce`
- `direct-trace` — high-grade detection variant; `onAlertRaised` skips alert propagation
  entirely and starts the trace countdown directly (used by Grade-S/A IDS nodes)

Atoms are composable: a node type can have multiple atoms.

### Node Type Registry (`js/node-types.js`)

Central definition of all node types as plain data objects. Each type has a base definition
plus optional per-grade overrides that can add or replace behaviors and actions.

```js
export const NODE_TYPES = {
  "ids": {
    behaviors: ["detection"],
    actions: [
      {
        id: "reconfigure",
        label: "RECONFIGURE",
        available: (node, state) =>
          !node.eventForwardingDisabled &&
          (node.accessLevel === "compromised" || node.accessLevel === "owned"),
        desc: () => "Disable event forwarding to security monitor.",
      },
    ],
    // Grade S/A IDS triggers a trace directly on detection rather than just
    // propagating an alert — qualitative difference, not just a harder number
    gradeOverrides: {
      S: { extraBehaviors: ["direct-trace"] },
      A: { extraBehaviors: ["direct-trace"] },
    },
  },
  "security-monitor": {
    behaviors: ["monitor", "iceResident"],
    actions: [
      {
        id: "cancel-trace",
        label: "CANCEL TRACE",
        available: (node, state) =>
          node.accessLevel === "owned" && state.traceSecondsRemaining !== null,
        desc: (node, state) =>
          `Abort trace countdown (${state.traceSecondsRemaining}s remaining).`,
      },
    ],
  },
  "fileserver":  { behaviors: ["lootable"], lootConfig: { count: [1, 2] }, actions: [] },
  "cryptovault": { behaviors: ["lootable"], lootConfig: { count: [1, 3] }, actions: [] },
  "workstation": { behaviors: ["lootable"], lootConfig: { count: [0, 1] }, actions: [] },
  "gateway":     { behaviors: [], actions: [] },
  "router":      { behaviors: [], actions: [] },
  "firewall":    { behaviors: [], actions: [] },
};
```

**Grade override resolution:** `gradeOverrides[node.grade]` is merged on top of the base
definition. `extraBehaviors` appends to base `behaviors`; `extraActions` appends to base
`actions`. A full `behaviors` or `actions` key in the override replaces the base list entirely
for that grade. Lower grades with no override entry use the base definition unchanged.

**Registry query helpers (exported from `js/node-types.js`):**

```js
getNodeType(type)        // Returns the base type definition (throws if unknown)
resolveNode(node)        // Returns the fully resolved definition for a node (type + grade merged)
getActions(node, state)  // Returns all available action objects for a node (grade-aware)
hasBehavior(node, id)    // Does this node (at its grade) have a given behavior atom?
getBehaviors(node)       // Returns all resolved behavior atom objects (grade-aware)
getStateFields(node)     // Returns merged stateFields from all resolved behaviors
```

Note: helpers that were previously `(type)` are now `(node)` so they can access both
`node.type` and `node.grade` for full resolution.

### Game Systems Layer

Existing behavior modules (`alert.js`, `ice.js`, `loot.js`) become **systems** — they
subscribe to game events and dispatch to the registry to find which nodes care. The systems
own the mechanism; the registry owns which types participate.

**Before:**
```js
// alert.js — hard-codes specific type names
export const DETECTION_TYPES = new Set(["ids"]);
on(E.NODE_ALERT_RAISED, ({ nodeId }) => {
  if (DETECTION_TYPES.has(node.type)) propagateAlertEvent(nodeId);
});
```

**After:**
```js
// alert.js — dispatches to behavior atom
on(E.NODE_ALERT_RAISED, ({ nodeId }) => {
  const behavior = getAtomForNode(node, "detection");
  if (behavior?.onAlertRaised) behavior.onAlertRaised(node, s);
  else recomputeGlobalAlert();
});
```

### Action System

`visual-renderer.js` and `console.js` both call `getActions(node, state)` — a single call
replacing all per-type conditional checks in both files. No more drift between UI and console.

### Lifecycle Callbacks

Atoms declare lifecycle hooks. A single **node lifecycle dispatcher** — a thin listener module
(`js/node-lifecycle.js`) initialized at startup — owns the `NODE_ACCESSED` subscription and
dispatches `onOwned` to the relevant node's behaviors. This replaces the current pattern where
`ice.js` and (implicitly) `alert.js` each maintain separate `NODE_ACCESSED` listeners. Those
listeners are removed entirely.

| Hook            | Triggered by                              | Dispatched from           |
|-----------------|-------------------------------------------|---------------------------|
| `onOwned`       | `NODE_ACCESSED` with `next === "owned"`   | `js/node-lifecycle.js`    |
| `onAlertRaised` | `NODE_ALERT_RAISED`                       | `alert.js` listener       |
| `onReconfigured`| `NODE_RECONFIGURED`                       | `alert.js` listener       |
| `onInit`        | `initState`                               | `state.js`                |

`onOwned` on the `monitor` atom replaces the `cancelTraceCountdown` side-effect currently
triggered manually. `onOwned` on the `iceResident` atom replaces the resident-node check in
`ice.js`. Both `ice.js` and `alert.js` lose their `NODE_ACCESSED` listeners.

### Node State Initialization

`initState` calls `getStateFields(node)` and merges the result into each node's initial
state. `eventForwardingDisabled` is only present on nodes whose type includes the `detection`
atom — not on all nodes.

The `lootable` atom's `onInit` hook replaces the current `assignMacguffins(nodes)` call in
`loot.js`. During `initState`, for each node, if its resolved behaviors include `lootable`,
`onInit` reads `typeDef.lootConfig` and assigns macguffins to the node directly. The
standalone `assignMacguffins` function is removed. `loot.js` retains the macguffin generation
logic (`generateMacguffin`, `flagMissionMacguffin`) but no longer owns the assignment loop.

### Type Definitions (`js/types.js`)

New JSDoc typedefs for the concrete registry shapes:
- `BehaviorAtom` — `{ id, stateFields?, onInit?, onOwned?, onAlertRaised?, onReconfigured? }`
- `ActionDef` — `{ id, label, available: (node, state) => boolean, desc: (node, state) => string }`
- `GradeOverride` — `{ behaviors?, extraBehaviors?, actions?, extraActions?, combatConfig?, vulnConfig? }`
- `NodeTypeDef` — `{ behaviors, actions, lootConfig?, combatConfig?, vulnConfig?, gradeOverrides? }`
- `CombatConfig` — `{ gradeModifier?, disclosureChance?, patchLag? }` (each a `Record<Grade, number>`)
- `VulnConfig` — `{ count?, rarities? }` (per-grade or flat override)

### Testing

Unit tests in `tests/` using Node's built-in `node:test` module. Zero new dependencies.
New `make test` target added to `Makefile`.

Tests cover:
- Registry queries (`getActions`, `hasBehavior`, `getStateFields`)
- Behavior atom callbacks (pure functions, no DOM)
- Action `available` predicate logic

Integration-level validation via `scripts/playtest.js` (headless, existing). The playtest
script's `actions` command currently has its own type-checking logic mirroring `console.js` —
it should also call `getActions(node, state)` post-refactor so there is no third copy of the
action gates.

## Acceptance Criteria

- [ ] `js/node-types.js` exists with all 8 node types defined
- [ ] Behavior atoms defined and co-located in `js/node-types.js` (or split to
  `js/behaviors.js` if file grows unwieldy)
- [ ] `js/node-lifecycle.js` exists; owns the single `NODE_ACCESSED` → `onOwned` dispatch;
  `ice.js` and `alert.js` no longer have `NODE_ACCESSED` listeners
- [ ] `js/types.js` updated with `BehaviorAtom`, `ActionDef`, `NodeTypeDef`, `CombatConfig`,
  `VulnConfig`, `GradeOverride` typedefs
- [ ] `DETECTION_TYPES` / `MONITOR_TYPES` removed from `alert.js`; replaced with registry
  queries
- [ ] Loot config removed from `loot.js`; sourced from registry
- [ ] Action gating in `visual-renderer.js` and `console.js` unified via `getActions()`
- [ ] `eventForwardingDisabled` only initialized on detection nodes (via `stateFields`)
- [ ] ICE disable on security-monitor owned handled via `iceResident` behavior `onOwned`
- [ ] `combatConfig` and `vulnConfig` per-type overrides wired into `combat.js` and
  `exploits.js`; at least `cryptovault` has illustrative non-default values
- [ ] Playtest script `actions` command calls `getActions()` — no third copy of action gates
- [ ] `make test` passes
- [ ] `make check` passes (no type errors)
- [ ] Playtest script confirms: probe → exploit → alert propagation → trace → cancel-trace
  all work end-to-end
- [ ] No existing gameplay behavior changes

## Out of Scope

- Designing actual balance values for per-type combat/vuln overrides — we wire the
  architecture and add a few illustrative examples (cryptovault, firewall), but full
  per-type tuning is future work once procedural generation gives us a test harness
- Adding new node types beyond the existing 8
- Visual shape/style data — the visual renderer owns its own type-to-shape/color decisions;
  "visual atoms" is a future concept but the renderer makes its own choices based on node type
  for now
- ICE as an entity in the registry (ICE is a separate game object, not a node type)
- Defender ICE / access reversal (future session)
- Procedural network generation
