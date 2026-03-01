# Plan: Seeded Random Number Generation

## Context

26 `Math.random()` call sites across 7 gameplay files, plus 4 test monkey-patches. All need to migrate to a seeded PRNG module with named streams. Visual-only randomness in `graph.js` stays on `Math.random()`.

## Call site inventory

| File | Sites | Stream | Notes |
|------|-------|--------|-------|
| `js/combat.js` | 6 | combat (2 rolls), exploit (4 flavor/burn) | Has local helpers to remove |
| `js/exploits.js` | ~10 | exploit | Has `randomFrom`, `rollRarity`, `randomQuality`, `pickTargetVulns` |
| `js/ice.js` | 7 | ice | All `randomPick` pattern |
| `js/loot.js` | 3 | loot | Has `randomInt`, `randomFrom`, macguffin ID |
| `js/node-types.js` | 1 | loot | Macguffin count in lootable behavior |
| `js/node-orchestration.js` | 1 | world | Reboot duration |
| `js/state/index.js` | 1 | world | ICE start node |

Tests: `integration.test.js` (1 site), `gate-access.test.js` (3 sites).

## Files to create/modify

| File | Change |
|------|--------|
| `js/rng.js` | **New** — Mulberry32 PRNG, named streams, helpers, serialization |
| `js/types.js` | Add `seed` to `GameState` |
| `js/state/index.js` | Init seed in `initState()`, serialize/deserialize RNG state |
| `js/combat.js` | Replace 6 `Math.random()` calls |
| `js/exploits.js` | Replace ~10 calls, remove local `randomFrom`/`rollRarity`/`randomQuality` |
| `js/ice.js` | Replace 7 calls |
| `js/loot.js` | Replace 3 calls, remove local `randomInt`/`randomFrom` |
| `js/node-types.js` | Replace 1 call (lootable behavior needs rng import) |
| `js/node-orchestration.js` | Replace 1 call |
| `scripts/playtest.js` | Add `--seed` flag, display seed |
| `js/console.js` | Show seed in status output |
| `tests/integration.test.js` | Replace Math.random monkey-patch with `initRng` |
| `tests/gate-access.test.js` | Replace Math.random monkey-patches with `initRng` |
| `CLAUDE.md` | Update seeded RNG note |

## Implementation steps

---

### Step 1: Create `js/rng.js` — the PRNG module

New file with:

**Mulberry32 algorithm** — a function that takes a 32-bit seed and returns a `() => float` generator:
```js
function mulberry32(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

**String-to-integer hash** (djb2):
```js
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}
```

**Stream names constant:**
```js
const STREAMS = ["exploit", "combat", "ice", "loot", "world"];
```

**Module state:**
- `seed` — the original seed string
- `generators` — `Map<string, { fn: () => float, state: number }>` per stream

**Public API:**
- `initRng(seedString?)` — if no seed, generate `"run-XXXX"` using `Math.random()`. Hash seed + stream name for each stream. Store seed.
- `random(stream)` — returns `[0, 1)` float from named stream
- `randomInt(stream, min, max)` — inclusive integer range
- `randomPick(stream, array)` — random element
- `shuffle(stream, array)` — in-place Fisher-Yates, returns array
- `randomId(stream)` — 6-char alphanumeric string for unique IDs
- `getSeed()` — returns the seed string
- `serializeRng()` — returns `{ seed, streams: { combat: stateInt, ... } }`
- `deserializeRng(data)` — restores all stream states from serialized data

**Implementation detail for serialization:** Mulberry32 state is just a single integer. We need to track it. The generator closure captures `s` — to serialize it, we store `s` after each call. Simplest: don't use closures internally. Instead, store state in a plain object per stream and have `random()` advance it inline.

```js
const streams = {};

