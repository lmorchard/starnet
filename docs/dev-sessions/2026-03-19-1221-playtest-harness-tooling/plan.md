# Playtest Harness Tooling — Plan

_Session: 2026-03-19-1221 | Issue: #65_

## Strategy

Two independent deliverables: **bot census script** and **playtest `--json` mode**. The census script is self-contained (new file, imports existing bot runner). The JSON mode modifies playtest.js. No dependencies between them — can be built in either order.

Start with census (simpler, higher immediate value for tuning), then JSON mode.

---

## Phase 1: Bot census script

Create `scripts/bot/census.js` that runs the bot across N seeds and aggregates stats.

### Prompt

Create a new file `scripts/bot/census.js` in the Starnet codebase at `/Users/lorchard/devel/starnet-game-2026`.

This CLI tool runs the bot player across many seeds and produces aggregate statistics as JSON.

**Pattern to follow:** Look at `scripts/bot/cli.js` for the arg parsing and network setup pattern. The census script uses the same `runBot()` function but loops over seeds.

**Arg parsing:**
- `--seeds N` (default: 50)
- `--threat`, `--wealth`, `--complexity`, `--depth` (default: C/B/C/C)
- `--network <name>` — use static network instead of generated
- `--full` — include per-seed BotRunStats in output

**Core logic:**
```
for i in 0..seeds:
  seed = `census-${i}`
  try:
    stats = runBot(() => buildNetwork(seed, spec), { seed })
    runs.push(stats)
  catch:
    runs.push({ success: false, failReason: "error", error: e.message })
```

**Aggregation:** Compute from the runs array:
- `successRate` — fraction of runs with `success: true`
- `failReasons` — count by failReason (caught, stuck, error)
- `avgTicksElapsed`, `avgNodesOwned`, `avgCash` (cashRemaining), `avgCardsUsed`, `avgStoreVisits`, `avgIceDetections`, `avgIceEvasions` — mean of numeric fields
- `peakAlertDistribution` — count by peakAlert value
- `traceFiredRate` — fraction with `traceFired: true`

**Output:** JSON to stdout:
```json
{
  "config": { "seeds": N, "spec": { ... }, "network": "generated" | "<name>" },
  "summary": { ... aggregates ... },
  "runs": [ ... ]  // only with --full
}
```

Import `runBot` from `./run.js`. Import network builders the same way `cli.js` does. Import `buildNetwork as buildGenerated` from `../../data/networks/generated.js`.

For generated networks, each seed produces a different network: `buildGenerated({ seed, spec })`.

After creating the file, update the Makefile: change the existing `census` target from `node scripts/network-census.js` to `node scripts/bot/census.js --seeds 50`. Add a comment.

Run `make check` after changes.

---

## Phase 2: Census smoke test

### Prompt

Verify the census script works by running it with a small seed count:

```bash
node scripts/bot/census.js --seeds 5 --threat F --wealth F
node scripts/bot/census.js --seeds 3 --threat C --wealth B --full
```

Check that:
- Output is valid JSON
- Summary fields are present and reasonable
- `--full` includes the runs array
- No crashes on generated networks

Also run `make census` to verify the Makefile target works.

Fix any issues found.

---

## Phase 3: Playtest JSON mode — event capture infrastructure

Add the `--json` flag to playtest.js and wire up event capture. This phase sets up the infrastructure without changing existing text output.

### Prompt

Modify `scripts/playtest.js` in the Starnet codebase to add a `--json` global flag.

**Arg parsing:** Add `--json` flag detection in the existing arg parsing block (around line 44-75). Set a `let jsonMode = false` variable.

**Event capture:** When `jsonMode` is true, install listeners for ALL game events that capture them into a `capturedEvents` array. The events to capture (from `js/core/events.js` `E.*` constants):

