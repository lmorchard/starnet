# Plan — ParticlePool (jank sweep B)

**Goal:** Extract a tested particle-lifecycle core; migrate loot-rings + graph-degradation onto it.

**Approach:** Core first (TDD), then the two consumers, each browser-verified.

---

## Phase 1: ParticlePool core (TDD)

**Files:**
- Add: `js/ui/particle-pool.js` — `class ParticlePool { add(p); tick(now); clear(); get size }`.
  Particle = `{ until, update?(now), restore?() }`. No DOM/cy/rAF.
- Add: `js/ui/particle-pool.test.js` — update called while live; restore called + particle culled
  at `now >= until`; survivors kept; `clear()` restores all + empties; `size` reflects live count;
  particles without update/restore don't throw.

**Verify:** `node --test js/ui/particle-pool.test.js` green; `make lint`.

## Phase 2: Migrate loot-rings

**Files:**
- Modify: `js/ui/overlays/loot-rings.js` — add a `ParticlePool` field; `_spawn(now)` creates the
  ring element and `pool.add({ until: now+LIFETIME, update(n){ resize+fade by age }, restore(){
  ring.remove() } })` instead of its own per-ring rAF; `_timeFrame(now,dt)` calls `pool.tick(now)`
  then the existing spawn-cadence accumulation; `clear()` calls `pool.clear()`. Cadence unchanged.

**Verify:** browser (preview) — rings spawn, expand, fade, and are removed; cadence denser at low
progress; `clear()` leaves no leftover polygons. No console errors.

## Phase 3: Migrate graph-degradation

**Files:**
- Modify: `js/ui/graph-degradation.js` — replace the module-level `particles` array + the inline
  live/cull loop in `applyDeckPerturbation` with a `ParticlePool` (`pool.tick(now)` for updates,
  `pool.add(...)` at spawn); `restoreDeck` uses `pool.clear()`. Keep `cy.batch`, the 30 Hz gate,
  budget spawning, and all `glitch*` factories untouched.

**Verify:**
- `graph-degradation.test.js` (teardown filter reset) green.
- Browser: drive deck low (cheat hurt deck), confirm glitches fire (shake/scramble/phantom), then
  heal and confirm **everything restores cleanly** (no stuck positions/styles/phantoms) — the pool
  `clear()`/restore path is the critical risk. No console errors.

## Phase 4: make check + final review
- [ ] `make check` green (full suite + lint)
- [ ] Confirm zaps (left as-is) still fire — no accidental change.
