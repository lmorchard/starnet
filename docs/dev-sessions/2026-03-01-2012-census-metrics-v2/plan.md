# Plan: Census Metrics v2 — Monte Carlo Bot Simulation

## Overview

Six phases. The first two extract the store logic and wire it properly. Phases
3–4 build the bot. Phase 5 builds the census CLI and report. Phase 6 runs it
against B/B and documents findings.

Each phase ends with `make check` passing and no orphaned code.

---

## Phase 1 — Extract headless store buy function

**Builds on:** existing `js/store.js`, `js/console.js`, `js/state/index.js`.

**After this phase:** a `buyFromStore(vulnId)` function exists in a new
`js/store-logic.js` module. It encapsulates the buy flow (catalog lookup →
affordability check → card generation → state mutation). The console.js
`cmdBuy` and DOM `store.js` both call it.

### Prompt

Create `js/store-logic.js`:

```js
import { getState, buyExploit } from "./state.js";
import { generateExploitForVuln, getStoreCatalog } from "./exploits.js";

/**
 * Buy an exploit card from the darknet broker by catalog index (1-based)
 * or vuln ID string. Returns the card on success, null on failure.
 *
 * This is the headless buy path — no DOM, no UI. Both the modal store
 * and the console `buy` command delegate to this function.
 *
 * @param {number | string} indexOrVulnId — 1-based catalog index or vuln ID string
 * @returns {{ card: import('./types.js').ExploitCard, price: number } | null}
 */
export function buyFromStore(indexOrVulnId) { ... }
```

Implementation:
1. Call `getStoreCatalog()` to get the catalog
2. Resolve the item — if `indexOrVulnId` is a number, use as 1-based index;
   if a string, find by `vulnId` match
3. If item not found, return null
4. Call `generateExploitForVuln(item.vulnId)` to create the card
5. Call `buyExploit(card, item.price)` — returns false if can't afford
6. If success, return `{ card, price: item.price }`; if can't afford, return null

Refactor `js/console.js` `cmdBuy`:
- Replace inline catalog lookup + `generateExploitForVuln` + `buyExploit`
  with a call to `buyFromStore(indexOrVulnId)`
- Keep the `resolveWanAccess()` guard and log messages in `cmdBuy`
- Remove the `buyExploit` import from console.js (no longer needed directly)

Refactor `js/store.js`:
- Import `buyFromStore` from `store-logic.js`
- In the buy button click handler, replace inline `generateExploitForVuln` +
  `onBuy(card, price)` with `buyFromStore(item.vulnId)`
- The `onBuy` callback from `action-context.js` is no longer needed — the
  store logic handles state mutation directly
- Update `openDarknetsStore` signature: remove the `onBuy` parameter
- Update `action-context.js` to match: `openDarknetsStore(getState())` instead
  of passing the `onBuy` callback

Add a test in `js/store-logic.test.js`:
- Init state with a known network, give player cash
- Call `buyFromStore(1)` — verify card returned, cash deducted, card in hand
- Call `buyFromStore("some-vuln-id")` — verify lookup by vuln ID works
- Call with insufficient cash — verify null returned, cash unchanged

`make check` passes.

---

## Phase 2 — Wire `buy` command in playtest harness

**Builds on:** Phase 1.

**After this phase:** the playtest harness supports `store` and `buy` commands
natively (not just via console.js). The bot will use `buyFromStore` directly,
but this phase ensures the harness is symmetric with the browser.

### Prompt

Update `scripts/playtest.js`:

The console.js `cmdBuy` already handles `buy` and `cmdStore` handles `store`.
These work through `runCommand()` which the harness already delegates to. But
the harness overrides `openDarknetsStore` with a log message stub (line 101).

Verify that `store` and `buy` commands work through the existing `runCommand`
path:
```bash
node scripts/playtest.js --seed test --time B --money B reset
node scripts/playtest.js --seed test --time B --money B "select wan-1"
node scripts/playtest.js --seed test --time B --money B "store"
node scripts/playtest.js --seed test --time B --money B "buy 1"
```

If the commands already work (they should — console.js handles them), no code
changes needed in this phase. Just verify and document.

If there's an issue (e.g. `resolveWanAccess` requires selection state that
doesn't persist properly), fix it.

`make check` passes.

---

## Phase 3 — Bot game runner (single run)

**Builds on:** Phases 1–2, plus existing playtest.js wiring pattern.

**After this phase:** `scripts/bot-player.js` exports a `runBot(network, seed)`
function that plays a single game from init to jackout and returns a stats
object. No CLI yet.

### Prompt

Create `scripts/bot-player.js`. This module exports a single function:

