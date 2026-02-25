# Plan: JSDoc Type Annotations

_Session: 2026-02-25-1317-jsdoc-types_

---

## Step 1 — Create `js/types.js`

Single file with all `@typedef` definitions. No imports, no runtime code — pure type declarations.

Define in this order:
1. String union types (`Visibility`, `AccessLevel`, `NodeAlertLevel`, `GlobalAlertLevel`, `DecayState`, `GamePhase`, `RunOutcome`, `Grade`, `Rarity`)
2. Leaf data shapes (`Vulnerability`, `Macguffin`, `ExploitCard`)
3. Composite shapes (`NodeState`, `IceState`, `PlayerState`, `MissionState`)
4. Top-level state (`GameState`)
5. Key event payloads (the cross-module ones most prone to drift)

---

## Step 2 — Add `@ts-check` and type imports to all `js/` files

For each file:
- Add `// @ts-check` as the first line
- Import needed types with `/** @import { GameState, NodeState, ... } from './types.js' */`
  (or the equivalent `@typedef { import('./types.js').GameState } GameState` form)
- Annotate key variables and return types where they're not inferrable:
  - The `state` variable in `state.js`: `/** @type {GameState} */`
  - The `getState()` return: `/** @returns {GameState} */`
  - Handler callbacks receiving event payloads in `log-renderer.js` and `visual-renderer.js`

Files to touch, in priority order:
1. `state.js` — central state shape, highest value
2. `events.js` — can annotate emitEvent with payload types (or leave generic)
3. `log-renderer.js` — event payload destructuring
4. `visual-renderer.js` — state destructuring
5. `console.js` — state reads
6. `ice.js` — IceState mutations
7. `exploits.js` — ExploitCard generation
8. `combat.js` — ExploitResult (local shape, may not need import)
9. `loot.js` — Macguffin shapes
10. `main.js`, `cheats.js`, `timers.js` — lower priority, annotate if errors surface

---

## Step 3 — Run tsc and fix errors

```bash
npx tsc --noEmit --allowJs --checkJs --target ES2020 --moduleResolution bundler --module ES2020
```

Or install tsc locally. Fix whatever surfaces — these will be real field name mismatches or null safety gaps. Common expected findings:

- `state.ice` accessed without null check somewhere
- Field name mismatches (the whole point)
- `node.grade` used where `Grade | undefined` is possible (some nodes may lack a grade)

Do not add `// @ts-ignore` as a fix — either fix the code or narrow the type definition.

---

## Step 4 — Commit

Single commit: `Add: JSDoc @ts-check type annotations`

---

## Notes

- If `tsc` chokes on Cytoscape (which has no types in the project), add a minimal `jsconfig.json` or skip `--checkJs` on `graph.js` with a per-file `// @ts-nocheck`.
- The `/** @import */` syntax requires TypeScript 5.5+. If the installed version is older, use the `@typedef { import('./types.js').Foo } Foo` form instead.
