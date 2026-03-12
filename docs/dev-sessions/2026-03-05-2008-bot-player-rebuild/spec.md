# Spec: Bot Player Rebuild

## Goal

Rebuild the bot player as a modular, extensible automated game-playing agent.
The old bot was a monolithic file with hardcoded strategy. The new bot uses a
perception→scoring→execute architecture with pluggable strategy functions.

The bot establishes a "slightly above novice" baseline for balance testing:
it makes reasonable decisions but doesn't plan ahead or optimize deeply.

## Architecture

### Core Loop

```
while (!done) {
  const world = perceive(state);
  const choice = score(world, strategies);
  if (!choice) { jackOut(); break; }
  done = execute(choice, world);
}
```

The loop runs synchronously, driving the game clock via `tick()`.

### File Structure

```
scripts/bot/
  run.js          — entry point: accept network, run loop, return stats
  loop.js         — the decide→act→tick cycle
  perception.js   — reads game state, builds structured world model
  scoring.js      — collects proposals from all strategies, picks highest
  heuristics/     — one file per concern, each exports a scoring function
    security.js   — IDS/monitor subversion priority
    loot.js       — mission target + lootable node scoring
    traps.js      — discover and use disarm actions on owned nodes
    evasion.js    — ICE proximity, deselect, cancel-on-arrival
    cards.js      — hand quality, store visits when stuck
    explore.js    — general node expansion (probe/exploit unowned nodes)
  execute.js      — fires starnet:action, ticks until resolution
  stats.js        — stat collection
```

### Shared Headless Engine

Extract common game engine init plumbing into a shared module that the
playtest harness, bot, and future headless tools all import:

- Game init (initGame, buildActionContext, initActionDispatcher)
- Timer wiring (ICE_MOVE, ICE_DETECT, TRACE_TICK)
- Graph bridge + dynamic actions
- Tick driving

This means refactoring `scripts/playtest.js` to use the shared module.

## Strategies

### Interface

Each strategy is a function:

```js
/** @param {WorldModel} world */
function strategyName(world) → ScoredAction[]
```

Where `ScoredAction` is:

```js
{
  action: string,      // action ID (e.g. "probe", "exploit", "disarm-counter")
  nodeId: string,      // target node
  score: number,       // higher wins
  reason: string,      // human-readable explanation for debugging
  payload?: object,    // extra data (e.g. { exploitId } for exploit actions)
}
```

### Scoring

`scoring.js` runs all strategies, collects all proposals into a flat list,
sorts by score descending, returns the winner. No priority tiers — score
magnitude conveys urgency (emergencies use high scores like 1000, normal
actions use 0-100).

### Composability

The strategy array is the bot's "personality." Different compositions produce
different play styles:

- **Default** — all heuristics active, balanced weights
- **Aggressive** — no evasion, pure speed
- **Cautious** — evasion weighted high, IDS subversion first
- **Completionist** — explore/own everything, not just mission target

### Card Selection

Card selection is part of strategy proposals. The explore/loot heuristics
propose complete `exploit` actions with a specific `exploitId` in the payload.
Different strategies could propose different card choices for the same node
(e.g. "best match" vs "conserve good cards"), and scoring resolves the
tradeoff.

## World Model (Perception)

The perception layer reads game state and produces a structured snapshot:

- **Nodes by category** — visible nodes grouped by state:
  - unowned but accessible (can navigate to)
  - owned (bot controls)
  - needs-probe (accessible, not yet probed)
  - needs-exploit (probed, not yet owned)
  - lootable (owned, readable or has uncollected loot)
  - security (IDS/monitor nodes, reconfigure status)
  - has-disarm-actions (owned nodes with available disarm-type actions)
- **Graph topology** — adjacency for BFS pathfinding
- **ICE state** — position (if known from events), last seen node, whether
  it's on the currently selected node
- **Player state** — selected node, cash, alert level, trace active/countdown
- **Hand** — cards with uses remaining; for each visible node's vulns, which
  cards match
- **Available actions** — per accessible node, from `getAvailableActions()`
- **Mission** — target node ID, whether found, whether looted

The world model is recomputed each iteration (cheap — it's just reading state
and categorizing).

## ICE Handling

During timed action execution (probe, exploit, read, loot), the execute layer
ticks forward incrementally. Between ticks, it checks for ICE-relevant events.
If ICE arrives at the player's node mid-action, the execute step re-enters the
scoring loop with updated perception. The evasion heuristic can then propose
"cancel current action and deselect" with a high score, or other strategies
might propose "ride it out" if the action is nearly complete.

This makes evasion emergent from scoring rather than a hardcoded interrupt.
The recursion is bounded to one level: mid-action re-score → either continue
or cancel+act.

## Trait Awareness

The bot has no hardcoded knowledge of specific traits (hardened, trapped,
encrypted, volatile, etc.). Instead, it discovers what it can do via
`getAvailableActions()` on each node. After owning a node, if disarm actions
appear (e.g. "disarm-counter", "disarm-sensor"), the traps heuristic proposes
using them.

This means the bot automatically adapts to new traits that add disarm actions
without code changes.

## Network Input

The bot accepts any network as a `buildNetwork` function returning a
NodeGraphDef. It is network-agnostic — no assumptions about specific node IDs,
topology, or set-piece composition. The existing hand-crafted networks
(corporate-foothold, research-station, corporate-exchange) and any future
networks or JSON-defined graphs all work.

## Outcomes and Stats

### Outcome

Simple success/failure:
- **Success** — mission target looted and jacked out
- **Failure** — run ended without completing mission (trace caught, no cards,
  stuck, tick cap exceeded)

Track a `failReason` string for diagnostics but keep the categories minimal.

### Stats

Design the stats shape around what the new bot actually does. Include at
minimum:

- Ticks elapsed
- Nodes owned / total
- Cards used / burned
- Store visits / cash spent
- Peak alert level
- Trace fired (boolean)
- ICE detections count
- ICE evasions count (cancel-on-arrival events)
- Disarm actions used
- Actions proposed per strategy (for tuning — which heuristics are driving
  decisions)

The exact shape will be refined during implementation. The stats object is
returned from each bot run for census aggregation.

## Census

The census system will be rebuilt as a separate follow-up session. For now,
the bot's `run()` function returns a stats object that the census can consume.
The bot itself has no census logic.

## Playtest Harness Refactor

As part of extracting the shared headless engine, `scripts/playtest.js` will
be refactored to import from the shared module. Its external interface (CLI
args, state file persistence, command dispatch) stays the same — only the
internal init plumbing changes.

## Out of Scope

- Census CLI rebuild (separate session)
- LLM-driven bot (future project)
- Procgen network generation (deleted, not being restored here)
- Strategy tuning / weight optimization (iterate after basic bot works)
- Bot-vs-bot or multi-bot scenarios