```js
/**
 * Run one automated game from init to completion.
 * @param {object} network — return value of generateNetwork()
 * @param {string} seed
 * @param {{ tickIncrement?: number, maxTicks?: number }} [options]
 * @returns {BotRunStats}
 */
export function runBot(network, seed, options = {}) { ... }
```

**Setup (same wiring as playtest.js):**
1. `initState(network, seed)`
2. `startIce()`
3. Timer wiring: register handlers for all TIMER events (ICE_MOVE, ICE_DETECT,
   TRACE_TICK, REBOOT_COMPLETE, EXPLOIT_EXEC, EXPLOIT_NOISE, PROBE_SCAN,
   READ_SCAN, LOOT_EXTRACT)
4. `initNodeLifecycle()`
5. Build action context and init dispatcher
6. Register event listeners for stat collection (count ICE detections, track
   peak alert, detect trace)

**Important: event listener cleanup.** The `on()` function in events.js adds
persistent listeners. Running 100 bot games would accumulate 100× listeners.
Check if events.js has an `off()` or cleanup mechanism. If not, add one
(`off(type, fn)` to remove a specific listener, or `offAll()` / scoped
listener groups). This is critical for the census loop.

**Bot strategy loop:**

```js
const { tickIncrement = 1, maxTicks = 5000 } = options;
let totalTicks = 0;
let missionDone = false;
let traceFired = false;
// ... stat accumulators

while (totalTicks < maxTicks) {
  const state = getState();
  if (state.phase !== "playing") break;
  if (traceFired) { jackOut(); break; }

  // 1. Pick next target node
  const target = pickNextNode(state);
  if (!target) {
    // Stuck — no reachable unowned nodes
    if (missionDone) break;  // full exploration done or stuck
    jackOut(); break;         // can't reach mission target
  }

  // 2. Navigate to target
  selectNode(target.id);

  // 3. Probe if needed
  if (!target.probed) {
    startProbe(target.id);
    totalTicks += tickUntilEvent(E.NODE_PROBED, tickIncrement, maxTicks - totalTicks);
  }

  // 4. Exploit until owned
  while (target.access !== "owned" && totalTicks < maxTicks) {
    const card = pickBestCard(state, target);
    if (!card) {
      // Try to buy from store
      const bought = tryBuyCard(state, target);
      if (!bought) { failReason = "no-cards"; jackOut(); break outer; }
      continue;
    }
    startExploit(target.id, card.id);
    totalTicks += tickUntilEvent([E.EXPLOIT_SUCCESS, E.EXPLOIT_FAILURE],
                                 tickIncrement, maxTicks - totalTicks);
    // Re-read state after exploit resolves
  }

  // 5. Read + loot if lootable and owned
  if (target.access === "owned" && isLootable(target)) {
    startRead(target.id);
    totalTicks += tickUntilEvent(E.NODE_READ, tickIncrement, maxTicks - totalTicks);
    startLoot(target.id);
    totalTicks += tickUntilEvent(E.NODE_LOOTED, tickIncrement, maxTicks - totalTicks);
    if (isMissionTarget(target)) missionDone = true;
  }
}

// Jack out if still playing
if (getState().phase === "playing") jackOut();

return collectStats(...);
```

**Helper functions (private to the module):**

- `pickNextNode(state)` — implements the greedy priority:
  1. Adjacent unowned lootable node
  2. Nearest unowned adjacent node (BFS from current position through owned nodes)
  3. null if nothing reachable
  Note: "adjacent" means the bot can see/reach the node. Hidden nodes behind
  gates are not visible until the gate is owned.

- `pickBestCard(state, target)` — from `state.player.hand`, find best card:
  1. Filter to cards with uses > 0 and not disclosed
  2. Prefer cards matching a known vuln on this node
  3. Among matches (or all if no matches): highest quality, then most uses
  4. Return card or null

- `tryBuyCard(state, target)` — attempt darknet store purchase:
  1. Find a known vuln on the target node
  2. Call `buyFromStore(vulnId)`
  3. Return true if successful, false if can't afford or no known vulns

- `tickUntilEvent(eventType, increment, budget)` — tick in increments,
  listening for the event. Return total ticks consumed. Safety: if budget
  exceeded, stop ticking. eventType can be a single type or array of types
  (for exploit which fires either SUCCESS or FAILURE).

- `isLootable(node)` — type is fileserver or cryptovault
- `isMissionTarget(node, state)` — node is the mission's target node

**Stats returned (`BotRunStats`):**

