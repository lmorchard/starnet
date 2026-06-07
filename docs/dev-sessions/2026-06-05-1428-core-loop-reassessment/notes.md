# Notes — Core-Loop Tuning Session

## Detour: census was broken (fixed first, PR #112)

Starting Phase 1, an experimental `startCash` bump didn't move the census — which
exposed that the **multi-seed bot census had been producing garbage**. Root cause:
`resetGame()` re-registered `initGraphBridge()`/`initDynamicActions()` listeners
every run with no teardown, so in the single-process census loop the Nth game ran
under N stacked copies of every handler. Progressive corruption: seed 0 fine,
seed 1 → ~1 node owned, seed 2 → 0. Every seed after the first was noise, which is
where the inflated "70% stuck / 0.55 owned" numbers in the original reassessment
came from.

Fixed on a dedicated branch (full bus reset + re-wire per run in
`scripts/lib/headless-engine.js`; extracted `initNavigationCancelHandler()` from
`game-ctx.js`; regression test `tests/headless-run-isolation.test.js`). Merged as
PR #112. Browser was unaffected (it already clears timers and reloads on new-run).

**Lesson:** validate the measurement instrument before trusting balance numbers.
The reassessment's *direction* survived (clean cli runs always agreed), but the
*magnitude* was a harness artifact.

## Phase 1 — Provision supply (DONE)

Honest baseline (post-fix, 30 seeds): foothold 27% / stuck / 5.2-owned;
exchange 57% / mostly tick-cap / 8.1-owned.

`startCash` sweep on foothold (the supply-starved network):

| startCash | success | stuck | owned | store visits |
|---|---|---|---|---|
| 0 | 27% | 22 | 5.2 | 0.7 |
| 500 | 90% | 2 | 8.2 | 4.5 |
| **1000** | **100%** | **0** | **8.6** | **5** |
| 2000 | 100% (saturated) | 0 | 8.6 | 5 |

**Change applied:** `corporate-foothold` `startCash: 0 → 1000`. Supply is no longer
the wall (0 stuck); the darknet stub is now operational (~5 buys/run); the bot owns
~72% — takes what it needs, doesn't steamroll. Single-line change.

**Exchange left unchanged (startCash 200).** Bumping it to 1000 made it *worse*
(65%→50%, ICE detections 0.5→4.75): more cash → bot lingers → more ICE exposure →
more tick-cap evasion loops. So exchange's bottleneck is **pressure + bot
efficiency, not supply** — explicitly Phase 3 work. Its 2 stuck/30 are not a supply
problem worth chasing in Phase 1.

Confirm (30 seeds): foothold 100% / 0 fails / 8.8-owned; exchange 56.7% (tick-cap 11,
stuck 2).

## Next

- **Phase 2** — `research`/`pentest` action (brainstorm + spec + impl + teach bot).
- **Phase 3** — give foothold gentle ICE; tune exchange's pressure/tick-cap so
  losses are trace/ICE not tick-cap.
</content>
