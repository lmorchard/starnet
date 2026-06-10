# Obscure node identity until probe — Spec

**Goal:** A discovered-but-unprobed node hides its real identity (id, label, type, grade) behind its `sig-N` signal alias — on the graph *and* the console — until the player probes it or lands a blind exploit on it. Connecting to / navigating into a node no longer reveals what it is.

**Source:** Issue #121 (GitHub). User request, 2026-06-08.

## Current state

The codebase uses `visibility === "revealed"` as a proxy for "identity unknown." That proxy
breaks the moment a node is promoted `revealed → accessible` by traversal without a probe.
See `research.md` for the full site list. Load-bearing facts:

- `sigAlias` is assigned **only** on `hidden → revealed` (`js/core/state/index.js:216-228`). It is
  exactly the marker "discovered by signal, identity unknown." Foothold nodes (gateway) have none.
- `probed` is set in exactly two places: probe completion (`js/core/node-graph/game-ctx.js:191`)
  and exploit success (`js/core/combat.js:241`). Gating on `probed` covers both reveal triggers.
- Clicking a `sig-N` node → `navigateTo()` promotes it to `accessible` (`js/core/navigation.js:33-40`),
  which flips the graph label from `data(sigAlias)` to `data(id)` (`js/ui/graph.js:297` vs `:315`)
  and switches every console path to the real id/label.
- Identity-leak sites: graph label + shape (`graph.js:283-325`, `:495-499`, `:466-469`); console
  alias map `getRevealedAliases` (`completions.js:63-69`) and its consumers — `fromNodes`
  (`completions.js:78-99`), `resolveNode` (`resolvers.js:15-41`), `cmdStatus` summary
  (`cmd-status.js:146-149`), actions/target list (`commands.js:106-116`); and `status node` detail
  (`cmd-status.js:205-219`), which already leaks type/grade/label for *revealed* nodes today.

## Desired end state

A single predicate defines obscurity:

```js
isObscured(node) = Boolean(node.sigAlias) && !node.probed
```

For an obscured node, the **only** identity the player sees is its `sig-N` alias and the fact
that it exists. Hidden until probed: real `id`, `label`, `type`, `grade`. On probe **or** a
successful blind exploit (`probed = true`), the real identity is revealed everywhere at once.

User-visible behavior:

- **Graph:** an obscured node keeps its current rendering style for its visibility state
  (revealed = dashed/dim; accessible = solid/actionable glow) but shows the `sig-N` label and a
  **generic ellipse shape** instead of its type shape. Navigating into a node makes it look
  reachable/actionable without disclosing what it is.
- **Console targeting/listing:** obscured nodes are referenced by `sig-N` alias only — completion,
  `target`/`select` resolution, the actions `target` line, and the `status` summary list. Their
  real id/label are not accepted or shown.
- **`status node sig-N`:** header and fields show the alias and `[???]` placeholders for
  label/type/grade; `visibility`/`probed` still shown. After probe, shows full detail.
- **GUI/console symmetry** (CLAUDE.md): both channels obscure identically.

Navigation/traversal behavior is **unchanged** — connecting to a node still works exactly as the
manual describes; only what's *displayed* changes.

## Design decisions

- **Decision:** One predicate `isObscured(node) = !!node.sigAlias && !node.probed`, defined once
  as a pure read helper in `js/core/state/node.js` and imported by both console code and `js/ui/graph.js`.
  - **Why:** `sigAlias` is the precise "identity-unknown" marker and `probed` is the precise reveal
    trigger (covers probe + blind exploit). Foothold nodes have no alias, so they're never obscured —
    correct. Centralizing prevents the current scattered `visibility === "revealed"` checks from drifting.
  - **Rejected:** Keeping the `visibility === "revealed"` discriminator and special-casing accessible —
    that's the bug's root cause and would re-leak on any future state that sets `accessible` early.
  - **Rejected:** Clearing `sigAlias` on probe instead of gating on `probed` — extra mutation, and the
    alias is still useful as the historical signal handle; gating reads cleaner.

- **Decision:** Obscure the **full identity** (id, label, type, grade), not just the id string.
  - **Why:** Hiding only the id while `status node` still prints `type: ids grade: A` doesn't actually
    obscure the node — the player just reads it from the console. Folds in the pre-existing
    `status node` leak on revealed nodes (same surface, one PR).
  - **Rejected:** ID/label-only scope — leaves an obvious console oracle; fails GUI/console symmetry.

- **Decision:** Connected-but-unprobed nodes keep **accessible styling** but a **generic ellipse
  shape** + `sig-N` label.
  - **Why:** The player must be able to tell they've reached a node (it's targetable/probeable) without
    learning its type. Generic shape hides the type tell (shape ↔ node type per MANUAL table).
  - **Rejected:** Rendering them identically to not-yet-reached revealed nodes — loses the "you've
    connected" cue.

- **Decision:** Rename `getRevealedAliases` → `getObscuredAliases` and update its 4 import sites.
  - **Why:** Its semantics change from "revealed nodes" to "obscured nodes (revealed + accessible-
    unprobed)." A misleading name is a readability cost; the rename is mechanical.

## Patterns to follow

- Replace each `n.visibility === "revealed"` identity check with `isObscured(n)`:
  `completions.js:66,85`, `resolvers.js:22-37`, `cmd-status.js:147`, `commands.js:109-114`.
- Graph: mirror the existing class-driven label approach — add an `obscured` class toggled in
  `updateNodeStyle` (`graph.js:462-469`) and a stylesheet rule `node.obscured { label: data(sigAlias) }`
  ordered after `node.accessible` so it wins; force ellipse at `graph.js:495-499` when obscured;
  populate `sigAlias` data whenever obscured (not just when `revealed`).
- `status node` detail (`cmd-status.js:205-219`): mirror the `[???]` placeholder style already used in
  the summary list (`cmd-status.js:148`).
- Console alias resolution stays the single chokepoint: `getObscuredAliases` feeds completion,
  resolution, and listings — fix it once and consumers inherit.

## What we're NOT doing

- **Not changing navigation/traversal.** `navigateTo()` still promotes revealed→accessible on connect;
  that's intended per `MANUAL.md:121-122`. Only display changes.
- **Not clearing `sigAlias`** on probe or otherwise mutating it.
- **Not hiding vulnerabilities differently** — vuln reveal is already gated by probe and is out of scope.
- **Not redesigning visuals** beyond label + shape (no new colors, animations, or borders for the
  obscured-accessible state — reuse existing accessible styling).
- **Not touching procedural generation, ICE, alert, or scoring.**

## Open questions

- **Should the obscured-accessible node's HUD/node-panel sidebar also obscure identity?** Default: yes —
  audit the node-panel component for the same `id/label/type/grade` exposure and apply `isObscured`
  there too if present. (Resolved by the "full identity, both channels" decision; flagged so `plan`
  explicitly checks the sidebar component, not just graph + console commands.)
