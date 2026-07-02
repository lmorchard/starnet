# Notes — Hub bugbash (#261, #236)

Two independent hub fixes, TDD, one PR.

## #236 — hub hamburger no longer throws

`menuOpen`/`handCollapsed` live in per-run `state.ui`, so the toggles called `mutate()` which
throws with no active run (the hub). Fix: module-level `_uiFallback` in `js/core/state/game.js`;
each toggle branches on `getState()` — mutate `state.ui` in-run, flip the fallback at the hub.
No change to the serialized-state shape or the round-trip test. New no-run tests in
`tests/ui-state.test.js` (used `setActiveRun(null)` to simulate the hub).

## #261 — named networks are authored hub jobs

`hub.js launchTarget` always built procedural networks; authored named networks (incl. the Flow
Subversion flows in Corporate Exchange) were only reachable via `?network=` / level-select.

- `js/core/profile/targets.js`: `HubTarget` gains optional `network`; `generateTargets` appends one
  authored target per `NAMED_NETWORKS` key (derived from the registry, so new networks auto-surface;
  friendly labels via a small map). Procedural tiers keep `seed` + `spec`.
- `js/ui/hub.js launchTarget`: branches — `network` → `NAMED_NETWORKS[network]()`, else
  `buildGenerated({seed, spec})`. Same `startRun` downstream.
- Registry (`data/networks/index.js`) stays the single source of truth.

## Regression caught by the browser smoke (before shipping)

Authored targets have **no `spec`**, but two symmetric readers assumed `t.spec.threat`:
the `targets` console command and the `<starnet-hub>` GUI card (line 98). The GUI one would throw
during Lit render and break the whole hub. Both now guard on `t.spec` and show "authored network"
otherwise. (GUI/console symmetry — fixed together.)

## Verification

- `make check` green (1337 pass; +4 net new tests). `make census SEEDS=5` — no headless crash.
- Headless-Chromium smoke: hub lists all 6 targets (3 procgen + 3 authored with correct `network`
  keys); toggling the hamburger in the hub throws **0 errors**; `launch authored-corporate-exchange`
  loaded a 15-node named graph. Only console 404 is the pre-existing `favicon.ico`.
- MANUAL updated (hub target list now names procgen + authored jobs).
