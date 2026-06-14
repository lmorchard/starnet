# Spec — Authoring-time set-piece validator (`validateSetPiece`)

GitHub issue: #219. Related (out of scope): #220 (rewriter robustness), #221 (authoring duplication).

## Problem

`tsc` checks the *shape* of a `SetPieceDef` but not its *semantic/referential wiring*: an
internal edge to a node that doesn't exist, a gate input that never resolves, a `ctx-call`
method that silent-no-ops on a typo, an action id that shadows a core verb, a quality read
that nothing writes. These compile clean and surface only during playtest — multiple
unwinnable-run and trace-at-init bugs have shipped this way (#215, #153, and others catalogued
in the issue).

## Goal

Add `validateSetPiece(def)` that walks a single `SetPieceDef` and returns structured errors
(`{ pieceId, nodeId?, check, message }`). Run it over the entire biome catalog
(`SET_PIECES` ∪ `ATOMICS` ∪ `BACKBONE_PIECES`) in a test that fails on any error. The current
catalog is correct (all the historical bugs are fixed), so the test must pass green today; its
value is catching the *next* miswired piece at authoring time.

## Non-goals

- Rewriter robustness (#220) — we implement the *validation* side of check #10 (detect an
  unresolved cross-namespace reference after instantiate); we do **not** change `instantiate`.
- Authoring duplication / builders (#221).
- Network-assembly-level checks already in `validate.js` (we add the per-piece analog, which
  fires earlier with a piece-scoped error).

## Return shape

Mirror `validate.js`'s `{ valid, errors }`. Errors are structured objects, not bare strings,
so the catalog test can report `pieceId` + `nodeId` + reason:

```js
/** @typedef {{ pieceId: string, nodeId: string|null, check: string, message: string }} SetPieceError */
/** validateSetPiece(def) => { valid: boolean, errors: SetPieceError[] } */
```

## Checks

### Static (walk the def + resolved traits — no instantiation)

1. **edge-endpoint** — every `internalEdges` endpoint is a declared node id.
2. **port-target** — every `ports[].nodeId` and every `externalPorts` entry is a declared node id.
3. **operator-input** — every `any-of`/`all-of` operator `inputs[]` entry references a declared node id.
4. **destinations-edge** — every operator `destinations[]` entry (a) is a declared node and
   (b) is connected to the emitting node by an `internalEdges` pair (enforces the CLAUDE.md
   "no invisible channels" rule). *(Vacuous on today's catalog — no piece uses `destinations` —
   but guards future authoring; this is the machine form of the reviewer-only rule.)*
5. **core-verb-shadow** — a node's **authored** `actions[]` must not use an id in
   `CORE_NODE_VERBS` when one of the node's traits already provides that same core verb.
   **Catches #153** (`encrypted-vault` authored `id:"fetch"`, shadowing the lootable trait's
   FETCH → uncollectable loot → unwinnable run). Faithful nuance: the `encrypted` trait's own
   `id:"dump"` override is *trait code*, not authored-in-a-piece, so it never trips — we inspect
   raw `NodeDef.actions`, not the resolved action list.
6. **ctx-method** — every `ctx-call` effect `method` and every operator `call` (the `report`
   operator) names a real `CtxInterface` method. Source of truth: `Object.keys(nullCtx)` from
   `node-graph/ctx.js` (matches `mockCtx`). Catches typos that silently no-op.
7. **quality-read-without-write** — every static quality *read* (`quality-gte`/`quality-eq`
   `name`, `${quality:NAME}` in a `log-template`) is *written* somewhere in the same piece
   (`quality-delta`/`quality-set` `name`, or `tally.quality`). **Catches the #215 class from the
   other direction** — a gate reading a quality nothing increments. Dynamic names
   (`quality-from-attr`, whose name is read at runtime from an attribute) are exempt — they are
   intentionally global/dynamic. *(Decision: also flag write-without-read as a dead-quality
   error, contingent on the catalog passing it — see Open Questions.)*
