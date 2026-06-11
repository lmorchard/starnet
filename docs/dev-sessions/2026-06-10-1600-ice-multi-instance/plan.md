# ICE Multi-Instance Runtime Migration — Implementation Plan

**Goal:** Make every active ICE instance an independent roaming detector (own dwell, detection, move cadence), spawn one per security-monitor (cap 3) in real networks, and retire the `getPrimaryIce()` singleton shim.

**Approach:** De-singleton the detection/dwell path (per-instance timers keyed by `iceId`), keep a single global alert/trace sourced from any instance, spawn per-monitor in `assemble`/`initGame`, then make bot + status enumerate instances and delete the shim. Single-monitor networks stay byte-identical (regression guard); the cap of 3 is a temporary swarm-guard until #136.

**Tech stack:** Vanilla JS ES modules, JSDoc `@ts-check`, node:test. Timer system is per-id (`timers.js`).

---

## Phase 1: Per-instance detection, dwell, and alert

De-singleton the detection path: every active instance on the player's selected node dwells and detects independently, on its own `ICE_DETECT` timer, and each detection sources the global alert/trace. Movement already iterates instances; this removes the `getPrimaryIce()` detection gate at `runtime.js:184-190`.

**Files:**
- Modify: `js/core/ice/runtime.js` — per-instance detection; import `cancelEvent`.
- Modify: `js/core/alert.js` — `recordIceDetection(nodeId, iceId)`; trace gate on total detections across instances.
- Modify: `js/core/state/ice.js` — add `activeIceInstances(state)` helper (array of active instances).
- Test: `tests/ice-multi-detection.test.js` — new.

**Key changes:**
- `activeIceInstances(state): IceInstance[]` — `Object.values(state.ice?.instances ?? {}).filter(i => i.active)`.
- `checkIceDetection(ice, nodeId, { justArrived })` — takes the instance explicitly; cancels *that* instance's prior dwell via `cancelEvent(ice.dwellTimerId)`; schedules `scheduleEvent(TIMER.ICE_DETECT, totalMs, { iceId: ice.id, nodeId }, …)`; `setIceDwellTimer(timerId, ice.id)`.
- `handleIceDetect({ iceId, nodeId })` — resolve instance via `s.ice.instances[iceId]`; fire only if still active and `s.selectedNodeId === nodeId`.
- `triggerDetection(ice, nodeId)` — emit `ICE_DETECTED` with `ice.id`; `recordIceDetection(nodeId, ice.id)`.
- `handleIceDeparture(iceId)` — `cancelEvent(instance.dwellTimerId)`; `setIceDetectedAt(null, iceId)`. `ICE_EJECTED`/`ICE_REBOOTED` handlers pass `iceId` from payload.
- `moveInstance` — delete the `getPrimaryIce()` gate (`:184-190`); call `checkIceDetection(ice, nextNode, { justArrived: true })`.
- `PLAYER_NAVIGATED` handler — iterate `activeIceInstances(s)`: cancel each dwell + clear each `detectedAtNode`; then for each whose `attentionNodeId === nodeId`, `checkIceDetection(ice, nodeId)`.
- `ACTION_FEEDBACK` noise handler — iterate active instances; if any has `floor(progress*10) >= ICE_NOISE_THRESHOLD[ice.grade]`, `setLastDisturbedNode(nodeId)` (single global disturbance signal, unchanged).
- `alert.js recordIceDetection(nodeId, iceId)`:
```js
export function recordIceDetection(nodeId, iceId) {
  const s = getState();
  const ice = iceId ? s.ice?.instances?.[iceId] : activeIceInstances(s)[0];
  if (!ice) return;
  setIceDetectedAt(nodeId, ice.id);
  incrementIceDetectionCount(ice.id);
  // Trace gate: TOTAL detections across all instances vs threshold of the
  // detecting instance's grade (== run grade in production; instances share grade).
  const count = Object.values(s.ice.instances).reduce((n, i) => n + i.detectionCount, 0);
  const threshold = DETECTION_TRACE_THRESHOLD[ice.grade] ?? 2;
  if (count >= threshold) { if (s.traceSecondsRemaining === null) startTraceCountdown(); return; }
  // …existing sub-threshold global-alert step (unchanged)…
}
```
  Note: `startTraceCountdown()` still reads grade via an active instance for `TRACE_SECONDS` — leave as-is this phase (cleaned in Phase 5).

