# Plan — overlay progress smoothing

**Goal:** Opt-in render-cadence/progress-update decoupling in `NodeOverlay`, applied to the
three continuous-motion overlays.

**Approach:** One slice — pure easing helper + base-class opt-in rAF + adopt in three overlays.

---

## Phase 1: Easing helper + NodeOverlay opt-in + adopt + verify

**Files:**
- Add: `js/ui/overlays/ease.js` — `easeToward(current, target, dtMs, tauMs)` (pure, no deps).
- Add: `js/ui/overlays/ease.test.js` — converges, stays between current/target, monotone
  approach, frame-rate independence (2×8ms ≈ 1×16ms within tolerance), identity at current==target.
- Modify: `js/ui/overlays/node-overlay.js` — add `_smoothing`/`_tau`/`_displayProgress`/`_raf`/
  `_lastFrame` fields; `enableProgressSmoothing(tauMs = 120)`; `get displayProgress()`
  (returns `this.progress` when smoothing off, eased value when on); an rAF loop using
  `easeToward` that re-renders each frame and self-stops on convergence; `sync()` starts/keeps
  the loop and snaps `_displayProgress` on a new target node; `clear()` cancels the rAF. When
  smoothing is off, the `sync()`/`reposition()` render path is unchanged.
- Modify: `js/ui/overlays/mine-scan.js` — `enableProgressSmoothing(120)` in ctor; `_render`
  reads `this.displayProgress`.
- Modify: `js/ui/overlays/probe-sweep.js` — add ctor `enableProgressSmoothing(120)`; `_render`
  reads `this.displayProgress`.
- Modify: `js/ui/overlays/exploit-brackets.js` — `enableProgressSmoothing(120)` in ctor;
  `_render` + `_tickZaps` read `this.displayProgress`.

**Verification — automated:**
- [ ] `make lint` passes
- [ ] `make test` passes (new `ease.test.js` green; full suite green)

**Verification — manual (browser, real game — smoothness is motion, not a screenshot):**
- [ ] `make bundle-vendor`; serve; in a run trigger PROBE, XPLOIT, and a MINE scan via the
  console; confirm each overlay still renders correctly, animates smoothly (no 10 fps lurch),
  and no console errors. Confirm `clear()` hides them (no lingering rAF/ghost).
- [ ] Sanity: with smoothing off (any non-adopted overlay, e.g. ice-detect) behavior unchanged.
