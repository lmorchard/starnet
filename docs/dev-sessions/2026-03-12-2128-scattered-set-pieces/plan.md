# Plan: Scattered Set-Pieces (Companion Piece System)

## Overview

7 phases, building bottom-up: type changes + cleanup → log-template effect →
first scattered piece → generator scatter support → remaining pieces + biome
catalog → bot player → playtest + polish.

Each phase is testable independently and builds on the previous one.

---

## Phase 1: Type Changes + Legacy Cleanup

**Goal:** Add the `scatter` field to `NodeDef`, remove the unused `Dependency`
typedef, and establish the foundation all later phases build on.

**Why first:** Every subsequent phase reads or writes the `scatter` field.
Cleaning up `Dependency` now avoids confusion during implementation.

### Prompt 1.1: Add `scatter` to NodeDef typedef

In `js/core/node-graph/types.js`, add an optional `scatter` boolean field to
the `NodeDef` typedef:

```
@property {boolean} [scatter] - node is placed independently by the generator
```

This field is read by the generator during core/scatter separation. The
NodeGraph runtime ignores it.

**Verify:** `make lint` passes.

### Prompt 1.2: Remove legacy Dependency typedef

In `js/core/network/set-pieces.js`:

1. Remove the `Dependency` typedef (the `@typedef {Object} Dependency` block).
2. Remove the `@property {Dependency[]} [requires]` line from the `SetPieceDef`
   typedef.
3. Search for any imports or references to `Dependency` across the codebase and
   remove them.

**Verify:** `make check` passes. `grep -r "Dependency\|requires.*Dependency"` in
`js/` and `data/` returns no results.

---

## Phase 2: `log-template` Effect

**Goal:** Implement the new `log-template` effect type end-to-end: instantiation
rewriting, runtime execution, and tests. This is independent of the generator
changes and can be used by any set-piece.

### Prompt 2.1: Add `log-template` to rewriteEffect

In `js/core/network/set-pieces.js`, add a new case to `rewriteEffect()` for
`"log-template"`. The handler must parse the template string, find all
`${quality:name}` tokens, prefix each quality name with the instance prefix,
and return the rewritten effect:

```js
case "log-template": {
  const rewritten = effect.template.replace(
    /\$\{quality:([^}]+)\}/g,
    (_, name) => `\${quality:${pfx(name, prefix)}}`
  );
  return { ...effect, template: rewritten };
}
```

**Verify:** `make lint` passes.

### Prompt 2.2: Add `log-template` to applyEffect

In `js/core/node-graph/effects.js`, add a new case to `applyEffect()` for
`"log-template"`. The handler:

1. Takes `effect.template` string.
2. Replaces all `${quality:name}` tokens by calling `mutators.getQuality(name)`.
   Use `?? 0` for missing qualities (default to 0).
3. Logs the result via `mutators.ctx.log(resolved)`.

```js
case "log-template": {
  const resolved = effect.template.replace(
    /\$\{quality:([^}]+)\}/g,
    (_, name) => String(getQuality(name) ?? 0)
  );
  ctx.log(resolved);
  break;
}
```

Note: `getQuality` is already available in the `mutators` destructuring at the
top of `applyEffect`.

**Verify:** `make lint` passes.

### Prompt 2.3: Test log-template effect