**Verification — automated:**
- [x] New test: two active instances both on the player's selected node → after dwell, **two** `ICE_DETECTED` events (one per `iceId`).
- [x] New test: cancelling/ejecting instance A's dwell does NOT cancel instance B's pending dwell (independent `cancelEvent` by id).
- [x] New test: single-instance detection unchanged (one detection, same trace timing).
- [x] `make check` passes.

**Verification — manual:**
- [x] Existing `tests/snapshot-ice-detection.test.js` still passes unchanged (single-instance parity). _(confirmed: file not in diff vs main; suite green)_

---

## Phase 2: Per-instance move timers (independent cadence)

Each instance moves on its own repeating `ICE_MOVE` timer at its own grade interval, instead of one shared tick at the primary's grade.

**Files:**
- Modify: `js/core/types.js` — add `moveTimerId: number|null` to `IceInstance`.
- Modify: `js/core/state/ice.js` — add `setIceMoveTimer(timerId, iceId)`.
- Modify: `js/core/ice/runtime.js` — per-instance move scheduling; `handleIceTick(payload)`.
- Modify: `js/ui/main.js:150`, `scripts/lib/headless-engine.js:47`, `js/playground/main.js:330` — pass payload to `handleIceTick`.
- Test: `tests/ice-multi-detection.test.js` — add cadence test.

**Key changes:**
- `startIce()` — `for (const ice of activeIceInstances(s)) { const id = scheduleRepeating(TIMER.ICE_MOVE, MOVE_INTERVALS[ice.grade] ?? 6000, { iceId: ice.id }); setIceMoveTimer(id, ice.id); }`
- `handleIceTick(payload)` — if `payload?.iceId`, move just `s.ice.instances[payload.iceId]` (if active); else iterate all active (back-compat). Guard `s.phase === "playing"`.
- `teleportIce(nodeId)` — reschedule only that instance's move timer: `cancelEvent(ice.moveTimerId)` then `scheduleRepeating(..., { iceId: ice.id })`, `setIceMoveTimer`.
- Handler sites: `on(TIMER.ICE_MOVE, (payload) => handleIceTick(payload))` (all three).
- `initGame` instance objects (Phase 3 too) include `moveTimerId: null`.

**Verification — automated:**
- [x] New test: two active instances, grades S and D, run N ticks → S emits more `ICE_MOVED` (per `iceId`) than D (independent cadence).
- [x] New test: single instance moves at exactly its grade interval (parity).
- [x] `make check` passes.

**Verification — manual:**
- [ ] Browser/playground: load a 1-ICE network, confirm ICE still patrols at the expected rate (no double-speed / stalled movement).

---

## Phase 3: Production consumer — one ICE per security-monitor (cap 3)

Generated networks spawn one roaming ICE per security-monitor node, threat ≥ B, each grade = run threat, capped at 3. One-monitor networks stay identical to today.

**Files:**
- Modify: `js/core/network/assemble.js:63-73` — build a list of ICE configs.
- Modify: `js/core/state/index.js:186-210` — build N instances; `:268` endRun deactivates all.
- Modify: `scripts/generate-network.js:104` — summary lists instances.
- Modify: `js/core/types.js` — `meta.ice` typedef → `{ instances: { startNode, grade }[] } | null`.
- Test: `tests/integration.test.js` (network suite) + `tests/init-game.test.js`.

**Key changes:**
- `assemble.js`:
```js
let iceConfig = null;
if (gradeToNumber(spec.threat) >= 4) {
  const monitors = allNodes.filter(n => n.type === "security-monitor").slice(0, 3); // cap 3 (temp swarm-guard, #136)
  if (monitors.length) iceConfig = { instances: monitors.map(m => ({ startNode: m.id, grade: spec.threat })) };
}
// meta.ice = iceConfig
```
- `initGame`:
```js
if (meta.ice?.instances?.length) {
  state.ice = { instances: {} };
  meta.ice.instances.forEach((cfg, i) => {
    const id = `ice-${i + 1}`;
    state.ice.instances[id] = { id, typeId: 'standard-ice', hostNodeId: cfg.startNode,
      residentNodeId: cfg.startNode, attentionNodeId: cfg.startNode, active: true, enabled: true,
      grade: cfg.grade, focus: 'roaming', behaviorPattern: 'standard',
      dwellTimerId: null, moveTimerId: null, detectedAtNode: null, detectionCount: 0 };
  });
} else { state.ice = { instances: {} }; }
```
- `endRun` (`index.js:268`): `Object.values(state.ice?.instances ?? {}).forEach(i => { if (i.active) setIceActive(false, i.id); });`
- `generate-network.js`: print each instance `grade @ startNode`.

