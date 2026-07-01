# Session 1: Flow Programs + Noise Economy — notes

## Outcome: functionally complete, pending browser verification + feel-tuning

Branch `flow-programs-noise`. All 5 planned phases shipped, `make check` green throughout
(1498 tests, was 1483 on main → +15 flow-program/flow-layer tests). Reach the loop via
`?network=corporate-exchange`.

The shipped loop: probe/reveal `switch-2` + `fw-1` → the encrypted `switch-2→fw-1` **credential**
flow renders → **SNIFF** it (decrypts on the graph + captures `fw-root-key`) → **REPLAY** the
token into finesse-only `fw-1` → owned (vault beyond reveals). Each program play adds **noise**
that climbs the shared trace ladder; **NOISE: N** shows beside the alert.

## Phases

- **P1** — data + noise sensor: `Flow.key/revealed`, `PlayerState.capturedCredentials`,
  `GameState.programNoise` (serializable + healed); `recordProgramNoise` third sensor in
  `alert.js` (same ladder + trace clock, tunable thresholds in `balance.js`).
- **P2** — SNIFF: `js/core/programs.js` (sniffFlow/incidentFlows) + `js/core/actions/program-actions.js`
  (injected into `getAvailableActions`); node-anchored flow picker (`flow-packet` render in
  starnet-action-choices from single-sourced glyph geometry); console `sniff` + playtest + log.
- **P3** — finesse node + REPLAY: `finesse-access` trait (finesseLocked/trustsCredential);
  `EXPLOIT_ACTION.requires += not finesseLocked`; `createFirewall({ finesse:{ key } })`; fw-1
  authored finesse in corporate-exchange; REPLAY replicates `applyCombatResult`'s access-gain
  side-effects (reveal-beyond).
- **P4** — HUD numeric `NOISE: N` beside the alert (reuses hud-label/value; no new chrome).
- **P5** — flow-layer honours `revealed` (sniff decrypts on graph); preview REVEALED toggle;
  MANUAL.md + BOT-PLAYER.md; census SEEDS=10 clean.

## Deviations from the plan (all deliberate, all sound)

1. **REPLAY, not SPOOF.** `A.SPOOF`/"spoof" is already the security-monitor recalibrate + a trap
   action — a console/dispatch collision. Design doc sanctions "SPOOF/REPLAY" as synonyms, so the
   credential-replay program is **REPLAY** (`A.REPLAY`). Les approved.
2. **Programs are injected node actions, not traits and not EXEC scripts.** The kit is player-owned
   (not node-intrinsic), and EXEC executes a script immediately on pick — it can't host SNIFF's
   flow picker. So SNIFF/REPLAY are in `CORE_NODE_VERBS` (top-level, like probe/xploit) and injected
   by `getProgramActions` in `node-actions.js`. Availability the graph's `requires` can't express
   (incident flows, held credentials) is filtered there — mirrors the KICK filter.
3. **Flow-layer decrypt (P5) was a real gap.** Session 0's layer keyed only off `encrypted`; a
   SNIFFed flow wouldn't visually decrypt. Fixed: signature includes `revealed`; concealed only
   while `encrypted && !revealed`.
4. **Skipped two speculative preview widgets** (captured-credential indicator, finesse-node marker)
   — Session 1 has no such graph visuals (credentials → log; finesse → no-XPLOIT + node panel), so
   they'd be dead demo code. The real new visuals (sniff-decrypt, picker glyph) are covered.

## Still to do (needs Les + a browser — Playwright won't launch here)

- **Browser verification** of the whole loop on `?network=corporate-exchange`: SNIFF picker glyphs;
  encrypted→decrypted flow render after sniff; NOISE readout climbing; fw-1 offers no XPLOIT and
  owns via REPLAY; the alert lamp escalating with noise.
- **Feel-tuning the noise numbers** (`PROGRAM_NOISE_COST` / `PROGRAM_NOISE_THRESHOLD` in
  `balance.js`). Current placeholders: sniff 1 / replay 3; yellow 2 / red 4 / trace 6. Intent:
  the intended quiet solution (a couple of sniffs + a replay + probing) stays below trace, while
  loud over-use reaches it. Tune by playing, not autonomously.

## Follow-ups noted (out of scope, Session 2+)

- TAP/SPLICE + skim/scoring (S2); RAM loadout + store reframe (S3).
- Named networks (incl. corporate-exchange) aren't hub-reachable (issue #261) — the loop is only
  reachable via `?network=`.
