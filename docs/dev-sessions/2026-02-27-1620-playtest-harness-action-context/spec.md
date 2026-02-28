# Spec: Playtest Harness — ActionContext Wiring

## Problem

`scripts/playtest.js` dispatches gameplay actions by listening to old-style
`"starnet:action:probe"`, `"starnet:action:select"`, etc. events — a format that
was replaced when the unified `"starnet:action"` dispatcher landed in the
node-action-registry session (2026-02-27-0950).

`console.js`'s `dispatch()` now emits `"starnet:action"` with `{ actionId, ...payload,
fromConsole: true }`. The harness never calls `initActionDispatcher(ctx)`, so
`"starnet:action"` events fire and nobody handles them. Every gameplay command
(`probe`, `exploit`, `read`, `loot`, `reconfigure`, `cancel-trace`, `eject`,
`reboot`, `jackout`, `select`, `deselect`) is **silently dropped**.

The harness appears functional only because `reset`, `tick`, `status`, and `cheat`
bypass `dispatch()` entirely (handled directly in `runCmd` or console's `cmdStatus`).

## Goal

Wire the harness through the same `buildActionContext()` + `initActionDispatcher()`
path the browser uses. Gameplay commands in the harness should go through the same
`getAvailableActions()` guard, the same `ActionDef.execute()` methods, and produce
the same log side-effects as clicking the context menu in the browser.

## What Changes

### `scripts/playtest.js`

1. **Remove** the dead `on("starnet:action:*")` listeners (lines 77–89). These are
   never fired by the current `console.js` and provide false confidence.

2. **Add** `import { buildActionContext, initActionDispatcher } from "../js/action-context.js"`

3. **Build a headless ActionContext** — same as `buildActionContext()` but with
   `openDarknetsStore` overridden to a no-op (avoids `document` crash if ever called):

   ```js
   const ctx = {
     ...buildActionContext(),
     openDarknetsStore: () => {
       addLogEntry("[DARKNET] Use 'store' and 'buy' commands in the harness.", "meta");
     },
   };
   initActionDispatcher(ctx);
   ```

4. **Remove unused imports** — the following were only needed by the dead listeners:
   - `readNode, lootNode, ejectIce, rebootNode, reconfigureNode` from `state.js`
   - `startExploit, cancelExploit` from `exploit-exec.js`
   - `startProbe, cancelProbe` from `probe-exec.js`
   - `navigateTo, navigateAway` from `navigation.js`
   - `cancelTraceCountdown` from `alert.js`

   Still needed: `completeReboot` (TIMER.REBOOT_COMPLETE handler), `endRun`
   (used directly? — verify), `handleTraceTick` (TIMER.TRACE_TICK handler),
   and `initState`, `serializeState`, `deserializeState` (harness plumbing).

### What Does NOT Change

- `tick`, `reset`, `cheat` handling in `runCmd` — harness-only, stay as-is
- Timer event wiring (`on(TIMER.ICE_MOVE, ...)`, etc.)
- The event → output section (`on(E.LOG_ENTRY, ...)`, `on(E.NODE_PROBED, ...)`, etc.)
- `console.js` — no changes needed
- `action-context.js` — no changes needed
- `store.js` — no changes needed; `openDarknetsStore` has no top-level DOM code,
  safe to import in Node.js; and it's never called via the harness action path anyway

## Acceptance Criteria

1. `node scripts/playtest.js reset` then `node scripts/playtest.js "probe gateway"`
   produces PROBE_SCAN_STARTED output, not silence
2. `node scripts/playtest.js "select gateway"` then `node scripts/playtest.js "probe"`
   works (implicit node from selection)
3. Attempting an unavailable action (e.g. `exploit` before probing) silently returns
   or logs an error — same behavior as the browser's action guard
4. `make check` passes (no logic changes to test-covered modules)
5. `store` and `buy` console commands still work (they bypass `dispatch()` entirely)

## Out of Scope

- Fixing `store`/`buy` console commands (they bypass the action bus by design and work fine)
- Headless implementation of `openDarknetsStore` beyond a no-op + log message
- Any new harness features or commands
- Seeded RNG (separate backlog item)
