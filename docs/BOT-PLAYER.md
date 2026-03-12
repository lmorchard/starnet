# Bot Player

The bot player (`scripts/bot/`) is an automated game-playing agent that runs a
complete Starnet LAN dungeon from initialization to jackout. It uses a modular
**perception → scoring → execute** architecture with pluggable strategy
heuristics — deliberately greedy (no lookahead) so that difficulty differences
show up in results rather than strategy variance. The bot establishes a
pessimistic lower bound on completion rates: a skilled human player should beat
it at every difficulty level.

---

## Quick Start

```bash
# Run a single bot game
node scripts/bot/cli.js --network corporate-foothold --seed test-1

# Verbose mode — shows scoring proposals and decisions
node scripts/bot/cli.js --network research-station --seed test-1 --verbose

# Available networks: corporate-foothold, research-station, corporate-exchange
```

Output is a JSON `BotRunStats` object (see Stats Collected below).

---

## Architecture

```
scripts/bot/
  cli.js            — CLI entry point (parse args, select network, print stats)
  run.js            — init engine, assemble strategies, run loop
  loop.js           — main cycle: perceive → score → execute → track
  perception.js     — reads game state, builds WorldModel snapshot
  scoring.js        — runs all strategies, picks highest-scored proposal
  execute.js        — dispatches actions, ticks timed actions to resolution
  stats.js          — stat creation, recording, finalization
  types.js          — JSDoc typedefs (WorldModel, ScoredAction, etc.)
  heuristics/
    explore.js      — probe unprobed nodes, exploit probed ones
    loot.js         — read and loot owned nodes
    security.js     — subvert IDS, cancel trace
    traps.js        — disarm set-piece traps on owned nodes
    evasion.js      — avoid ICE, jack out under trace
    cards.js        — buy cards from darknet store, jack out when stuck

scripts/lib/
  headless-engine.js — shared init for bot + playtest harness
```

### Pipeline

Each main-loop iteration:

1. **Perceive** — snapshot game state into a `WorldModel`: categorized nodes,
   card-to-vuln matching, ICE position, available actions, mission status.
2. **Score** — every strategy heuristic returns `ScoredAction[]` proposals. The
   scoring engine picks the highest by score magnitude.
3. **Execute** — dispatch the winning action. Instant actions return immediately.
   Timed actions (probe, exploit, read, loot) tick forward until resolution,
   ICE interruption, or tick budget.
4. **Track** — record stats, update failed-exploit memory, ICE cooldowns, and
   completed-action sets.

### Shared Headless Engine

`scripts/lib/headless-engine.js` extracts the timer wiring, action context, and
game init sequence shared by the bot and playtest harness. Both entry points
import `initHeadlessEngine()` and `resetGame()` from here.

---

## Strategy Heuristics

Each heuristic is a function `(world: WorldModel) => ScoredAction[]`. Score
ranges establish natural priority:

| Score Range | Category |
|-------------|----------|
| 800–900 | Emergency (ICE on node, cancel-trace) |
| 100 | Trace jackout |
| 55–70 | Security subversion, buy cards, disarm traps |
| 42–58 | Normal exploration (select, probe, exploit) |
| 15 | Deselect (reduce exposure) |
| 10 | Stuck jackout |

### explore

Probes unprobed nodes (base 50), exploits probed ones (base 45). Card
selection: prefer vuln match, then highest quality/uses. Bonuses for mission
path (+10) and current selection (+8). Distance penalty (-5/hop). Hail-mary
penalty (-5) for non-matching cards. Dangerous-type penalty (-10) for IDS and
security-monitor nodes.

### loot

Read owned unread nodes (base 60), loot read nodes (base 62). Only proposes
if the `read`/`loot` action is actually available (checks `availableActions`).
Mission target bonus (+20).

### security

Reconfigure owned IDS (70). Probe/exploit IDS for subversion (72/71). Cancel
active trace (900 — emergency). Green-alert penalty (-35) delays security
work until alert pressure exists.

### traps

