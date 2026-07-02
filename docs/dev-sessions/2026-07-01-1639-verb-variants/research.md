# Verb variants — SWEEP-PROBE — codebase research

Off `origin/main`@8c1128e (heat model #271 merged). Integration points for a progressive,
depth-bounded, abortable probe flood-fill.

## Probe + reveal + gate propagation (the flood-fill engine, already exists)
- **Single-node probe:** `resolveProbe(nodeId)` in `js/core/node-graph/game-ctx.js` — setNodeProbed,
  setLastDisturbedNode, `recordHeat(HEAT_COST.probe)`, raises node alert green→yellow, emits
  ACTION_RESOLVED{PROBE}, and reveals neighbors **only when `(node.gateAccess ?? "probed") === "probed"`**.
- **`revealNeighbors(nodeId)`** (`js/core/state/index.js:282`) — reveals a node's hidden neighbors as
  `sig-N` (visibility "revealed"). This is the propagation step.
- **Gate rule = the sweep's natural stopper.** gateAccess "probed" (gateway/workstation/fileserver/
  cryptovault/WAN) reveal neighbors on probe → sweep propagates through them. gateAccess "open"/"owned"
  (router/firewall/IDS/monitor) do NOT reveal on probe until opened/owned → sweep can probe them but
  can't expand past them. SWEEP reuses this; no new "hardened" concept needed.
- **Frontier source:** `state.adjacency[nodeId]` (undirected neighbor ids). A node is sweep-probeable
  if visible (revealed/accessible) and unprobed.

## Heat (the cost, shipped #271) — `js/core/alert.js`
- `recordHeat(amount)` — trip-line: adds heat, crossing hidden `HEAT_ALARM_THRESHOLD[threat]` steps the
  alert + discharges. `HEAT_COST.probe` in `js/core/balance.js`. Each swept node = one recordHeat →
  a wide/deep wave spikes heat and can trip mid-sweep (the tension).
- Decaying-heat + gauge already in place; SWEEP just feeds it more, faster.

## Progressive action pattern (NEW — not the single-shot timed action)
- Existing timed actions (probe/xploit) resolve ONCE on completion via the `timed-action` operator +
  `TIMED_ACTIONS` registry (`js/core/node-graph/timed-actions.js`: `TIMED_ACTIONS`, `ABORTABLE_FLAGS`,
  `getTimedActionAttrNames`). SWEEP is different: it fires a **wave every N ticks** until depth cap /
  frontier-empty / abort.
- **Model:** a repeating `SWEEP_WAVE` timer (mirror `TRACE_TICK`/`HEAT_DECAY` in `alert.js` + `timers.js`
  `TIMER`), handler processes one wave; wired in `js/ui/main.js` + `scripts/lib/headless-engine.js`
  `wireRunHandlers`. In-flight sweep state (origin, depthCap, currentDepth, frontier[], timerId) lives
  in serializable `state` (like `heatDecayTimerId`/`traceTimerId`).
- **Abort:** reuse the ABORT unified action + nav-away cancel; add a `sweeping` active flag to the
  registry so ABORT surfaces and NOT_BUSY blocks concurrent actions. Abort cancels the timer, clears
  sweep state, keeps everything already revealed/probed.

## Availability + UI (mirror the Session-1 flow programs)
- **Injected node-action:** `getProgramActions(node,state)` in `js/core/actions/program-actions.js`
  injects SNIFF/REPLAY as a fixed kit (top-level, not EXEC scripts). Add SWEEP the same way — available
  on an accessible node; a **followup depth picker** (mirrors the SNIFF flow picker / XPLOIT card picker,
  rendered by `starnet-action-choices.js`).
- **Console:** `sweep <node> <depth>` in `js/core/console-commands/commands.js` (mirror `sniff`).
- **Visual:** `js/ui/overlays/probe-sweep.js` already draws a clockwise probe ripple — extend/repeat it
  outward per wave (clockwise = player action, per the rotation convention). New effect → preview harness.

## Three entry points + census
- SWEEP is player-only, opt-in (like flow programs). The **bot won't use it** — document in
  `docs/BOT-PLAYER.md`; census confirms no-regression. Wave-timer handler must be registered in
  `main.js` + `wireRunHandlers` (playtest + bot), mirroring HEAT_DECAY/TRACE_TICK.
