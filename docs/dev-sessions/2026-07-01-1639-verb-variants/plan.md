# SWEEP-PROBE Implementation Plan

**Goal:** A progressive, depth-bounded, abortable probe flood-fill (SWEEP) — the breadth counterpart
to selective PROBE — built on a **reusable progressive-process framework** (no bespoke per-feature
timers, no per-action abort special-cases), bounded by the gate structure, priced in heat.

**Approach:** Introduce a small general **process** seam — serializable `state.processes`, a type
registry, one `stepProcesses()` hook in the existing central `tick()`, and a uniform "active process
on a node = busy/abortable" rule. SWEEP is the first client: a `sweep` process whose step probes the
current BFS frontier (connect + `resolveProbe` per node → gate-bounded reveal + heat + alert fall out),
advances a wave every N ticks, and ends at depth cap / empty frontier / abort. Surface as a fixed-kit
node action with a depth picker (mirrors SNIFF). Future cross-node/progressive verbs (parallel-XPLOIT)
plug into the SAME seam.

**Tech stack:** Vanilla ES modules, JSDoc `@ts-check`, node:test, Lit HUD, esbuild.

---

## Phase 1: Progressive-process framework (generic seam, no UI)

The reusable mechanism, standalone and tested — SWEEP is a later client. Built first so SWEEP never
needs a bespoke timer or abort special-case.

**Files:**
- Modify: `js/core/types.js` — `GameState.processes: Process[]`; `Process = { id:number, type:string, nodeId:string, [k:string]:any }`.
- Modify: `js/core/state/index.js` — init `processes: []`; heal.
- Create: `js/core/state/process.js` — `mutate()`-wrapped: `addProcess(p)`, `updateProcess(id, patch)`, `removeProcess(id)`, `nextProcessId()`. Re-export via `state.js`.
- Create: `js/core/processes.js` — the registry + tick driver + queries:
  - `registerProcess(type, { step, onAbort })`
  - `stepProcesses()` — for each active process, `step(proc, state)`; if it returns `true` (done), remove + emit `E.PROCESS_ENDED{reason:"complete"}`.
  - `activeProcessOnNode(state, nodeId)` / `abortNodeProcesses(nodeId, reason)` (calls `onAbort`, removes, emits `E.PROCESS_ENDED{reason}`).
- Modify: `js/core/timers.js` — call `stepProcesses()` once per `tick()` (alongside the graph tick), so all three entry points drive it with no per-feature timer.
- Modify: `js/core/events.js` — `E.PROCESS_STARTED`, `E.PROCESS_STEP`, `E.PROCESS_ENDED`.
- Test: `tests/processes.test.js`.

