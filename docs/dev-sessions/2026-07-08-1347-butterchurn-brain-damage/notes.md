# Notes — Butterchurn brain-damage overlay (exploration)

## Session summary

Explored using butterchurn (WebGL Milkdrop) as the "organic brain-damage" overlay bleeding
through the vector-CRT graph on wetware damage. Built two reference labs (standalone aesthetic
proof + live-game hybrid-drive proof). **Outcome: GO** — the intentional aesthetic clash reads as
brain-damage, the hybrid drive (live audio + damage-delta shocks + severity bed) works end-to-end
against real gameplay, perf is acceptable, and butterchurn can replace the existing WebGL1 plasma.
No game source changed; productionization is scoped for a future port session (see VERDICT below).

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
- **Audio tap confirmed working.** ✅ The `connect`-shim tap catches the live signal — the
  visualizer is definitely moving to the game audio, not just idling on preset motion.
- **Replaces the plasma.** ✅ With the plasma hidden, butterchurn-alone carries the brain-damage
  effect — Les: "this can replace the plasma."

## VERDICT — GO

Both labs pass. Butterchurn is a viable **replacement** for the WebGL1 health-plasma as the
brain-damage overlay. The hybrid drive works end-to-end against real gameplay:
- live game audio → analyser (tap) → reactive texture ✅
- health/deck damage delta → synthetic bass-impulse shock ✅
- `degradationParams` severity → ambient-bed opacity ✅
- perf acceptable (WebGL2 + feedback over `#cy`, no significant fps hit) ✅

## Productionization notes (for the port session)

1. **Vendor** butterchurn + a curated preset set into `dist/` via esbuild (like cytoscape/lit).
   Mind bundle size — the full presets pack is large; ship only the curated subset.
2. **Clean audio tap:** add a single master `GainNode` in `js/audio/` (all sources → master →
   destination; analyser off master) instead of the runtime `AudioNode.connect` shim. Small,
   contained game-source change; also removes the "load early / long-lived nodes missed" caveat.
3. **Damage signal:** no discrete damage event exists today. Either keep the delta-watch or (cleaner)
   emit an `E.PLAYER_DAMAGED` (pool + amount) from `js/core/player-orchestration.js` — generally
   useful (SFX, etc.). Recommend adding the event.
4. **Port the drive** into `js/ui/graph-degradation/`: replace `health-plasma.js`'s shader path
   with a butterchurn-backed layer (retire the WebGL1 shader) and **remove/disable the plasma**
   (the labs showed they stack). Leave `deck-perturbation.js` alone (independent effect).
5. **Preset curation + categorization by damage type** (health / deck / ICE / trace) — the design
   direction Les liked. Categorized preset families signal *what kind* of impairment is happening.
6. **Blend/severity:** `screen` for the ambient bed (graceful thickening); reserve heavier
   `normal`/full-takeover for peak shock / near-death. Severity→opacity curve is blend-dependent.
7. **WebGL2 fallback:** butterchurn needs WebGL2 (plasma was WebGL1). Use `isButterchurnSupported()`;
   decide the no-WebGL2 fallback (keep a minimal plasma, or degrade gracefully to nothing).
8. **Preview harness:** add a butterchurn demo node to `preview.html` per the "new effects go in
   preview" rule.
9. **Licensing:** presets as separable **content** (wad) under the AGPL-engine / separable-content
   model — curated permissive subset or original presets. Resolve before ship.

## Lab index (reference artifacts)

- `lab-a.html` + `lab-a-boot.js` — standalone aesthetic proof (butterchurn over a graph screenshot,
  placeholder mp3, sliders). Open at `/docs/.../lab-a`.
- `lab-b.js` + `lab-b-README.md` — live-game hybrid-drive proof (devtools import into a running game).
- `lab-audio.mp3` — trimmed placeholder track. `graph-shot.png` — Lab A backdrop.


### Env note

- butterchurn requires **WebGL2** (the game's health-plasma is WebGL1). Confirmed working in
  Les's browser. Pinned to stable `butterchurn@2.6.7` / `butterchurn-presets@2.4.7` via esm.sh
  (`@3` is beta-only).
