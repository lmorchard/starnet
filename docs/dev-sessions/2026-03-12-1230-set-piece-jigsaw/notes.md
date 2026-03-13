# Session Notes: Set-Piece Jigsaw for Procedural Generation

## Phase 1 Retro (original session)

### What Was Delivered (vs Spec)

All 11 phases from the plan were completed:

0. Directory restructure — `js/core/network/` created, set-pieces moved
1. Metadata schema — Port, Dependency, BiomeDef, NetworkSpec typedefs
2. Annotate 15 existing set-pieces with tags, cost, ports
3. 5 atomic set-pieces (entry, router, firewall, workstation, fileserver)
4. Corporate biome catalog (25 pieces total)
5. Budget tables and grade utilities
6. Skeleton generator (pass 1)
7. Slot filler (pass 2)
8. Assembly + output (grade scaling, ICE, meta)
9. Validation + entry point with retry
10. Integration (bot CLI, playtest harness, browser UI)

Plus significant iteration:
- 5 scaled set-piece variants (largeServerBank, vaultCluster, defensePlex,
  fortifiedGate, dataCenter) to fill catalog gaps at C/B/A cost tiers
- Budget scaling improvements (adaptive multiplier, F-cost fallback)
- Orphan node prevention
- Piece diversity weighting
- Guaranteed tag placement (defense, puzzle) in skeleton
- minDepth for auto-start timer set-pieces
- Browser NEW RUN dialog with network type dropdown + budget grades

### Final Quality Metrics

- **Generation**: 100% success across all difficulty tiers (F through S)
- **Network size**: 11-29 nodes at default C/B/C/C spec
- **Bot win rate**: 63% at default, scales with difficulty (easy 67%, hard 33%)
- **Defense coverage**: 86% of B-threat networks have defense content
- **Piece diversity**: 7-9 unique piece types per network
- **All 523 existing tests pass**, hand-crafted networks unaffected

### What Worked Well

- **Skeleton-first was the right call.** The two-pass approach (skeleton → fill)
  gave us deliberate shape control and natural budget allocation. The frontier
  growth alternative would have needed extensive backtracking.

- **Iterative smoke-testing caught real problems.** The cascadeShutdown trace bug
  (watchdog firing before player could reach it) was found by actually playing a
  generated network. Unit tests wouldn't have caught that — it's an emergent
  interaction between set-piece timers and network topology.

- **The bot is an excellent quality signal.** Running the bot across 30 seeds
  revealed budget exhaustion, orphan nodes, and diversity problems that manual
  inspection would have missed. The 63% win rate at default difficulty is a
  good indicator that generated networks are actually playable.

- **Additive metadata worked.** Adding tags/cost/ports alongside existing
  externalPorts meant zero changes to hand-crafted networks. The generator
  reads the new fields; everything else ignores them.

### What Didn't Work Well

- **Budget arithmetic needed 3 iterations.** The initial 1.5x flat multiplier
  was too low for high specs. The slot filler had a local copy of the budget
  function that got out of sync. The budget system should have been designed
  with the full range of specs in mind from the start.

- **Orphan nodes were a systemic problem.** The slot filler placed pieces
  without checking if they could be wired, creating nodes with no edges.
  This should have been an invariant from the start: never add a piece
  unless you can wire it.

- **Tag matching was too loose.** The skeleton assigned tags, but the slot
  filler's fallback path could replace any tag with filler. This meant
  defense slots got filled with workstations at high specs. The guaranteed
  tag placement (ensureTagEarly) was a band-aid; better skeleton budget
  awareness would be a cleaner fix.

- **Auto-start timers are hostile to procgen.** The cascadeShutdown and
  deadmanCircuit watchdogs fire on game init regardless of player proximity.
  In hand-crafted networks this is fine (designer controls placement). In
  procgen, it creates unfair situations. The minDepth field is a workaround;
  ideally these set-pieces would activate on first player contact.

### Lessons

- **Run the bot early and often during generator work.** The bot found more
  bugs than manual testing. Make it part of the iteration loop, not a final
  check.

- **Budget systems need range testing.** Test the extremes (F/F/F/F and S/S/S/S)
  early, not just the default. The default worked fine; the extremes broke.

- **Set-pieces need procgen-awareness metadata.** Tags and cost aren't enough.
  minDepth was added mid-iteration. Future fields might include: maxCount
  (limit duplicates), activationMode (on-init vs on-contact), required
  neighbors (this piece needs a spine piece adjacent).

- **Diversity needs active enforcement.** Without the used-piece penalty, the
  generator would place 10 fileservers. Random selection from a small catalog
  naturally produces repetition. The 0.33x weight for already-used pieces is
  simple and effective.

---

## Phase 2 Retro (continuation session — 2026-03-12)

### Summary

Bug-fix and polish pass driven by hands-on playtesting of generated networks.
Roughly 2 hours, ~40 conversation turns. Two commits:

1. `4fcf1d3` — explicit traits on all set-piece nodes, remove createGameNode
2. `30dd50a` — concealed nodes, switch logging, vault reward action, tab-complete

### What Was Delivered

**Trait system cleanup:**
- Added explicit `traits` arrays to all 78+ nodes across 25 set-pieces in
  `corporate-pieces.js`. Every node now declares exactly what it is — no
  implicit type-based injection.
- Removed `createGameNode()` and `TRAITS_BY_TYPE` from `game-types.js`.
  All 8 call sites updated to use `instance.nodes` directly.
