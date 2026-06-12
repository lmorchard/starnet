# Plan — deck-pulse → symmetric CPU clock

**Goal:** Port the locked symmetric-clock `pulsePoints` from the lab into `js/ui/waveform.js`.

**Approach:** One vertical slice — rewrite `pulsePoints`, keep/extend tests, verify in
browser. Geometry is locked in `lab/waveform-lab.html`; this is a faithful port.

---

## Phase 1: Port pulsePoints + tests + verify

**Files:**
- Modify: `js/ui/waveform.js` — replace the `pulsePoints` body (the double-pulse + peaks
  loop) with the symmetric-clock geometry from `lab/waveform-lab.html`. Keep the
  `({frac,width,height})` signature, `clamp01`, and the module's clamp helper; swap the
  lab's `Math.abs(Math.sin(seed))` plateau-noise hashing to `hash01(seed)`. Update the
  function's JSDoc to describe the clock.
- Modify: `js/ui/waveform.test.js` — the existing pulse tests are generic (flat@0,
  substantial amplitude across frac, ascending x, in-bounds, determinism) and should still
  pass; update any that assumed the old structure. Add an assertion or two for the clock:
  e.g. `frac:1` produces overshoot points beyond `hi`/`lo` (max deviation > amplitude), and
  amplitude is roughly symmetric about mid.
- Modify: `docs/dev-sessions/2026-06-11-1315-vital-waveforms/lab/waveform-lab.html` — refresh
  the canonical lab artifact to the current (clock) state so it matches shipped behavior.

**Key changes:**
- New `pulsePoints`: `hi=mid-amp`, `lo=mid+amp`; `CYCLES=4`, `half=W/(CYCLES*2)`; an `edge()`
  helper emitting departing+arriving overshoot micro-pulses (held flat → squares) + damped
  ring; alternating plateaus with ragged-under-damage noise. (Verbatim from the lab.)

**Verification — automated:**
- [ ] `make lint` passes
- [ ] `make test` passes (`node --test js/ui/waveform.test.js` green; full suite green)

**Verification — manual:**
- [ ] `make bundle-vendor`; serve the worktree; `/preview.html` deck waveform shows the
  symmetric clock with squared edge overshoots; scrub the deck slider → ringing + ragged
  plateaus grow with damage; `/` HUD deck strip matches. No console errors.
