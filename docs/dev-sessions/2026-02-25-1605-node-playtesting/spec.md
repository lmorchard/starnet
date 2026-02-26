# Spec: Node.js Playtest Support

_Session: 2026-02-25-1605-node-playtesting_

---

## Goal

Enable game logic modules to run in Node.js so Claude can drive a playtest
session step-by-step via Bash tool calls — no browser, no Playwright overhead.
Full game state (including timers) serializable to/from JSON for reproducible
test scenarios.

## Background

The event bus (`events.js`) is already a pure pub/sub Map — no DOM dependency.
Steps already completed:
- `timers.js` fires events via `emitEvent()` (not `document.dispatchEvent`)
- `main.js` timer listeners moved to `on()`
- `state.js` `window._starnetState` guarded
- `package.json` set to `"type": "module"`
- `scripts/playtest.js` exists but uses real `setTimeout`/`setInterval` and
  a scripted AI player loop — both to be replaced

## Core Redesign: Virtual Tick Clock

Replace `timers.js`'s OS-level `setTimeout`/`setInterval` with a virtual tick
counter. All timers become pure data — no OS handles.

**Tick resolution:** `TICK_MS = 100` (100ms per tick). Game durations in ticks:
- ICE move (2500–8000ms) = 25–80 ticks
- ICE dwell (3500–10000ms) = 35–100 ticks
- Trace countdown (60s, 1s intervals) = 10 ticks per second
- Reboot (1000–3000ms) = 10–30 ticks

**Browser:** one master `setInterval(() => tick(1), TICK_MS)` in `main.js`.

**Node.js:** call `tick(n)` directly — advance any number of ticks on demand.

**Timer entry shape (all serializable):**
```js
{
  id, type, payload,
  fireAt,        // absolute tick to fire (one-shot)
  intervalTicks, // repeat every N ticks (repeating only); null for one-shot
  visible,       // show in UI countdown?
  label,         // display label for UI
  startedAt,     // tick when scheduled (for countdown display)
  durationTicks, // total ticks from schedule to fire (for countdown display)
}
```

No `handle` field — no OS resource to track.

## Trace Countdown Refactor

`alert.js` currently runs the 60s trace countdown with its own `setInterval`
separate from `timers.js`. Fold it into the tick system:

- Remove `_traceIntervalId` and its `setInterval`
- Schedule a repeating `"trace-tick"` timer (every 10 ticks = 1s) when trace starts
- Wire `"starnet:timer:trace-tick"` handler in `main.js` (and playtest harness)
  to decrement `state.traceSecondsRemaining` and call `endRun("caught")` at 0

## Full State Serialization

With virtual timers, `timers.js` state is pure data. Expose:
- `serializeTimers()` → plain array of timer entries
- `deserializeTimers(entries)` → restores timer state (no OS handles needed)

`state.js` exports `serializeState()` / `deserializeState()` which bundle game
state + timer snapshot into one JSON-serializable object.

## Playtest Harness Redesign

Replace the scripted AI player loop with a **REPL-style single-command interface**
that Claude drives via Bash:

```bash
node scripts/playtest.js reset                      # init fresh game → default state file
node scripts/playtest.js "probe gateway"            # run command → default state file
node scripts/playtest.js --state foo.json reset     # init → named state file
node scripts/playtest.js --state foo.json "tick 25" # run against named file
```

State file defaults to `scripts/playtest-state.json`. Named state files enable:
starting from a known checkpoint, running parallel scenarios for comparison,
preserving state before a risky sequence. Each invocation:
1. Loads state (or inits fresh on `reset` or missing file)
2. Runs the command via existing `console.js` `runCommand()` where possible,
   or handles `tick N` directly
3. Prints all game events that fired
4. Saves state back to JSON
5. Exits

## Scope

### In scope
- Virtual tick clock in `timers.js` (replace setTimeout/setInterval)
- Trace countdown folded into tick system in `alert.js`
- `tick(n)` export from `timers.js`; master `setInterval` in `main.js`
- `serializeTimers()` / `deserializeTimers()` in `timers.js`
- `serializeState()` / `deserializeState()` in `state.js`
- Redesigned `scripts/playtest.js` — single-command, state persistence

### Out of scope
- Seeded RNG — deferred; prerequisite for fully reproducible test cases but
  a separate project (threading seed through combat.js, exploits.js, ice.js, loot.js)
- Directory restructure (`js/core/` vs `js/ui/`)
- Full test suite / CI assertions

## Success Criteria

- `node scripts/playtest.js reset` initializes a game, saves state
- `node scripts/playtest.js "probe gateway"` loads, runs, saves, prints events
- `node scripts/playtest.js "tick 25"` advances game clock, ICE may move
- Browser game behavior unchanged
- `scripts/playtest-state.json` is valid JSON inspectable between calls
