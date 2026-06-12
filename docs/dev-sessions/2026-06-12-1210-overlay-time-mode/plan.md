# Plan — overlay time mode (jank sweep A)

**Goal:** Managed, disconnect-safe time loop in `NodeOverlay`; convert `loot-rings` + zaps onto it.

**Approach:** One slice — add the loop to the base, adopt in the two overlays, browser-verify.

---

## Phase 1: NodeOverlay time loop + adopt + verify

**Files:**
- Modify: `js/ui/overlays/node-overlay.js`
  - Fields: `_timeRaf = null`, `_timeLast = 0`.
  - `startTimeLoop()` — idempotent; kicks the rAF. `stopTimeLoop()` — cancels + resets.
  - `_timeFrameLoop(now)` — compute `dt` (seed 16ms on first frame), call `_timeFrame(now, dt)`,
    reschedule unless the hook stopped it.
  - `_timeFrame(now, dtMs)` — empty subclass hook (documented).
  - `disconnectedCallback()` and `clear()` also call `stopTimeLoop()`.
- Modify: `js/ui/overlays/loot-rings.js` — drop `_timer`/`_tick`/`setTimeout`; `sync()` calls
  `startTimeLoop()`; add `_timeFrame(now, dt)` accumulating toward `SPAWN_MIN_MS +
  progress*SPAWN_PROGRESS_MS`, spawning + resetting the accumulator when due; `clear()` calls
  `stopTimeLoop()` (drop the manual timer clear). Per-ring expansion rAF unchanged.
- Modify: `js/ui/overlays/exploit-brackets.js` — drop `_zapIntervalId`/`setInterval`; `_startZaps`
  → `startTimeLoop()`, `_stopZaps` → `stopTimeLoop()` + zap-hide; move `_tickZaps` body into
  `_timeFrame(now, dt)` accumulating ms toward a 30–90 ms gap. Keep the smoothing loop for the
  brackets; both stop on clear/disconnect.

**Verification — automated:**
- [ ] `make lint` passes
- [ ] `make test` passes (full suite green — no regression)

**Verification — manual (browser, real game — DOM/cy-coupled, no node unit tests):**
- [ ] Instantiate `loot-rings-overlay`: feed `sync()` over time, confirm rings spawn at the
  expected cadence (denser at low progress), then `remove()` (no `clear()`) → time loop stops
  (`_timeRaf === null`), no orphaned rAF, no console errors.
- [ ] Instantiate `exploit-brackets-overlay`: confirm zaps fire while synced; `remove()` stops
  the loop; brackets still converge/rotate (smoothing intact).
- [ ] Sanity: a normal probe/xploit/fetch in a live run still shows the effects unchanged.