**Key changes:**
- Registry + driver (pure-ish; `step` returns done):
  ```js
  const HANDLERS = new Map(); // type → { step, onAbort }
  export function registerProcess(type, def) { HANDLERS.set(type, def); }
  export function stepProcesses() {
    const s = getState();
    if (!s || s.phase !== "playing") return;
    for (const proc of [...s.processes]) {           // snapshot: step may remove
      const def = HANDLERS.get(proc.type);
      if (def && def.step(proc, getState()) === true) endProcess(proc.id, "complete");
    }
  }
  export function abortNodeProcesses(nodeId, reason = "aborted") {
    for (const proc of getState().processes.filter((p) => p.nodeId === nodeId)) endProcess(proc.id, reason);
  }
  function endProcess(id, reason) {
    const proc = getState().processes.find((p) => p.id === id);
    if (!proc) return;
    HANDLERS.get(proc.type)?.onAbort?.(proc, getState()); // onAbort runs on every end (idempotent cleanup)
    removeProcess(id);
    emitEvent(E.PROCESS_ENDED, { id, type: proc.type, nodeId: proc.nodeId, reason });
  }
  export const activeProcessOnNode = (state, nodeId) => state.processes.some((p) => p.nodeId === nodeId);
  ```
  (Handlers are re-registered per run wherever run handlers are wired — module import registers them;
  confirm registration survives `clearHandlers()` since it's a plain Map, not an event listener.)

**Verification — automated:**
- [ ] `make lint` / `make test` / `make check` pass
- [ ] A dummy test process registered, added, and stepped over `tick()`s advances and self-removes when
      its `step` returns done; `E.PROCESS_ENDED{complete}` fires.
- [ ] `abortNodeProcesses` removes a node's processes, runs `onAbort`, emits `E.PROCESS_ENDED{aborted}`.
- [ ] `processes` round-trips through serialize→deserialize (a mid-flight process resumes stepping);
      pre-field save heals to `[]`.

**Verification — manual:** none.

---

## Phase 2: SWEEP as a process — gate-bounded wave flood-fill

SWEEP is the first `registerProcess` client. Reuses `resolveProbe` per frontier node.

**Files:**
- Modify: `js/core/balance.js` — `SWEEP_WAVE_TICKS` (ticks/wave), `SWEEP_MAX_DEPTH`.
- Create: `js/core/sweep.js` — `startSweep(originId, depthCap)` + `registerProcess("sweep", { step, onAbort })`.
- (reuse) per-node step = connect + probe so a reached `sig-N` node ends fully revealed (Les: "as if connected-to"): `setNodeVisible(id,"accessible")` then `ctx.resolveProbe(id)`.
- Test: `tests/sweep.test.js`.

**Key changes:**
- `sweep.js`:
  ```js
  const revealedUnprobedNeighbors = (s, id) =>
    (s.adjacency[id] || []).filter((n) => s.nodes[n] && s.nodes[n].visibility !== "hidden" && !s.nodes[n].probed);
  const sweepProbe = (ctx, id) => { setNodeVisible(id, "accessible"); ctx.resolveProbe(id); }; // connect + probe

  export function startSweep(originId, depthCap) {
    const s = getState();
    const ctx = s.nodeGraph?._ctx;
    if (!ctx || activeProcessOnNode(s, originId)) return;
    sweepProbe(ctx, originId);                                   // wave 0
    const cap = Math.min(depthCap || SWEEP_MAX_DEPTH, SWEEP_MAX_DEPTH);
    addProcess({ id: nextProcessId(), type: "sweep", nodeId: originId,
                 depthCap: cap, depth: 0, wave: 0,
                 frontier: revealedUnprobedNeighbors(getState(), originId) });
    emitEvent(E.PROCESS_STARTED, { type: "sweep", nodeId: originId, depthCap: cap });
  }

  registerProcess("sweep", {
    step(proc, s) {
      if (proc.depth >= proc.depthCap || proc.frontier.length === 0) return true; // done
      if (++proc.wave < SWEEP_WAVE_TICKS) { updateProcess(proc.id, { wave: proc.wave }); return false; }
      const ctx = s.nodeGraph._ctx;
      for (const id of proc.frontier) sweepProbe(ctx, id);       // each: connect + reveal-if-gate + heat + alert
      const next = [...new Set(proc.frontier.flatMap((id) => revealedUnprobedNeighbors(getState(), id)))];
      const depth = proc.depth + 1;
      updateProcess(proc.id, { depth, wave: 0, frontier: next });
      emitEvent(E.PROCESS_STEP, { type: "sweep", nodeId: proc.nodeId, depth, count: proc.frontier.length });
      return depth >= proc.depthCap || next.length === 0;        // done after this wave?
    },
    onAbort() {}, // nothing to undo — probed nodes stay revealed
  });
  ```
  (Confirm `s.nodeGraph._ctx.resolveProbe` handle during execution; if cleaner, extract `resolveProbe`'s
  body to a shared `probeNode(nodeId)` and call from both game-ctx and here.)

**Verification — automated:**
- [ ] `make check` passes
- [ ] Sweep depthCap N probes N waves; reached `sig-N` nodes end `probed` AND `visibility:"accessible"` (fully revealed); heat rose ~`HEAT_COST.probe × swept`.
- [ ] Propagation STOPS at a gate-controller (router/firewall/IDS/monitor) — its neighbors stay hidden/unprobed.
- [ ] Stops early when the frontier empties before the cap.
- [ ] Serialize mid-sweep → resumes waving after deserialize (process round-trips).

**Verification — manual:** none.

---

## Phase 3: SWEEP action + depth picker + console + abort

Surface the verb; abort rides the generic process rule (no special-case).

**Files:**
- Modify: `js/core/action-ids.js` — `SWEEP: "sweep"`.
- Modify: `js/core/actions/program-actions.js` — `SWEEP_ACTION` (followup depth picker 1/2/3/max) + inject in `getProgramActions` when accessible AND `!activeProcessOnNode`.
- Modify: `js/core/actions/node-actions.js` — offer the unified ABORT when `activeProcessOnNode(state, node.id)` (mirrors the KICK global-state filter); ABORT execute → `abortNodeProcesses(node.id)`.
- Modify: `js/core/actions/action-context.js` — dispatch `sweep` with `{depth}` → `startSweep(node.id, depth)`.
- Modify: `js/core/navigation.js` — `navigateAway` also `abortNodeProcesses(prevSelected)` (nav-cancel parity with timed actions).
- Modify: `js/core/console-commands/commands.js` — `sweep <node> <depth|max>` (mirror `sniff`).
- Modify: `js/ui/log-renderer.js` + `scripts/playtest.js` — log `PROCESS_STARTED/STEP/ENDED` for `sweep`.
- Test: `tests/sweep.test.js`.

**Key changes:**
- `SWEEP_ACTION` mirrors `SNIFF_ACTION`: followup `choices` = depth options (render "action"); pick →
  `starnet:action { actionId:"sweep", nodeId, depth }`; `execute:(n,_s,_c,p)=>startSweep(n.id, p.depth==="max"?SWEEP_MAX_DEPTH:Number(p.depth))`.
- ABORT already exists as a unified action; extend its availability + execute to cover an active process
  on the node (general — parallel-XPLOIT inherits it).

**Verification — automated:**
- [ ] `make check` passes
- [ ] Dispatch `{actionId:"sweep", nodeId, depth:2}` runs to completion over `tick()`s; GUI/console (`sweep <node> 2`) parity (same probed set + heat).
- [ ] ABORT mid-sweep ends the process, keeps everything already probed; SWEEP not offered while a sweep runs on the node.
- [ ] Nav-away mid-sweep aborts it.

**Verification — manual:**
- [ ] Harness: `sweep gateway 3` + `tick` — waves probe outward in the log; a wide sweep trips `[HEAT]`.

---

## Phase 4: Wave ripple visual + preview

**Files:**
- Modify: `js/ui/overlays/probe-sweep.js` — outward per-wave ripple (clockwise = player action), or a sibling overlay; overlay layer + cheap filter (glow-ownership rule), no per-frame heavy filter.
- Modify: `js/ui/visual-renderer.js` — on `E.PROCESS_STEP{type:"sweep"}`, pulse the ripple from origin at the wave radius.
- Modify: `js/ui/preview.js` / `preview.html` — "Sweep ripple" demo.

**Verification — automated:** [ ] `make check` passes
**Verification — manual:**
- [ ] Preview shows the outward ripple per wave; stroke+glow only, cheap overlay filter.
- [ ] In-game (`?network=corporate-exchange`): sweep ripples outward, heat gauge climbs, abort stops it.

---

## Phase 5: Docs + census

**Files:**
- Modify: `MANUAL.md` — SWEEP (selective vs sweep probing); node-actions + console rows; gate-controllers stop the flood, heat is the cost, reached nodes come fully online.
- Modify: `docs/BOT-PLAYER.md` — bot doesn't use SWEEP (opt-in); census confirms no-regression.
- Modify: `docs/design/flow-subversion.md` — SWEEP-PROBE done; note the generic **process** seam now exists for future cross-node/progressive verbs (parallel-XPLOIT); parallel-XPLOIT still pending.

**Verification — automated:**
- [ ] `make check` passes
- [ ] `make census SEEDS=30` vs same-seed `main`: unchanged (bot doesn't sweep).
**Verification — manual:**
- [ ] MANUAL re-read matches behavior.
- [ ] Feel check with Les: depth picker + wave cadence + heat spike (tune `SWEEP_WAVE_TICKS` / depth options by feel).
