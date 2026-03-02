# Notes: Census Metrics v2

## Session Summary

Built a Monte Carlo bot player that simulates full game runs headlessly,
then used it to find and fix multiple balance problems. The bot drove several
game mechanic changes that wouldn't have been discovered through static
topology analysis alone.

---

## Key Actions

### Store extraction (Phase 1-2)
- Created `js/store-logic.js` with `buyFromStore()` — headless buy path
- Refactored `store.js` (DOM) and `console.js` to delegate to it
- Verified harness `store`/`buy` commands work (already did via console.js)

### Bot player (Phase 3-4)
- Created `scripts/bot-player.js` with `runBot()` — plays a full game
- Greedy strategy: BFS node selection, best-card picking, store fallback
- Stat collection: mission success, exploration, resources, ICE pressure
- Timeline breakpoints: tick of first node owned, detection, trace, mission

### Bot census CLI (Phase 5)
- Created `scripts/bot-census.js` — runs N simulations, prints LLM-legible report
- `--evasion` flag for ICE avoidance mode
- `make bot-census` target with TC/MC/SEEDS overrides

### Balance discoveries and fixes (Phase 6)
Iterative cycle: run census → identify problem → fix → re-measure.

1. **ICE cliff at D→C**: 80%→8% without evasion. Root cause: C-grade ICE
   detects (45 ticks dwell) before exploit completes (47+ ticks).

2. **Evasion strategy**: cancel-exploit on ICE arrival, deselect to hide.
   Result: C cliff eliminated (8%→78%). A/S still 0% — instant detection.

3. **A/S instant detection removed**: S dwell null→800ms, A null→1500ms.
   Still 0% because A/S ICE pathfound directly to player's selected node.

4. **direct-trace bug**: IDS reconfigure didn't block S/A grade detection.
   The `direct-trace` behavior bypassed `eventForwardingDisabled` check.

5. **ICE→IDS chain**: `recordIceDetection` directly escalated global alert,
   bypassing the IDS→monitor chain. Fixed to route through IDS, making
   reconfigure the key counterplay. Stale `prev` reference in alert emit fixed.

6. **A/S player tracking removed**: omniscient pathfinding to `selectedNodeId`
   replaced with faster disturbance tracking. Fair: ICE responds to player
   actions (noise), not player presence.

7. **Exploit duration reduced**: 3-12s → 2-7s. Players need time to finish
   before ICE arrives.

8. **A/S ICE slowed**: A 3000ms→5000ms, S 2500ms→4000ms move intervals.

9. **C/B dwell bumped**: C 4500ms→5500ms, B 3500ms→4500ms. Gives window for
   common exploits to complete.

10. **Bot patience**: wait 3 ICE moves after evasion before retrying. Lets
    ICE investigate disturbance, clear signal, wander away.

11. **Bot proactive store**: buy matching cards before exploiting unmatched.

### Event handler cleanup issue
`clearHandlers()` destroys module-level event handlers registered at import
time (ice.js, *-exec.js, alert.js, node-lifecycle.js). Fixed by not calling
clearHandlers in the bot — one-time init for timer wiring, per-run cleanup
of stat handlers only. Added `initAlertHandlers()` and `initIceHandlers()`
exports for future use.

---

## Final Difficulty Curves

### Diagonal (TC=MC, evasion bot)
```
F/F: 82%  D/D: 74%  C/C: 28%  B/B: 6%  A/A: 0%  S/S: 0%
```

### ICE ladder (fixed moneyCost=D, evasion bot)
```
F: 76%  D: 74%  C: 62%  B: 54%  A: 10%  S: 8%
```

### Money ladder (fixed timeCost=F, no evasion — from earlier session)
```
F: 94%  D: 88%  C: 66%  B: 36%  A: 18%  S: 0%
```

### Bot limits on the diagonal

The dumb bot hits a wall at A/A and S/S. The binding constraints:

