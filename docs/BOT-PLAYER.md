# Bot Player

The bot player (`scripts/bot-player.js`) is an automated game-playing agent that
runs a complete Starnet LAN dungeon from initialization to jackout. It uses a
fixed greedy strategy — deliberately simple so that difficulty differences show up
in results rather than strategy variance. The bot establishes a pessimistic lower
bound on completion rates: a skilled human player should beat it at every
difficulty level.

The bot census CLI (`scripts/bot-census.js`) runs the bot many times across
parameterized difficulties and produces LLM-readable reports.

---

## Quick Start

```bash
# Run 100 simulated games at B/B difficulty
node scripts/bot-census.js --time B --money B

# Run with evasion strategy (recommended — much better at C+ ICE)
node scripts/bot-census.js --time B --money B --evasion

# Quick test with fewer seeds
node scripts/bot-census.js --time C --money C --seeds 20 --evasion

# Makefile shortcut (defaults: B/B, 100 seeds)
make bot-census
make bot-census TC=S MC=S SEEDS=50
```

---

## Bot Strategy

### Node Selection Priority

Each iteration of the main loop, the bot picks the next node to work on:

1. **Current node** — if the bot's current position (gateway at start) is
   unowned, work on it first.
2. **IDS reconfiguration** (evasion mode only) — if a visible IDS node is not
   yet reconfigured, prioritize owning and reconfiguring it. This severs the
   ICE detection → alert chain, which is the key counterplay to ICE pressure.
3. **Nearest lootable target** — BFS through owned nodes to find the closest
   fileserver or cryptovault that isn't yet owned.
4. **Nearest unowned node** — any visible, non-security, non-wan node.
5. **Null** — nothing reachable; the bot jacks out.

