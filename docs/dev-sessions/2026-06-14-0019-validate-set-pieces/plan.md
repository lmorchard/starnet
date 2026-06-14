# Plan — `validateSetPiece`

TDD throughout. Each check: write a unit test on a hand-built broken def first (red), implement
the check (green), then confirm the clean catalog still passes. New files:

- `js/core/network/validate-set-piece.js` — the validator.
- `js/core/network/validate-set-piece.test.js` — unit tests (broken defs) + catalog sweep.

## Shared scaffolding (build first)

- `SetPieceError` typedef `{ pieceId, nodeId|null, check, message }`.
- `validateSetPiece(def) => { valid, errors }`. Internally: `declaredIds = new Set(def.nodes.map(n=>n.id))`;
  resolve each node's traits once (`resolveTraits`, wrapped in try/catch → emit an
  `unknown-trait` error instead of throwing); run each check, push errors.
- Small helpers: `walkConditions(cond, fn)` (recurse all-of/any-of/not), `walkEffects(effects, fn)`,
  iterate every operator/action/trigger (graph-level def.triggers + per-node resolved triggers).
- Import `CORE_NODE_VERBS` from `../actions/scripts.js`, `nullCtx` from `../node-graph/ctx.js`,
  `resolveTraits`/`getTrait` from `../node-graph/traits.js`, `instantiate` from `./set-pieces.js`,
  `NodeGraph` from `../node-graph/runtime.js`, `mockCtx` from `../node-graph/ctx.js`.
- Valid ctx methods = `new Set(Object.keys(nullCtx))`.

## Phase A — static reference checks (1, 2, 3)

Cheap walks over the raw def. Build broken defs (edge to "ghost", port to "ghost", all-of input
"ghost") → assert one error each with the right `check`/`nodeId`. Implement. Catalog passes.

## Phase B — destinations-edge (4)

Broken def: an operator with `destinations:["other"]` but no `internalEdges` linking the two
→ error. A def *with* the matching edge → no error. Implement (declared-node + edge-pair check).
Catalog passes (vacuous).

## Phase C — core-verb-shadow (5)

Broken def: node `traits:["lootable"]` + authored `actions:[{id:"fetch",...}]` → error (mirrors
#153). Control: node with authored `id:"fetch-vault"` → no error; `encrypted` trait's `dump`
override resolved on a node → no error (we inspect raw authored actions, and the override lives
in trait code). Implement: for each node, `provided = union(getTrait(t).actions ids)`; flag
authored action whose id ∈ CORE_NODE_VERBS ∩ provided.

## Phase D — ctx-method (6)

Broken def: `ctx-call` with `method:"notARealMethod"` → error; operator `{name:"report",
call:"nope"}` → error. Control: `recordMonitorAlert`, `startTrace`, `giveReward`, `log` → no
error. Implement: walk all resolved operators (`.call`) + all effects (`ctx-call`.method) in
actions and triggers; check membership in the ctx-method set.

## Phase E — quality-read-without-write (7)

Broken def: trigger `when: quality-gte name:"never-written"` → error. Control: a piece that
writes via `quality-delta` and reads via `quality-gte` → no error; `${quality:x}` log-template
read with a matching write → no error; `quality-from-attr` dynamic read → no error (exempt).
Implement read-set vs write-set over the whole piece. Then add write-without-read in the same
pass; run the catalog — if it stays green keep it as an error, else downgrade that direction to
a skip with a note in the code + notes.md (per spec Open Questions).

## Phase F — enabled-attr (8)

Broken def: operator `enabledAttr:"ghostAttr"` with no such attribute → error. Control:
`enabledAttr:"counterEnabled"` with the attribute in `attributes` → no error; an attr set only by
a `set-attr` effect → no error. Implement attr-availability set per node (resolved attributes ∪
self set-attr attrs ∪ set-node-attr targets).

## Phase G — watchdog-armed (9)

Broken def: watchdog operator, not armable, no clock feeder reaching it → error. Controls: the
`deadman-circuit` shape (clock → relay → watchdog, not armable) → no error; `cascade-shutdown`
shape (armable:true) → no error. Implement: for each watchdog node, pass if `armable:true` or
BFS over undirected internalEdges from the watchdog reaches a node with a `clock` operator.

## Phase H — namespace-leak (10, instantiated)

Instantiate a hand-built def whose authored reference would survive only if instantiate rewrites
it (we *use* the real instantiate, so the positive control is "every catalog piece instantiates
clean"). Broken control: a def referencing a nodeId not declared in the piece → after
instantiate the prefixed ref points at a non-existent `prefix/ghost` → leak error. Implement:
instantiate(def, "v"), then walk the rewritten reference sites; every internal nodeId ref must
start with `"v/"` AND resolve to an instantiated node id; every prefixed quality name must start
with `"v/"`; dynamic `quality-from-attr` names exempt.

## Phase I — reachability (11, static)

Do it statically on the raw def (no instantiate needed): roots = `ports[].nodeId ∪ externalPorts`
(dedup); BFS undirected over `internalEdges`; every non-`scatter` node must be reached. Broken
def: a declared non-scatter node with no edge to it and not a port → error. Controls:
`scattered-key-vault-*` (scatter key-servers, no edges) → no error; `combination-lock` → no error.

## Phase J — no-trace-at-init (12, behavioral)

Compute `MAX_TICKS` = comfortably past the largest `period`/`periodTable` value across the
catalog (survey says key-gen clock F=150, deadman watchdog F=80 → use 300). For each piece:
`inst = instantiate(def, "t")`; `ctx = mockCtx()`; `new NodeGraph(inst, ctx)`; `tick(MAX_TICKS)`
with no player action / no injected message; assert `ctx.calls.startTrace === undefined`. Broken
def for the unit test: a watchdog with no feeder and not armable, wired to an alarm-latch +
startTrace trigger → ticking fires startTrace (this is the #215 reproduction in miniature).

## Phase K — catalog sweep test

One `describe` that builds `ALL = { ...SET_PIECES, ...ATOMICS, ...BACKBONE_PIECES }` and, per
piece, asserts `validateSetPiece(def).valid` with a failure message listing the structured
errors. Plus dedicated catalog-wide `it`s for reachability (#11) and no-trace (#12) so a failure
names which check broke. Iterate the catalog objects (auto-covers future biomes).

## Phase L — finish

- `make check` (tsc + tests) green; fix any type/lint issues.
- BOT-PLAYER.md / MANUAL.md: no change — no game mechanic changed; this is author-tooling,
  player-invisible. (Confirm in retro.)
- No new make target — `make check` already runs it.
- notes.md summary; PR.

## Risks / watch-items

- **Trait registration**: `resolveTraits`/`getTrait` need traits registered — importing
  `traits.js` (or `runtime.js`) does that at module load. Import it in the validator.
- **Write-without-read** may false-positive → downgrade per Phase E.
- **#12 deadman**: relies on the internal heartbeat keeping the watchdog alive at default grade
  (clock period < watchdog period). If it trips, that's either a real latent bug to surface
  (per the issue's intent) or a ticking artifact — investigate, don't paper over.
- **Worktree paths**: this worktree is under `.claude/worktrees/validate-set-pieces` — use full
  paths for Read/Edit/Write (per project memory).
