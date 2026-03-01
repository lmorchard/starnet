# Plan: Gated Node Access

## Context

Currently, `revealNeighbors(nodeId)` is called unconditionally in `combat.js` on both access-level transitions (locked→compromised and compromised→owned). Probing does not reveal neighbors. All node types behave identically.

This plan adds a `gateAccess` property to `NodeTypeDef` that controls when a node's neighbors are revealed:

| Gate level | Node types | Meaning |
|-----------|-----------|---------|
| `"probed"` (default) | Gateway, Workstation, File Server, Cryptovault, WAN | Probing reveals neighbors |
| `"compromised"` | Router | Must compromise to see connections |
| `"owned"` | Firewall, IDS, Security Monitor | Must fully own to see connections |

## Files to modify

| File | Change |
|------|--------|
| `js/types.js` | Add `gateAccess?` to `NodeTypeDef` |
| `js/node-types.js` | Set `gateAccess` on Router, Firewall, IDS, Security Monitor |
| `js/node-types.js` | Export a `getGateAccess(node)` helper |
| `js/probe-exec.js` | Call `revealNeighbors()` on probe completion for "probed"-gated nodes |
| `js/combat.js` | Replace unconditional `revealNeighbors()` with gated check |
| `tests/gate-access.test.js` | New test file for gated reveal behavior |
| `MANUAL.md` | Update node types table, probe section, firewall/router descriptions |

## Implementation steps

---

### Step 1: Add `gateAccess` to types and node-types registry

**`js/types.js`** — Add `gateAccess?` to `NodeTypeDef`:
```js
gateAccess?: "probed" | "compromised" | "owned",
```

**`js/node-types.js`** — Set `gateAccess` on gated types:
```js
"router":           { gateAccess: "compromised", ... },
"firewall":         { gateAccess: "owned", ... },
"ids":              { gateAccess: "owned", ... },
"security-monitor": { gateAccess: "owned", ... },
```

All other types leave `gateAccess` unset (defaults to `"probed"` at the call site).

**`js/node-types.js`** — Add a query helper:
```js
export function getGateAccess(node) {
  return resolveNode(node).gateAccess ?? "probed";
}
```

This keeps the default in one place and respects grade overrides if we add them later.

Run `make check` — should pass with no behavior change yet (the property is only read, never checked).

---

### Step 2: Gate the reveal in combat.js

**`js/combat.js`** — Import `getGateAccess` from `node-types.js`. Replace the two unconditional `revealNeighbors(nodeId)` calls with a gated check:

```js
// After locked → compromised:
if (getGateAccess(node) === "compromised") {
  revealNeighbors(nodeId);
}

// After compromised → owned:
if (getGateAccess(node) === "compromised" || getGateAccess(node) === "owned") {
  revealNeighbors(nodeId);
}
```

Wait — this needs more thought. The logic should be: reveal neighbors when the node **reaches or passes** the gate level. A cleaner approach:

```js
const ACCESS_RANK = { locked: 0, compromised: 1, owned: 2 };
const GATE_RANK = { probed: -1, compromised: 1, owned: 2 };

function shouldRevealOnAccess(node, newAccess) {
  const gate = getGateAccess(node);
  if (gate === "probed") return false; // handled in probe-exec, not here
  return ACCESS_RANK[newAccess] >= GATE_RANK[gate];
}
```

In the locked→compromised block: call `revealNeighbors` only if `shouldRevealOnAccess(node, "compromised")`.
In the compromised→owned block: call `revealNeighbors` only if `shouldRevealOnAccess(node, "owned")`.

But there's an edge case: a node gated at "compromised" should NOT re-reveal on owned (neighbors already revealed). We want reveal to fire **exactly once**, when the gate threshold is crossed. So:

- Gate "probed": reveal on probe (not here)
- Gate "compromised": reveal on locked→compromised transition only
- Gate "owned": reveal on compromised→owned transition only

Simplest: in the locked→compromised block, call `revealNeighbors` only if `getGateAccess(node) === "compromised"`. In the compromised→owned block, call `revealNeighbors` only if `getGateAccess(node) === "owned"`.