```js
{
  missionSuccess: boolean,
  fullClear: boolean,
  failReason: null | "trace" | "no-cards" | "stuck",
  cardUsesConsumed: number,
  cardsBurned: number,
  storeVisits: number,
  cashSpent: number,
  cashRemaining: number,
  totalTicks: number,
  peakAlert: string,
  traceFired: boolean,
  iceDetections: number,
  nodesOwned: number,
  nodesTotal: number,
}
```

Write a test in `scripts/bot-player.test.js`:
- Run bot against a generated F/F network — should succeed (easy difficulty)
- Run bot against B/B — should complete without crashing (may or may not succeed)
- Verify stats object has all expected fields
- Verify determinism: same seed + difficulty = same stats

Add `scripts/*.test.js` to the Makefile test glob (already done in prior session).

`make check` passes.

---

## Phase 4 — Bot node selection and card picking

**Builds on:** Phase 3 skeleton.

**After this phase:** the bot's `pickNextNode` and `pickBestCard` are robust
and tested independently.

### Prompt

This phase may be folded into Phase 3 if the helpers are straightforward
enough. If Phase 3 is getting large, split the helpers into this phase.

Key things to get right:

**`pickNextNode` — visibility awareness:**
The bot can only see nodes that are visible (`visibility !== "hidden"`). Nodes
behind firewalls are hidden until the firewall is owned. The BFS must only
traverse visible nodes, and only consider nodes that are not yet owned.

The BFS should start from the currently selected node (or gateway if nothing
selected) and explore through owned nodes to find unowned visible nodes.
Priority: lootable first (fileserver/cryptovault), then any type.

**`pickBestCard` — matching logic:**
A card "matches" a node if any of the card's `targetVulnTypes` appears in the
node's `vulnerabilities` array (filtering out patched and hidden vulns).
Only probed nodes have known vulns.

Test `pickNextNode` with a hand-crafted state:
- Network with gateway (owned) → router (visible, unowned) → fileserver (hidden)
- Bot should pick router (fileserver is hidden behind a gate)
- After owning router, fileserver becomes visible, bot picks fileserver

Test `pickBestCard`:
- Node with known vuln "buffer-overflow"
- Hand has matching card (quality 0.5) and non-matching card (quality 0.8)
- Bot should pick the matching card despite lower quality

`make check` passes.

---

## Phase 5 — Bot census CLI and report

**Builds on:** Phases 3–4 (working bot).

**After this phase:** `node scripts/bot-census.js --time B --money B` runs
100 simulated games and prints the LLM-legible report.

### Prompt

Create `scripts/bot-census.js`. CLI script that:

1. Parses arguments:
   - `--time <grade>` and `--money <grade>` (required)
   - `--seeds <N>` (default 100)
   - `--seed-prefix <string>` (default "bot")

2. For each seed (`{prefix}-0` through `{prefix}-{N-1}`):
   - `generateNetwork(seed, tc, mc)` → network
   - `runBot(network, seed)` → stats
   - Collect stats into arrays

3. Print the report:

```
=== BOT SIMULATION: B/B ===
Seeds: bot-0 through bot-99 (100 runs)

--- MISSION COMPLETION ---
Success rate:     N/100 (pct%)
Avg ticks:        X (succeeded) / Y (failed)
Failure reasons:  trace=N  no-cards=N  stuck=N

--- FULL EXPLORATION ---
Full clear rate:  N/100 (pct%)
Avg nodes owned:  X / Y total (pct%)

--- RESOURCE USAGE (succeeded runs) ---
              Min    Avg    Max
Card uses:    X      X      X
Cards burned: X      X      X
Store visits: X      X      X
Cash spent:   X      X      X
Cash left:    X      X      X

--- PRESSURE ---
Peak alert:   GREEN=N  YELLOW=N  RED=N
Trace fired:  N/100
ICE detects:  avg X  max X
```

4. Add a `bot-census` target to the Makefile:
```make
bot-census:
	node scripts/bot-census.js --time B --money B
```

Verify by running:
```bash
node scripts/bot-census.js --time B --money B --seeds 10
```

`make check` passes.

---

## Phase 6 — Run B/B census and document findings

**Builds on:** Phase 5.

**After this phase:** we have a B/B bot census report saved and documented.

### Prompt

1. Run: `node scripts/bot-census.js --time B --money B`
2. Save output to `docs/dev-sessions/2026-03-01-2012-census-metrics-v2/bot-census-BB.txt`
3. Also run F/F for comparison:
   `node scripts/bot-census.js --time F --money F`
   Save to `bot-census-FF.txt`
4. Review findings with Les. Key questions:
   - What's the mission success rate at B/B? Is it reasonable?
   - Does trace fire at B/B? How often?
   - Is the store needed? How often?
   - How does F/F compare?
5. Document observations in `notes.md`

This phase is collaborative — the data drives the conversation.
