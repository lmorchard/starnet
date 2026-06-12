# Plan — ECG health-degradation cascade

**Goal:** Port the locked ECG cascade from the lab into `js/ui/waveform.js` `ecgPoints`.

**Approach:** One slice — rewrite `ecgPoints` to layer the cascade onto the existing PQRST(+U),
keep/extend tests, browser-verify. Geometry is locked in `lab/waveform-lab.html`.

---

## Phase 1: Port ecgPoints cascade + tests + verify

**Files:**
- Modify: `js/ui/waveform.js` — rewrite `ecgPoints`. Add: `severity = 1-frac`; ST elevation on
  J point + ST segment; T flatten→invert; QRS widening (Q/S offsets); per-beat PVC and
  dropped-beat branches; a `frac<0.07` ventricular-fibrillation early-return (chaotic
  sum-of-sines → the existing `frac<=0` flatline). Keep the `({frac,width,height})` signature
  and the module's `clamp`; port the lab's `Math.abs(Math.sin(seed))` per-beat rolls to
  `hash01(seed)`. Update the JSDoc to describe the cascade. Leave `pulsePoints`/`sampleY`/
  `pointsToPath` untouched.
- Modify: `js/ui/waveform.test.js` — existing ecg tests are generic (flat@0, visible spikes@1,
  bounds, ascending x, determinism, beat-count-vs-damage) and should still pass; fix any that
  assumed the old structure. Add cascade assertions: at low frac the ST segment sits above mid
  (elevation) and the T region dips below mid (inversion); `frac` just above 0 (e.g. 0.04, in
  the VF band) yields a non-flat chaotic trace (> baseline deviation) that is NOT the 2-point
  flatline; determinism across the cascade.
- Modify: `MANUAL.md` — extend the HEALTH/ECG description to note that the trace degrades through
  ECG-style abnormalities (ST/T changes → ectopy/dropped beats → fibrillation) as health falls.

**Verification — automated:**
- [ ] `make lint` passes
- [ ] `make test` passes (`node --test js/ui/waveform.test.js` green; full suite green)

**Verification — manual:**
- [ ] `make bundle-vendor`; serve the worktree; scrub the HEALTH slider in `/preview.html` (and
  the `/` HUD strip): clean PQRST → subtle ST/T → PVCs + dropped beats + wide QRS → VF flutter
  below ~7% → flatline at 0. No console errors.
