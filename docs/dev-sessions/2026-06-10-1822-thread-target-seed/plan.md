# Plan — Thread target seed into initGame (#142)

## Approach

One-line behavior change in `startRun`, guarded by a new co-located test that
exercises the real function with the DOM stubbed. TDD: write the failing test
first (current code passes `undefined` → `getSeed()` is a random `run-XXXX`,
not `meta.seed`), then make it pass.

## Phase 1 — Failing test (TDD red)

New file `js/ui/run-control.test.js`:

- Setup: `globalThis.document = { getElementById: () => null }` so `addIceNode`
  no-ops. (Restore/leave as-is in teardown; tests run in isolated processes per
  node:test, but be tidy.)
- Build a real generated network: `buildNetwork({ seed: "seed-A", spec })` from
  `data/networks/generated.js` (gives a `meta.seed`).
- Test 1 (threading): `startRun(result)` → assert `getSeed() === result.meta.seed`.
- Test 2 (reproducibility): `startRun(result)` twice with the same `result`,
  snapshot each node's `vulnerabilities` from `getState().nodes`; assert deep-equal.
- Test 3 (variety): two networks built from different seeds → vulnerabilities differ.
- Test 4 (absent seed): `startRun({ graphDef, meta: { …, seed: undefined } })`
  completes without throwing and `getSeed()` is a `run-` fallback.

Run `make test` — Test 1/2 must FAIL on current code (proves the bug).

## Phase 2 — Fix (TDD green)

In `js/ui/run-control.js`, change:

```js
initGame(() => networkResult, undefined, { openDarknetsStore });
```
to:
```js
initGame(() => networkResult, networkResult.meta?.seed, { openDarknetsStore });
```

Update the `startRun` JSDoc to note the seed is threaded for reproducibility.

Run `make test` — all green.

## Phase 3 — Verify & guard the parallel paths

- `make check` (lint + full suite) green.
- `make census SEEDS=10` runs and is unaffected (sanity that headless path is
  independent; compare against expectations, not a fixed threshold).

## Phase 4 — Docs

- Update `MANUAL.md` only if it claims anything about run randomness/seeds that
  this change contradicts (likely no change needed — check the trace/ICE/RNG
  sections). If nothing references it, no manual edit.
- Fill `notes.md` with the final summary.

## Risks / watch-items

- Importing `js/ui/run-control.js` in node pulls in `graph.js` + `store.js`. They
  are DOM-free at module-eval time (verified in research), but if import crashes,
  the test must stub whatever top-level global is missing (`window`/`customElements`).
  Adjust the stub minimally; do not weaken the assertions.
- Keep the test asserting the **observable consequence** (`getSeed()`, node
  vulnerabilities), not intermediate state.
