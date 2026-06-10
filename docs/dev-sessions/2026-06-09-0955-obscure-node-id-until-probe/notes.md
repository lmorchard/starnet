# Notes — obscure node identity until probe (#121)

## Summary

A discovered-but-unprobed node now hides its real identity (id, label, type, grade)
behind its `sig-N` signal alias across **all three display channels** — graph, console,
and the sidebar node-panel — until the player probes it or lands a blind exploit (both
set `probed`). Connecting to / navigating into a node makes it actionable but no longer
discloses what it is. Navigation/traversal logic itself is unchanged; this is display-only.

## Implementation

One predicate, consulted everywhere identity was previously gated on `visibility === "revealed"`:

```js
isObscured(node) = Boolean(node.sigAlias) && !node.probed   // js/core/state/node.js
```

- **Phase 1** — `isObscured` + unit truth-table (`state/node.js`, `node.test.js`).
- **Phase 2** — console: `getRevealedAliases` → `getObscuredAliases`; `resolveNode`,
  `fromNodes` completion, `cmdStatus` summary, `cmdStatusNode`, and the `actions` target
  list all key off `isObscured`. Obscured nodes resolve/complete by alias only; `status
  node` shows `[???]` for type/label/grade. End-to-end regression test in `commands.test.js`
  drives the real `revealNeighbors` + `navigateTo` path.
- **Phase 3** — graph: `node.obscured` stylesheet rule overrides the accessible label back
  to `data(sigAlias)`; `updateNodeStyle` toggles the class and forces a generic ellipse so
  the node type isn't telegraphed. Accessible styling otherwise retained for reachability.
- **Phase 4** — sidebar: the "[???] UNKNOWN NODE" view triggers on `isObscured`, with hint
  text that adapts ("Run PROBE to identify this node." once reachable).
- **Phase 5** — MANUAL.md updated; final `make check` + bot census.

## Verification

- `make check`: full suite passes, lint clean.
- **Browser (Playwright, real game):** owned gateway → `router-1` revealed as `sig-1` →
  navigated in (accessible, unprobed). Confirmed: graph node carries classes
  `["obscured","accessible"]`, label `sig-1`, ellipse shape; sidebar shows
  "[???] UNKNOWN NODE / Run PROBE to identify this node"; console references it only by
  `sig-1`. After probe completed: `obscured` class dropped, graph label → `router-1`,
  sidebar → `[ROUTER] router-1 GRADE…`, `status node router-1` resolves by real id. No
  console errors.
- **Bot census:** unaffected by design — the bot reads raw state and dispatches by real id,
  importing none of the changed modules (grep-confirmed). Easy-grade smoke (10 seeds) ~70%,
  nodes owned normally, no crash.

## Decisions of note

- Gated on `probed` rather than clearing `sigAlias` on probe — the alias stays as the
  historical signal handle; gating reads cleaner. (See spec.)
- Scope = **full identity** (id/label/type/grade), not just the id string. This folded in a
  pre-existing leak: `status node` already exposed type/grade for *revealed* nodes. Hiding
  only the id would have left an obvious console oracle and broken GUI/console symmetry.
- Obscured-accessible nodes keep accessible styling + generic ellipse + `sig-N` label, so
  "reached" still reads distinctly from "merely revealed."

## Follow-ups / observations

- `window._starnetState` appears to be a stale/snapshot reference in the browser; use
  `window.starnet.state()` for live reads when scripting Playwright verification. (Cost me a
  `target undefined` misfire during verification — harmless, but worth remembering.)
