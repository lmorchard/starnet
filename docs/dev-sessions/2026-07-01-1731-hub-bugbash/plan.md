# Plan — Hub bugbash (#261, #236)

TDD each. Both are independent; do #236 first (tiny), then #261.

## Phase 1 — #236 run-independent menu/hand toggles

1. **Test first** (`tests/ui-state.test.js`, new cases): with no active run,
   `toggleMenuOpen()`/`toggleHandCollapsed()` do not throw, return the flipped value, and flip
   back on a second call. In-run behavior + round-trip stay green.
2. **Fix** `js/core/state/game.js`: module-level `_uiFallback = { menuOpen, handCollapsed }`;
   each toggle branches on `getState()` — mutate `s.ui` when a run is active, else flip the
   fallback. (Import `getState` from `./index.js`.)
3. `make check`.

## Phase 2 — #261 named networks as authored hub jobs

1. **Test first** (`tests/hub-targets.test.js` or extend an existing hub test): `generateTargets`
   includes one target per `NAMED_NETWORKS` key with a `network` field; a procedural tier has no
   `network`. (Pure — no DOM.)
2. **`js/core/profile/targets.js`:** add optional `network` to `HubTarget`; append authored
   targets (label from a small name map or the network's meta). Keep procgen tiers unchanged.
3. **`js/ui/hub.js` `launchTarget`:** if `target.network`, build via `NAMED_NETWORKS[target.network]()`
   (import from `data/networks/index.js`); else `buildGenerated({seed, spec})` as today. Same
   `startRun` downstream.
4. `make check` + browser smoke (hub lists authored jobs; launching one loads the named graph;
   hamburger opens in the hub without error).

## Phase 3 — wrap

- Update `MANUAL.md` if the hub target list is documented.
- Session notes; squash; PR closing #261 + #236; Copilot review.
