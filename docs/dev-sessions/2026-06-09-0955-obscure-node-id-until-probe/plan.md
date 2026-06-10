# Obscure node identity until probe — Implementation Plan

**Goal:** A discovered-but-unprobed node shows only its `sig-N` alias (hiding id/label/type/grade) across graph, console, and sidebar, until probe or blind-exploit success reveals it.

**Approach:** Replace the scattered `visibility === "revealed"` identity checks with one predicate `isObscured(node) = !!node.sigAlias && !node.probed`, defined once in `js/core/state/node.js`. Each display channel consults it. Navigation/traversal is unchanged — only display.

**Tech stack:** Vanilla JS ES modules, JSDoc `@ts-check`, node:test, Cytoscape.js (graph), Lit (components).

---

## Phase 1: Central predicate `isObscured`

Add the pure predicate and lock its truth table with a unit test. Foundation for all later phases.

**Files:**
- Modify: `js/core/state/node.js` — add and export `isObscured(node)`.
- Test: `js/core/state/node.test.js` — truth-table cases.

**Key changes:**
```js
/**
 * A node's identity (id, label, type, grade) is obscured behind its sig-N alias
 * until the player probes it or lands a blind exploit (both set node.probed).
 * sigAlias is assigned only on hidden→revealed, so foothold nodes (no alias) are never obscured.
 * @param {NodeState} node
 * @returns {boolean}
 */
export function isObscured(node) {
  return Boolean(node?.sigAlias) && !node.probed;
}
```

**Verification — automated:**
- [ ] New test fails before the function exists, passes after.
- [ ] `make lint` passes (JSDoc/types).
- [ ] `make test` passes.

**Truth table to assert:**
- `{sigAlias:"sig-1", probed:false}` → true
- `{sigAlias:"sig-1", probed:true}` → false
- `{probed:false}` (no alias, e.g. gateway) → false
- `{}` / undefined-ish → false

---

## Phase 2: Console obscures identity (the regression slice)

Make every console path key identity off `isObscured` instead of `visibility === "revealed"`. Start with a failing test that reproduces the leak: an **accessible, unprobed, aliased** node must not expose its real id/label/type/grade.

**Files:**
- Modify: `js/core/console-commands/completions.js` — rename `getRevealedAliases` → `getObscuredAliases`; predicate `isObscured(n)` at the map (was `:66`) and in `fromNodes` (was `:85`).
- Modify: `js/core/console-commands/resolvers.js` — `resolveNode`: obscured nodes resolve by alias only; exclude obscured nodes from id/label matching; update import.
- Modify: `js/core/console-commands/cmd-status.js` — summary list (`:146-149`) partitions by `isObscured`; `cmdStatusNode` (`:205-219`) shows `[???]` for label/type/grade when obscured; update import.
- Modify: `js/core/console-commands/commands.js` — actions `target` line (`:106-116`) lists obscured nodes by alias; update import.
- Modify: `js/core/console-commands/index.js` — re-export rename.
- Test: `js/core/console-commands/completions.test.js` — rename refs; add accessible-unprobed-aliased cases.
- Test: `js/core/console-commands/resolvers.test.js` (create if absent) — accessible-unprobed node: resolvable by alias, NOT by real id/label.

**Key changes (resolveNode — exclude obscured from id/label match):**
```js
// Accessible & NOT obscured: match by real id or label prefix.
const byId = s.nodes[token];
if (byId && byId.visibility === "accessible" && !isObscured(byId)) return byId;

const labelMatches = Object.values(s.nodes).filter(
  (n) => n.visibility === "accessible" && !isObscured(n) && n.label?.toLowerCase().startsWith(lower)
);
// ... ambiguity handling unchanged ...

// Obscured nodes (revealed OR accessible-unprobed): match by alias only.
const obscuredAliases = getObscuredAliases(s.nodes);
for (const [nodeId, alias] of obscuredAliases) {
  if (alias.toLowerCase() === lower) return s.nodes[nodeId];
}
```

**Key changes (`getObscuredAliases`):**
```js
export function getObscuredAliases(nodes) {
  const map = new Map();
  for (const n of Object.values(nodes)) {
    if (isObscured(n)) map.set(n.id, n.sigAlias);
  }
  return map;
}
```

**Key changes (`cmdStatus` summary list):** partition visible nodes into obscured vs known; obscured render as `- ${alias}  [???]  ${node.visibility}`; known render with full detail as today. (The current `revealed`/`accessible` split at `cmd-status.js:118-149` becomes obscured/known.)

