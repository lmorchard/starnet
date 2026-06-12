# Notes — Alert cooldown levers (#174)

## Outcome

Two grid-only, below-trace relief levers shipped, both built TDD:
- **Scrub logs** (P1) — `scrub-logs` action on a compromised/owned security-monitor → resets that
  monitor's `alertCount`, eases the global alert one level. `coolGrid` core + `ALERT_COOLED` event.
- **Lie low** (P2) — timed `lie-low` action on every WAN node (`createWAN` + `darknet` trait via the
  shared `LIE_LOW_OPERATOR`/`LIE_LOW_ATTRS`) → ~50-tick wait, then full calm to green; 2 uses/run,
  then `lieLowExhausted` gates it off (human-admin fiction). Timed-action multi-site wiring: operator,
  start-action, ABORT `requires`, nav-cancel handler.

`make check` green (1051+ tests). Docs: MANUAL.md "Cooling the grid" + console table; CLAUDE.md alert section.

## Census (25 seeds) — branch vs post-#173 baseline

| | threat C (ICE-less) | threat B (ICE + grid) |
|---|---|---|
| post-#173 (main) | 0.28 / 0.76 | 0.24 / 0.84 |
| this branch | 0.32 / 0.72 | 0.24 / 0.84 |

**Key caveat:** the bot does NOT know `lie-low` / `scrub-logs` (grep-confirmed — no references in
`scripts/bot/`). So census **cannot measure the levers' value** (same limitation as
[[mine-balance-bot-census-limitation]]). What it confirms:
- **No regression** — baseline essentially unchanged within seed noise.
- **Grid-only behaviour is correct** — threat B (ICE-driven trace) is identical; only the grid-only
  tier could move, and the small C delta is within noise (7→8 / 25).

The levers are for human play; tuning (2 uses, ~50-tick wait, scrub = one level) is by feel.

## Headless playtest (deterministic, engine-driven) — all confirmed

- **Scrub** a compromised monitor: red→yellow, `alertCount` 3→0.
- **Lie low**: red→green, monitor→0, uses 2→1; 2nd use → 0 + `exhausted`, action no longer offered.
- **At trace**: scrub + lie-low both no-op, lie-low use unspent.
- ICE-untouched is structural (`coolGrid` only iterates monitors; never references ICE state).

## Follow-ups / deferred
- "Human admin" as a real escalation mechanic (exhausting lie-low spawns pursuit / bumps alert) — flavor-only for now.
- Scrubber consumable card/store item (option 3) — deferred.
- Teach the bot to use the levers (would let census actually gauge their balance value).

## Follow-up additions (post-initial-PR, folded into #186)

Rebased onto main + reconciled with #189 (one-timed-action-per-node): lie-low joins
`TIMED_ACTION_FLAGS` and uses `...NOT_BUSY` (the general guard) instead of a hand-rolled
re-trigger check.

**Alert cheats** — restructured `cheat set alert <level>` into a `cheat alert` group:
`cheat alert set <level>` / `raise` / `lower`. raise/lower step the global alert (saturating
at green/trace); lowering out of trace cancels the running countdown. Tests + completions updated.

**Lie-low clock overlay** — a dodecagon clock on the WAN node during lie-low: 12 edges light up
chunkily one-at-a-time clockwise as the wait progresses (PROBE facet-reveal idiom), hour+minute
hands spin clockwise in fast-forward. Vector-CRT: stroke-only, polygon (no circle), glow.
- Built feel-first in an interactive lab (slider-driven), tuned with Les: dodecagon, hour+minute
  hands @ ~2.5 rev/s, cyan, edges fade in one-at-a-time (not a smooth creep). Lab preserved at
  `./clock-lab.html` (per the waveform-lab precedent — it lives in `tmp/` otherwise, gitignored).
- Pure geometry/math in `js/ui/overlays/lie-low-clock-geom.js` (`ledOpacity`, `handAngles`) with
  unit tests; the overlay element (`lie-low-clock.js`) reuses `facetVertices` + the base class's
  managed time loop for the spin. Registry-driven, so the preview-harness demo + game dispatch
  wire automatically (`OVERLAY_DESCRIPTORS`). Verified live in the preview harness (6/12 edges lit
  at 50% progress, hands spinning, no console errors).
