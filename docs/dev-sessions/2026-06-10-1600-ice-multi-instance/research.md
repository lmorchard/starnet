# Research — ICE multi-instance runtime migration

Documentarian findings (factual, current state). All paths relative to worktree root.

## 1. Timer system (`js/core/timers.js`)

- TIMER catalog (`:12-17`): `ICE_MOVE`, `ICE_DETECT`, `TRACE_TICK`.
- **Timers are per-id.** Each gets unique `id = nextId++` (`:37`); stored in `Map<timerId, entry>` (`:34`). Entry: `{ id, type, payload, fireAt, intervalTicks, visible, label, startedAt, durationTicks }` (`:39-49`).
- `scheduleEvent(type, delayMs, payload, visibility)` → one-shot, returns id (`:36-51`).
- `scheduleRepeating(type, intervalMs, payload)` → repeating (`:53-68`).
- `tick(n)` fires when `currentTick >= entry.fireAt` (`:76`); emits `entry.type` with `timerId` in payload (`:77`); one-shot deletes (`:81`), repeating does `fireAt += intervalTicks` (`:79`).
- **Cancel one vs all:** `cancelEvent(id)` removes one by id (`:97-99`); `cancelAllByType(type)` removes every timer of a type (`:101-105`). Caller must hold the id to cancel one.

## 2. ICE runtime (`js/core/ice/runtime.js`)

- `startIce()` (`:38-44`): reads `getPrimaryIce()` (`:39`), schedules a **single** repeating `ICE_MOVE` at primary's grade interval (`:42`).
- `stopIce()` (`:45-48`): `cancelAllByType(ICE_MOVE)` + `cancelAllByType(ICE_DETECT)`.
- `handleIceTick()` (`:118-126`): if phase playing, **iterates all active `state.ice.instances`** (`:121`), calls `moveInstance(ice, s)` each (`:124`). Movement is multi-instance.
- `moveInstance()` (`:128-191`): per-instance position update (random walk D/F; BFS toward `lastDisturbedNodeId` for C/B/A/S). Calls `setIceAttention(nextNode)` (`:175`). **BUT** detection gated to primary: `:184-190` only the instance equal to `getPrimaryIce()` (`:187`) drives dwell/detection. Non-primary instances move but never detect.
- Detection/dwell: `checkIceDetection(nodeId)` (`:198-220`) schedules **one** `ICE_DETECT` one-shot at grade dwell (`:217`), stores id in `ice.dwellTimerId` (`:218`) — **per-instance timer id field already exists**. `handleIceDetect({nodeId})` (`:222-231`) → `triggerDetection()` (`:233-239`) → `recordIceDetection()` (`:238`).
- `cancelIceDwell()` (`:241-243`): `cancelAllByType(ICE_DETECT)` (cancels ALL dwells, not one).
- `handleIceDeparture()` (`:20-23`): cancels pending `ICE_DETECT`, clears `detectedAtNode`.
- Event handlers use `getPrimaryIce()`: `PLAYER_NAVIGATED` (`:62`), `ACTION_FEEDBACK` noise→grade (`:80`).

## 3. Alert ladder (`js/core/alert.js`)

- **Two layers, separated:**
  - *ICE pursuit:* `recordIceDetection(nodeId)` (`:200-228`) — only ICE detection entry point. `incrementIceDetectionCount()` (`:205`, no iceId → primary), reads `DETECTION_TRACE_THRESHOLD[ice.grade]` (`:214`) where `ice = getPrimaryIce()` (`:202`). Steps global alert directly; starts trace when count ≥ threshold (S/A:1, B/C:2, D/F:3).
  - *Puzzle:* exploit fail → IDS propagation → monitor → `recomputeGlobalAlert()` (`:85-111`, counts red detectors/monitors). Escalation-only, never de-escalates (`:100-110`).
- Trace: `startTraceCountdown()` reads grade from `getPrimaryIce()`, `TRACE_SECONDS[grade]`, schedules **single** repeating `TRACE_TICK` @1000ms (`:152`); `handleTraceTick()` decrements, ends run at ≤0.

## 4. ICE instantiation (single instance today)

- `initGame` (`js/core/state/index.js:186-210`): reads `meta.ice`; if present creates **one** instance `ice-1` (`:190`) `{ hostNodeId, grade, active:true, detection fields null }`; stores `state.ice = { instances: { [id]: primary } }` (`:207`); else `{ instances: {} }` (`:209`).
- Network gen (`js/core/network/assemble.js:63-73`): ICE only if threat ≥ B (`:65`); single config starting at security-monitor node (`:69`); returns `meta.ice = { startNode, grade }` (`:117`).
- **No production path creates 2+ instances.** Only `tests/integration.test.js` "two active instances both move on a tick" manually injects `ice-2` into the collection to prove movement iteration. (Also "ice events: iceId in payload" suite.)

## 5. Bot ICE interaction (`scripts/bot/`)

- `perception.js:115-121`: `getPrimaryIceFromState(state)` (`:116`) → WorldModel.ice = `{ nodeId: attentionNodeId, isOnSelectedNode, isActive }` (`:118-120`, stored `:151`). Single ICE only.
- `execute.js`: `onIceMoved()` (`:121-129`) reads `getPrimaryIce()` (`:125`); if ICE arrives on owned target & player present → dispatch EJECT. `onDetected()` (`:131-133`) sets `detected` → after loop, ABORT+UNTARGET (`recordIceDetection` already escalated alert).

## 6. All `getPrimaryIce` / `getPrimaryIceFromState` call sites

| File:Line | What it does |
|---|---|
| `js/core/state/ice.js:94` | the shim itself (`getPrimaryIce` → `getPrimaryIceFromState(getState())`) |
| `js/core/ice/runtime.js:39` | startIce — exists-check before scheduling move timer |
| `js/core/ice/runtime.js:62` | PLAYER_NAVIGATED handler — re-detect on new node |
| `js/core/ice/runtime.js:80` | ACTION_FEEDBACK handler — read grade for noise threshold |
| `js/core/ice/runtime.js:187` | moveInstance — gate detection to primary only |
| `js/core/ice/runtime.js:200,225,235` | checkIceDetection / triggerDetection — exists-check, grade/dwell |
| `js/core/ice/runtime.js:251,275,286,293` | teleportIce / ejectIce / disableIce / rebootIce |
| `js/core/alert.js:202` | recordIceDetection — grade for threshold + trace duration |
| `js/core/actions/node-actions.js:37` | getAvailableActions (FromState) — is EJECT available |
| `js/core/console-commands/cmd-status.js` | status display (several) |
| `js/core/node-graph/game-ctx.js` | spawnICE callback — start ICE timer |
| `js/playground/main.js` | playground init — exists-check |
| `scripts/bot/execute.js:125` | eject-on-arrival reactive check |
| `scripts/bot/perception.js:116` | (FromState) extract ICE for WorldModel |

## Key facts for design

- Timer system **already supports per-id timers**; `ice.dwellTimerId` already a per-instance field.
- Movement already iterates all instances; **only the single shared `ICE_MOVE` cadence** (primary's grade) and **detection gating to primary** (`runtime.js:184-190`) keep it singleton in practice.
- `detectionCount` is a per-instance field but `recordIceDetection` increments the primary's and reads the primary's grade; trace clock is global.
- Nothing in production spawns 2+ instances — the only multi-instance exercise is a test fixture.
