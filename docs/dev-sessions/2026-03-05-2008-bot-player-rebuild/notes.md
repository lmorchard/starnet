# Session Notes: Bot Player Rebuild

## Smoke-test Bug Fixes — Round 1 (2026-03-10)

Ran the new modular bot against all 3 networks and found 5 bugs + 3 strategy issues.

### Bugs Fixed

1. **Card field name mismatch (critical)** — `perception.js:buildHand()` read `c.uses` and
   `c.vulnType` but the actual `ExploitCard` type uses `c.usesRemaining`,
   `c.targetVulnTypes` (array), and `c.decayState`. The bot was never filtering
   disclosed/spent cards and never matching vulns correctly. Every exploit was a
   hail-mary because card matching was silently broken.

2. **`read`/`looted` strict equality vs undefined** — Perception checked `n.read === false`
   but only nodes with the "lootable" trait get `read: false` initialized. Gateway, router,
   IDS, key-server etc. have `read: undefined`. The bot was trying to read every owned node
   (including unreadable ones like gateway/WAN), then getting stuck when the timed action
   never resolved.

3. **WAN node in owned/lootable lists** — WAN is `accessLevel: "owned"` at game start but
   doesn't support read/loot actions. The `!isWan` exclusion was only on the `else if`
   branches, so WAN leaked into `owned` and `lootable`. Bot would infinitely try to read WAN.

4. **Disarm action infinite loop** — The alarm-latch set-piece's disarm action only requires
   `accessLevel === "owned"` with no post-condition (like `latchEnabled === true`). After
   disarming, the action is still "available". Additionally, `disarm` wasn't in the
   `INSTANT_ACTIONS` set, so each attempt burned 500 ticks in `tickUntilResolved`. Fixed
   with: (a) `isInstant()` helper that recognizes dynamic action IDs, (b) `completedActions`
   tracking in the loop, (c) traps heuristic skips already-completed disarms.

5. **Cards heuristic didn't account for `failedExploits`** — `hasUsableMatch` checked
   `cardMatchesByNode` but not the `failedExploits` set. A card that matched a vuln but had
   already failed on the target was still counted as "usable", preventing the store-visit and
   jackout proposals from firing. Bot got stuck with "matching" cards that couldn't succeed.

### Strategy Improvements

- **Hail-mary exploit penalty** (explore + security heuristics) — non-matching cards get a
  score penalty (-5 in explore, -30 in security) so the bot prefers matching cards and
  doesn't tunnel-vision on nodes where it has no good cards.

- **Security node deprioritization at green alert** — IDS probe/exploit gets a -35 penalty
  when alert is green. Probing an IDS can trigger immediate alert escalation via the
  detection→monitor chain, so the bot should explore data nodes first.

- **Dangerous type penalty in explore** — IDS and security-monitor nodes get -10 when
  selecting revealed nodes, so the bot prefers data-bearing nodes.

- **Trace-active jackout** — Evasion heuristic proposes jackout at score 100 when trace is
  active, so the bot saves progress instead of dying to trace.

## Smoke-test Bug Fixes — Round 2 (2026-03-11)

### Bugs Fixed

6. **Vulnerability field name mismatch** — `perception.js` card matching used `v.type` but
   the Vulnerability type uses `v.id`. Card-to-node matching was completely broken — every
   card appeared as non-matching. This was the root cause of all hail-mary exploits.

7. **`access-darknet` infinite loop** — The darknet store is a no-op in headless mode
   (browser UI only). Bot would repeatedly dispatch `access-darknet` thousands of times.
   Fixed by replacing with `buy-card` — a bot-only action that calls `buyFromStore()` from
   `store-logic.js` directly, picking the cheapest card matching a needed vulnerability.

8. **`needsExploit` included non-exploitable nodes** — Set-piece internal nodes (latches,
   relays, key-gens) are probed and not owned, but have no vulnerabilities and can't be
   exploited. The perception layer now requires `vulnerabilities.length > 0` for needsExploit.

9. **ICE interrupt re-score loop** — After ICE interruption, the interrupt handler immediately
   re-scored and picked the same exploit, which got interrupted again → infinite loop (81+
   evasions per run). Removed the interrupt re-score; the main loop now handles it naturally.
   Added ICE cooldown penalty (-20) to deprioritize recently-interrupted nodes for one cycle.

### Results After Round 2

| Network             | Win Rate | Notes |
|---------------------|----------|-------|
| corporate-foothold  | 0/10     | 0 cash, 0 store visits — starting hand never matches vulns |
| research-station    | 3/10     | 16/20 nodes owned, store working (5-16 visits), 9k-60k cash |
| corporate-exchange  | 3/10     | Up to 14/14 nodes, high ICE evasion counts on failing seeds |

