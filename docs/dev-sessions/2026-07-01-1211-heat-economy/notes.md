# Heat Model (anti-tedium arc pt.1) — notes

## Outcome: complete, green, pending browser eyeball + PR

Branch `heat-economy` off `origin/main`@07fe7f9. All 6 planned phases shipped (P1+P2 merged —
the programNoise→heat rename entangled them). `make check` green throughout (1508 tests, +13
heat/gauge). Reach the loop via `?network=corporate-exchange`.

## What shipped
- **heat** (decaying meter) replaces Session 1's monotonic `programNoise`. `HEAT_DECAY` repeating
  timer bleeds it down (mirrors TRACE_TICK; self-starts on first heat; handler in main.js +
  wireRunHandlers).
- **Trip-line ratchet** (`recordHeat`): crossing a hidden, grade-scaled `HEAT_ALARM_THRESHOLD`
  steps the alert ladder up one (escalation-only) and discharges heat so it must rebuild. Bursts
  trip; paced play stays cool.
- **Heat fed by core activity** — probe (`resolveProbe`) + xploit (`applyCombatResult`, every
  attempt) + programs. Imperative at the resolution points → all three entry points accrue heat.
- **lie-low → heat cooling only** (not alert); alert-down is subversion-only (scrub/corrupt/
  cancel-trace). Still per-run-limited; no-op at trace.
- **Qualitative heat gauge** (`heatGaugeSvg`) replaces the numeric `NOISE: N` — stroked cool→hot
  ladder on a fixed visual scale; never shows the number or threshold. Preview swatch added.

## The key tuning finding
Heat feeding probe/xploit at placeholder decay (0.15/s) devastated the bot: **0.9 trace / 0.1
success** vs main's 0.77 / 0.30 (same-seed SEEDS=30). Root cause: decay was negligible vs activity,
so heat was effectively monotonic (pacing didn't cool). **But probe/xploit are timed actions** —
their heat is naturally paced for everyone. Bumping decay to **0.6/s** made the bot's steady cadence
stay under the bar → census matches main **exactly** (no regression). So heat landed as a **burst
detector**: it fires on rapid *instant* actions (programs now; the future SWEEP verb-variant later),
not on steady sequential play.

Les's call: **accept this** (conservative, no floor damage) and **keep probe feeding heat** — the
probe-heat cost is deliberately load-bearing for the future *mass-probe SWEEP vs selective
node-at-a-time probe* choice, where bursting many probes at once should spike heat. The numbers are
intentionally gentle now; dial heat **up** for real bite once verb variants exist.

## Deviations from the plan
- Plan P1 and P2 merged into one commit (the rename couples state + ratchet; a half-renamed
  intermediate would be incoherent).
- Numeric readout removed this session (plan had it as P5) — replaced by the gauge as planned.

## Still to do (Les)
- **Browser eyeball** on `?network=corporate-exchange`: gauge climbs with activity + visibly cools;
  a burst of programs trips the alert; lie-low drops heat without lowering alert; scrub lowers alert.
- **PR** (rebase onto current origin/main first — it advanced to a54633e / #268 during the session).

## Next arc (captured in docs/design/flow-subversion.md)
Verb variants (SWEEP/meticulous, parallel/serial xploit) — where probe-heat's cost becomes central —
and flows-as-scouting. Heat is the shared cost model that makes those bite.
