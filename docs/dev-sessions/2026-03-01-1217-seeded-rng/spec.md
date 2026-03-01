# Spec: Seeded Random Number Generation

## Problem

All randomness in the game uses `Math.random()`, making runs non-reproducible. A given game state snapshot can't be replayed deterministically — combat rolls, ICE movement, loot generation, and exploit card shuffles all vary. This blocks reproducible testing, bug reports, and future replay features.

## Design

### New module: `js/rng.js`

A seeded PRNG module that replaces all gameplay `Math.random()` calls. Uses **Mulberry32** (4-line 32-bit PRNG, good distribution, single integer state).

### Seed format

Seeds are **strings** — any user-provided string gets hashed to a 32-bit integer via a simple string hash (e.g., djb2 or FNV-1a). Examples: `"neon-ghost-42"`, `"test-run-1"`, `"hello"`.

If no seed is provided, one is generated randomly (using `Math.random()` for this bootstrap only) and converted to a readable string like `"run-XXXX"` where XXXX is a random hex suffix.

The string seed is stored in game state and displayed to the player so interesting runs can be shared.

### Multiple named streams

Each game subsystem gets its own independent PRNG stream, seeded deterministically from the master seed. This way, adding a new random call to one system doesn't shift sequences in others.

| Stream | Seeded from | Used by |
|--------|------------|---------|
| `exploit` | `hash(seed + "exploit")` | Card generation, vuln generation, starting hand, quality rolls |
| `combat` | `hash(seed + "combat")` | Exploit resolution rolls, disclosure chance, partial burn, flavor text |
| `ice` | `hash(seed + "ice")` | Movement direction, eject target selection |
| `loot` | `hash(seed + "loot")` | Macguffin type/value generation, loot counts |
| `world` | `hash(seed + "world")` | ICE start position, reboot duration, misc |

Each stream is an independent Mulberry32 instance with its own 32-bit state.

### API

```js
// Initialize all streams from a master seed string
initRng(seedString)

// Get a random float [0, 1) from a named stream
random(stream)           // e.g., random("combat")

// Helpers — all use the named stream
randomInt(stream, min, max)     // inclusive integer range
randomPick(stream, array)       // random element from array
shuffle(stream, array)          // in-place Fisher-Yates shuffle, returns array

// Serialization
serializeRng()           // → { seed, streams: { combat: state, ice: state, ... } }
deserializeRng(data)     // restore all stream states

// For display
getSeed()                // → the original seed string
```

### State and serialization

GameState gains:
```
seed: string             // the original seed string (for display/restart)
```

The PRNG internal state (per-stream 32-bit integers) is serialized alongside timers in `serializeState()` / `deserializeState()`, NOT stored in GameState itself (same pattern as timers — runtime state that's serialized but not part of the logical game state object).

### What stays on Math.random()

- `js/graph.js` — visual-only effects (read sector animation). Not gameplay, not serialized.
- Seed bootstrap — generating the initial seed string when none is provided.

### What changes

Every other `Math.random()` call in gameplay code gets replaced with the appropriate `rng.random(stream)` or helper call.

Tests that monkey-patch `Math.random` get reworked to use `initRng(knownSeed)` instead.

### Playtest harness

```bash
node scripts/playtest.js reset                    # random seed
node scripts/playtest.js reset --seed "neon-ghost" # deterministic seed
node scripts/playtest.js "status summary"          # shows seed
```

The seed is displayed in `status summary` and `status full` output.

## Out of scope

- Visual effect PRNG seeding (graph.js stays on Math.random)
- Replay recording/playback (this lays the foundation but doesn't build replay UI)
- Cryptographic-quality randomness (not needed for a game)
