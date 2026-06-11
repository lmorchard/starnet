# Research — Overworld Meta-State (codebase sweep)

Findings from an `Explore` sweep of the run lifecycle, persistence, and meta
surfaces. Line numbers reflect the codebase at session start and may drift —
re-verify in `plan` / `execute`.

> **Doc drift caught:** the project `CLAUDE.md` "File Structure" section still
> documents the *pre-reorg* layout (`js/main.js`, `js/state/`, `js/combat.js`).
> The actual code is split into `js/core/` (pure) and `js/ui/` (DOM), per
> `MEMORY.md` and confirmed by this sweep. Use the `js/core/` // `js/ui/` paths
> below, not CLAUDE.md's. (CLAUDE.md fix is out of scope — noted in `notes.md`.)

## Run lifecycle

- **Three parallel entry points, one shared run engine:** browser `js/ui/main.js`;
  headless `scripts/playtest.js`; bot `scripts/bot/run.js` → `scripts/lib/headless-engine.js`.
- **Run config:** `getSelectedNetwork()` in `js/ui/main.js` parses URL params
  (`?network=`, `?seed=`, `?threat=`, `?wealth=`, `?complexity=`, `?depth=`,
  `?lanGrade=`, `?recipe=`). Network builders return `{ graphDef, meta }`; `meta`
  carries `startNode`, `startCash`, `moneyCost`, `spec`, `ice`, **`startHand`**.
- **Startup:** `initGame(buildNetworkFn, seedString, opts)` builds state, generates
  per-node vulns + macguffins (seeded), flags one macguffin as mission target,
  spawns ICE, emits `RUN_STARTED`.
- **End:** `jackOut()` → `endRun("success")` (`js/core/actions/action-context.js:28`).
  Trace capture → `endRun("caught")`, which **zeroes cash** (`js/core/state/index.js:251`).
  `endRun(outcome)` clears timers, sets `phase="ended"`, emits `RUN_ENDED`, shows
  the end-screen.
- **"Run again"** re-invokes `initGame()` with the same builder (`js/ui/main.js:149-157`)
  — fully fresh state, zero carry-over. **This is the seam the hub replaces.**

## Persistence

- **Save/load exists but is single-run:** `js/ui/save-load.js` (downloads a JSON
  snapshot; `restoreFromFile(file, opts)` rehydrates).
- **`GameState` is strictly single-run** (`js/core/types.js:200-274`): `seed`, `spec`,
  `moneyCost`, `nodes`, `adjacency`, `nodeGraph`, `player{cash,hand}`, `phase`,
  `runOutcome`, `mission`, `ice`, `globalAlert`. **No cross-run fields** — no bank,
  inventory, reputation, or unlocks.
- `player.hand` is regenerated each run via `generateStartingHand()`.
- `resetGame()` (`scripts/lib/headless-engine.js:77-88`) wipes the event bus + timers,
  guaranteeing run isolation.
- **Implication:** meta-state MUST live OUTSIDE `GameState`, in a separate
  player-scoped store. Adding cross-run fields to `GameState` would fight
  run-isolation and the save-load snapshot semantics.

## Existing meta surfaces / what to reuse

- **Darknet store:** `js/ui/store.js` + component `js/ui/components/starnet-store.js`,
  reached via the WAN node `access-darknet` action. Pauses the LAN, spends **in-run
  cash** on cards **into the current hand**. The pattern to generalize for the hub;
  today its purchases evaporate at run end.
- **Mining** yields exploit cards into the current hand (per `MANUAL.md`) — another
  inventory feed to redirect at the profile.
- **In-network qualities** `js/core/node-graph/qualities.js` are per-run set-piece
  state — **do NOT reuse** for player standings; player qualities need their own store.
- **Biomes:** only `data/biomes/corporate.js` exists.
- **State mutation pattern:** `GameState` mutations route through a versioned
  `mutate()` wrapper in `js/core/state/index.js` (submodule setters call it). The
  profile model should follow an analogous pure-setter pattern.

## Node hierarchy

- SPEC's Universe→…→Device hierarchy is **aspirational only** — no code represents
  it. Generation stops at a single seeded LAN. (Confirms: the hub's target list is a
  flat menu, not a hierarchy traversal, in v1.)

## Architecture note

- `js/` is split: `js/core/` (pure JS, no DOM) and `js/ui/` (DOM/Cytoscape/Lit). The
  profile **data model + mutations belong in `js/core/`**; the localStorage binding
  and the hub component belong in `js/ui/`.
