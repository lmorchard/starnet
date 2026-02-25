# Spec: JSDoc Type Annotations

_Session: 2026-02-25-1317-jsdoc-types_
_Branch: jsdoc-types_

---

## Goal

Add `@ts-check` and JSDoc `@typedef` annotations to the codebase to catch field-name drift and make data shapes explicit — without introducing a build step.

Zero build tooling is preserved. VS Code (and `tsc --noEmit --allowJs`) will provide type checking purely from JSDoc comments.

---

## What to type

### String union types (enum-like)

These are currently loose strings with no enforcement. Any typo silently produces `undefined`.

| Name | Values |
|---|---|
| `Visibility` | `"hidden" \| "revealed" \| "accessible"` |
| `AccessLevel` | `"locked" \| "compromised" \| "owned"` |
| `NodeAlertLevel` | `"green" \| "yellow" \| "red"` |
| `GlobalAlertLevel` | `"green" \| "yellow" \| "red" \| "trace"` |
| `DecayState` | `"fresh" \| "worn" \| "disclosed"` |
| `GamePhase` | `"playing" \| "ended"` |
| `RunOutcome` | `"success" \| "caught"` |
| `Grade` | `"S" \| "A" \| "B" \| "C" \| "D" \| "F"` |
| `Rarity` | `"common" \| "uncommon" \| "rare"` |

### Data shape typedefs

- `Vulnerability` — `{ id, name, rarity, patched, patchTurn, hidden, unlockedBy? }`
- `Macguffin` — `{ id, name, cashValue, collected, isMission? }`
- `ExploitCard` — `{ id, name, rarity, quality, usesRemaining, decayState, targetVulnTypes }`
- `NodeState` — full per-node game state shape (all 12 fields)
- `IceState` — ICE entity state
- `PlayerState` — `{ cash, hand }`
- `MissionState` — `{ targetMacguffinId, targetName, complete }`
- `GameState` — top-level state object

### Event payload typedefs (optional but valuable)

Payload types for the most cross-module events — at minimum the ones where field name drift is a real risk:
- `NodeAccessedPayload`, `NodeRevealedPayload`, `ExploitSuccessPayload`, `ExploitFailurePayload`, `AlertGlobalRaisedPayload`, `IceMovedPayload`

---

## What NOT to type

- `@param` / `@returns` on every function — busywork, adds noise
- Local variables with obvious types
- Cytoscape internals in `graph.js` — third-party API, not our data
- The `data/network.js` shape — static input, not mutated game state

---

## Approach

1. Create `js/types.js` — pure typedef definitions, no runtime code
2. Add `// @ts-check` to each `js/` file
3. Import types via `@import` or `@typedef ... import` at the top of each file where used
4. Fix any errors VS Code / tsc surfaces — these are real bugs or drift

Types live in one place (`types.js`) and are imported where needed. No scattering typedefs across files.

---

## Acceptance criteria

- [ ] `js/types.js` exists with all typedef definitions
- [ ] All `js/` files have `// @ts-check` at top
- [ ] No type errors under `tsc --noEmit --allowJs --checkJs --strict`
  - (or at minimum: no errors on the data shapes we defined)
- [ ] All string union types are used consistently (e.g. no `"locked"` misspellings)
- [ ] No new runtime behavior — purely annotations

---

## Out of scope

- Migrating to full TypeScript (`.ts` files, build step)
- Typing the Cytoscape API surface
- Typing `data/network.js` (input data, not game state)
- Adding `@param`/`@returns` to functions that don't cross module boundaries
