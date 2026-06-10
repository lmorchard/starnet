# Research — obscure node ID until probe

Issue: #121. Bug: clicking a `sig-N` (revealed) node promotes it to `accessible` via
traversal, which unmasks its real node id — before any probe or exploit.

## The `sigAlias` marker

- `sigAlias` is assigned **only** by `revealNeighbors()` on the `hidden → revealed`
  transition: `js/core/state/index.js:216-228`. Guarded by `neighbor.visibility === "hidden" && !neighbor.concealed`.
- Setter: `js/core/state/node.js:151-158` (`setNodeSigAlias`).
- Therefore `sigAlias` is precisely the marker "discovered by signal, identity still unknown."
  Starting/foothold nodes (e.g. gateway) are accessible but have **no** `sigAlias`.

## Where `probed` is set (the reveal triggers)

- Probe timed action completes: `js/core/node-graph/game-ctx.js:191` → `setNodeProbed(nodeId)`.
- Exploit success (the blind-exploit path): `js/core/combat.js:241` → `setNodeProbed(nodeId)`.
- Setter: `js/core/state/node.js:60-64`.

So gating identity on `probed` covers **both** triggers Les named (probe succeeds OR blind
exploit lands). A successful blind exploit already counts as a probe.

## The bug path

1. Click a `sig-N` node → TARGET action → `navigateTo()` (`js/core/navigation.js:19-44`).
2. If `visibility === "revealed"` and it has an `accessible` neighbor, it is promoted
   `revealed → accessible` (`navigation.js:33-40`) — "signal traced. Node accessible." — with
   **no probe/exploit gate**.
3. Graph styling keys the label off the visibility CSS class (below), so the label flips
   from the alias to the real id.

## Identity gated on `visibility === "revealed"` (every leak site)

The codebase uses `visibility === "revealed"` as a proxy for "identity unknown." That proxy
is wrong: a node can be `accessible` yet unprobed. Sites:

1. **Graph label** — `js/ui/graph.js:283-325`:
   - `node.revealed` → `label: "data(sigAlias)"` (line 297)
   - `node.accessible` → `label: "data(id)"` (line 315)  ← leak
   - `updateNodeStyle` only populates `sigAlias` data while `visibility === "revealed"` (`graph.js:466-469`).
   - Note: `node.accessible` base block (306-324) sets **no** `shape`; `node.revealed` forces `ellipse`.
     Shape source for accessible nodes needs confirming in the plan (type-driven selector or data(shape)).
2. **Console alias map** — `js/core/console-commands/completions.js:63-69` (`getRevealedAliases`):
   only includes `n.visibility === "revealed" && n.sigAlias`. This is the central gate consumed by:
   - `fromNodes` completion — `completions.js:78-99` (accessible → id/label; revealed → alias)
   - `resolveNode` — `js/core/console-commands/resolvers.js:15-41` (accessible → id/label; revealed → alias only)
   - `cmdStatus` summary list — `js/core/console-commands/cmd-status.js:146-149`
   - actions list (`target` line) — `js/core/console-commands/commands.js:106-116`
3. **`status node` detail** — `cmd-status.js:205-219`: prints `node.id`, `label`, `type`, `grade`
   unconditionally. **Pre-existing broader leak:** this already exposes type/grade/label for a
   *revealed* (never-probed) node today, independent of the navigation bug.

## Implication for the fix

Replace the `visibility === "revealed"` discriminator with a single predicate:

```
isObscured(node) = !!node.sigAlias && !node.probed
```

- Revealed nodes: have alias, not probed → obscured (unchanged behavior).
- Navigated-but-unprobed nodes: have alias, accessible, not probed → obscured (the fix).
- Gateway / foothold: no alias → never obscured (correct — identity known).
- After probe or blind-exploit success: `probed = true` → identity revealed everywhere at once.

Central helper home: a pure read predicate importable by both `js/core/*` (console) and
`js/ui/graph.js`. `js/core/state/node.js` is a candidate.

## Tests / fixtures touching this

- `js/core/console-commands/completions.test.js:260-262` — builds revealed nodes with sigAlias.
- `js/core/state/node.test.js:34` — `setNodeProbed`.
- Snapshot/integration suites exercise navigation + visibility.
