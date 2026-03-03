# Session Plan: ice-host Node + pkill Action

## Phase 1: Types and ActionContext

**1.1** `js/core/types.js` — Add `pkillIce: () => void` to the `ActionContext` typedef.

**1.2** `js/core/actions/action-context.js`:
- Import `stopIce`, `disableIce` from `../ice.js`
- Add `pkillIce: () => { stopIce(); disableIce(); }` to `buildActionContext()`

## Phase 2: Node Type Registry

**2.1** `js/core/actions/node-types.js`:

Add `"ice-host"` to `NODE_TYPES`:
```js
"ice-host": {
  gateAccess: "owned",
  behaviors: [],
  actions: [
    {
      id: "pkill",
      label: "PKILL ICE",
      available: (node, state) =>
        node.accessLevel === "owned" && !!(state.ice?.active),
      desc: () => "Terminate the ICE process.",
      execute: (_node, _state, ctx) => ctx.pkillIce(),
    },
  ],
},
```

Remove `"iceResident"` from `"security-monitor"` behaviors:
```js
"security-monitor": {
  gateAccess: "owned",
  behaviors: ["monitor"],   // ← removed "iceResident"
  ...
```

## Phase 3: Network Generation

**3.1** `js/core/network/biomes/corporate/gen-rules.js`:

Add to `ROLES`:
```js
"ice-host": "ice-host",
```

Add to `NODE_RULES`:
```js
"ice-host": {
  singleton:   true,
  security:    true,
  iceResident: true,
  depth:       4,           // visual hint; actual depth = depthBudget + 1
  connectsTo:  [],
  leaf:        true,
  gradeRole:   "hard",
  labels:      ["ICE-HOST", "ICE-PROC", "ICE-DAEMON"],
},
```

Add to `LAYERS` (immediately after the `monitor` layer):
```js
{
  role:      "ice-host",
  count:     1,
  depth:     ({ tc }) => tc.depthBudget + 1,
  gradeRole: "hard",
  connectTo: "monitor",    // edge: security-monitor ↔ ice-host
},
```

**3.2** `js/core/network/network-gen.js`:
```js
ice: {
  grade:     time.iceGrade,
  startNode: spawnedByRole["ice-host"][0],   // was: spawnedByRole.monitor[0]
},
```

## Phase 4: Bot Player

**4.1** `scripts/bot-player.js`:
- Add `"ice-host"` to `SECURITY_TYPES` set

**4.2** `docs/BOT-PLAYER.md`:
- Add to "What the Bot Does NOT Do": `pkill` — never uses pkill to terminate ICE

## Phase 5: Tests

**5.1** Add unit tests in `js/core/actions/node-types.test.js` (or appropriate existing test file):
- `pkill` available when ice-host is owned and ICE is active
- `pkill` not available when ICE is inactive
- `pkill` not available when ice-host is not yet owned
- `pkill` execute calls `ctx.pkillIce()`

**5.2** Delete and regenerate network-gen snapshot fixtures:
- `rm tests/fixtures/network-gen-*.json`
- `make test` — new fixtures will be generated on first run
- `make test` again — fixtures should be stable

## Phase 6: Documentation

**6.1** `MANUAL.md`:
- Add `ice-host` to the node types table
- Add `pkill` to the console commands / node actions reference

**6.2** `docs/BACKLOG.md`:
- Mark any related item if present

## Commit Strategy

One commit per phase (or combine phases where it makes sense):
- Phase 1+2: "feat: add ice-host node type with pkill action"
- Phase 3: "feat: add ice-host to corporate biome, move ICE startNode"
- Phase 4: "chore: add ice-host to bot SECURITY_TYPES, update BOT-PLAYER.md"
- Phase 5: "test: pkill unit tests + regenerated network-gen snapshots"
- Phase 6: "docs: update MANUAL.md with ice-host and pkill"
