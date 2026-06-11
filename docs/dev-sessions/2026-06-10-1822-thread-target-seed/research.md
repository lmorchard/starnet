# Research — Thread target seed into initGame (#142)

## The seed flow today

1. `openHub()` (`js/ui/hub.js`) increments `profile._hubVisits` and calls
   `generateTargets(profile)`.
2. `generateTargets()` (`js/core/profile/targets.js:33`) builds the tier list with
   `seed: \`target-${visit}-${t.id}\``. **Every hub re-entry bumps the visit counter,
   so each tier gets a brand-new seed → a brand-new topology.**
3. `launchTarget(targetId)` (`js/ui/hub.js:115`) calls
   `buildGenerated({ seed: target.seed, spec: target.spec })`.
4. The seed lands in `meta.seed` — `assembleNetwork()` sets `meta: { …, seed }`
   (`js/core/network/assemble.js:111`).
5. `launchTarget` spreads it into the run meta:
   `startRun({ graphDef, meta: { ...result.meta, ...launchMeta } })`.
   `prepareLaunch()` returns only `{ startHandCards, startCash }`
   (`js/ui/profile-store.js:106`) — **no `seed` key, so `meta.seed` survives the spread.**
6. `startRun(networkResult)` (`js/ui/run-control.js:43`) calls
   `initGame(() => networkResult, undefined, { openDarknetsStore })`.
   **The `undefined` is the bug:** `meta.seed` is sitting in `networkResult.meta`
   but never reaches `initGame`.
7. `initGame(buildNetworkFn, seedString, opts)` (`js/core/state/index.js:77`) calls
   `initRng(seedString)`. With `undefined`, `initRng` generates a random
   `run-XXXX` seed (`js/core/rng.js:62-66`), so vulns / loot / combat rolls are
   non-deterministic per launch.

## Why option (a) is low-cost

- **Variety is supplied by the visit counter, not run-time RNG.** Every hub
  re-entry rolls new tier seeds → new maps. Normal play never replays an identical
  target seed, so seeding run-time RNG removes no meaningful variety.
- **Determinism is a stated project value** ("All gameplay randomness is
  deterministic for a given seed" — CLAUDE.md playtest docs).
- **Seeding fixes the roll *stream*, not outcomes.** Different probe/exploit order
  consumes the stream differently → divergent runs. Only identical action sequences
  reproduce identical results — exactly the reproducibility we want for debugging.

## RNG mechanics

`initRng(seedString)` seeds every named stream as
`hashString(seed + ":" + name)` for `name in {exploit, combat, ice, loot, world}`
(`js/core/rng.js:62-66`). One root seed → all streams deterministic. `getSeed()`
(`js/core/rng.js:146`) returns the active root seed — usable as a test assertion.

## The three parallel entry points — regression check

- **Browser** (`js/ui/main.js` → hub → `startRun`): the path being fixed.
- **Headless harness** (`scripts/playtest.js`) and **bot/census**
  (`scripts/bot/`): both go through `scripts/lib/headless-engine.js:85`, which
  already calls `initGame(buildNetworkFn, seed)` with an explicit seed. **They do
  not touch `startRun`, so this change cannot regress `make census`.**
- **Playground** (`js/playground/main.js:317`) also calls
  `initGame(() => networkResult, undefined, {})`. Out of scope for #142 (separate
  dev harness, not the hub launch path). Noted, not changed.

## Testability of `startRun`

`startRun` touches DOM/Cytoscape, but every graph function guards on a null `cy`:
- `resetGraph` → `if (!cy) return;`
- `syncInitialNodes` → `ensureNodeInGraph`/`updateNodeStyle` both `if (!cy) return;`
- `getCy()` → null; `if (cy) fitGraph(cy)` skipped
- `addIceNode` → `document.getElementById("cy")` then `if (!container) return;`
- `startIce` → from `js/core/ice/runtime.js`, DOM-free (schedules timers)

So with `cy` never initialized and a minimal `globalThis.document` stub whose
`getElementById` returns `null`, the **real** `startRun` runs end-to-end in node.
This lets us test the actual seed threading rather than a proxy helper.

The test glob (`find tests js data -name '*.test.js'`, Makefile:30) picks up a new
`js/ui/run-control.test.js`. No existing test imports `js/ui/`; `run-control.js`
and its transitive imports (`graph.js`, `store.js`) are DOM-free at module-eval
time, so importing them in node is safe.