- Internal/puzzle nodes (alarm-latch, logic-gate, routing-switch, etc.) now
  get `["graded", "hackable", "rebootable"]` — players can hack circuit
  internals to subvert puzzles.

**gateAccess fixes:**
- Routers now require `compromised` to reveal neighbors (was defaulting to
  `probed`, showing everything on first scan).
- Firewalls require `owned` to reveal neighbors.

**Trigger fixes:**
- `combinationLock` and `switchArrangement` had broken `ctx-call revealNode`
  effects (passed undefined nodeId). Replaced with proper `reveal-node`
  effect which gets prefixed correctly during instantiate.
- Removed duplicate `alert-reached-monitor` trigger from `tamperDetect`
  (the `security` trait already handles alert escalation).

**Concealment system (new first-class pattern):**
- Added `concealed: true` attribute for nodes that should resist normal
  neighbor-reveal mechanics. `revealNeighbors()` skips concealed nodes.
- Puzzle triggers clear `concealed` then `reveal-node` to unlock access.
- Used by `combinationLock` vault and `switchArrangement` hidden-subnet.
- `revealNode()` no longer downgrades `accessible` → `revealed` (was
  clobbering already-navigated nodes).

**Vault reward redesign:**
- Moved `combinationLock` reward from trigger to `crack-vault` action
  (requires owned + opened, one-time use via `opened` reset).
- Removed `lootable` trait from vault (no read/loot — crack-vault is
  the interaction).

**Switch UX:**
- `activate` and `align` actions now log messages when executed.
- `activate` action disappears after use (`activated: false` requires).

**Tab completion + null safety:**
- `cheat own` and `cheat summon-ice` now tab-complete all nodes including
  hidden ones (`includeAll` flag on `fromNodes`).
- Fixed null `label` crash in `resolveNode` and `fromNodes`.

**Misc:**
- Makefile: added default `all` target (npm install + bundle-vendor).
- Graph zoom: `wheelSensitivity` increased to 1.0.

### What Diverged from the Original Plan

This entire phase was unplanned — it emerged from hands-on playtesting.
The original session was "done" after Phase 1. This continuation was
driven by Les playing a generated network and finding real UX/behavior
issues.

The `concealed` attribute was an emergent design discovery: the set-piece
system had no way to say "this node should stay hidden even when its
neighbors are owned." The existing `visibility: hidden` was overridden
by normal neighbor-reveal mechanics. `concealed` is a distinct concern
from visibility — it's a puzzle lock on discoverability.

The `createGameNode` removal wasn't in any plan — it fell out naturally
once all nodes had explicit traits.

### Key Insights

- **Playtesting generated networks reveals different bugs than playtesting
  hand-crafted ones.** The `gateAccess` default (`"probed"`) was fine when
  the designer controlled placement. In procgen, every router immediately
  exposed the entire subtree on first probe — breaking puzzle pacing.

- **`concealed` is a first-class game pattern, not a one-off fix.** Gating
  exploration is a core mechanic: "solve puzzle X to discover node Y."
  This needs to be a documented, reliable pattern that set-piece authors
  can use. Current users: combinationLock vault, switchArrangement
  hidden-subnet. Future: any puzzle that gates access to deeper network.

- **Trigger effects need careful prefix awareness.** `ctx-call` effects
  don't get their args prefixed during `instantiate()`. `reveal-node` and
  `set-node-attr` DO get their `nodeId` prefixed. Using the wrong effect
  type produces silent failures. This is a footgun worth documenting.

- **Removing dead code has compounding value.** `TRAITS_BY_TYPE` →
  `createGameNode` → all the `.map(createGameNode)` call sites — each
  removal simplified the next. The codebase lost ~40 lines of indirection
  with zero behavior change.

### Efficiency Notes

- ~40 conversation turns over ~2 hours
- Heavy use of headless playtest harness for verification — much faster
  than browser testing for this kind of work
- The `cheat own` command was essential for quickly navigating deep into
  generated networks during testing
- Context window compacted once mid-session (conversation summary preserved
  continuity well)

### Process Improvements

- **Document the `concealed` pattern in CLAUDE.md or MANUAL.md** as a
  supported set-piece mechanism. Set-piece authors need to know about it.

- **Add a playtest smoke test to the Makefile** — something like
  `make playtest-smoke` that resets a generated network and runs basic
  commands. Would have caught the gateAccess bug automatically.

- **The trigger effect prefix rules should be documented.** Which effects
  prefix their nodeId args and which don't is non-obvious. A table in
  CLAUDE.md or a code comment in `set-pieces.js` would prevent future
  `ctx-call` vs `reveal-node` confusion.

### Follow-Up

- **Companion pieces / scattered switches**: Design a system where
  set-pieces can require companion pieces placed elsewhere in the network.
  Uses quality-based communication (already works) + slot-filler
  coordination (new — "reservation" mechanism for companion slots).
  This is the `requires` field from the spec, finally getting implemented.
  **Track as a new session.**

- **Document `concealed` pattern** in MANUAL.md and/or CLAUDE.md.

- **Audit other set-pieces for similar gateAccess / concealment needs.**
  Any piece with a "hidden reward" node connected to hackable nodes may
  have the same premature-reveal problem.

- Items carried forward from Phase 1:
  - S-tier set-pieces
  - Activation-on-contact for timer pieces
  - Census rebuild
  - More biomes
  - PROCGEN.md rewrite
