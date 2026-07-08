# Notes — Butterchurn brain-damage overlay (exploration)

## Lab A — aesthetic checkpoint (PASSED)

**Verdict on the core question:** ✅ Yes — composited over the vector UI, butterchurn
reads as *intentional brain-damage / meat bleeding through*, not garbage bolted on.
Les's words: "surprisingly great as a first stab." The clash lands as the fiction intends.

### Findings

- **Opacity** — works as the ambient-bed knob.
- **Blend mode** — `screen` or `normal` both read well.
  - `normal` is acceptable *and arguably desirable*: obscuring the vector UI is part of the
    impairment fiction, so we don't mind the animation covering things. Prefer `normal` if it
    performs better.
  - **Interaction found:** with `normal` blend, the **severity** ramp gets *too* impairing at
    the high end (UI swamped). With `screen`, the severity ramp reads better (glowing bleed-through
    that thickens without fully occluding).
  - **Implication for the port:** the severity→opacity curve is blend-dependent. Likely answer:
    ambient bed uses `screen` (graceful thickening); reserve heavier `normal`/full-takeover for
    peak shock / near-death beats. Or gentler/capped severity curve under `normal`.
- **Shock** — works well; the transient flare + synthetic bass-impulse punch reads as a hit.
  Envelope/gain/duration (`SHOCK_MS=900`, `FLARE_GAIN=0.6`) are in a good starting range.

### Design directions surfaced (deferred, not this spike)

- **Preset curation** — the butterchurn-presets pack is broad; some presets fit the wetware
  fiction, others read as generic rave visuals. Hand-curate a shortlist. Deferred.
- **Preset categorization by damage/interference type** — richer idea: map *kinds* of damage
  to *kinds* of presets. The game already has distinct channels (health severity, deck
  corruption, ICE detection, trace) — different preset families could signal each. This extends
  the hybrid drive's "preset selection" surface from a severity tier to a damage-*type* selector.
  A production/port concern, but a promising one — record for the port session.

## Lab B — discovery (grounded from code)

- **Ambient-bed source:** `degradationParams(getState())` (`js/ui/graph-degradation/params.js`)
  returns `{ health: { severity, overlayOpacity, ... }, deck: { severity } }`, reading
  `state.player.health {current,max}` and `state.player.deckIntegrity {current,max}`. This is
  the same source the existing plasma uses. Bed drives off `max(health.severity, deck.severity)`
  so either kind of impairment thickens it.
- **Shock trigger:** there is **no discrete damage event.** `damagePlayerHealth` /
  `damagePlayerDeck` (`js/core/player-orchestration.js`) just mutate state (and may end the run) —
  no `E.PLAYER_DAMAGED` emit. So Lab B **watches `player.health.current` and
  `deckIntegrity.current` frame-to-frame and fires a shock on a drop**, scaled to the drop size.
  This is ground-truth "wetware took damage" and — bonus — knows *which pool* dropped, feeding
  the preset-categorization-by-damage-type direction directly.
- **Audio tap:** confirmed no shared master node (sources connect straight to `ctx.destination`),
  so Lab B uses the non-invasive `AudioNode.prototype.connect` shim to fan a tap to an analyser.
  Production would instead add a single master `GainNode` (one-line game-source change, out of
  scope for the lab).

## Lab B — live-game checkpoint (in progress)

- **Works against the live game.** ✅ Mounts over `#cy`, panel drives it, shocks fire on
  cheat-`hurt` damage.
- **Perf: not significantly affected.** ✅ Continuous WebGL2 + feedback over `#cy` did NOT tank
  fps in Les's run — the big viability worry is resolved (no half-res fallback needed so far).
- **Shock reads well** over the live moving graph — as good as static Lab A.
- **Bug found + fixed:** the old WebGL1 health-plasma (`#graph-degradation-layer`, zIndex 5) kept
  running under butterchurn and mixed with it (both driven by the same severity). Since butterchurn
  is the plasma's *replacement*, Lab B now hides the plasma layer on load (restored via
  `window.__labB.teardown()`). Re-check clean.
- **Still to confirm:** does the `connect`-shim tap make butterchurn visibly react to the *live
  game audio* (vs. just rendering)? — the riskiest Lab B unknown.

### Env note

- butterchurn requires **WebGL2** (the game's health-plasma is WebGL1). Confirmed working in
  Les's browser. Pinned to stable `butterchurn@2.6.7` / `butterchurn-presets@2.4.7` via esm.sh
  (`@3` is beta-only).
