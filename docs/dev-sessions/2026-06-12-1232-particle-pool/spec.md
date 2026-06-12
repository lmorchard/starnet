# ParticlePool — shared particle-lifecycle core (jank sweep B)

**Goal:** Second slice of the jank-elimination sweep (#179, part B). Three places hand-roll a
"spawn short-lived animated things, age them, clean them up" loop: `graph-degradation` glitches,
`loot-rings` ripples, `exploit-brackets` zaps. Extract the shared *lifecycle* into one tiny,
tested core and migrate the consumers that fit it cleanly.

**Source:** #179 part B. Builds on the time loop added in A (#183).

## Key finding

`graph-degradation` already uses the exact model a shared pool would provide: every glitch is a
`{ until, update?, restore }` and one loop (lines ~300–307) ages them — `now >= until ? restore()
: update?.(now)` — culling the dead. So the pool isn't a new abstraction imposed from outside; it's
**that proven pattern extracted** and shared.

## Scope (decided)

- **In:** a `ParticlePool` core + migrate `loot-rings` (SVG side) and `graph-degradation` (cy side)
  — two real consumers (SVG drawing vs Cytoscape mutation) proving the core is domain-agnostic.
- **Out:** `exploit-brackets` zaps — they're CSS-transition flashes (fire-and-forget, no per-frame
  JS lifecycle). Forcing them into the pool would be the square peg; left as-is.
- **Out:** the WebGL health-plasma layer (a shader, not particles).
- **Determinism:** not required — these are ephemeral visual flourishes (not game state, exempt).
  `Math.random` spawn jitter stays; the pool's *lifecycle* is what's tested, not the randomness.

## Desired end state

- `js/ui/particle-pool.js` — `class ParticlePool` with `add(p)`, `tick(now)`, `clear()`, `size`.
  A particle is `{ until:number, update?(now), restore?() }`. `tick`: for each particle, if
  `now >= until` call `restore?.()` and drop; else `update?.(now)` and keep. `clear`: `restore?.()`
  all, then empty. Pure — no DOM, no Cytoscape, no rAF (the caller owns the loop). Domain-agnostic:
  SVG effects mutate elements in update/restore; graph-degradation mutates cy.
- `js/ui/particle-pool.test.js` — lifecycle coverage (update-while-live, restore+cull-on-expiry,
  clear restores all, size, missing update/restore are fine).
- `loot-rings`: each ring becomes a pool particle (`update` = resize + fade by age, `restore` =
  remove element). The per-ring `requestAnimationFrame`s are gone; the pool is `tick`ed from the
  `_timeFrame` time-loop added in A. Spawn cadence unchanged.
- `graph-degradation`: its module-level `particles` array + inline age/cull loop + `restoreDeck`
  loop become a `ParticlePool` (`add`/`tick`/`clear`). Spawning, budget, `cy.batch`, and the
  30 Hz gate are unchanged. Behavior identical.

## Design decisions

- **Extract graph-degradation's model, don't invent one.** It's the most-evolved of the three;
  its `{until,update,restore}` shape becomes the core verbatim.
- **Pool owns lifecycle, not the loop.** No rAF inside the pool — the caller ticks it (loot from
  the A time-loop, graph-degradation from its existing rAF). Keeps it pure/testable and lets each
  consumer keep its own cadence/gating.
- **Leave non-fitting effects alone.** Zaps stay CSS; not every effect must be a particle.

## What we're NOT doing

- Not changing visuals/cadence/determinism of any effect (pure refactor).
- Not migrating zaps or the plasma shader.
- Not building physics (velocity/forces) — particles are timed sprites, nothing more.

## Verification

- `make check` green; new `particle-pool.test.js` passing; `graph-degradation.test.js` (teardown)
  still green.
- Browser: loot rings still spawn/expand/fade at cadence and clean up; deck-degradation glitches
  (shakes, scrambles, phantoms) still fire and **fully restore on heal** (the critical risk — the
  restore path); no console errors; no orphaned particles after clear.

## Open questions
- None.
