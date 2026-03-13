# Session Notes: Set-Piece Jigsaw for Procedural Generation

## Session Retro

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

### What's Left / Follow-Up

- **S-tier set-pieces**: No S-cost content exists. These would be complex
  multi-node centerpiece puzzles — worth a dedicated design session.

- **Activation-on-contact**: Timer set-pieces (watchdog, clock) should ideally
  not fire until the player enters their subnet. This is a game engine change
  (proximity-triggered init) not a generator change.

- **Long-range dependencies**: The `requires` field exists in the schema but
  no set-piece uses it yet. The multiKeyVault is the candidate for testing
  distributed key placement.

- **Census rebuild**: Batch balance testing across many seeds/specs. Separate
  session, builds on bot + generator.

- **More biomes**: The schema supports multiple biomes. A residential,
  military, or research biome would be a new set-piece catalog + default
  budget profile.

- **PROCGEN.md update**: The old procgen doc describes the deleted layer
  processor. Should be rewritten to document the jigsaw system.
