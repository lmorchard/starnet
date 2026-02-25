# Spec: Game Events & Console Redesign

_Session: 2026-02-25-1112-game-events-console-redesign_
_Branch: game-events-console-redesign_

---

## Problem

The current architecture has two fundamental gaps:

1. **Log entries and visual effects are decoupled.** A `flashNode` call in `main.js` and an `addLogEntry` call in `state.js` are implicitly paired by programmer discipline, not by structure. It is architecturally possible — and has already happened — to add a visual effect without a corresponding log entry (e.g. the node reveal flash).

2. **Game events are not a first-class concept.** The `statechange` event is undifferentiated — it carries the full state snapshot but records nothing about *what changed* or *why*. There is no typed event stream, no single place to see what events the game can produce, and no way for peer consumers (log, visuals, future AI agents) to subscribe selectively.

The goal is to make **game events the source of truth for all game activity**: every player-visible occurrence flows through a typed event, which simultaneously drives log output and visual effects. The console log + command interface should be sufficient for an LLM to fully observe and play the game without the visual graph.

---

## Architecture

### Three-Phase Pipeline

```
Intent (starnet:action:*)
  → Resolution (state mutation in state.js / ice.js)
    → Outcome (typed event emitted via events.js)
      → Peer renderers (log-renderer.js, visual-renderer.js)
```

**Intent layer** — the existing `starnet:action:*` DOM events remain unchanged. Player clicks and console commands dispatch these as now.

**Resolution layer** — `state.js` (and `ice.js`) handle intent events, mutate state, then emit typed outcome events via `events.js`. `addLog`/`addLogEntry` calls are removed from these modules entirely — log output is exclusively the log renderer's responsibility.

**Outcome layer** — typed events emitted through `events.js`, carrying structured payloads. Two peer renderers subscribe:
- `log-renderer.js` — formats each event as a human/LLM-readable log entry
- `visual-renderer.js` — triggers graph animations and one-shot visual effects

