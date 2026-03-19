# Playtest Harness Tooling — Spec

_Session: 2026-03-19-1221 | Issue: #65_

## Problem

The game has a working bot player and playtest harness, but no tools for systematic balance analysis:

- No way to run many seeds and see aggregate stats (success rate, cash distribution, alert patterns)
- Playtest harness output is human-readable text only — scripts and LLMs must parse it with regex
- Event log is ad-hoc strings with inconsistent formatting

## Deliverables

### 1. Bot Census Script (`scripts/bot/census.js`)

A CLI tool that runs the bot across many seeds at specified grades and produces aggregate statistics.

**Usage:**

```bash
node scripts/bot/census.js --seeds 100 --threat C --wealth B
node scripts/bot/census.js --seeds 50 --threat S --wealth A --full
```

**Flags:**
- `--seeds N` — number of seeds to run (default: 50)
- `--threat`, `--wealth`, `--complexity`, `--depth` — grade spec (default: C/B/C/C)
- `--full` — include per-seed raw BotRunStats array in output
- `--network <name>` — use a static network instead of generated (optional)

**Output:** JSON to stdout. Summary object with aggregate stats:

```json
{
  "config": { "seeds": 100, "spec": { "threat": "C", "wealth": "B", ... } },
  "summary": {
    "successRate": 0.82,
    "failReasons": { "caught": 12, "stuck": 6 },
    "avgTicksElapsed": 450,
    "avgNodesOwned": 8.3,
    "avgCash": 4200,
    "avgCardsUsed": 5.1,
    "peakAlertDistribution": { "green": 5, "yellow": 30, "red": 65 },
    "traceFiredRate": 0.18,
    "avgIceDetections": 2.4,
    "avgIceEvasions": 0.8,
    "avgStoreVisits": 1.2
  },
  "runs": [ ... ]  // only with --full
}
```

**Error handling:** If a bot run throws (bad network gen, etc.), record it as `{ success: false, failReason: "error", error: "message" }` and continue. Don't crash the whole census.

**Makefile:** Repurpose the existing `make census` target (currently points at missing `network-census.js`) to run the bot census with sensible defaults.

### 2. JSON Mode for Playtest Harness (`--json` flag)

A global flag on `scripts/playtest.js` that switches all output to structured JSON.

**Usage:**

```bash
node scripts/playtest.js --json "target gateway"
node scripts/playtest.js --json "status"
node scripts/playtest.js --json "probe"
node scripts/playtest.js --json "tick 50"
```

**Output envelope** (same shape for every command):

```json
{
  "events": [
    { "type": "PLAYER_NAVIGATED", "payload": { "nodeId": "gateway", ... } },
    { "type": "ACTION_FEEDBACK", "payload": { "action": "probe", "phase": "start", ... } }
  ],
  "state": { ... },
  "log": [
    { "text": "[NODE] Gateway: probing...", "type": "system" }
  ]
}
```

**Behavior:**
- `--json` is a global flag, not per-command — affects all output
- `events` — typed event objects captured during command execution (replaces ad-hoc text)
- `state` — full game state snapshot after command execution
- `log` — log entries generated during the command (the human-readable text, preserved for reference)
- Non-JSON output (the current text mode) is unchanged — `--json` is purely additive
- State file persistence (save after each command) still happens silently in `--json` mode — the JSON envelope goes to stdout, the state file is a side effect
- `reset` command includes state in the envelope
- `tick N` includes all events that fired during the tick window

**Event types** use the existing `E.*` constants from `events.js` as the `type` field. Payloads match the existing event payload shapes. No new event types needed — just capture what already fires.

### Implementation approach

**Census script:**
- Import `runBot` from `scripts/bot/run.js`
- Loop over seeds (`seed-0` through `seed-N`), collect BotRunStats array
- Compute aggregates (mean, distribution counts)
- Print JSON to stdout

**JSON mode:**
- Add `--json` flag parsing to playtest.js arg handling
- When active, install a temporary event listener that captures all `E.*` events into an array
- After command execution, serialize the envelope and print as JSON
- Suppress the normal text output handlers (or let them write to log array instead of stdout)
- `state` comes from `serializeState()` which already exists

## Out of scope

- LLM gameplay agent (#86) — deferred
- ActionContext wiring (#87) — deferred
- Changes to the browser UI or visual rendering
- Changing the default (non-JSON) text output format