Disarm actions on owned nodes (65). Tracks completed disarms to prevent
infinite retry (set-piece disarm actions lack post-conditions).

### evasion

ICE on selected node → deselect (800). Trace active → jackout (100).
Idle selection → deselect (15).

### cards

Buy matching card from darknet store (55) when no cards match exploitable
nodes. Uses `buyFromStore()` directly (headless — no browser store UI).
Jack out (10) when no usable cards remain and can't afford store.

---

## ICE Handling

### Interrupt During Timed Actions

If ICE arrives at the player's node mid-action, `execute.js` cancels the
action and deselects. The main loop adds the node to `iceCooldown` — a
one-cycle score penalty (-20) that encourages the bot to try a different
node before retrying.

### Cooldown Lifecycle

- ICE interrupts → node added to cooldown set
- Next non-interrupted cycle → cooldown cleared
- Cooled-down nodes get penalty, not hard skip (avoids "no proposals" when
  there's only one path forward)

---

## Card Economy

### Matching vs Hail-Mary

Cards have `targetVulnTypes` matched against node `vulnerabilities[].id`.
Matching cards get full score; non-matching get a -5 penalty (explore) or
-30 penalty (security).

### Failed Exploit Memory

The loop tracks `failedExploits` as `"nodeId:cardId"` pairs. Cards that
failed on a node are skipped by `pickBestCard()`. Successful exploits
(access level changed) clear all failures for that node.

### Store Purchases

The `buy-card` action calls `buyFromStore()` from `js/core/store-logic.js`
directly. `pickVulnToBuy()` collects vulnerability IDs from `needsExploit`
nodes and finds the cheapest affordable catalog match.

---

## Tick Advancement

The bot drives the game clock via `tick()`. After dispatching a timed action,
`tickUntilResolved()` advances in 1-tick increments until:

- `ACTION_RESOLVED` fires for the target node/action
- `ICE_MOVED` to the selected node (interrupted)
- `RUN_ENDED` fires
- Per-action tick budget (500) exhausted

A per-run tick cap (default: 5000) prevents infinite loops.

---

## Stats Collected

Each `runBot()` call returns a `BotRunStats` object:

### Outcome
| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Mission complete and jacked out |
| `failReason` | string/null | `"trace"`, `"stuck"`, `"tick-cap"`, or null |

### Resources
| Field | Type | Description |
|-------|------|-------------|
| `cardsUsed` | number | Total exploit attempts |
| `cardsBurned` | number | Cards fully depleted or disclosed |
| `storeVisits` | number | Darknet store purchases |
| `cashSpent` | number | Total darknet expenditure |
| `cashRemaining` | number | Cash at jackout |

### Time / Pressure
| Field | Type | Description |
|-------|------|-------------|
| `ticksElapsed` | number | Virtual ticks at jackout |
| `peakAlert` | string | Highest alert reached |
| `traceFired` | boolean | Whether trace countdown started |
| `iceDetections` | number | ICE detection events |
| `iceEvasions` | number | Actions cancelled due to ICE |

### Exploration
| Field | Type | Description |
|-------|------|-------------|
| `nodesOwned` | number | Nodes at "owned" access (excluding WAN) |
| `nodesTotal` | number | Total nodes (excluding WAN) |
| `disarmActionsUsed` | number | Disarm actions executed |
| `strategyCounts` | Record | Per-strategy win counts |

---

## What the Bot Does NOT Do

These omissions are intentional — they make the bot a pessimistic baseline:

- **Eject ICE** — never pushes ICE to an adjacent node
- **Reboot nodes** — never forces ICE back to its resident node
- **Strategic patience** — doesn't wait for ICE to move away before re-engaging
- **Manage card decay** — doesn't preserve high-value cards for hard nodes
- **Plan ahead** — no lookahead; greedy scoring of current moment only
- **Anticipate ICE movement** — only reacts when ICE arrives, doesn't track
  patrol patterns

---

## Determinism

Same seed + same network = identical stats. The bot uses the game's seeded PRNG
and drives the clock deterministically via `tick()`.
