# Notes: Scattered Set-Pieces (Companion Piece System)

## Session Retro

### What Was Delivered

Full implementation of the scattered set-piece system:

1. **`scatter: true` attribute on NodeDef** — generator-only flag, runtime ignores it
2. **`log-template` effect** — `${quality:name}` substitution in log messages,
   with proper prefix rewriting during instantiation
3. **7 scattered piece variants** — scatteredLock (1/3/5), scatteredKeyVault (2/3),
   scatteredEncryptedVault (2/3)
4. **Two-pass generator** — pass 1 separates core/scattered nodes, pass 2 places
   scattered nodes in gate-free slots via free ports or leaf replacement
5. **Bot puzzle heuristic** — generic "execute available actions on owned nodes"
   with dedup tracking to prevent action spam
6. **Card flicker fix** — hand pane caches state key, skips redundant innerHTML
7. **Legacy cleanup** — removed Dependency typedef, added scatter to NodeDef

10 commits on branch, 542 tests passing, lint clean.

### What Diverged from Plan

- **Leaf node replacement** (Phase 7 bug-driven). The original plan only placed
  scattered nodes on unused outbound ports. Testing revealed that most ports are
  consumed during pass 1, leaving nowhere for scattered nodes. Les suggested
  replacing leaf filler nodes (workstation/fileserver) with scattered nodes —
  this dramatically improved success rates (86% → 100% default, 48% → 98% F/B/B/C).

- **Gate-free computation redesign** (Phase 4). The original spec said "don't
  place behind gate-tagged pieces." In practice, nearly every piece below the
  spine has the `gate` tag (routers, firewalls) — making almost no slots
  available. Changed to only block on *puzzle* gates (pieces with `concealed`
  or `scatter` nodes), not regular hackable gates.

- **Orphan scatter obligation cleanup** (Phase 7). When a core piece couldn't
  wire to its parent (no outbound port), it was removed from `pieces` but the
  scatter obligation survived, causing orphan scattered nodes. Fixed by removing
  the obligation alongside the core.

- **Filler exclusion** (Phase 7). The opportunistic filler path lacked scatter
  separation logic, so scattered pieces placed as fillers had all nodes
  co-located with no edges. Fixed by excluding scattered pieces from filler.

- **Card flicker fix** — unplanned, found during manual playtesting. Not caused
  by this session's changes — pre-existing issue with innerHTML replacement on
  every STATE_CHANGED event.

- **Network branching observation** — noted as a general procgen issue, deferred.

### Key Insights

- **Leaf replacement is the key enabler.** Without it, scattered pieces only
  work in networks with spare outbound ports, which is rare after the main fill.
  Replacing cheap leaf nodes is a simple, budget-neutral strategy that makes
  scatter placement reliable.

- **"Gate-free" needs a narrow definition.** The `gate` tag is overloaded —
  routers and firewalls are `gate`-tagged (player must hack to pass) but they're
  not deadlock risks. Only puzzle gates (concealed vaults, scattered cores)
  create actual deadlocks. The scatter placement rule needs to distinguish these.

- **Builder functions with JSDoc type casts are verbose.** The `makeScatteredLock`
  function needed `/** @type {const} */` casts on every condition/effect object
  to satisfy tsc. This is a pain point of JSDoc @ts-check — TypeScript infers
  `{ type: string }` instead of `{ type: "node-attr" }` from computed builder
  output. Might be worth a shared helper or loosening the type union.

- **Spec review iterations paid off.** Three review passes caught: gate-ness is
  piece-level not slot-level (ordering problem), NodeDef typedef needed updating,
  bot player didn't know about puzzle actions, cost accounting needed specifying,
  orphan obligation edge case. All of these would have been bugs during
  implementation.

- **The bot's puzzle heuristic needs dedup.** Without tracking completed actions,
  the bot spams repeatable actions (scan-lock, recalibrate) every turn. The
  `completed` set in puzzles.js fixes this but it's module-level state that
  needs explicit reset between runs.

### Efficiency Notes

- Quick session — brainstorm through execution in one sitting
- ~45 conversation turns
- 10 commits, 7 plan phases executed
- Heavy use of generation stress testing (50-100 seed runs) to validate
  success rates — essential for catching scatter placement failures
- The spec brainstorm (8 questions) and 3 review passes front-loaded the
  design work, making execution mostly mechanical

### Process Improvements

- **Add a `make gen-stress` target** that runs 100 seeds across several specs
  and reports success/failure rates. Would have caught the 86% regression faster.

- **Network topology visualization** — hard to tell from text output whether
  switches are actually scattered. A simple ASCII tree dump would help during
  development. The `--summary` flag on `generate-network.js` could show the
  edge graph.

- **More outbound ports on set-pieces** — the branching observation is a real
  issue. Long linear paths make networks feel like corridors. Adding optional
  outbound ports to existing pieces would create more branching without new
  piece types. Track as a follow-up.

### Follow-Up Items

- **Network branching** — add more outbound ports to existing pieces, or create
  dedicated branching pieces. Long unbranching paths noticed while playtesting
  scattered networks.

- **Scatter groups** — pairs of nodes scattered as a unit (from spec future
  directions).

- **Placement preferences** — author-controlled hints for scatter placement
  depth/distance.

- **Dynamic scatter count** — generator picks N switches based on network size
  instead of fixed variants.

- **JSDoc builder type ergonomics** — the `/** @type {const} */` pattern in
  builder functions is noisy. Consider a helper or type relaxation.
