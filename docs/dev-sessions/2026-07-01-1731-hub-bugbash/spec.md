# Spec — Hub bugbash: named networks reachable + menu crash (#261, #236)

Two small, independent hub fixes in one pass.

## #261 — Named networks reachable from the hub

**Problem:** authored named networks (`corporate-foothold`, `research-station`,
`corporate-exchange` — the last carries the Flow Subversion flows) are only reachable via
`?network=` deep-links or the level-select form. The hub (`js/ui/hub.js` `launchTarget`) always
calls `buildGenerated(...)`, so authored/set-piece content is invisible in normal hub play.

**Decision:** surface the named networks as their own **always-available "authored job" hub
targets**, alongside the 3 procedural tiers (soft/standard/hard).

**Approach:**
- Extend `HubTarget` (`js/core/profile/targets.js`) with an optional `network` field (a
  `NAMED_NETWORKS` key). Procedural tiers keep `spec` + `seed`; authored targets carry `network`.
- `generateTargets` appends one target per named network (label from its meta / a friendly name).
- `launchTarget` (`js/ui/hub.js`): if the target has a `network`, build via `NAMED_NETWORKS[name]()`
  instead of `buildGenerated({seed, spec})`. Everything downstream (loadout, carry, startRun) is
  unchanged.
- Keep the registry as the single source of truth (`data/networks/index.js` `NAMED_NETWORKS`).

## #236 — Hub hamburger menu throws `mutate requires an active run`

**Problem:** `menuOpen`/`handCollapsed` live inside per-run `GameState` (`state.ui`). In the hub
there's no active run, so `toggleMenuOpen()`/`toggleHandCollapsed()` → `mutate()` throws.

**Decision:** make the two UI toggles **run-independent** via a module-level fallback — no change
to the serialized-state shape or the existing round-trip test.

**Approach (`js/core/state/game.js`) — as shipped:**
- Module-level fallback `{ menuOpen, handCollapsed }`.
- Each toggle branches on `getState()` (non-throwing, unlike `mutate`): with an active run, mutate
  `state.ui` as today; otherwise flip the fallback. Both paths return the new value.
- No read helpers needed — the HUD consumes the toggle's return value; nothing else reads
  `state.ui.*` in production (only tests do, in-run).

## Non-goals

- No hub UI redesign; authored targets reuse the existing target-card rendering.
- Not folding named-network selection into procgen (a later Flow Subversion pillar item).

## Verification

- TDD: failing test first for each (hub-target launch path builds the named graph; toggles don't
  throw with no active run and persist across a run boundary).
- `make check` green; browser smoke: hub lists authored jobs + launches one; hub hamburger opens
  without error.