Write tests in `js/core/node-graph/effects.test.js` (or a new co-located
test file if one doesn't exist):

1. **Rewriting test:** Call `rewriteEffect` on a `log-template` effect with
   quality references. Verify the quality names are prefixed correctly.
   Test with multiple quality references in one template.

2. **Runtime test:** Create a minimal NodeGraph with a node that has an action
   using `log-template`. Set up qualities, execute the action, verify `ctx.log`
   was called with the correct substituted string.

3. **Edge case:** Template with no quality references — should pass through
   unchanged. Quality that doesn't exist — should substitute `0`.

**Verify:** `make check` passes with new tests.

---

## Phase 3: First Scattered Piece — `scatteredLock3`

**Goal:** Author the first scattered set-piece (`scatteredLock3`) and write
unit tests proving the quality-based communication works in isolation (no
generator changes yet). This validates the authoring model before touching the
generator.

### Prompt 3.1: Author scatteredLock3 piece definition

In `data/biomes/corporate-pieces.js`, add a new `scatteredLock3` set-piece
definition. This is a quality-based version of `combinationLock` with 3
scattered switches:

**Scattered nodes** (3 switches, each `scatter: true`):
- Type: `routing-switch`
- Traits: `["graded", "hackable", "rebootable"]`
- Attributes: `{ accessLevel: "locked", activated: false }`
- Action: `activate` — requires `owned` + `activated: false`, effects:
  `set-attr activated true`, `quality-delta "locks-opened" 1`,
  `ctx-call log "Switch activated — routing signal sent"`

**Core nodes:**
- `gate` — type `logic-gate`, traits `["graded", "hackable", "rebootable"]`.
  Action: `scan-lock` — requires `owned`, effect:
  `log-template "Combination lock: ${quality:locks-opened}/3 switches activated"`
- `vault` — type `cryptovault`, traits `["graded", "hackable", "rebootable"]`,
  attributes `{ accessLevel: "locked", concealed: true }`.
  Action: `crack-vault` — requires `owned` + `quality-gte "locks-opened" 3`,
  effects: `giveReward 1500`, `set-attr opened false`,
  `ctx-call log "Vault cracked — ¥1,500 extracted"`

**Internal edges:** `["gate", "vault"]` only (switches have no edges).

**Trigger:** `vault-reveal` — when `quality-gte "locks-opened" 3`:
  `set-node-attr vault concealed false`, `reveal-node vault`,
  `log "Combination lock disengaged — vault accessible"`.

**Metadata:**
- `tags: ["puzzle", "treasure", "gate"]`
- `cost: "B"`
- `ports:` gate as inbound, vault as outbound (wantsTags treasure/filler)
- No entries for scattered nodes in ports (generator synthesizes them)

**Verify:** `make lint` passes.

### Prompt 3.2: Test scatteredLock3 quality communication

In `js/core/network/set-pieces.test.js`, add tests for `scatteredLock3`:

1. **Instantiate and verify prefixing.** Call `instantiate(scatteredLock3, "sl")`.
   Verify all node IDs are prefixed. Verify the trigger's quality reference is
   `sl/locks-opened`. Verify the switch actions reference `sl/locks-opened`.

2. **Quality communication in NodeGraph.** Create a NodeGraph with all 5
   instantiated nodes (core + scattered, all in the same graph — simulating
   what the generator would produce). Own all switches, activate all 3. Verify:
   - After 2 activations: `ctx.calls.revealNode` is undefined
   - After 3rd activation: vault is revealed, `concealed` cleared

3. **Scan-lock action.** Own the gate, execute `scan-lock`. Verify ctx.log
   was called with `"Combination lock: 0/3 switches activated"`. Activate
   one switch, scan again, verify `"1/3"`.

4. **Crack-vault action.** Activate all 3 switches, own the vault, execute
   `crack-vault`. Verify `giveReward` called with `[1500]`.

**Verify:** `make check` passes with new tests.

### Prompt 3.3: Author scatteredLock1 and scatteredLock5 variants

Add `scatteredLock1` (1 switch, cost D) and `scatteredLock5` (5 switches,
cost A) as variants. Same pattern as `scatteredLock3` but with different
switch counts and trigger thresholds. Add a quick sanity test for each
(instantiate + verify trigger threshold matches switch count).

**Verify:** `make check` passes.

---

## Phase 4: Generator Scatter Support

**Goal:** Teach the slot filler to handle scattered pieces: separate core from
scattered nodes during pass 1, compute gate-free attachment points, and place
scattered nodes in pass 2.

This is the core engineering work of the session.

### Prompt 4.1: Core/scatter separation in fillSlot

In `js/core/network/slot-filler.js`, modify the `fillSlot` function:

After `instantiate()` is called and the instance is created, check if the
chosen piece has any nodes with `scatter: true` (check the original piece
definition, since `scatter` is on the authored node, not the instantiated one).

If scattered nodes exist:
1. Separate `instance.nodes` into `coreNodes` (no scatter) and
   `scatteredNodes` (scatter: true). Use the original piece definition's node
   list to determine which IDs are scattered, then match by prefixed ID.
2. Filter `instance.edges` to only include edges where both endpoints are
   core node IDs.
3. Build the `PlacedPiece` using only core nodes and filtered edges.
   Triggers stay with the core (they're piece-level, not node-level).
4. Record a "scatter obligation" — store the scattered nodes and the piece's
   prefix for later placement.

Add a `scatterObligations` array to the state tracked by `fillSkeleton`.
Each obligation: `{ prefix, scatteredNodes: NodeDef[], pieceDef }`.

For non-scattered pieces, behavior is unchanged.

**Verify:** `make check` passes (no scattered pieces in the catalog yet, so
this code path isn't exercised — but existing behavior is preserved).

### Prompt 4.2: Conservative scatter eligibility check

In `findCandidates` (or as a filter after it), add a check: if a candidate
piece has scattered nodes, count the number of scattered nodes. Estimate
available attachment points by counting all placed pieces' unused outbound
ports in the current network. If fewer attachment points than scattered nodes,
exclude the candidate.

This is a conservative estimate — it doesn't check gate-free reachability yet
(that happens in pass 2). The goal is to avoid obviously impossible placements.

**Verify:** `make check` passes.

### Prompt 4.3: Gate-free reachability computation

Add a new function `computeGateFreeSlots(pieces, skeleton)` to
`slot-filler.js`:

1. Build a map from slot ID → placed piece (using `piece.slot.id`).
2. Walk the skeleton tree from the root (entry slot).
3. For each slot, check if the placed piece's `pieceDef.tags` includes `"gate"`.
4. If yes, mark this slot and all its descendants as NOT gate-free.
5. If no, mark this slot as gate-free and continue to children.
6. Return a `Set<string>` of gate-free slot IDs.

**Verify:** Unit test: build a small skeleton with 5 slots, place pieces (some
with gate tag, some without), call `computeGateFreeSlots`, verify the correct
slots are marked gate-free.

### Prompt 4.4: Scatter placement pass (pass 2)

Add a new function `placeScatteredNodes(scatterObligations, pieces, skeleton, crossEdges)`:

For each obligation:
1. Get the set of gate-free slot IDs from `computeGateFreeSlots`.
2. For each scattered node in the obligation:
   a. Find a placed piece in a gate-free slot that has an unused outbound port
      (iterate `pieces`, check `piece.outboundNodeIds.length > 0`,
      check slot is gate-free).
   b. If found: consume the outbound port, add the scattered node to
      `piece.nodes`, add the edge `[outboundPort, scatteredNodeId]` to
      `crossEdges`.
   c. If not found: return `{ ok: false }`.
3. If all scattered nodes placed: return `{ ok: true }`.

Call this function at the end of `fillSkeleton`, after the main recursive fill.
If scatter placement fails, set `ok: false` on the return value (triggers
retry in `generateNetwork`).

**Verify:** `make check` passes.

### Prompt 4.5: Integration test — generate with scatteredLock3

1. Add `scatteredLock3` to `CORPORATE_BIOME.catalog` in
   `data/biomes/corporate.js`.

2. Write an integration test that generates a network with a seed known to
   produce a `scatteredLock3` placement. Verify:
   - The 3 switch nodes exist in the generated `graphDef.nodes`
   - The switch nodes share the same prefix as the gate/vault core nodes
   - Each switch node has at least one edge connecting it to the network
   - No switch is behind a gate-tagged piece (verify by BFS from gateway
     through non-gate paths)
   - The vault is concealed
   - The existing validator passes (`validate(graphDef, spec)`)

3. If finding a deterministic seed is difficult, use `--verbose` mode to
   inspect which pieces were placed and manually verify.

**Verify:** `make check` passes with new tests. `node scripts/generate-network.js --seed <test-seed> --summary` shows scattered switches in the output.

---

## Phase 5: Remaining Scattered Pieces + Biome Catalog

**Goal:** Author the remaining scattered piece variants, add all to the biome
catalog, and verify generation works across a range of seeds.

### Prompt 5.1: Scattered multi-key vault variants

In `data/biomes/corporate-pieces.js`, add `scatteredKeyVault2` and
`scatteredKeyVault3`:

- Scattered key-server nodes: `scatter: true`, type `key-server`,
  traits `["graded", "hackable", "rebootable"]`.
  Action: `extract-token` — requires `owned` + `tokenExtracted: false`,
  effects: `set-attr tokenExtracted true`,
  `quality-delta "keys-collected" 1`,
  `ctx-call log "Auth token extracted"`
- Core vault node: type `cryptovault`,
  traits `["graded", "hackable", "rebootable", "lootable"]`.
  Action: `unlock-vault` — requires `owned` + `quality-gte "keys-collected" N`,
  effects: `quality-set "keys-collected" 0`, `giveReward 5000`,
  `ctx-call log "Vault unlocked — ¥5,000 extracted"`.
  Scan action: `log-template "Key vault: ${quality:keys-collected}/N tokens collected"`.

Metadata: tags `["puzzle", "treasure"]`, cost C (2 keys) or B (3 keys).

Write basic tests: instantiate, verify quality prefixing, verify unlock
requires correct quality threshold.

**Verify:** `make check` passes.

### Prompt 5.2: Scattered encrypted vault variants

In `data/biomes/corporate-pieces.js`, add `scatteredEncryptedVault2` and
`scatteredEncryptedVault3`:

- Scattered key-gen nodes: `scatter: true`, type `key-gen`,
  traits `["graded", "hackable", "rebootable"]`.
  Action: `extract-key` — requires `owned`,
  effects: `quality-delta "decryption-keys" 1`,
  `ctx-call log "Decryption key extracted"`.
- Core vault node: type `cryptovault`,
  traits `["graded", "hackable", "rebootable", "lootable"]`.
  Action: `loot` — requires `owned` + `quality-gte "decryption-keys" N`,
  effects: `quality-set "decryption-keys" 0`, `giveReward 3000`,
  `ctx-call log "Encrypted vault decrypted — ¥3,000 extracted"`.
  Scan action for progress.

Metadata: tags `["puzzle", "treasure"]`, cost C (2 keys) or B (3 keys).

Write basic tests.

**Verify:** `make check` passes.

### Prompt 5.3: Update biome catalog

In `data/biomes/corporate.js`:

1. Import all new scattered pieces from `corporate-pieces.js`.
2. Add them to `CORPORATE_BIOME.catalog`.
3. The existing co-located versions remain in the catalog.

Run generation across 10+ seeds to verify:
```bash
for seed in test-{1..10}; do
  node scripts/generate-network.js --seed $seed --summary 2>&1 | head -5
done
```

Check that some networks include scattered pieces and generation succeeds.

**Verify:** `make check` passes. Generation succeeds across seeds.

---

## Phase 6: Bot Player Heuristic

**Goal:** Teach the bot to execute puzzle actions on owned nodes so it can
interact with scattered pieces during automated play.

### Prompt 6.1: Add puzzle action heuristic

Create a new heuristic file `scripts/bot/heuristics/puzzles.js`:

1. Iterate all owned nodes in `world.nodes`.
2. For each owned node, check `world.availableActions.get(nodeId)`.
3. For each available action that is NOT in the bot's known set
   (`probe`, `exploit`, `read`, `loot`, `reconfigure`, `cancel-trace`,
   `eject`, `reboot`, `access-darknet`, and `disarm-*`), propose it as
   a `ScoredAction` with score ~60 (between loot at 62 and explore at 50).
4. Use reason string: `"puzzle: ${action.label} on ${nodeId}"`.

Register this heuristic in the bot's strategy list (in `scripts/bot-player.js`
or wherever strategies are composed).

Add `"activate"`, `"scan-lock"`, `"crack-vault"`, `"unlock-vault"`,
`"extract-token"`, `"extract-key"` to the `INSTANT_ACTIONS` set in
`scripts/bot/execute.js`.

### Prompt 6.2: Test bot with scattered pieces

Run the bot against generated networks with scattered pieces:

```bash
node scripts/bot-player.js --generated --seed test-1 --threat C --wealth B --verbose
```

Verify in the verbose output:
- Bot encounters and activates scattered switches
- Bot scans locks on gate nodes
- Bot cracks vaults when available
- Bot completes runs (or at least makes meaningful progress)

Run a quick census:
```bash
node scripts/bot-census.js --seeds 10 --time F --money F
```

**Verify:** Bot doesn't crash. Win rate is reasonable (not zero).

---

## Phase 7: Playtest + Polish

**Goal:** Manually playtest generated networks with scattered pieces. Fix any
issues found. Commit session docs.

### Prompt 7.1: Headless playtest

Use the playtest harness to play through a network with scattered pieces:

```bash
node scripts/playtest.js --generated --seed <seed> --threat C --wealth B reset
node scripts/playtest.js --generated ... "status full"
```

Navigate to switches, activate them, check scan-lock output, crack the vault.
Verify:
- Switch activation logs appear
- Scan-lock shows correct progress (0/3, 1/3, 2/3, 3/3)
- Vault reveals after all switches activated
- Crack-vault gives reward
- Switches have the same prefix as the vault (diegetic breadcrumb)

### Prompt 7.2: Fix any issues

Address bugs found during playtesting. Run `make check` after each fix.

### Prompt 7.3: Session docs + commit

Update `notes.md` with session retro. Commit all changes. Open PR.

---

## Phase Summary

| Phase | Scope | Depends On | Key Output |
|-------|-------|-----------|------------|
| 1 | Type changes + cleanup | — | `scatter` on NodeDef, Dependency removed |
| 2 | `log-template` effect | — | New effect in effects.js + set-pieces.js |
| 3 | First scattered piece | Phase 2 | `scatteredLock3` + variants, unit tests |
| 4 | Generator scatter support | Phases 1, 3 | Two-pass slot filler, gate-free computation |
| 5 | Remaining pieces + catalog | Phases 3, 4 | All variants in biome, generation verified |
| 6 | Bot player | Phases 4, 5 | Puzzle heuristic, bot plays scattered networks |
| 7 | Playtest + polish | Phase 6 | Manual verification, bug fixes, session retro |

Phases 1 and 2 are independent and can be done in either order.
Phase 3 depends on Phase 2 (log-template used by scan-lock action).
Phase 4 is the core engineering work.
Phases 5-7 are incremental content + integration.

---

## Risk Notes

- **Attachment point exhaustion.** If the network has few unused outbound ports
  in gate-free slots, scatter placement fails. Mitigation: the conservative
  eligibility check in Phase 4.2 prevents obviously impossible placements.
  The retry mechanism in `generateNetwork` handles marginal cases.

- **Quality namespace collisions.** Two instances of the same scattered piece
  could collide if they share a prefix. This can't happen — each instantiation
  gets a unique prefix from the slot filler. But verify with a test that
  places two `scatteredLock3` instances in one network.

- **Gate-free computation complexity.** Walking the skeleton tree is O(n) where
  n is the number of slots — trivial for current network sizes (10-30 nodes).
  No performance concern.

- **Bot regression.** The new puzzle heuristic might interfere with the bot's
  existing priorities. The score of 60 is deliberately between loot (62) and
  explore (50) — puzzle actions are taken when convenient, not at the expense
  of core gameplay. Monitor bot census metrics after Phase 6.