**Verification — automated:**
- [x] New test: assemble a network with ≥2 security-monitors at threat ≥ B → `meta.ice.instances.length === min(monitorCount, 3)`.
- [x] New test: 1-monitor network → exactly 1 instance (parity); threat < B → `meta.ice` null / no instances.
- [x] New test: `initGame` builds `ice-1..ice-N` matching `meta.ice.instances`.
- [x] `make check` passes (790 tests).

**Verification — manual:**
- [x] `node scripts/generate-network.js --threat S --summary` lists multiple ICE on a multi-monitor seed _(seed s2 → 3 ICE, s3 → 2 ICE)_.
- [x] Multiple instances confirmed end-to-end (Phase 4): a real generated S network (`generateNetwork("s2")` → `initGame`) yields 3 runtime instances `ice-1/2/3` on distinct monitors; `status ice` enumeration verified by Phase 4 test.

---

## Phase 4: Bot + status + actions enumerate all instances

Keep the bot functional and the readout complete with multiple ICE. Bot evades when *any* instance threatens; `status` and EJECT availability consider all instances.

**Files:**
- Modify: `scripts/bot/perception.js:115-121` — aggregate over all active instances; add `ice.instances`.
- Modify: `scripts/bot/execute.js:121-129` — `onIceMoved` reacts to any ICE arriving on the owned target.
- Modify: `js/core/actions/node-actions.js:35-40` — EJECT available if any active instance at `node.id`.
- Modify: `js/core/console-commands/cmd-status.js` (3 ICE blocks: ~`:22`, `:105`, `:178`) — enumerate instances.
- Modify: `js/core/node-graph/game-ctx.js`, `js/playground/main.js` — exists-checks use any-active helper.
- Test: `tests/integration.test.js` (status + EJECT availability); bot census smoke.

**Key changes:**
- `perception.js`: `const insts = activeIceInstances(state);` →
```js
const ice = {
  instances: insts.map(i => ({ nodeId: i.attentionNodeId, grade: i.grade })),
  isOnSelectedNode: insts.some(i => i.attentionNodeId === state.selectedNodeId),
  isActive: insts.length > 0,
  nodeId: insts.find(i => i.attentionNodeId === state.selectedNodeId)?.attentionNodeId ?? insts[0]?.attentionNodeId ?? null,
};
```
  (`evasion.js:26` reads `world.ice.isOnSelectedNode` — preserved as any-instance aggregate.)
- `execute.js onIceMoved({ toId })`: drop `getPrimaryIce`; `if (toId === s.selectedNodeId && toId === targetNodeId && s.nodes[targetNodeId]?.accessLevel === "owned") emit EJECT`. (The `ICE_MOVED` event itself confirms an ICE arrived at `toId`.)
- `node-actions.js`: for `A.EJECT`, `return activeIceInstances(state).some(i => i.attentionNodeId === node.id);`
- `cmd-status.js`: replace each `getPrimaryIce()` block with a loop over `activeIceInstances(s)`, one line per instance (NONE if empty). Keep single-instance output shape identical when exactly one.

**Verification — automated:**
- [x] New test: with 2 instances on different nodes, `status ice` lists both.
- [x] New test: EJECT available at a node iff some active instance attends it.
- [x] `node scripts/bot/census.js --seeds 10 --threat S` runs without error and reports multi-ICE detections _(avgIceDetections 0.4; threat-S success 0% — Phase 6 tuning)_.
- [x] `make check` passes (793 tests).

_Note: `game-ctx.js`/`playground/main.js` exists-checks were left on `getPrimaryIce` and folded into Phase 5 (shim retirement), where they're deleted anyway._

**Verification — manual:**
- [ ] Census transcript shows the bot ejecting/evading against ≥2 ICE without thrashing — **folded into Phase 6 census review**.

---

## Phase 5: Retire `getPrimaryIce` / `getPrimaryIceFromState`

Remove the shim; every remaining caller uses explicit `iceId` or an any-active helper. Structural invariant: zero `getPrimaryIce` call sites remain.