**A/A (0%):** Disturbance-tracking ICE with 5000ms moves and 1500ms dwell.
Each exploit creates noise, drawing ICE. The evasion cycle (cancel + wait
3 moves = ~150 ticks per attempt) means ~5-8 attempts to own one node, at
~200+ ticks each. The critical path has 4+ nodes. Total: 4000+ ticks.
Tick cap (5000) runs out before mission completes. A patient player who
times exploits around ICE patrol gaps and uses IDS reconfigure to sever
the alert chain would do better.

**S/S (0%):** Same as A/A but tighter: 4000ms moves, 800ms dwell, harder
nodes (pathGradeMin A, pathGradeMax S). Each node needs more exploits and
each exploit has lower success probability. The bot's card resources run
out even with store purchases.

**What would help at A/A and S/S:**
- Player upgrades that reduce exploit duration (faster deck hardware)
- Stealth upgrades that increase ICE dwell time (signal masking)
- Ability to pre-scout ICE position before committing to an action
- ICE distraction tools (decoys that create false disturbance signals)
- These are all potential player progression mechanics for the overworld

**The bot as a balance floor:** The dumb bot's completion rates represent
a pessimistic lower bound. A skilled human player who learns ICE patrol
patterns, times actions, manages IDS proactively, and uses eject/reboot
tactically should significantly outperform these numbers at every grade.
A/A should be hard but achievable; S/S should require mastery plus good
preparation (overworld upgrades).

---

## Divergences from Plan

1. **Phase 6 became the entire second half of the session.** The plan called
   for "run B/B + F/F, document findings." Instead, we iteratively discovered
   and fixed 11 balance issues across ~8 commit cycles. The bot census was
   the catalyst — every run revealed something new to fix.

2. **Game mechanic changes not in the plan.** ICE→IDS chain, A/S behavior
   rework, exploit duration, dwell tuning — all emerged from bot data. The
   plan only anticipated "run census, document findings."

3. **Event handler architecture issue.** clearHandlers vs module-level
   registration was an unexpected obstacle. Solved pragmatically (don't
   clear) with initXxxHandlers() as a cleaner future path.

4. **Store extraction was simpler than planned.** The buy logic was already
   headless in console.js — just needed extraction into a shared module.
   store.js refactor was straightforward.

---

## Key Insights

- **The bot is a balance debugger, not just a measurement tool.** Every run
  reveals something: the ICE cliff, the detection-before-exploit race, the
  omniscient player tracking, the direct-trace bypass. The iterative
  measure→fix→remeasure cycle is the core value, not the final numbers.

- **ICE balance is fundamentally a race condition.** Exploit duration vs ICE
  dwell time determines whether the player can act. All the tuning levers
  (dwell, move interval, exploit speed) shift this race. The bot makes the
  race visible.

- **IDS reconfigure should be the central security puzzle.** Routing ICE
  through the IDS chain makes reconfigure meaningful at every difficulty.
  The old direct escalation made IDS a minor optimization. Now it's the key.

- **Player tracking was bad design.** Omniscient pathfinding to selectedNodeId
  removed player agency entirely. Disturbance tracking is fair because the
  player controls when they make noise. This is a better game regardless of
  balance numbers.

- **Module-level event handlers and clearHandlers() don't mix.** Several
  modules register handlers at import time. A multi-run harness needs either
  init functions per module or scoped handler groups. Added initAlertHandlers
  and initIceHandlers as a pattern; the remaining modules (exec, lifecycle)
  should follow in a future cleanup.

---

## Future Work

See session notes above for detailed items:
- Move ICE resident node (topology change)
- High-value-target patrol (augment random walk)
- Multi-signal tracking (alert-responsive ICE speed)
- Area lockdown ICE type
- Reward scaling with difficulty (backlog updated)
- Player upgrades for A/S survivability (deck speed, signal masking, decoys)
- Module init function cleanup (clearHandlers compatibility)

---

## Stats

- Tests: 304 (unchanged — bot tests from earlier, no new game logic tests)
- Branch commits: 13
- Files changed: bot-player.js, bot-census.js, store-logic.js + test,
  store.js, console.js, action-context.js, ice.js, alert.js, node-types.js,
  exploit-exec.js, BACKLOG.md, session docs
- Census reports saved: FF, DD, CC, BB, ICE cliff, money curve, asymmetric,
  timeline analysis
