# Plan: Playtest Harness — ActionContext Wiring

## Step 1 — Wire the unified dispatcher; remove dead listeners

**File:** `scripts/playtest.js`

Replace the 13 dead `on("starnet:action:*")` listeners with `initActionDispatcher(ctx)`
where `ctx` is `buildActionContext()` with `openDarknetsStore` overridden to a no-op.

- Add import: `buildActionContext, initActionDispatcher` from `../js/action-context.js`
- Add import: `addLogEntry` from `../js/log.js`
- Remove the `on("starnet:action:*")` block
- Add ctx build + `initActionDispatcher(ctx)` call

## Step 2 — Remove unused imports

With dead listeners gone, remove imports only needed by those handlers:
- `readNode, lootNode, ejectIce, rebootNode, reconfigureNode, endRun` from `state.js`
- `startExploit, cancelExploit` from `exploit-exec.js`
- `startProbe, cancelProbe` from `probe-exec.js`
- `navigateTo, navigateAway` from `navigation.js`
- `cancelTraceCountdown` from `alert.js` (keep `handleTraceTick`)

Keep: `completeReboot` (still used by TIMER.REBOOT_COMPLETE handler),
`initState, serializeState, deserializeState` (harness plumbing).

Run `make check` to confirm no regressions.

## Step 3 — Smoke test and commit

```bash
node scripts/playtest.js reset
node scripts/playtest.js "select gateway"
node scripts/playtest.js "probe"
node scripts/playtest.js "tick 60"
node scripts/playtest.js "actions"
node scripts/playtest.js "exploit 1"
```

Confirm probe and exploit produce output. Commit.