**Key changes (`cmdStatusNode`):**
```js
if (isObscured(node)) {
  lines.push(`## STATUS: NODE ${node.sigAlias}`);
  lines.push(`- label: [???]  type: [???]  grade: [???]`);
  lines.push(`- visibility: ${node.visibility}  probed: ${node.probed}`);
  lines.forEach((l) => addLogEntry(l, "meta"));
  return;
}
// ...existing full detail unchanged...
```

**Verification — automated:**
- [ ] New resolver/completion tests fail before edits, pass after.
- [ ] `make lint` passes.
- [ ] `make test` passes (existing completions/resolver tests updated for rename).

**Verification — manual (playtest harness):**
- [ ] `node scripts/playtest.js reset` → compromise a node, then `actions` lists the new neighbor by `sig-N`, not real id.
- [ ] `status node sig-N` on a navigated-but-unprobed node shows `[???]`, not type/grade.

---

## Phase 3: Graph rendering obscures identity

The graph shows `sig-N` + generic ellipse for obscured nodes while keeping accessible styling for reachability.

**Files:**
- Modify: `js/ui/graph.js` — stylesheet: add `node.obscured { label: "data(sigAlias)" }` ordered AFTER `node.accessible` (so it overrides `label: data(id)`); `updateNodeStyle`: toggle the `obscured` class via `isObscured(nodeState)`, populate `sigAlias` data whenever obscured (not only when `revealed`), and force ellipse shape when obscured.

**Key changes (`updateNodeStyle`, was `:462-499`):**
```js
const obscured = isObscured(nodeState);

node.removeClass("hidden revealed accessible");
node.addClass(nodeState.visibility);
node.toggleClass("obscured", obscured);

if (obscured) {
  node.data("sigAlias", nodeState.sigAlias ?? "???");
}
// ...accessible block unchanged except shape:
const shape = obscured ? "ellipse" : (NODE_SHAPES[type] || "ellipse");
node.style("shape", shape);
```

**Stylesheet addition (after the `node.accessible.*` rules):**
```js
{ selector: "node.obscured", style: { label: "data(sigAlias)" } },
```

**Verification — automated:**
- [ ] `make lint` passes (graph.js is `@ts-nocheck`; lint still runs).
- [ ] `make test` passes.

**Verification — manual (browser, `make bundle-vendor` + `make serve`):**
- [ ] Compromise a node; neighbor shows `sig-N`. Click it → it gains the solid/actionable accessible look but STILL shows `sig-N` and a generic ellipse (not its type shape).
- [ ] Probe it (or land a blind exploit) → label flips to real id and the type shape appears.
- [ ] Gateway/foothold node always shows its real id (never obscured).

---

## Phase 4: Node-panel sidebar obscures identity

The sidebar's "[???] UNKNOWN NODE" view currently triggers on `visibility === "revealed"`; extend to `isObscured`, with messaging that fits an accessible-but-unprobed node.

**Files:**
- Modify: `js/ui/components/starnet-node-panel.js` — gate the obscured view (`:38`) on `isObscured(node)`; branch the helper text: not-yet-reachable (revealed) vs reachable-unprobed (accessible) → "Run PROBE to identify this node."

**Key changes (`:37-44`):**
```js
if (isObscured(node)) {
  const hint = node.visibility === "accessible"
    ? html`Connection established.<br />Run PROBE to identify this node.`
    : html`Signal detected on network.<br />Gain access to a connected node<br />to probe further.`;
  return html`<div class="sidebar-placeholder">
    [???] UNKNOWN NODE<br /><br />${hint}
  </div>`;
}
```

**Verification — automated:**
- [ ] `make lint` passes.
- [ ] `make test` passes.

**Verification — manual (browser):**
- [ ] Select a navigated-but-unprobed node → sidebar shows "[???] UNKNOWN NODE / Run PROBE to identify this node", NOT type/label/grade.
- [ ] After probe → sidebar shows full detail.

---

## Phase 5: Manual + final verification

Update `MANUAL.md` to describe obscure-until-probe, and run the full check + bot smoke.

**Files:**
- Modify: `MANUAL.md` — node discovery section (`~:121-138`): connecting to a `sig-N` node makes it actionable but does NOT reveal its identity; probe (or a successful blind exploit) reveals id/type/grade. Update `status` command notes and the `???`/signal language accordingly.

**Verification — automated:**
- [ ] `make check` (lint + test) passes.
- [ ] `node scripts/bot-census.js --time F --money F --seeds 10` still ~80% success (bot reads raw state; expected unaffected — confirm no crash).

**Verification — manual:**
- [ ] Re-read changed MANUAL sections against actual in-browser behavior — they match.

---

## Notes

- **Bot & playtest harness unaffected:** both read raw state (`node.id`, `accessLevel`, `visibility`) and dispatch by real id, not via console alias resolution. No bot strategy change needed. Confirm in Phase 5 the census doesn't crash.
- **Navigation is intentionally untouched.** The fix is display-only; `navigateTo()` still promotes revealed→accessible on connect.
- **One commit per phase**, message `Phase N: <name>`.
