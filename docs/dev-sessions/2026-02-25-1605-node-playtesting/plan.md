# Plan: Node.js Playtest Support

_Session: 2026-02-25-1605-node-playtesting_

_Steps 1–4 (DOM decoupling, package.json, initial playtest script) already complete._

---

## Step 5 — Redesign `timers.js`: virtual tick clock

**Context:** Replace OS `setTimeout`/`setInterval` with a virtual tick counter.
All timer entries become plain data — fully serializable, no OS handles.

**TICK_MS = 100** (100ms per tick in the browser).

**Changes to `timers.js`:**
- Remove `import { emitEvent }` (already added); keep it
- Replace `setTimeout`/`setInterval` handles with tick-based entries
- `scheduleEvent(type, delayMs, payload, visibility)`:
  - converts `delayMs` to `durationTicks = Math.max(1, Math.round(delayMs / TICK_MS))`
  - stores `{ id, type, payload, fireAt: currentTick + durationTicks, intervalTicks: null, visible, label, startedAt: currentTick, durationTicks }`
- `scheduleRepeating(type, intervalMs, payload)`:
  - `intervalTicks = Math.max(1, Math.round(intervalMs / TICK_MS))`
  - stores `{ ..., fireAt: currentTick + intervalTicks, intervalTicks, ... }`
- `cancelEvent(id)` / `cancelAllByType(type)` / `clearAll()`: just delete from Map (no clearTimeout/clearInterval)
- Add `export function tick(n = 1)`:
  ```js
  currentTick += n;
  for each timer entry:
    if currentTick >= entry.fireAt:
      emitEvent(`starnet:timer:${entry.type}`, { ...entry.payload, timerId: entry.id })
      if repeating: entry.fireAt += entry.intervalTicks
      else: timers.delete(entry.id)
  ```
- `getVisibleTimers()`: compute `remaining` from `(entry.fireAt - currentTick) * TICK_MS / 1000`
- Add `export function serializeTimers()` → `{ currentTick, entries: [...timers.values()] }`
- Add `export function deserializeTimers({ currentTick, entries })` → restores Map

**Result:** `timers.js` is pure data. No OS handles anywhere. Browser not yet
wired — handled in Step 6.

---

## Step 6 — Wire master tick loop in `main.js`

**Context:** Browser needs to drive the virtual clock. One `setInterval` at
`TICK_MS` calls `tick(1)`. Also wire the new `trace-tick` timer event (Step 7).

**Changes to `main.js`:**
- Import `tick` from `./timers.js`
- After `initState` / `startIce`: `setInterval(() => tick(1), TICK_MS)` — store
  handle so it can be cleared on `endRun` if needed (or just let it run; game
  phase check in handlers guards against post-game ticks)
- Add `on("starnet:timer:trace-tick", handleTraceTick)` listener (function defined
  here or imported from alert.js — see Step 7)

**Import `TICK_MS` from `timers.js`** so the interval uses the canonical value.

**Result:** Browser game runs on virtual clock. All existing behavior preserved
(ICE moves, detection timers, reboots). Verify with browser smoke test.

---

## Step 7 — Fold trace countdown into tick system in `alert.js`

**Context:** `alert.js` runs its own `setInterval` for the 60s trace countdown,
outside the timer system. Replace with a `scheduleRepeating("trace-tick", 1000)`
so it's serializable and driven by the same tick clock.

**Changes to `alert.js`:**
- Remove `_traceIntervalId` and all `setInterval`/`clearInterval` references
- `startTraceCountdown()`:
  - Remove the `setInterval` block
  - Add `scheduleRepeating("trace-tick", 1000)` — store returned id in
    `state.traceTimerId` (new field on GameState)
- `cancelTraceCountdown()`:
  - Replace `clearInterval(_traceIntervalId)` with `cancelEvent(state.traceTimerId)`
  - Clear `state.traceTimerId = null`
- Export `handleTraceTick()`:
  ```js
  export function handleTraceTick() {
    const s = getState();
    if (!s || s.phase !== "playing") return;
    s.traceSecondsRemaining -= 1;
    if (s.traceSecondsRemaining <= 0) {
      endRun("caught");
    } else {
      emit();
    }
  }
  ```

