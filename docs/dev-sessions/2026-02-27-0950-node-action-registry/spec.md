# Spec: Node Action Registry

## Problem

"What actions are available on this node?" is currently answered in two separate places:

- **`visual-renderer.js`** (`renderActions()`) — hard-coded `if (node.accessLevel === ...)` chains that produce sidebar buttons
- **`console.js`** (`cmdActions()`) — a parallel set of hard-coded conditionals that produce the `actions` command output

These two implementations drift. The backlog already documents a real bug from this: `cancel-trace` is present in console output but missing from the sidebar. Any new action, condition change, or new node type requires touching both files.

Type-specific actions (`reconfigure`, `cancel-trace`) are already in a partial registry in `node-types.js` via `getActions()`, but the universal core actions are not.

## Solution

Introduce two new modules that make actions first-class, self-contained objects:

### `js/node-actions.js`

Holds all node-contextual actions — those that operate on a selected node. Each action is a composable `ActionDef` object:

```js
{
  id:        string,
  label:     string,
  available: (node: NodeState, state: GameState) => boolean,
  desc:      (node: NodeState, state: GameState) => string,
  execute:   (node: NodeState, state: GameState, ctx: ActionContext) => void,
}
```

Actions to migrate here:
- `probe` / `cancel-probe`
- `exploit` / `cancel-exploit`
- `read`
- `loot`
- `eject`
- `reboot`

### `js/global-actions.js`

Holds actions that are always available regardless of node selection — but still flow through the same `ActionDef` shape and `available` predicate. This means future mechanics (e.g. a node or ICE state that locks jackout) are a single predicate change, not a cross-file surgery.

Actions to migrate here:
- `jackout`
- `select`
- `deselect`

### `ActionContext`

The `execute` function receives a context object rather than importing state mutators directly. This makes actions testable in isolation — a test can pass a mock context with stub functions and assert on what was called.

```js
/**
 * @typedef {{
 *   emit:          (event: string, payload?: any) => void,
 *   getState:      () => GameState,
 *   startProbe:    (nodeId: string) => void,
 *   cancelProbe:   () => void,
 *   startExploit:  (nodeId: string, cardIndex: number) => void,
 *   cancelExploit: () => void,
 *   readNode:      (nodeId: string) => void,
 *   lootNode:      (nodeId: string) => void,
 *   ejectIce:      (nodeId: string) => void,
 *   rebootNode:    (nodeId: string) => void,
 *   jackOut:       () => void,
 *   selectNode:    (nodeId: string) => void,
 *   deselectNode:  () => void,
 * }} ActionContext
 ```

`main.js` constructs a single `ActionContext` at init, wiring each field to the appropriate state mutator. The dispatch loop becomes: look up action by id → call `execute(node, state, ctx)`.

### `getAvailableActions(node, state)`

A unified function (likely exported from `node-actions.js` or a thin `actions.js` facade) that merges:
1. Global actions from `global-actions.js`
2. Node-contextual actions from `node-actions.js`
3. Type-specific actions from `node-types.js` (via existing `getActions()`)

Both `visual-renderer.js` and `console.js` call this single function to get the action list. The sidebar renders buttons from it; the console prints the list from it.

## Acceptance Criteria

1. `js/node-actions.js` exists with all core node-contextual actions as `ActionDef` objects
2. `js/global-actions.js` exists with all global actions as `ActionDef` objects
3. `ActionContext` typedef added to `js/types.js`
4. `visual-renderer.js` derives its sidebar action buttons entirely from `getAvailableActions()`
5. `console.js` derives its `actions` command output entirely from `getAvailableActions()`
6. `main.js` dispatch loop is reduced to: look up action by id → call `execute(node, state, ctx)`
7. All existing tests pass
8. New unit tests cover the `available` predicates for all migrated actions

## Out of Scope

- **Moving type-specific actions out of `node-types.js`** — `reconfigure` and `cancel-trace` stay where they are. A future session could merge all action definitions into a single location, but that's a bigger refactor.
- **New actions or gameplay mechanics** — this session is purely structural migration.
- **Broader `js/` directory restructuring** — noted as a future concern; for now the flat file structure is retained.
- **Applying the context/dispatch pattern elsewhere** — `ActionContext` establishes the pattern for this module; propagating it to other parts of the codebase is future work.