8. **enabled-attr** — every operator `enabledAttr` names an attribute the node actually has:
   present in resolved (trait-merged) initial `attributes`, or set by a `set-attr` in one of the
   node's own actions, or set by a `set-node-attr` targeting this node anywhere in the piece. A
   bogus `enabledAttr` silently disables (or never disables) the operator.
   *(Scope: `enabledAttr` only. `activeAttr`/`progressAttr`/`durationAttr` are
   engine-managed by the timed-action operator and may be initialized lazily — checking them
   risks false positives, so they're deferred. Documented, not faked.)*
9. **watchdog-armed** — every `watchdog` operator is either `armable: true` **or** has an
   in-piece heartbeat feeder: a node carrying a `clock` operator with an `internalEdges` path to
   the watchdog node. **Static angle on #215** (the `cascade-shutdown` watchdog free-ran from
   network init). Approximation: "feeder" = any node with a `clock` operator that reaches the
   watchdog over undirected `internalEdges`. Pairs with check #12.

### Instantiated / behavioral (need `instantiate` + a `NodeGraph`)

10. **namespace-leak** — after `instantiate(def, prefix)`, no rewritten nodeId / quality name
    reference points *outside* the piece's own `prefix/` namespace (except dynamic
    `quality-from-attr` names, which are intentionally global). This is the direct #215 analog
    and the cleanest expression of "the instantiate rewrite is complete." Walk the same
    reference sites instantiate touches (operator inputs/destinations/quality, condition
    nodeIds + quality names, effect nodeIds + quality names + log-template, trigger when/then)
    and assert every internal reference begins with `prefix/`. References to a node id that does
    not exist in the piece are also leaks.
11. **reachability** — per-piece BFS over (undirected) `internalEdges` from the piece's port
    nodes (`ports[].nodeId` ∪ `externalPorts`) must reach every **non-scatter** node.
    `scatter: true` nodes are exempt as roots *and* as targets — they are placed independently
    elsewhere and communicate via global qualities (so they intentionally have no internal
    edges; e.g. `scattered-key-vault-*`). Per-piece version of `validate.js`'s all-reachable
    check; catches the missing-`key-gen→vault`-edge class (#1438971) with a piece-scoped error.
12. **no-trace-at-init** — instantiate the piece, build a `NodeGraph` with a `mockCtx`, `tick`
    past the longest watchdog/clock period in the catalog with **no** player action and **no**
    external stimulus, and assert `ctx.calls.startTrace` is undefined. **Generalizes the #215
    reproduction across the whole catalog** — the strongest single guard against insta-trace. A
    freshly-placed piece must never self-trace without the player doing something.

## Honesty notes (CLAUDE.md "set-piece test honesty")

- The catalog test asserts the **observable consequence** (validator returns no errors; #12
  asserts `ctx.calls.startTrace` undefined), not intermediate flags.
- Each per-bug check gets a **targeted unit test on a hand-built broken def** that proves the
  check fires (red), so we know the check works — not just that the clean catalog passes.
- The **dead-node / dead-operator liveness** rule (CLAUDE.md) is flagged in the issue as the
  lowest-confidence, hardest-to-do-statically check. We do **not** attempt full signal-path
  liveness. The tractable approximation we *do* ship is reachability (#11, structural) +
  no-trace-at-init (#12, behavioral). If full liveness is wanted later it needs the instantiated
  graph and message tracing — out of scope here, called out rather than faked.

## Acceptance criteria (from the issue)

- [ ] `validateSetPiece(def)` implemented with static checks 1–9 returning structured errors.
- [ ] A test runs `validateSetPiece` over every piece in `SET_PIECES` ∪ `ATOMICS` ∪
      `BACKBONE_PIECES` and fails on any error (passes green on today's catalog).
- [ ] Behavioral no-trace-at-init (#12) and per-piece reachability (#11) covered for the catalog.
- [ ] Each new biome's catalog is validated by the same test automatically (iterate the catalog
      objects, not a hardcoded list).
- [ ] Per-bug unit tests prove each high-value check (#5, #6, #7, #9, #10, #11, #12) fires on a
      broken def.
- [ ] `make check` green.

## Open questions / decisions

- **Write-without-read** (part of #7): implement as an error only if the current catalog passes
  it. Survey shows every quality is both read and written, so it should pass — but the TDD run
  is the arbiter. If a legit piece writes a display-only quality, downgrade that direction to a
  no-op with a documented note rather than weakening the read-without-write check.
- **Where the validator lives:** `js/core/network/validate-set-piece.js` (sibling of
  `validate.js`), tests in `js/core/network/validate-set-piece.test.js`.
