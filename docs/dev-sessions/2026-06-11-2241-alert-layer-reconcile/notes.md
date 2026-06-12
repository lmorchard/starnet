# Notes — Reconcile the alert layer (#173)

## Execution summary

Built the two-sensors-one-ladder alert model per spec, retired the legacy layer, fixed the
status display, made the tests honest, corrected the docs, and tuned difficulty.

- **P1** — grid escalation to TRACE: `report` operator + `recordMonitorAlert` (mirrors
  `recordIceDetection`) + ctx wiring + security trait (`report` op, removed `alert-escalate`) +
  bridge broadcast. Removed redundant inline `relay` on 5 set-piece IDS nodes (the `detectable`
  trait already provides it; the duplicate double-counted at the monitor).
- **P2** — retired the legacy alert.js layer (`recomputeGlobalAlert`, `propagateAlertEvent`,
  `raiseGlobalAlert`, `DETECTOR/MONITOR_TYPES`, `initAlertHandlers` hooks, `eventForwardingDisabled`
  + `setNodeEventForwarding`). Removed the two dishonest integration tests + the node.test for the
  deleted setter.
- **P3** — `cmd-status` reads `forwardingEnabled` (it read the dead `eventForwardingDisabled`, so
  it always showed "enabled"). Verified: corrupt → `[fwd:OFF]`.
- **P4** — MANUAL.md + CLAUDE.md rewritten to the two-sensor model; #173 caveat removed.
- **P5** — tuning (below).

## Key design correction during execution

The grid initially tripped on **every probe**, not just failures — `NODE_ALERT_RAISED` fires on
probe (green→yellow) as well as exploit failure. With grid-wide sensing that made the trace fire
on routine recon (0% success even at threshold 6). Fix: the bridge broadcasts the grid `alert`
on **exploit failure** (`ACTION_RESOLVED`, XPLOIT, `success===false`), not on `NODE_ALERT_RAISED`.
Probes still emit `probe-noise` for dedicated sensors (nthAlarm); they don't trip the grid.

## Difficulty tuning (census, 25 seeds/grade)

Baseline **main**: threat C → 0.32 success / 0.76 trace / $6964; threat B → 0.32 / 0.76 / $11656.

`MONITOR_TRACE_THRESHOLD` sweep (failures-only grid):

| threshold (by grade) | threat C | threat B |
|---|---|---|
| {C:2} (initial, ICE-mirror) | 0/1.00 | 0.04/0.96 |
| {S3 A4 B5 C6 D8 F10} | 0.20/0.84 | 0.20/0.88 |
| **{S4 A5 B7 C9 D12 F15}** (chosen) | **0.28/0.76** | **0.24/0.84** |

Chosen rationale: at **threat C (no ICE — the passive-grid-only tier)** the branch matches main's
0.76 trace / ~0.3 success, so the ICE-less LAN now has a *real* clock at comparable, forgiving-ish
difficulty. At **threat B (ICE + grid, two sensors)** it's slightly harder (0.84 trace), which is
the intended cost of a second sensor. The upcoming cooldown levers (#174) will add relief on top.
The threshold table is the obvious knob for Les's hands-on tuning pass.

## Follow-ups
- #174 — alert cooldown levers ("lie low" EXEC, "scrub logs" action), depends on this.
- Difficulty is tuned-to-the-bot; revisit by feel + with #174 in place.