```javascript
const CAPTURE_EVENTS = [
  E.NODE_REVEALED, E.NODE_ACCESSED, E.NODE_ALERT_RAISED,
  E.EXPLOIT_DISCLOSED, E.EXPLOIT_PARTIAL_BURN, E.EXPLOIT_SURFACE,
  E.ALERT_GLOBAL_RAISED, E.ALERT_TRACE_STARTED, E.ALERT_TRACE_CANCELLED, E.ALERT_PROPAGATED,
  E.PLAYER_NAVIGATED,
  E.ICE_MOVED, E.ICE_DETECT_PENDING, E.ICE_DETECTED, E.ICE_EJECTED, E.ICE_REBOOTED, E.ICE_DISABLED,
  E.MISSION_STARTED, E.MISSION_COMPLETE,
  E.ACTION_FEEDBACK, E.ACTION_RESOLVED,
  E.RUN_STARTED, E.RUN_ENDED,
];
```

For each, register: `on(eventType, (payload) => capturedEvents.push({ type: eventType, payload }))`.

Also capture LOG_ENTRY events into a separate `capturedLog` array: `on(E.LOG_ENTRY, ({ text, type }) => capturedLog.push({ text, type }))`.

**Output:** After `runCmd()` and state save, instead of printing `lines` to stdout, print the JSON envelope:

```javascript
if (jsonMode) {
  const envelope = {
    events: capturedEvents,
    state: serializeState(),
    log: capturedLog,
  };
  console.log(JSON.stringify(envelope, null, 2));
} else {
  lines.forEach((line) => console.log(line));
}
```

**Suppress text output in JSON mode:** When `jsonMode` is true, the `out()` function should still collect lines (they feed into `capturedLog` via LOG_ENTRY), but the existing event→text handlers should NOT write to `lines` since the structured events replace them. The simplest approach: when `jsonMode` is true, redefine `out` to be a no-op. The LOG_ENTRY capture handles log collection separately.

Wait — actually the text handlers (lines 141-184) call `out()` which pushes to `lines`. In JSON mode we don't want those text strings, we want the raw events. But LOG_ENTRY events from console commands (status, actions, help) ARE the useful text output and should be captured.

Better approach:
- Keep `out()` as-is (writes to `lines`)
- In JSON mode, the event→text handlers (NODE_ALERT_RAISED, ACTION_FEEDBACK, etc.) should be skipped — the raw events are captured instead
- LOG_ENTRY should still be captured (these come from console commands)
- At the end: JSON mode prints the envelope, text mode prints lines

To skip the text handlers in JSON mode: wrap each handler registration in `if (!jsonMode)`. The event capture listeners (installed when jsonMode is true) replace them.

**Special case — `reset` and `tick`:** These commands use `out()` directly (e.g. `out("[SYS] Initialized...")`). In JSON mode, these messages should go to `capturedLog` instead. Handle by making `out()` push to `capturedLog` when `jsonMode` is true, and to `lines` otherwise.

**Special case — error paths:** State load failures and other error messages use `out()`. These should appear in `capturedLog` in JSON mode.

Run `make check` after changes.

---

## Phase 4: JSON mode smoke test and fixes

### Prompt

Verify the JSON mode works with several commands:

```bash
node scripts/playtest.js --json reset
node scripts/playtest.js --json "target gateway"
node scripts/playtest.js --json "probe"
node scripts/playtest.js --json "status"
node scripts/playtest.js --json "tick 10"
node scripts/playtest.js --json "actions"
```

Check that:
- Each outputs valid JSON with `events`, `state`, and `log` fields
- `reset` includes a populated state
- `target gateway` shows a PLAYER_NAVIGATED event
- `probe` shows ACTION_FEEDBACK events (start at minimum)
- `status` shows log entries with the status text
- `tick 10` captures any events that fire during ticks
- `actions` shows the action listing in log entries
- State file is still saved (check that `scripts/playtest-state.json` is updated)

Fix any issues found. Run `make check`.

---

## Phase 5: Makefile + docs

### Prompt

Update the Makefile and documentation:

1. Verify the `census` Makefile target works: `make census`

2. Update `CLAUDE.md` — add census to the Makefile section:
   ```
   make census        — run bot census (50 seeds, default grades)
   ```

3. Update `CLAUDE.md` — add `--json` flag to the playtest harness usage examples:
   ```
   node scripts/playtest.js --json "status"          # structured JSON output
   ```

4. Update `docs/BOT-PLAYER.md` — add a Census section documenting the script usage and output format.

Run `make check` after changes.
