# Spec: Census Metrics v2 — Monte Carlo Bot Simulation

## Goal

Build an automated bot that plays through generated LANs in a tight headless
loop, collecting per-run statistics across many seeds. The bot establishes a
pessimistic lower bound on completion rates and resource costs — a skilled
human should beat it. Parameterized by difficulty so we can sweep the full
matrix later, starting with B/B.

Also: extract the darknet store's buy logic into a headless function, fixing
the current DOM-only coupling. The store should be fully accessible to
headless gameplay per the "GUI and console are symmetric" design principle.

---

## Background

The census tool (session 2026-03-01-1721) measures topology and resource
*budgets* — what the network looks like and what it theoretically costs. But it
can't answer:

- Can a player actually complete this difficulty?
- How often does trace fire?
- How many darknet store visits are needed?
- What's the real tick-to-complete under ICE pressure?

These require simulating gameplay, not just analyzing topology. The bot fills
this gap by playing many runs with a fixed greedy strategy and collecting
distributional data.

---

## Darknet Store Extraction

### Problem

`js/store.js` is DOM-coupled — `openDarknetsStore()` creates modal elements.
The playtest harness and the bot both need headless store access.

### Solution

Extract a `buyExploitForVuln(state, vulnId)` function (or similar) that:
1. Looks up the vuln in the store catalog
2. Checks if the player can afford it
3. Generates the exploit card
4. Deducts cash and adds the card to the player's hand
5. Returns the card (or null if can't afford)

This function lives in the game logic layer (not store.js's DOM layer). The
DOM store and the headless bot both call it. The playtest harness gains
`buy <vulnId>` command support as a side effect.

---

## Bot Design

### Goal modes

Each run attempts both, measured independently:

1. **Mission completion** — reach the target (fileserver/cryptovault), loot it,
   jackout. Binary success/fail.
2. **Full exploration** — after mission completion (or if mission is already
   done), continue owning every reachable non-security node. Measures total
   network cost.

The bot always attempts mission first. If it succeeds, it continues exploring
until all reachable nodes are owned or it gets stuck/traced. If mission fails,
exploration stats are still recorded (nodes owned at time of failure/jackout).

### Strategy

Greedy, consistent, not optimal. The bot is deliberately simple so difficulty
differences show up in results rather than strategy variance.

**Node selection priority:**
1. If an adjacent unowned lootable node exists (fileserver/cryptovault), target it
2. Otherwise, pick the nearest unowned adjacent node (BFS from current position)
3. If all adjacent nodes are owned, move to an owned node adjacent to an unowned one

**Per-node action sequence:**
1. Select node
2. Probe (if not already probed) — tick until probe completes
3. Pick best exploit card:
   - Prefer: matching a known vuln on this node
   - Then: highest quality
   - Then: most uses remaining
4. Exploit — tick until exploit resolves (success or failure event)
5. Repeat exploit until node is owned or no usable cards remain for this node
6. If owned and lootable: read (tick to complete), then loot (tick to complete)
7. Move to next node per selection priority

**When stuck (no usable cards for any reachable unowned node):**
1. Find a known vuln on any adjacent unowned node
2. Visit darknet store, buy a card matching that vuln
3. If can't afford anything, jackout (run failed — reason: "no-cards")

**Tick advancement:**
After starting any timed action (probe, exploit, read, loot), tick in small
increments until the relevant completion event fires. The increment is a
configurable constant (default 1 tick) — can be increased if performance is
an issue. This gives realistic tick counts and lets ICE pressure manifest
naturally.

**Trace handling:**
If trace fires (alert reaches RED, 60-second countdown begins), jackout
immediately. Run recorded as failure with reason "trace".

**Stuck detection:**
A per-run tick cap (e.g. 5000 ticks) prevents infinite loops. If the bot
hasn't completed or jacked out within the cap, the run ends as failure with
reason "stuck". Additionally, if the bot's action selection finds no valid
move (no reachable unowned nodes, can't afford store), it jacks out
immediately rather than spinning.

### What the bot does NOT do

- Reconfigure IDS nodes (no alert management)
- Eject ICE (no ICE avoidance)
- Reboot nodes
- Make strategic choices about node ordering beyond the greedy priority
- Retry failed nodes with different strategies

These omissions are intentional — they make the bot a pessimistic baseline.

---

## Stats Collected Per Run

**Outcome:**
- `missionSuccess`: boolean — target looted and jackout
- `fullClear`: boolean — all reachable non-security nodes owned
- `failReason`: null | "trace" | "no-cards" | "stuck"

**Resource consumption:**
- `cardUsesConsumed`: number — total exploit attempts
- `cardsBurned`: number — cards fully depleted or disclosed
- `storeVisits`: number — darknet store purchases
- `cashSpent`: number — total darknet store expenditure
- `cashRemaining`: number — cash at jackout

**Time/pressure:**
- `totalTicks`: number — ticks elapsed at jackout
- `peakAlert`: "GREEN" | "YELLOW" | "RED"
- `traceFired`: boolean
- `iceDetections`: number — times ICE detection event fired

**Exploration:**
- `nodesOwned`: number
- `nodesTotal`: number
- `critPathNodesOwned`: number
- `critPathNodesTotal`: number

---

## Report Format

Text-based, LLM-legible. Parameterized by difficulty.

```
=== BOT SIMULATION: B/B ===
Seeds: bot-0 through bot-99 (100 runs)

--- MISSION COMPLETION ---
Success rate:     73/100 (73%)
Avg ticks:        342 (succeeded) / 189 (failed)
Failure reasons:  trace=15  no-cards=8  stuck=4

--- FULL EXPLORATION ---
Full clear rate:  41/100 (41%)
Avg nodes owned:  9.2 / 13.1 total (70%)

--- RESOURCE USAGE (succeeded runs) ---
              Min    Avg    Max
Card uses:    8      14.3   22
Cards burned: 0      1.8    5
Store visits: 0      1.2    4
Cash spent:   0      425    1250
Cash left:    250    1075   1500

--- PRESSURE ---
Peak alert:   GREEN=31  YELLOW=42  RED=27
Trace fired:  15/100
ICE detects:  avg 2.4  max 7
```

### CLI Usage

```bash
node scripts/bot-census.js --time B --money B              # 100 runs at B/B
node scripts/bot-census.js --time B --money B --seeds 50   # 50 runs
node scripts/bot-census.js --time F --money F --time S --money S  # sweep (future)
```

---

## Architecture

### Files

- `js/store-logic.js` (new) — headless buy function extracted from store.js
- `js/store.js` — refactored to use store-logic.js for the actual purchase
- `scripts/bot-player.js` (new) — the bot strategy module (exported function)
- `scripts/bot-census.js` (new) — CLI harness: init, run bot, collect stats, print report

### Bot loop (single run)

```
1. generateNetwork(seed, tc, mc) → network
2. initState(network, seed)
3. startIce()
4. Wire timer handlers (same as playtest.js)
5. Run bot strategy loop:
   a. Observe state → pick next action
   b. Dispatch action via emitEvent("starnet:action", ...)
   c. Tick until action completes (watch for completion events)
   d. Check termination conditions (mission done, stuck, trace)
6. Collect stats from final state + event log
7. Return stats object
```

### Driving ticks

The bot ticks 1-at-a-time after dispatching an action, watching for the
completion event. A safety cap (e.g. 2000 ticks) prevents infinite loops
if an event never fires.

---

## Scope

### In scope
- Headless store extraction (store-logic.js)
- Console `buy` command wired through playtest harness + browser console
- Bot player strategy module
- Bot census CLI with parameterized difficulty
- Stats collection and LLM-legible report
- B/B as initial test case

### Out of scope
- Smart strategies (IDS reconfiguration, ICE avoidance, node reboot)
- Full matrix sweep automation (the CLI supports it, but analysis is future)
- Browser integration of headless store beyond refactoring store.js to use
  the extracted logic
- Comparison mode (before/after reports — just run twice and read both)