This is clean and correct. Nodes with `gateAccess: "probed"` don't reveal here at all — they already revealed on probe.

Run `make check` — tests pass. Behavior change: gated nodes no longer reveal on exploit. Default-gated nodes also stop revealing on exploit (they'll reveal on probe in the next step).

**Important:** This step temporarily breaks the reveal flow for default nodes (they won't reveal on probe yet). Step 3 fixes it immediately. These two steps should be implemented together, not committed separately.

---

### Step 3: Reveal on probe for "probed"-gated nodes

**`js/probe-exec.js`** — Import `getGateAccess` from `node-types.js` and `revealNeighbors` from `state.js`. In `handleProbeScanTimer`, after `setNodeProbed(nodeId)` and before the alert logic, add:

```js
if (getGateAccess(node) === "probed") {
  revealNeighbors(nodeId);
}
```

Run `make check`. The full reveal flow is now restored: default nodes reveal on probe, gated nodes reveal at their gate level.

---

### Step 4: Tests

**`tests/gate-access.test.js`** — New test file covering:

1. `getGateAccess` returns correct values per type
2. `getGateAccess` returns "probed" for types without explicit gateAccess
3. Probe on a default-gated node reveals hidden neighbors
4. Probe on a "compromised"-gated node does NOT reveal hidden neighbors
5. Exploit locked→compromised on a "compromised"-gated node reveals neighbors
6. Exploit locked→compromised on an "owned"-gated node does NOT reveal neighbors
7. Exploit compromised→owned on an "owned"-gated node reveals neighbors

Tests use direct state manipulation + function calls (same pattern as existing unit tests), not the playtest harness.

Run `make check`.

---

### Step 5: Update MANUAL.md

Update these sections:

- **Node Types table**: Add a "Gate" column showing when each type reveals connections
- **Probe section (### 2. Probe)**: Mention that probing reveals connected nodes for most node types
- **Core Loop context**: Note that firewalls, IDS, and security monitors require higher access before revealing connections
- **Tips section**: Add a tip about planning around gated nodes

---

### Step 6: Verify with playtest harness

Manual verification sequence:
```bash
node scripts/playtest.js reset
node scripts/playtest.js "select gateway"
node scripts/playtest.js "probe"
node scripts/playtest.js "tick 30"
# Gateway probed → neighbors should be revealed as ???
node scripts/playtest.js "status full"
# Confirm router, firewall visible as revealed

node scripts/playtest.js "cheat own gateway"
node scripts/playtest.js "select firewall"
node scripts/playtest.js "probe"
node scripts/playtest.js "tick 50"
# Firewall probed → neighbors should NOT be revealed (gated at owned)
node scripts/playtest.js "status full"

node scripts/playtest.js "cheat own firewall"
# Firewall owned → NOW neighbors behind firewall should appear
node scripts/playtest.js "status full"
```

---

## Prompt sequence

### Prompt 1: Types + registry + helper

Add `gateAccess?` to `NodeTypeDef` in `js/types.js`. Set `gateAccess` values on Router (`"compromised"`), Firewall (`"owned"`), IDS (`"owned"`), and Security Monitor (`"owned"`) in `js/node-types.js`. Add `getGateAccess(node)` export to `js/node-types.js`. Run `make check`.

### Prompt 2: Gate the reveal in combat.js + probe-exec.js

In `js/combat.js`: import `getGateAccess`, replace the two unconditional `revealNeighbors(nodeId)` calls with gated checks — locked→compromised reveals only if gate is `"compromised"`, compromised→owned reveals only if gate is `"owned"`. In `js/probe-exec.js`: import `getGateAccess` and `revealNeighbors`, add `revealNeighbors(nodeId)` after `setNodeProbed` gated on `getGateAccess(node) === "probed"`. Run `make check`.

### Prompt 3: Tests

Create `tests/gate-access.test.js` with tests for: getGateAccess return values, probe-triggered reveal for default nodes, probe NOT revealing for gated nodes, exploit-triggered reveal at correct gate levels. Run `make check`.

### Prompt 4: Manual + verify

Update MANUAL.md node types table (add Gate column), probe section, and tips. Run playtest harness verification sequence to confirm gating works end-to-end.