**Wire in `main.js`:** `on("starnet:timer:trace-tick", handleTraceTick)`

**Wire in playtest harness:** same `on("starnet:timer:trace-tick", handleTraceTick)`

**Result:** Trace countdown is tick-driven and serializable. `alert.js` has zero
`setInterval`/`clearInterval` calls.

---

## Step 8 — State serialization in `state.js`

**Context:** With timers pure data, the full game state is serializable. Expose
`serializeState()` and `deserializeState()` for the playtest harness.

**Changes to `state.js`:**
- Import `serializeTimers`, `deserializeTimers` from `./timers.js`
- Add `export function serializeState()`:
  ```js
  return { ...state, _timers: serializeTimers() };
  ```
- Add `export function deserializeState(snapshot)`:
  ```js
  const { _timers, ...gameState } = snapshot;
  state = gameState;
  deserializeTimers(_timers);
  ```

**Result:** Full round-trip: `JSON.stringify(serializeState())` → file →
`deserializeState(JSON.parse(file))` restores exact game state including
pending ICE move timers, detection timers, and trace countdown.

---

## Step 9 — Redesign `scripts/playtest.js`

**Context:** Replace the scripted AI player loop with a single-command REPL
interface. State persists in `scripts/playtest-state.json` between calls.

**Interface:**
```bash
node scripts/playtest.js reset                        # init fresh game, save to default state file
node scripts/playtest.js "probe gateway"              # run command against default state file
node scripts/playtest.js --state foo.json reset       # init fresh game, save to foo.json
node scripts/playtest.js --state foo.json "tick 25"   # run against named state file
```

State file defaults to `scripts/playtest-state.json`. The `--state <file>` flag
allows: starting from a known saved state, running multiple parallel scenarios,
preserving a "checkpoint" before a risky sequence of actions.

**Implementation:**
- Parse `process.argv[2]` as the command string
- On `reset` (or missing state file): call `initState(NETWORK)`, `startIce()`, save
- Otherwise: `deserializeState(JSON.parse(fs.readFileSync(STATE_FILE)))`
- Handle `tick N` directly: call `tick(parseInt(N))`
- For all other commands: use `runCommand(cmd)` from `console.js`... but
  `console.js` has DOM dependencies (it reads from `document.getElementById`).
  Instead, replicate the minimal command dispatch: import and call game functions
  directly, matching what `console.js` does for probe/exploit/select/status/actions
- Collect all `E.LOG_ENTRY` events + typed game events during execution
- Print them, then save state, then exit

**Note on `console.js`:** Check whether `console.js`'s `runCommand()` has DOM
dependencies. If it's clean, import it directly. If not, inline the dispatch.

**Result:** Claude can drive a full playtest session via Bash tool calls, one
command at a time, with full event visibility between each step.

---

---

## Step 10 — Document headless playtesting in CLAUDE.md

**Context:** The playtest harness is only useful if future Claude instances know
it exists and how to use it. Add a section to `CLAUDE.md` covering the workflow.

**Add to `CLAUDE.md`** (new section, e.g. after Architecture):

- What the harness is and when to use it (balance testing, bug reproduction,
  regression checking — without a browser)
- The `--state <file>` flag and how to use named state files for scenarios
- The `tick N` command and what it advances
- The `reset` command
- Example workflow: reset → select → probe → exploit → tick → status
- Note that seeded RNG is not yet implemented — runs are probabilistic

**Result:** Any future Claude session working on this codebase will know to reach
for `node scripts/playtest.js` before spinning up Playwright.

---

## Commit sequence

1. After Steps 5–6: `"Refactor: virtual tick clock — timers.js driven by tick()"`
2. After Step 7: `"Refactor: fold trace countdown into tick system"`
3. After Step 8: `"Add: serializeState/deserializeState for full state snapshots"`
4. After Step 9: `"Redesign: playtest.js as single-command REPL harness"`
5. After Step 10: `"Docs: document headless playtest harness in CLAUDE.md"`