The BFS only traverses through owned nodes (the bot can't see past nodes it
doesn't control). Hidden nodes behind firewalls are invisible until the gate
is owned.

### Per-Node Action Sequence

For each target node:

1. **Select** — navigate to the node (makes it accessible if revealed).
2. **Probe** — if not already probed, scan for vulnerabilities. Ticks forward
   until `NODE_PROBED` fires. In evasion mode, cancels and hides if ICE arrives
   mid-probe.
3. **Exploit** — pick the best card and attack:
   - **Card selection**: prefer cards matching a known vulnerability, then
     highest quality, then most uses remaining.
   - **Proactive store** (evasion mode): if no card matches any known vuln, buy
     a matching card from the darknet store before exploiting.
   - Ticks forward until `EXPLOIT_SUCCESS` or `EXPLOIT_FAILURE` fires.
   - Repeats until the node is owned or no usable cards remain.
4. **Read** — if owned and not yet read, extract data. Ticks until `NODE_READ`.
5. **Loot** — if read and has uncollected macguffins, extract loot. Ticks until
   `NODE_LOOTED`.
6. **Reconfigure** (evasion, IDS nodes) — if the owned node is an IDS, disable
   event forwarding to sever the alert chain.

### When Stuck

If the bot has no usable cards for the current node:

1. Look for a known vulnerability and buy a matching card from the darknet store.
2. If the store purchase fails (can't afford), try a different node.
3. If no nodes are reachable, jack out with failure reason `"no-cards"`.

---

## Evasion Mode

Enabled with the `--evasion` flag (or `{ evasion: true }` option). Adds ICE
avoidance behaviors that significantly improve success rates at C+ difficulty.

### Deselect Between Actions

After each timed action completes (probe, exploit, read, loot), the bot
immediately deselects. ICE can only detect the player when co-located on the
same node — deselecting removes the player's presence.

### Cancel-on-ICE-Arrival

During exploit and probe execution, the bot monitors for `ICE_MOVED` events.
If ICE arrives at the player's current node mid-action:

1. Cancel the current action (`cancel-exploit` or `cancel-probe`).
2. Deselect to hide.
3. **Patience**: wait for 3 ICE move events. This gives ICE time to arrive at
   the disturbance source, investigate, clear the signal, and wander away.
4. Set the current node as `avoidNodeId` — the next iteration will prefer a
   different target.

### Node Avoidance

After an ICE encounter, the bot avoids the node where ICE was last seen and
picks a different target if one is available. This prevents the bot from
immediately re-triggering disturbance at the same location. The avoidance
clears once any node is successfully owned.

### IDS Reconfiguration

In evasion mode, the bot prioritizes owning and reconfiguring IDS nodes before
pursuing the mission target. Reconfiguring an IDS severs the ICE detection →
security monitor → global alert chain, preventing detections from escalating
to trace.

---

## Tick Advancement

The bot drives the game clock directly via `tick()`. After dispatching any timed
action, it ticks in small increments (default: 1 tick = 100ms virtual time)
until the completion event fires. This gives realistic tick counts and lets ICE
pressure manifest naturally.

Two tick-loop variants:

- **`tickUntilEvent`** — ticks until a specific event fires or budget is
  exceeded. Used for non-evasion mode and for read/loot actions.
- **`tickUntilEventOrIce`** — same, but also breaks if ICE arrives at the
  player's node (`ICE_MOVED` to selected node). Used in evasion mode for
  probe and exploit.

A per-run tick cap (default: 5000 ticks) prevents infinite loops. If the bot
hasn't completed within the cap, the run ends with failure reason `"tick-cap"`.

---

## Stats Collected

Each `runBot()` call returns a `BotRunStats` object:

### Outcome
| Field | Type | Description |
|-------|------|-------------|
| `missionSuccess` | boolean | Target macguffin looted and jacked out |
| `fullClear` | boolean | All non-security, non-wan nodes owned |
| `failReason` | string/null | `"trace"`, `"no-cards"`, `"stuck"`, `"tick-cap"`, or null |

### Resources
| Field | Type | Description |
|-------|------|-------------|
| `cardUsesConsumed` | number | Total exploit attempts (success + failure) |
| `cardsBurned` | number | Cards fully depleted or disclosed |
| `storeVisits` | number | Darknet store purchases |
| `cashSpent` | number | Total darknet expenditure |
| `cashRemaining` | number | Cash at jackout |

### Time / Pressure
| Field | Type | Description |
|-------|------|-------------|
| `totalTicks` | number | Virtual ticks elapsed at jackout |
| `peakAlert` | string | Highest global alert reached (`"green"`, `"yellow"`, `"red"`) |
| `traceFired` | boolean | Whether trace countdown started |
| `iceDetections` | number | Times ICE detection event fired |

### Exploration
| Field | Type | Description |
|-------|------|-------------|
| `nodesOwned` | number | Nodes at "owned" access (excluding wan) |
| `nodesTotal` | number | Total nodes (excluding wan) |

### Timeline Breakpoints
| Field | Type | Description |
|-------|------|-------------|
| `tickFirstNodeOwned` | number | Tick when first non-gateway node reached "owned" (-1 = never) |
| `tickFirstDetection` | number | Tick when first ICE detection fired (-1 = never) |
| `tickTraceStarted` | number | Tick when trace countdown began (-1 = never) |
| `tickMissionComplete` | number | Tick when mission target was looted (-1 = never) |

---

## Census CLI

`scripts/bot-census.js` runs the bot across many seeds and aggregates stats.

### Arguments

| Flag | Default | Description |
|------|---------|-------------|
| `--time <grade>` | required | timeCost grade (F through S) |
| `--money <grade>` | required | moneyCost grade (F through S) |
| `--seeds <N>` | 100 | Number of simulation runs |
| `--seed-prefix <str>` | `"bot"` | Seed prefix (seeds are `{prefix}-0` through `{prefix}-{N-1}`) |
| `--evasion` | off | Enable evasion mode |

### Report Format

The report is text-based and designed for LLM readability:

```
=== BOT SIMULATION: B/B [EVASION] ===
Seeds: bot-0 through bot-99 (100 runs)

--- MISSION COMPLETION ---
Success rate:     N/100 (pct%)
Avg ticks:        X (succeeded) / Y (failed)
Failure reasons:  trace=N  no-cards=N  stuck=N  tick-cap=N

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

--- TIMELINE (avg tick when event first occurs) ---
First node owned:    X (N/100 runs)
First ICE detection: X (N/100 runs)
Trace started:       X (N/100 runs)
Mission complete:    X (N/100 runs)
```

---

## What the Bot Does NOT Do

These omissions are intentional — they make the bot a pessimistic baseline:

- **Eject ICE** — never pushes ICE to an adjacent node
- **Reboot nodes** — never forces ICE back to its resident node
- **pkill ICE** — never owns the ice-host node to terminate the ICE process
- **Cancel trace** — never owns the security monitor to cancel an active trace
- **Strategic node ordering** — beyond the greedy BFS priority, no planning
- **Anticipate ICE movement** — doesn't track ICE position or time actions
  around patrol cycles (only reacts when ICE arrives)
- **Manage card decay** — doesn't preserve high-value cards for hard nodes
- **Multi-attempt strategies** — if an exploit fails, retries with the same
  approach; doesn't switch tactics based on failure history

---

## Architecture Notes

### Event Handler Lifecycle

The game engine registers event handlers at module import time (ice.js,
exploit-exec.js, alert.js, etc.). The bot does **not** call `clearHandlers()`
between runs — doing so would destroy these module-level handlers.

Instead:
- **One-time init** (first `runBot` call): registers timer handlers and action
  dispatcher. These persist across runs.
- **Per-run handlers**: stat tracking listeners are registered at the start of
  each run and explicitly removed via `off()` at the end.
- `initState()` resets all game state between runs.

### Determinism

Same seed + same difficulty + same options = identical stats. The bot uses the
game's seeded PRNG and drives the clock deterministically via `tick()`.