### Remaining Issues

- **corporate-foothold card economy** — Starting hand has no vulnerability matches for any
  node. All exploits are hail-marys. Bot runs out of cards before reaching lootable nodes
  (3-4 hops deep). Needs either: starting cash to buy from store, better starting hand
  generation, or a network with shallower paths to loot.

- **Set-piece design: disarm post-conditions** — The alarm-latch disarm action should
  require `latchEnabled === true` so it self-gates after execution. Currently worked around
  in the bot, but this is a game-side fix that would benefit all consumers.

---

## Session Retro

### What Was Delivered (vs Spec)

All 8 phases from the plan were completed:

1. Shared headless engine — done, `scripts/lib/headless-engine.js`
2. Bot types and stats — done, `scripts/bot/types.js` + `stats.js`
3. Perception layer — done, `scripts/bot/perception.js`
4. Scoring engine — done, `scripts/bot/scoring.js`
5. Execute layer — done, `scripts/bot/execute.js`
6. Strategy heuristics (6) — done, `scripts/bot/heuristics/*.js`
7. Main loop + run + CLI — done, `scripts/bot/{loop,run,cli}.js`
8. Playtest harness refactor — done, `scripts/playtest.js` uses shared engine

Spec items explicitly deferred and still deferred:
- Census CLI rebuild (separate session)
- LLM-driven bot (future)
- Strategy tuning/weight optimization

### What Worked Well

- **The perception→scoring→execute pipeline is solid.** Cleanly separates
  concerns. Heuristics are easy to reason about and tune independently. The
  verbose scoring output was invaluable for debugging.

- **Pluggable strategies.** The spec's vision of composable "personalities"
  works — different strategy mixes would produce meaningfully different play.

- **Shared headless engine.** The extraction from playtest.js was clean and
  the two entry points share code without friction.

- **Iterative smoke-testing caught 9 bugs.** Running the bot and reading the
  verbose output was more effective than unit tests would have been at this
  stage, because the bugs were integration-level (wrong field names, missing
  state transitions, action availability mismatches).

### What Didn't Work Well

- **Field name mismatches dominated the bugs.** 3 of 9 bugs were the bot
  reading the wrong property name from game state objects (`uses` vs
  `usesRemaining`, `vulnType` vs `targetVulnTypes`, `v.type` vs `v.id`).
  The JSDoc types in `scripts/bot/types.js` defined a `WorldCard.vulnType`
  that didn't match the actual `ExploitCard.targetVulnTypes`. These should
  have been caught by the type checker if the bot files were in the lint
  scope, or by a simple integration test that verifies card matching.

- **The original implementation (Phase 1-8) shipped with zero working card
  matching.** Every exploit was a hail-mary. The bot appeared to work (it
  ran, it produced stats) but was fundamentally broken. This went unnoticed
  because there was no smoke-test step in the plan.

- **Headless store was a no-op.** The spec mentioned store visits but the
  headless engine passed `() => {}` for `openDarknetsStore`. The bot needs
  to call `buyFromStore()` directly — this wasn't in the plan.

- **ICE interrupt re-scoring was spec'd but caused an infinite loop.** The
  spec described the interrupt as "re-enter the scoring loop" but in practice
  the re-scored choice was always the same node, causing a tight loop. The
  fix was to remove the re-score and let the main loop handle it with a
  cooldown penalty.

### Lessons

- **Add a smoke-test phase to bot/agent plans.** "Run it against each network
  with verbose output and check the first 20 decisions" would have caught
  all the field-name bugs immediately.

- **Bot perception should validate against source types.** Either include bot
  files in `make lint`, or write a small test that asserts `buildHand()`
  output shape matches `ExploitCard` field names.

- **Test card matching specifically.** A test like "given a hand with
  `targetVulnTypes: ['weak-auth']` and a node with `vulnerabilities: [{id:
  'weak-auth'}]`, assert the card appears in `cardMatchesByNode`" would have
  prevented 2 of the 3 field-name bugs.

### Follow-Up Work

- **Census CLI rebuild** — batch runner for balance analysis across seeds.
  Separate session.
- **Bot unit tests** — perception, card matching, heuristic proposals. Would
  prevent regression on field-name bugs.
- **corporate-foothold balance** — starting hand generation should consider
  network vulnerabilities, or the network should provide starting cash.
- **Disarm post-conditions** — game-side fix to alarm-latch set-piece.