**Idempotent re-renders** — a generic `state:changed` event (replacing the current `starnet:statechange` DOM event) carries the full state snapshot. Both renderers subscribe to it alongside specific typed events: visual-renderer uses it to sync graph node styles, HUD, and sidebar; log-renderer ignores it (idempotent re-renders don't produce log entries).

### New Modules

```
js/events.js          — event catalog, pub/sub mechanism, emitEvent()
js/log-renderer.js    — subscribes to all events, formats log entries
js/visual-renderer.js — subscribes to all events, triggers graph effects + idempotent renders
```

The existing `js/graph.js` retains its Cytoscape.js wiring and low-level draw functions; `visual-renderer.js` calls into it. `js/main.js` is significantly slimmed — it orchestrates init and wires action handlers, but no longer contains render logic.

### Import Graph (no circularity)

```
events.js         ← no game imports
state.js          → events.js
ice.js            → events.js, state.js
log-renderer.js   → events.js, state.js (read-only)
visual-renderer.js→ events.js, graph.js, state.js (read-only)
main.js           → all of the above
```

---

## Event Catalog

All events emitted via `emitEvent(type, payload)`. Each entry shows type string, payload fields, and log prefix.

### System / State

| Type | Payload | Log prefix |
|---|---|---|
| `state:changed` | `{ state }` | _(no log entry — idempotent render only)_ |
| `run:started` | `{ state }` | `[SYS]` |
| `run:ended` | `{ outcome }` | `[SYS]` |

### Node Events

| Type | Payload | Log prefix |
|---|---|---|
| `node:revealed` | `{ nodeId, label }` | `[NODE]` |
| `node:probed` | `{ nodeId, label }` | `[NODE]` |
| `node:accessed` | `{ nodeId, label, prev, next }` | `[NODE]` |
| `node:alert-raised` | `{ nodeId, label, prev, next }` | `[NODE]` |
| `node:read` | `{ nodeId, label, macguffinCount }` | `[NODE]` |
| `node:looted` | `{ nodeId, label, items, total }` | `[NODE]` |
| `node:reconfigured` | `{ nodeId, label }` | `[NODE]` |
| `node:rebooting` | `{ nodeId, label, durationMs }` | `[NODE]` |
| `node:rebooted` | `{ nodeId, label }` | `[NODE]` |

### Exploit Events

| Type | Payload | Log prefix |
|---|---|---|
| `exploit:success` | `{ nodeId, label, exploitName, flavor, roll, successChance, matchingVulns }` | `[EXPLOIT]` |
| `exploit:failure` | `{ nodeId, label, exploitName, flavor, roll, successChance, matchingVulns }` | `[EXPLOIT]` |
| `exploit:disclosed` | `{ exploitName }` | `[EXPLOIT]` |
| `exploit:partial-burn` | `{ exploitName, usesRemaining }` | `[EXPLOIT]` |
| `exploit:surface-revealed` | `{ nodeId, label }` | `[EXPLOIT]` |

### Alert Events

| Type | Payload | Log prefix |
|---|---|---|
| `alert:global-raised` | `{ prev, next }` | `[ALERT]` |
| `alert:trace-started` | `{ seconds }` | `[ALERT]` |
| `alert:propagated` | `{ fromNodeId, fromLabel, toNodeId, toLabel }` | `[ALERT]` |

### ICE Events

| Type | Payload | Log prefix |
|---|---|---|
| `ice:moved` | `{ fromId, toId, fromLabel, toLabel, fromVisible, toVisible }` | `[ICE]` |
| `ice:detect-pending` | `{ nodeId, label, dwellMs }` | `[ICE]` |
| `ice:detected` | `{ nodeId, label }` | `[ICE]` |
| `ice:ejected` | `{ fromId, toId }` | `[ICE]` |
| `ice:rebooted` | `{ residentNodeId, residentLabel }` | `[ICE]` |
| `ice:disabled` | `{}` | `[ICE]` |

### Mission Events

| Type | Payload | Log prefix |
|---|---|---|
| `mission:started` | `{ targetName }` | `[MISSION]` |
| `mission:complete` | `{ targetName }` | `[MISSION]` |

---

## Log Format

Log entries follow the pattern:

```
[PREFIX] narrative message
```

- Prefix is always present and uppercase: `[ICE]`, `[EXPLOIT]`, `[ALERT]`, `[NODE]`, `[MISSION]`, `[SYS]`
- Narrative is human-readable decker-flavored text — e.g. `[ICE] Guardian moving: Fileserver-1 → Logs-Archive`
- Color classes (existing: `success`, `error`, `info`, `meta`, `command`) continue to apply per event category
- Emoji may be used as visual accent where it adds flavor without obscuring parseability

The existing `> command` format for echoed commands is unchanged.

The log pane continues to show the most recent N entries. The `log` command provides extended scrollback.

---

## Console Commands

### New / Changed

**`help`** — lists all available commands with usage and a one-line description. Machine-readable format (consistent structure) so an LLM can parse available "tools".

```
> help
  select <node>       — set active node
  probe [node]        — scan vulnerabilities (raises alert)
  exploit [node] <card> — launch exploit against node
  ...
```

**`status [noun]`** — without noun: full state dump (as now). With noun, focused report:

- `status ice` — ICE grade, position (attention + resident), active state, dwell timer
- `status hand` — all exploit cards with decay state, uses remaining, target vuln types
- `status node <id>` — full detail for one node: access, alert, vulns, macguffins, ICE presence
- `status alert` — global alert level, trace countdown, all monitor/detector states
- `status mission` — mission target, collection status, value

**`log [n]`** — replay the last `n` log entries (default: 20). Provides scrollback beyond the visible pane. Format matches the log pane entries.

---

## Acceptance Criteria

- [ ] `js/events.js` exports `emitEvent(type, payload)`, `on(type, handler)`, `off(type, handler)`
- [ ] `js/log-renderer.js` subscribes to all event types and emits a log entry for each (except `state:changed`)
- [ ] `js/visual-renderer.js` subscribes to all event types and triggers appropriate one-shot visuals; also handles `state:changed` for idempotent re-renders
- [ ] `js/main.js` no longer contains render logic; reduced to init orchestration and action event wiring
- [ ] `state.js` and `ice.js` contain no `addLog`/`addLogEntry` calls — all log output removed from game logic
- [ ] All events in the catalog are emitted at the appropriate game moments
- [ ] Every visual effect has a corresponding log entry (enforced by both subscribing to the same event)
- [ ] `statechange` DOM event replaced by `state:changed` in the new system
- [ ] `help` command implemented
- [ ] `status <noun>` subcommands implemented
- [ ] `log [n]` command implemented
- [ ] Game is fully playable via console commands alone
- [ ] `status` output is sufficient for an LLM to understand full game state

---

## Out of Scope

- **Intent interception / cyberdeck damage** — noted as near-future: a system that intercepts `starnet:action:*` events before resolution and can alter or block them based on player equipment state. Not in this session.
- Audio renderer
- Persistent event history across runs
- Multiplayer / networked state
- Procedural network generation or new game mechanics
