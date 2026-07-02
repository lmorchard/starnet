# SWEEP-PROBE (verb variants pt.2) — notes

## Outcome: functional feature complete + green; ripple-visual (P4) parked for a browser pass

Branch `verb-variants` off `origin/main`@8c1128e (heat #271). `make check` green (1550 tests,
+13 process/sweep). Census SEEDS=30 = main exactly (0.3 / 0.767 / 4.53 / ¥6190) — SWEEP is opt-in,
the bot never sweeps, the process framework no-ops for it.

## What shipped
- **Generic progressive-process seam** (`js/core/processes.js`) — the normalization Les asked for:
  `state.processes[]` (serializable + healed), a type registry (`registerProcess`), ONE
  `stepProcesses()` hook in the central `tick()`, and uniform busy/abort (`activeProcessOnNode` /
  `abortNodeProcesses`). No per-feature global timers, no per-action abort special-cases.
- **SWEEP as the first client** (`js/core/sweep.js`) — a `sweep` process: probes the origin, then
  ripples outward one wave every `SWEEP_WAVE_TICKS`, probing each frontier via `resolveProbe`
  (connect + probe, so reached sig nodes come **fully online**; gate-bounded propagation + heat +
  node-alert all fall out). Depth ceiling (1/2/3/max) + abort; ends at cap/empty/abort.
- **Action/UX**: SWEEP_ACTION with a depth picker (mirrors SNIFF); console `sweep <node> <depth|max>`;
  a busy node offers only ABORT (general rule at the actions layer); nav-away aborts (parity).
- **Logging** across log-renderer + playtest; harness-verified end-to-end.

## Key design win (Les's steer)
Instead of a bespoke `SWEEP_WAVE` timer + `sweeping` special-case, we built the general process seam.
Parallel-XPLOIT (the remaining verb variant) is now a cheap follow-on: another `registerProcess`
client, zero new timers/abort code. Special-cases avoided by construction.

## Deferred: Phase 4 — the outward-ripple overlay
The dedicated graph-level wave-ripple animation is NOT built. It's a feel/polish visual I can't
build-and-verify here (no browser / Playwright), and the sweep is already legible without it: swept
nodes animate via the existing NODE_REVEALED / ACTION_RESOLVED(probe) visuals, and every wave is
narrated in the log + heat gauge. Options for Les: (a) ship SWEEP now, add the ripple as a small
follow-up done with his eye in the browser; or (b) pair on the ripple before the PR.

## Still to do (Les)
- **Browser eyeball** on `?network=corporate-exchange`: `sweep gateway max` ripples outward through
  probe-gate nodes, stops at routers/firewalls, heat gauge spikes, abort stops it mid-ripple.
- Decide the Phase-4 ripple option above.
- **PR** (rebase onto current origin/main first).

## Next arc
Parallel-XPLOIT (plugs into the process seam) + flows-as-scouting. See `docs/design/flow-subversion.md`.
