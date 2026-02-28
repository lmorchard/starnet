# Session Notes: Playtest Harness — ActionContext Wiring

## Recap

Fixed a silent regression in `scripts/playtest.js` where all gameplay action commands
(`probe`, `exploit`, `read`, `loot`, `select`, `eject`, `jackout`, etc.) had been
silently dropped since the node-action-registry session (2026-02-27-0950).

Root cause: `console.js`'s `dispatch()` emits `"starnet:action"` (unified format), but
the harness had no listener for it — only dead `on("starnet:action:probe", ...)` handlers
from before the unified dispatcher existed. `reset`, `tick`, `status`, and `cheat` worked
only because they bypass `dispatch()` entirely.

Fix: replaced the 13 dead listeners with `buildActionContext()` + `initActionDispatcher()`,
matching the browser's dispatch path exactly. Removed all imports that existed solely to
serve the dead handlers.

Bonus changes during session:
- Balance pass: starting cash ¥500 → ¥1000; hand 4c/1uc → 2c/3uc/1r; loot values
  scaled ~5x down; mission multiplier 10x → 3x
- `initActionDispatcher` now logs `"<actionId>: not available."` for console-sourced
  dispatches that fail the `getAvailableActions()` guard (previously silent)

## Divergences from Plan

No significant divergences. The plan had 3 steps; the implementation followed them
exactly. The balance pass and unavailable-action feedback were unplanned additions that
came out of running the harness after the fix.

## Insights

**The harness was more broken than the backlog entry suggested.** The backlog note said
the harness "dispatches differently from browser" — which is true, but the actual state
was that every gameplay action command was a no-op. This wasn't caught because `reset`,
`tick`, and `status` still worked, making the harness look functional.

**Symptom vs. root cause.** The dead listeners were never fired — they would have required
events in the old `"starnet:action:probe"` format, which nothing emits anymore. The
comment above them ("console.js dispatches action events via emitEvent(); these handlers
execute them") was already false at the time it was written. Better to trust tests than
comments.

**`store.js` has no top-level DOM code.** It was safe to import `action-context.js` in
Node.js even though `action-context.js` imports `store.js`. The `document` references are
inside `openDarknetsStore()`, which is never called from the harness action path. The
override was purely defensive.

**Silent action guards are bad UX for console users.** The unified dispatcher's "no-op
if not available" behavior is correct for GUI (context menu only shows valid actions), but
console users need feedback. The one-liner fix in `initActionDispatcher` handles this
cleanly with the existing `fromConsole` flag.

**10x mission multiplier was designed for inter-run persistence.** When cash only matters
within a single run, a 10x spike on one loot item destroys the store economy. 3x still
makes the mission target feel like the premium score without breaking the scale.

**The starting rare card opens up interesting early choices.** Having a rare in hand from
the start means the player can sometimes skip the store on early nodes, or save the rare
for a high-grade target. Adds a strategic layer without much design cost.

## Efficiency

Very fast session. The bug investigation took longer than the fix itself (reading 4-5
files to understand the dispatch chain), but the actual code change was ~15 lines. The
balance pass and unavailable-action feedback were both small follow-ons that emerged
naturally from running the harness.

3 commits, all focused. No rework.

## Process Improvements

- **Regression-test action dispatch in the harness** — a simple test that `probe` or
  `exploit` produces `EXPLOIT_STARTED`/`PROBE_SCAN_STARTED` output after a reset would
  have caught this regression immediately after the node-action-registry session.
- **When removing wiring from main.js, check playtest.js at the same time** — the two
  files are parallel entry points with parallel wiring. A CLAUDE.md note reminding us to
  keep them in sync would help.

## Conversation Turns

~15 exchanges.
