# SWEEP-PROBE (verb variants, anti-tedium arc pt.2) Spec

**Goal:** Add **SWEEP** — a progressive, depth-bounded, abortable probe flood-fill from a node —
as the *breadth* counterpart to the existing selective single-node PROBE. It maps more of the
network fast, at the cost of a fast-building heat spike, so the player trades coverage against
notice. This is the first verb variant; it turns the heat meter (shipped #271) into a live
coverage-vs-heat dial and makes the network's gate structure tactically load-bearing.

**Source:** User request 2026-07-01 (design conversation with Les). Arc design:
`docs/design/flow-subversion.md` → "Anti-tedium arc" (verb variants). Builds on the heat model (#271).

## Current state
See `research.md` for `file:line`. Load-bearing facts:
- **Selective PROBE already exists** — `resolveProbe` (game-ctx) probes one node, reveals its
  neighbors only through **probe-gate** nodes, adds `HEAT_COST.probe`. "Meticulous probe" = this.
- **Gate rule is the natural flood-stopper:** gateAccess "probed" types reveal-on-probe (sweep flows
  through); "open"/"owned" types (router/firewall/IDS/monitor) don't until opened/owned (sweep stops).
- **Heat** (`recordHeat`, trip-line, decaying) is shipped and is the exact cost model.
- **Flow programs** (SNIFF/REPLAY) are the pattern for a fixed-kit injected node-action + followup
  picker + console verb across all three entry points.
- Repeating-timer pattern (`TRACE_TICK`/`HEAT_DECAY`) is the model for the per-wave progression.

## Desired end state
- **SWEEP** is a fixed-kit node-action on an accessible node. Choosing it opens a **depth picker**
  (1 / 2 / 3 / max); console `sweep <node> <depth>`.
- It runs as a **progressive, wave-by-wave** action from the origin node:
  - Wave k probes the current frontier (each node: setNodeProbed + reveal-neighbors-if-probe-gate +
    node-alert raise + `recordHeat(HEAT_COST.probe)`), then computes wave k+1's frontier from the
    newly-revealed, unprobed, non-gate-blocked neighbors.
  - It advances one wave every `SWEEP_WAVE_TICKS`, **incrementally revealing** the map and **building
    heat** as it goes. A big/deep sweep spikes heat fast and can **trip the alarm mid-sweep**.
  - It **stops** at the chosen depth ceiling, when the frontier is empty (all gate-blocked/dead-end),
    or when the player **ABORTs** (or navigates away). Abort keeps everything already revealed/probed.
- In-flight sweep state (origin, depthCap, currentDepth, frontier, timerId, `sweeping` flag) is
  **serializable** and survives a save/load round-trip; a sweep resumes ticking after load.
- The graph shows a per-wave outward **ripple** (clockwise = player action; extends the existing
  probe-sweep overlay). Every wave + the trip + completion/abort are logged.
- `make check` green; `make census` shows no regression (bot doesn't sweep — opt-in like programs).

## Design decisions
- **Decision:** SWEEP is a **progressive over-time flood-fill** (wave every N ticks), not a single
  burst-at-end. - **Why (Les):** the tension is watching the map open and heat climb and deciding
  each moment whether to push another wave or abort. **Rejected:** one-shot timed action (burst at
  end) and instant — both lose the live abort-vs-push decision.
- **Decision:** **player picks a depth ceiling** (1/2/3/max) up front; **abort** is the live early-out.
  - **Why (Les):** commit a coverage budget, but still bail if heat gets scary. **Rejected:**
    run-until-frontier-empty-or-abort with no ceiling (less upfront control).
- **Decision:** propagation uses the **existing gate rule** — flows through probe-gate nodes, stops at
  gate-controllers (router/firewall/IDS/monitor) until they're opened/owned. - **Why (Les):** no new
  "hardened" concept; reuses reveal-on-probe; gives routers/firewalls a tactical flood-stopper role and
  makes topology matter. **Rejected:** radius/all-revealed/multi-select targeting (blunter or expensive
  new UI).
- **Decision:** heat = `HEAT_COST.probe` per swept node, accruing per wave (reuse the shipped meter).
  - **Why:** SWEEP is "many probes at once" — the burst the heat model was built to price; it's what
    makes mass-probe the loud option vs selective PROBE. **Rejected:** a bespoke sweep heat cost.
- **Decision:** fixed always-available kit (injected node-action + depth-picker followup), mirroring the
  flow programs. - **Why:** no RAM loadout UI yet (Session 3). **Rejected:** loadout gating now.
- **Decision:** SWEEP is player-only; the bot does not learn it. - **Why:** it's an opt-in tool like the
  flow programs; census confirms no-regression, not its value (feel-tuned with a human).

## Patterns to follow
- Injected node-action + followup picker + console verb: mirror SNIFF (`program-actions.js`
  `getProgramActions`/`SNIFF_ACTION`/`getFlowChoices`; `commands.js` `sniff`; `starnet-action-choices.js`).
- Per-wave progression: repeating timer like `TRACE_TICK`/`HEAT_DECAY` (`alert.js` schedule + handler;
  `timers.js` `TIMER`; wired in `main.js` + `wireRunHandlers`). Serializable timer id + state.
- Per-node probe resolution: reuse/extract the `resolveProbe` body so a swept node behaves exactly like
  a manually-probed one (reveal, alert, heat, ACTION_RESOLVED).
- Abort/nav-cancel + `sweeping` active flag: extend the `TIMED_ACTIONS`/`ABORTABLE_FLAGS` registry.
- Serializable-state + heal: the Session-1/heat pattern (`state/`, `state/index.js` init/heal, shim).
- Ripple visual: extend `js/ui/overlays/probe-sweep.js`; demo in the preview harness.

## What we're NOT doing
- **No parallel/multi-node XPLOIT** — deferred (multi-node combat resolution + shared-failure is its
  own thornier slice).
- **No general multi-select graph UI** — the sweep's target set is derived from origin + gate-bounded
  BFS, not arbitrary selection.
- **No RAM loadout UI / pre-run variant selection** (Session 3) — fixed kit for now.
- **No new "hardened node" concept** — reuse the existing gate column.
- **No change to selective PROBE, heat, or the alert sensors' numbers.**
- **Bot does not learn SWEEP.**

## Open questions (each with a default)
- **Wave cadence (`SWEEP_WAVE_TICKS`).** Default: ~5 ticks (0.5s)/wave — fast enough to feel like a
  ripple, slow enough to abort between waves. Feel-tuned.
- **Depth options.** Default: picker offers 1 / 2 / 3 / max ("max" = run until frontier-empty). Console
  accepts an integer or `max`.
- **Does a swept node raise its own local alert (green→yellow) like a manual probe?** Default: **yes** —
  a swept node is probed identically (consistency); the global pressure comes from heat, the per-node
  glow from the same probe path.
- **Heat per swept node value.** Default: `HEAT_COST.probe` (reuse). Whether a wide sweep should trip is
  left to the shipped heat numbers + feel/census; do NOT retune heat autonomously.
