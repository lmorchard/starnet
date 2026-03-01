# Spec: Gated Node Access

## Problem

Currently, neighbors are only revealed when a node is successfully exploited (locked → compromised or compromised → owned). Every node type behaves the same way — there's no concept of a node gating access to the connections behind it, and no way for a simple node to transparently show its connections on probe.

This undermines the identity of node types like **Firewall** (a security chokepoint that should force full ownership before revealing what's beyond) and makes the network feel uniform. Meanwhile, soft targets like workstations should be transparent — probing them should immediately show what's connected.

## Design

### `gateAccess` — a per-type neighbor reveal threshold

Add an optional `gateAccess` property to `NodeTypeDef`:

```
gateAccess?: "probed" | "compromised" | "owned"
```

This controls when `revealNeighbors()` fires for a node:

- **`"probed"`** (default): neighbors revealed when the node is probed. Transparent — the player sees connections without needing to crack the node.
- **`"compromised"`**: neighbors revealed when the node reaches compromised. The player must establish a foothold before seeing what's beyond.
- **`"owned"`**: neighbors revealed only when the node reaches owned. Full control required — the node gates access completely.

When unset, defaults to `"probed"`.

### Node type assignments

| Type              | `gateAccess`     | Rationale |
|-------------------|-----------------|-----------|
| Gateway           | (default/probed) | Entry point — transparent |
| Workstation       | (default/probed) | Soft target — transparent on probe |
| File Server       | (default/probed) | Data node — transparent on probe |
| Cryptovault       | (default/probed) | Hard target, but connections aren't the secret |
| IDS               | `"owned"`        | Security node — gated like firewall |
| Security Monitor  | `"owned"`        | Security node — gated like firewall |
| WAN               | (default/probed) | Network boundary — transparent |
| Router            | `"compromised"`  | Traffic hub — gives up connections at first foothold |
| Firewall          | `"owned"`        | Security chokepoint — must fully own to see through |

### Where the gate is enforced

Two trigger points need gating logic:

1. **Probe completion** (`probe-exec.js` → `handleProbeScanTimer`): After marking a node probed, check if the node's `gateAccess` is `"probed"` (or unset). If so, call `revealNeighbors()`.

2. **Exploit success** (`combat.js` → `launchExploit`): After changing access level, check if the node's `gateAccess` matches the new level. If so, call `revealNeighbors()`. Remove the unconditional `revealNeighbors()` calls that are there today.

The gate check is a simple comparison: look up the resolved type def for the node, read `gateAccess` (defaulting to `"probed"`), and only reveal when the trigger matches.

### What "gated" means visually

When a node is gated and the player hasn't reached the required access level:
- Hidden neighbors behind the gate remain hidden (no `???` nodes appear)
- The player sees the gated node itself but has no indication of what's beyond
- Once the gate opens, the standard reveal cascade fires normally

### Console / log

No new commands needed. `NODE_REVEALED` events will fire at the appropriate time based on the gate. The existing log entries cover this.

## Out of scope

- Per-node (instance-level) gate overrides — type-level is enough for now
- Visual indicators on the graph showing a node is gated (e.g., lock icon) — future work
- Grade-level overrides for `gateAccess` — could use existing `gradeOverrides` mechanism later
