# Notes — heat history strip ("Ember Scope")

## Summary

Added a third phosphor strip ("Ember Scope") to the HUD vitals stack that renders `state.heat`
over time as a stroke-only vector flame — issue #295. The existing heat *lamp* shows heat right
now; this shows its *trajectory* (rise toward the hidden alarm, decay after lying low).

Shipped:
- `js/ui/heat-flame.js` — pure, tested flame geometry (crown + fixed-gap contour bands,
  add-from-bottom, red-crown→yellow-base, index-keyed color + transparency).
- `<starnet-heat-scope>` — thin canvas component reusing the `<starnet-waveform>` sweep+phosphor
  plumbing over the pure geometry. Wired into the preview harness (heat/speed/gap/bloom sliders).
- Mounted in `#vital-stack` between DECK and VISIT WAN; `syncVitals` drives `frac` from
  `state.heat / HEAT_GAUGE_MAX` (shared scale with the lamp; the alarm threshold stays hidden —
  no trip line shown).
- `cheat hurt heat <amount>` / `cheat heal heat [amount]` for manual testing (real
  recordHeat / decayHeat pathways).
- MANUAL.md updated (the heat section now describes both gauge and strip).

## Process notes

- **Feel-driven work → prototype first.** The look was dialed in live in a throwaway slider lab
  (`heat-strip-lab.html`, kept in this dir as the tuned reference) before any production code. The
  design went through several turns with Les: dense-fill → discrete chunky lines; even-redistribute
  → fixed-gap add-from-bottom; orange→ red→yellow palette; a visible idle baseline at heat 0 that
  keeps a subtle shimmer (deliberately NOT dead-flat — Les overrode a Copilot suggestion to flatten
  it); sweep speed synced to the vitals (100 px/s). Seeing beat specifying.
- **Component is a documented TDD opt-out** — canvas/RAF/dpr plumbing with no logic beyond the
  pure module (`getContext` isn't available under `node:test`). Verified via headless-Chrome
  screenshots (frac 0 / low / high + zoom) instead; the geometry carries the unit tests.

## Tuned defaults (starting values; fine-tune in-game)

band gap 4px · max bands 12 · jaggedness 0.5 · lower-band transparency 0.6 · sweep 100 px/s ·
trail 0.9 · bloom 6. Y-scale = `HEAT_GAUGE_MAX` (12).

## Follow-ups / possible later

- If the sweep bookkeeping duplicated between `<starnet-waveform>` and `<starnet-heat-scope>` ever
  grows, extract a shared scope-sweep helper (deliberately deferred — small duplication).
- Heat trail left at 0.9 (vitals are 0.72) for a slightly longer flame persistence — flagged to
  Les; keep unless it reads out of place.

## Verification

`make check` green (1394 tests, lint clean). `make census SEEDS=10` 10/10 (pure-UI change, bot
path untouched). Live in-game confirmation via `cheat hurt/heal heat`.
