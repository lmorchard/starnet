# Session Notes: Bot Player Rebuild

## Smoke-test Bug Fixes (2026-03-10)

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

### Remaining Issues (not yet fixed)

- **Bot runs out of cards before reaching lootable nodes** on corporate-foothold. The
  lootable nodes (vault-node, fileserver, workstations) are 3-4 hops deep and the starting
  hand doesn't match their vulns. Strategy needs better card economy: visit darknet store
  with initial cash, or focus exploits on the path to lootable nodes.

- **research-station tick-cap** — Bot earns cash (5000-9000¥) but hits 5000-tick budget.
  Likely another infinite loop in a heuristic — needs investigation.

- **corporate-exchange stuck at 1 node** — 0 cards used, 200 cash. Network may start with
  empty hand or different initial state. Bot doesn't know to visit store first.

- **Set-piece design: disarm post-conditions** — The alarm-latch disarm action should
  require `latchEnabled === true` so it self-gates after execution. Currently worked around
  in the bot, but this is a game-side fix that would benefit all consumers.