function advance(state) {
  let s = (state + 0x6D2B79F5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { next: s, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}

export function random(stream) {
  const st = streams[stream];
  const { next, value } = advance(st.state);
  st.state = next;
  return value;
}
```

This makes state directly accessible for serialization.

Run `make check` — module exists but isn't imported anywhere yet, so no behavior change.

---

### Step 2: Wire `initRng` into game initialization and serialization

**`js/types.js`** — Add `seed: string` to `GameState`.

**`js/state/index.js`**:
- Import `initRng`, `serializeRng`, `deserializeRng`, `getSeed` from `rng.js`
- In `initState(networkData, seedString?)`: call `initRng(seedString)` before any generation. Store `seed: getSeed()` in state.
- In `serializeState()`: include `_rng: serializeRng()` alongside `_timers`
- In `deserializeState()`: call `deserializeRng(snapshot._rng)` if present

**`scripts/playtest.js`**:
- Parse `--seed <value>` flag
- Pass seed to `initState(NETWORK, seed)` on reset
- No other changes yet — `Math.random()` calls still work alongside

Run `make check` — seed stored and serialized, but not consumed yet.

---

### Step 3: Replace `Math.random()` in `js/exploits.js`

This is the biggest file. Replace:
- `randomFrom(arr)` → `randomPick("exploit", arr)` (delete local helper)
- `rollRarity()` → inline using `random("exploit")` with same weighted logic
- `randomQuality()` → inline using `random("exploit")`
- `pickTargetVulns()` shuffle → `shuffle("exploit", [...pool])`
- `generateVulnerabilities()` count + shuffle → `randomInt("exploit", min, max)` + `shuffle("exploit", ...)`

Import `{ random, randomInt, randomPick, shuffle }` from `./rng.js`.

Run `make check`.

---

### Step 4: Replace `Math.random()` in `js/loot.js` and `js/node-types.js`

**`js/loot.js`**:
- Delete local `randomInt()` and `randomFrom()`
- Import from `rng.js`, use stream `"loot"`
- Macguffin ID: replace `Math.random().toString(36).slice(2, 6)` with `randomId("loot")`

**`js/node-types.js`** — lootable behavior `onInit`:
- The behavior atom is a plain object — it has no imports. The `ctx` pattern is used for dependency injection. Add `randomInt` to the ctx passed to `onInit` in `state/index.js`, or import rng.js directly in node-types.js.
- Simpler: import `randomInt` from `rng.js` directly (node-types.js already has no circular dependency issues with rng.js).

Run `make check`.

---

### Step 5: Replace `Math.random()` in `js/combat.js`

- Import `{ random, randomPick }` from `./rng.js`
- Line 67: `random("combat")` — success roll
- Line 72: `random("combat")` — disclosure roll
- Line 102: `random("combat")` < 0.6 — partial burn
- Lines 149, 155, 159: `randomPick("combat", pool)` — flavor text

Note: the plan originally assigned partial burn and flavor to "exploit" stream but on reflection, these happen during combat resolution, so "combat" is more natural. All 6 calls use "combat".

Run `make check`.

---

### Step 6: Replace `Math.random()` in `js/ice.js`

- Import `{ randomPick }` from `./rng.js`
- All 7 sites: `randomPick("ice", neighbors)` or `randomPick("ice", nonRebooting)`

Run `make check`.

---

### Step 7: Replace `Math.random()` in `js/node-orchestration.js` and `js/state/index.js`

**`js/node-orchestration.js`** — reboot duration:
- Import `{ random }` from `./rng.js`
- `const durationMs = 1000 + random("world") * 2000;`

**`js/state/index.js`** — ICE start node:
- Already imports from rng.js (step 2). Use `randomPick("world", nodeIds)`.

Run `make check`.

---

### Step 8: Update tests

**`tests/integration.test.js`** and **`tests/gate-access.test.js`**:
- Replace `Math.random = () => 0` pattern with `initRng("test-seed-zero")` in beforeEach
- For tests that need forced success: pick a seed that makes `launchExploit` succeed, OR add a test helper. Since we need deterministic success, the cleanest approach is: `initRng` with a known seed, then verify the test still works. If the seed doesn't produce success on the first try, we can use a loop to find one, or we can temporarily expose a way to force the combat stream.
- Actually, the simplest migration: keep using `initRng("test")` in beforeEach for general setup, and for tests that need forced combat success, temporarily set the combat stream state to a value that produces a roll < threshold. Or: add a `_forceNextRandom(stream, value)` test-only helper to rng.js.

Better approach: add `_setStreamState(stream, state)` to rng.js (prefixed with `_` to signal test-only). Tests can set combat stream to a state that produces 0.0 on next call. We'd need to find that state — or just provide `_forceNext(stream, value)` that queues a value.

Simplest: `_forceNext(stream, value)` — pushes a value that `random(stream)` returns once before resuming normal sequence.

Run `make check`.

---

### Step 9: Playtest harness + console status

**`scripts/playtest.js`**:
- `--seed` flag already parsed (step 2)
- Show seed in reset output: `[SYS] Initialized. Seed: "neon-ghost". Network: 11 nodes.`

**`js/console.js`**:
- `cmdStatusSummary`: add seed to first line
- `cmdStatusFull`: add seed under `### PLAYER`

Run `make check`.

---

### Step 10: Update docs and clean up

- **`CLAUDE.md`**: Update the seeded RNG backlog note — mark as implemented, document the module
- **`docs/BACKLOG.md`**: Mark seeded RNG item as done
- **`MANUAL.md`**: Add seed info (shown in status, `--seed` for harness)
- Remove any leftover `Math.random` references in gameplay code (grep to verify)

Run `make check`. Run playtest harness with a fixed seed twice and verify identical output.

---

## Prompt sequence

### Prompt 1: Create `js/rng.js`
Create the new PRNG module with Mulberry32, djb2 hash, 5 named streams, full API (random, randomInt, randomPick, shuffle, randomId, getSeed, serializeRng, deserializeRng, initRng), plus `_forceNext` test helper. Run `make check`.

### Prompt 2: Wire into state init + serialization
Add `seed` to GameState in types.js. Wire `initRng`/`serializeRng`/`deserializeRng` into state/index.js. Add `--seed` parsing to playtest.js and pass to initState. Run `make check`.

### Prompt 3: Replace Math.random in exploits.js
Import rng helpers, replace all ~10 call sites, delete local randomFrom/rollRarity/randomQuality helpers. All use "exploit" stream. Run `make check`.

### Prompt 4: Replace Math.random in loot.js + node-types.js
Import rng helpers, replace 3+1 call sites, delete local helpers in loot.js. Use "loot" stream. Run `make check`.

### Prompt 5: Replace Math.random in combat.js
Import rng helpers, replace 6 call sites. Use "combat" stream. Run `make check`.

### Prompt 6: Replace Math.random in ice.js
Import rng helpers, replace 7 call sites. Use "ice" stream. Run `make check`.

### Prompt 7: Replace Math.random in node-orchestration.js + state/index.js
Replace 1+1 call sites. Use "world" stream. Run `make check`.

### Prompt 8: Update tests
Replace Math.random monkey-patches in integration.test.js and gate-access.test.js with initRng + _forceNext. Run `make check`.

### Prompt 9: Console status + playtest display
Show seed in status summary/full. Show seed in playtest reset output. Run `make check`. Verify determinism: run playtest with fixed seed twice, diff output.

### Prompt 10: Docs cleanup
Update CLAUDE.md, BACKLOG.md, MANUAL.md. Final `grep Math.random` to confirm no stray calls in gameplay code. Run `make check`.
