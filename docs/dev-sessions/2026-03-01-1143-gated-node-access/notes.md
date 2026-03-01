# Notes: Gated Node Access

## Summary

Added `gateAccess` property to `NodeTypeDef` that controls when a node reveals its neighbor connections. Three tiers: "probed" (default, transparent), "compromised" (router), "owned" (firewall, IDS, security monitor).

## Key decisions

- **Gate is a minimum threshold, not exclusive trigger.** If a player skips probing and exploits directly, "probed"-gated nodes still reveal on exploit (safety net). `revealNeighbors()` is idempotent so double-reveals are harmless.
- **Gate logic in combat.js:** locked→compromised reveals unless gate is "owned"; compromised→owned always reveals (all gates met by this point). Clean and avoids rank-comparison machinery.
- **Probe-triggered reveal** added to `probe-exec.js` — only for nodes with gate "probed" (the default).

## Implementation detail

The plan originally proposed that "probed"-gated nodes should ONLY reveal on probe (not on exploit). The integration test `"successfully exploiting a locked node leaves neighbors as revealed"` caught the issue — exploiting gateway without probing would leave neighbors hidden forever. Fixed by making exploit also reveal for non-"owned" gates.

## Files changed

- `js/types.js` — `gateAccess?` on `NodeTypeDef`
- `js/node-types.js` — values on 4 types + `getGateAccess()` helper
- `js/combat.js` — gated `revealNeighbors()` calls
- `js/probe-exec.js` — probe-triggered reveal for default nodes
- `tests/gate-access.test.js` — 15 new tests
- `MANUAL.md` — Gate column, probe section, tips
