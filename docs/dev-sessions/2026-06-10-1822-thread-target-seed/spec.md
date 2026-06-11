# Spec — Thread target seed into initGame for reproducible runs (#142)

## Problem

`startRun()` (`js/ui/run-control.js`) calls `initGame(() => networkResult, undefined, …)`.
The generated target's deterministic seed already rides along in
`networkResult.meta.seed` (set by `assembleNetwork`), but `undefined` is passed
instead — so the run-time RNG (vulnerabilities, loot, combat rolls) is seeded from
`Math.random()` on every launch. The topology is reproducible per target; the
gameplay rolls are not.

This is pre-existing behavior carried over from the original boot/run-again path,
not a deliberate design choice (confirmed in #142).

## Decision

**Option (a): thread `meta.seed` into `initGame`.** Same-target launches become
fully reproducible. Run-to-run variety is preserved by the hub-visit counter
(`_hubVisits`), which rolls fresh tier seeds on every hub re-entry — so normal play
still gets a new map + new rolls each visit. Seeding the run-time RNG aligns the
launch path with the project's determinism-first ethos and makes player-reported
runs debuggable.

## Behavior

- `startRun(networkResult)` passes `networkResult.meta?.seed` to `initGame` as the
  seed string instead of `undefined`.
- When `meta.seed` is present (the generated-target launch path, the only real
  caller), the run-time RNG is seeded deterministically from it.
- When `meta.seed` is absent (defensive — a network built without a seed), behavior
  is unchanged: `initGame` receives `undefined` and `initRng` falls back to a random
  `run-XXXX` seed.

## Acceptance criteria

1. After `startRun(networkResult)` with `meta.seed = "X"`, `getSeed() === "X"`.
2. Two `startRun` calls with the same `networkResult` produce identical node
   vulnerabilities (and loot) — i.e. the run is reproducible.
3. Different seeds produce different vulnerabilities (no accidental constant).
4. When `meta.seed` is absent, `startRun` still completes and seeds randomly
   (no crash, behavior unchanged).
5. `make check` stays green (839+ tests, lint clean).
6. `make census SEEDS=10` is unaffected (headless path does not use `startRun`).

## Out of scope

- `js/playground/main.js` also passes `undefined` to `initGame`; it's a separate
  dev harness, not the hub launch path. Not changed here (noted for backlog).
- No new debug/seed UI or console param (that would be option (b)).
- No change to how target seeds are generated (`generateTargets`).

<!-- dev-session:spec -->
