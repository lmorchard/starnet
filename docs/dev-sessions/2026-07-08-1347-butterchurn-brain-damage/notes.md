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

### Env note

- butterchurn requires **WebGL2** (the game's health-plasma is WebGL1). Confirmed working in
  Les's browser. Pinned to stable `butterchurn@2.6.7` / `butterchurn-presets@2.4.7` via esm.sh
  (`@3` is beta-only).