**Files:**
- Modify: `js/core/state/ice.js` — delete `getPrimaryIce`/`getPrimaryIceFromState`; keep `activeIceInstances(state)` and add `hasActiveIce(state)`.
- Modify: `js/core/ice/runtime.js` — `startIce`/`ejectIce`/`disableIce`/`rebootIce`/`teleportIce` operate on explicit instances (eject/disable/reboot gain optional `iceId`/`nodeId`; cheats/teleport act on `activeIceInstances` — first or all, documented).
- Modify: `js/core/alert.js` `startTraceCountdown` — read grade from the detecting instance passed through, or `activeIceInstances(s)[0]` as the run-grade proxy.
- Modify: remaining call sites from research table: `node-actions.js`, `perception.js`, `cmd-status.js`, `game-ctx.js`, `playground/main.js` (most already migrated in Phase 4).
- Test: `tests/no-primary-ice.test.js` — new structural test.

**Key changes:**
- `eject`/`disable`/`reboot` action handlers pass the node's ICE id; verify call sites in `actions/` and `cheats.js`.
- Structural test:
```js
// reads js/ + scripts/ source, asserts no `getPrimaryIce(` or `getPrimaryIceFromState(` calls remain
import { readFileSync } from "node:fs";
// glob the source files, assert /getPrimaryIce(FromState)?\(/ matches none
```

**Verification — automated:**
- [x] `grep -rn 'getPrimaryIce' js scripts tests --include='*.js'` returns nothing (only the structural test's own strings).
- [x] New structural test (`tests/no-primary-ice.test.js`) asserts zero call sites — verified by injection (fails on a stray reference).
- [x] `make check` passes (794 tests; tsc clean).

**Verification — manual:**
- [ ] Full browser smoke: load a multi-monitor network, play a run, confirm multiple ICE move/detect and trace fires correctly — **consolidated into the end-of-session manual smoke (with Phase 6)**.

---

## Phase 6: Census re-baseline, light tuning, docs

Re-baseline difficulty with the new spawn rule; tune the cap/threat gate to keep success in band; update player docs. (TDD opt-out: tuning + docs, no new behavior.)

**Files:**
- Modify (if needed): `js/core/network/assemble.js` — cap value / threat gate (tuning only).
- Modify: `MANUAL.md` — ICE section: multiple ICE, one per security-monitor.
- Modify: `docs/ICE.md` if present.
- Modify: `notes.md` — record census deltas + tuning rationale.

**Key changes:**
- Run `make census` (default) and per grade B/A/S; capture success rate, trace-fired rate, avg ICE detections.
- If default-grade success rate falls outside ~±0.10 of today's 0.28, lower the cap (3→2) or raise the threat gate; re-run. Do NOT touch detection internals.

**Verification — automated:**
- [x] `make check` passes (794 tests).
- [x] `make census SEEDS=50` completes; results recorded in `notes.md` (default 0.28, unchanged).
- [x] census at threat S/B/A completes without error (multi-ICE exercised).

**Verification — manual:**
- [x] Census success within band — default 0.28 (dead-on ±0.10 target); no cap/gate change needed. Curve improved to monotonic C 0.28 → B 0.18 → A 0.10 → S 0.0; rationale in `notes.md`.
- [x] `MANUAL.md` ICE section reflects multiple-ICE behavior (+ `docs/ICE.md` implementation-status note).
- [x] Default census (threat C, ICE-free) byte-identical to main (0.28 / avgCash 6738 / avgTicks 523.4); B isolates the intended multi-ICE delta.

---

## Plan self-review

- **Spec coverage:** per-instance detection (P1) ✓; per-instance move cadence (P2) ✓; per-monitor spawn cap 3 (P3) ✓; single global alert from any instance (P1) ✓; bot evades any (P4) ✓; status enumerates (P4) ✓; shim retired (P5) ✓; census re-baseline + light tuning + MANUAL (P6) ✓; single-monitor parity (P1/P2/P3 manual checks + P6 spot-check) ✓; #136 split honored (cap retained, no network-gen surgery) ✓.
- **Placeholders:** none — each phase has concrete signatures/snippets.
- **Type consistency:** `activeIceInstances(state)` (P1) reused P2/P4/P5; `moveTimerId` added P2, used P3 init + P2 teleport; `recordIceDetection(nodeId, iceId)` P1 matches `triggerDetection` caller; `meta.ice = { instances: [...] }` P3 matches `initGame` reader.
