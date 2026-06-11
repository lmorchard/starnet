# Notes — Thread target seed into initGame (#142)

## Outcome

One-line behavior fix in `startRun` (`js/ui/run-control.js`):

```js
- initGame(() => networkResult, undefined, { openDarknetsStore });
+ initGame(() => networkResult, networkResult.meta?.seed, { openDarknetsStore });
```

Run-time RNG (vulns, loot, combat) is now seeded from the target's deterministic
`meta.seed` instead of `Math.random()`. Same-target launches are reproducible;
variety still comes from the hub-visit counter rolling fresh tier seeds each visit.

## Design decision

Option (a) of the issue's three options, chosen with Les. Rationale captured in
`spec.md` / `research.md`: variety is supplied by `_hubVisits`, not run-time RNG;
determinism is a stated project value; seeding fixes the roll *stream*, not
outcomes-regardless-of-choices, so skilled play still diverges.

## Key finding — the fix makes the manual honest

`MANUAL.md:66-68` already claims sharing a seed reproduces "the same network
layout, **vulnerabilities**, and exploit hand." Before this fix, only the topology
was reproducible — vulnerabilities were random per launch. So the old behavior was
already a **bug against the manual** ("if the game behaves differently from what
the manual describes, that is a bug"). The fix brings the game in line with the
manual's existing promise. **No manual edit required.**

## Testing

New `js/ui/run-control.test.js` exercises the real `startRun` with a minimal
`globalThis.document` stub (graph functions guard on a null `cy`; `addIceNode`
bails when the "cy" container is absent). Four cases: seed threading,
reproducibility across launches, variety across seeds, absent-seed fallback.
TDD red→green confirmed: tests 1 & 2 failed on the old `undefined` code for the
right reason, pass after the fix.

## Parallel entry points

- `make check`: 843 pass / 0 fail (was 839; +4 new), lint clean.
- `make census SEEDS=10`: runs fine. The headless harness + bot go through
  `scripts/lib/headless-engine.js`, which already passes explicit seeds and never
  touches `startRun` — so this change can't regress them.

## Out of scope (noted)

`js/playground/main.js:317` also passes `undefined` to `initGame`. It's a separate
dev harness, not the hub launch path. Left unchanged; candidate for a follow-up if
playground reproducibility ever matters.
