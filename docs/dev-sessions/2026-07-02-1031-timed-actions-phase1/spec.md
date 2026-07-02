# Spec — Timed actions, Phase 1: declarable timing + generic legible feedback (#187)

## Goal & intent

Two intents, from the design conversation with Les:

1. **Nearly every player action should be a time-bound, abortable process** — an *exposure /
   commitment window*. While it runs you're committed and exposed (ICE closing in, the trace/heat
   climbing) and can bail with ABORT / navigating away. This turns "click to resolve" into "commit,
   watch, disengage" — the evasion tension the loop wants.
2. **Every timed action must be a *legible* event** — something the player can see and hear, not
   just a console log line. Today ~13 authored set-piece actions ("Extract Key", "Crack Vault", …)
   are duds: no overlay, no drone, one log line. That's the real gap.

**North-star (tracked in #288, not resolved here):** collapse special-cased "core" verbs into one
"action-owns-its-process" model so behavior lives on the authoring surfaces, not in hand-wired
exceptions.

## Scope

**Phase 1 (this spec):** the foundation + generic legibility + a proof slice.
- Make timing **declarable per action** (`ActionDef.timed`), so both core trait-verbs and inline
  set-piece actions use one path.
- **Unify busy/abort** into a single `isNodeBusy` across the operator and process (#282) runtimes.
- An **action → feedback mapping** (`{overlay, drone, completionCue}`) with inline → central →
  default resolution, and a **generic default** overlay + drone + completion cue so nothing is a
  silent dud.
- **Prove end-to-end** by converting three actions: `corrupt` (core) + `extract-key`, `crack-vault`
  (set-piece).

**Phase 2 (follow-up, stays under #187):** breadth — convert the remaining instant verbs (kick-short,
scrub-logs, sniff, replay) + the rest of the ~13 set-piece actions; finalize instant exceptions;
per-action durations; `make census` tuning + feel pass.

**Deferred (own issues):** full operator↔process runtime convergence + core-verb migration onto
`timed` → **#288**. Bespoke per-action visual/audio palette (assigned across ranges of actions) →
future arc.

## Current state (origin: `main` @ #282)

- **Single-node timed actions** run on the node-graph **`timed-action` operator**
  (`js/core/node-graph/operators.js`): progress in node attrs (`_ta_<action>_*`), emits
  `ACTION_FEEDBACK` (start/progress/complete), which drives overlays (`js/ui/overlays/`) + Strudel
  action drones. Core verbs (probe/xploit/dump/fetch/mine/lie-low/reboot) get their operator config
  hand-wired on a **trait** (`traits.js`); the start-action `effects` merely arm it
  (`set-attr activeAttr=true` + zero progress). Registry: `TIMED_ACTIONS` / `ABORTABLE_FLAGS`
  (`timed-actions.js`); `NOT_BUSY` (action-templates.js) enforces one-at-a-time; ABORT + nav-cancel
  (game-ctx.js, generalized in #225) cancel.
- **Multi-node / over-time orchestration** runs on **`js/core/processes.js`** (#282): `state.processes`
  + `registerProcess`/`stepProcesses` (central tick), `PROCESS_*` events. SWEEP is the first client
  and *composes* the operator. Busy/abort via `activeProcessOnNode` / `abortNodeProcesses`, bridged
  by hand into `getAvailableActions` (ABORT affordance) and the nav-cancel handler.
- **Set-piece actions** are inline `{id,label,requires,effects}` on set-piece node defs
  (`data/biomes/corporate-pieces/*.js`), surfaced under the synthetic **EXEC** menu (`isScriptAction`
  = any non-core verb). They run **instantly** — the EXEC path applies their `effects` synchronously.
  ~13 exist today (Scan Lock, Crack Vault, Extract Token/Key, Unlock/Decrypt Vault, Activate,
  Corrupt IDS, Muffle Sensor, Neutralize Tamper Relay, Spoof Sensor, Disarm Latch, Subvert Relay).
- **Instant-but-keep:** cancel-trace (panic button), access-darknet (UI transition), disconnect,
  abort, target/untarget/jackout.

## Design

### 1. Declarable timing — `ActionDef.timed`

An `ActionDef` gains an optional block:

```js
{ id: "extract-key", label: "Extract Key",
  timed: { durationTable: { S:40, A:35, B:30, C:25, D:20, F:12 } /* or */ duration: 20,
           abortable: true /* default */ },
  effects: [ /* the original instant effects — become onComplete */ ] }
```

At **node construction**, for any action carrying `timed`, the builder synthesizes the *same*
`timed-action` operator config the runtime already has (activeAttr derived from the action id,
duration from the block, `onComplete` = the action's `effects`) and rewrites the action's own
`effects` to the arm pattern (`set-attr activeAttr=true` + zero progress). **One runtime engine, one
config shape** — `timed` generates the config the operator already consumes; it is not a second
execution path. Core verbs are a drop-in for this later (migration deferred to #288).

The activeAttr naming for declared actions is generated + collision-safe (e.g. `_ta_active_<id>`),
so arbitrary set-piece verbs never need registry edits.

### 2. Unified busy / abort — `isNodeBusy`

Replace the enumerated operator flag-list *and* the parallel process check with one predicate:

```
isNodeBusy(state, node) = (node has any active timed-action operator) OR activeProcessOnNode(state, node)
```

- `NOT_BUSY` (the one-at-a-time guard spread into startable actions) uses `isNodeBusy`.
- **ABORT** shows when `isNodeBusy`, and its single execute path cancels **both** an active operator
  (reset activeAttr/progress/duration + `clearOnCancel`) and any active process (`abortNodeProcesses`).
- **Nav-cancel** (game-ctx) uses the same unified query + abort path.

"Active timed-action operator on a node" is answered by the existing `getActiveTimedAction(nodeId)`;
a new condition type (e.g. `no-active-timed-action`) backs `NOT_BUSY`, so declared set-piece actions
(with generated activeAttrs, not in the enumeration) are covered without registry edits. This is the
concrete down-payment toward #288 — one notion of "busy," not the current hand-bridged two.

**Coordination with #286 (reactive substrate / cascade) — Phase 1 is additive on both surfaces:**
- The **`processes.js` contract is untouched.** `isNodeBusy` *composes* `activeProcessOnNode` (calls
  it); `state.processes`, `activeProcessOnNode`, `abortNodeProcesses`, and the `PROCESS_*` events are
  unchanged. #286's SWEEP reimplementation (new `cascade` operator, slimmed process `step`) depends
  on that contract — we do not alter it.
- **No rename/relocate of the operator-side registry** (`timed-actions.js`, `ABORTABLE_FLAGS` /
  `TIMED_ACTION_FLAGS`) in Phase 1. The generalized busy query is *added alongside* the existing
  enumeration, not a replacement. If a rename becomes necessary, ping the #286 session first. The
  actual framework dissolve/convergence (and retiring the enumeration) is deferred to **#288**.

### 3. Feedback mapping + generic default

A **feedback profile** = `{ overlay, drone, completionCue }` (all optional name strings). Resolution
is **field-level, layered**:

```
inline ActionDef.feedback.<field>  ??  ACTION_FEEDBACK_PROFILES[actionId].<field>  ??  DEFAULT_PROFILE.<field>
```

- **Inline** on the ActionDef is the set-piece authoring surface (feedback authored where the puzzle
  is composed).
- **Central** `ACTION_FEEDBACK_PROFILES` holds the core-verb mappings (probe→"probe-sweep", …, so
  they are unchanged) and is where the future palette assigns feedback across ranges of actions.
- **Default** profile is the generic overlay + drone + cue.

Wiring stays decoupled from action defs: the timed-action operator includes the action's inline
`feedback` on the `ACTION_FEEDBACK` `start` payload; the browser resolves central + default. Then:
- **Overlay:** the overlay registry becomes *name → element* (today *action → element*); the
  dispatcher does action → profile.overlay → element, falling back to the generic default. Core
  verbs get central entries → zero behavior change.
- **Audio:** the Strudel drone player resolves `profile.drone` (default = generic drone) instead of
  `resolveDrone(action)`; completion resolves `profile.completionCue`.

### 4. The generic default feedback (feel — prototype-driven)

The one piece a spec can't pin down. Built like the waveforms: a throwaway **slider-driven Canvas
lab in `tmp/`**, iterated live with Les, then the locked values ported into a real overlay module +
tests.

- **Visual:** a stroked, angular, node-anchored progress indicator (retro-vector: strokes not fills;
  clockwise = player agency; phosphene glow via the cheap overlay bloom). Generic — legible as "a
  process is running here, this far along," deliberately distinct from the bespoke core sweeps.
- **Audio:** a generic sustained, progress-driven action drone (existing Strudel drone idiom) + a
  completion one-shot cue. Auditioned by ear against the visual.

### 5. Proof slice

- **`corrupt`** (core, currently instant) → `timed`. Proves a core verb on the declarable path and
  the "effect resolves on completion" move: its `set-attr forwardingEnabled=false` shifts into
  `onComplete`, giving IDS subversion a real exposure window (the issue's called-out natural fit).
- **`extract-key`, `crack-vault`** (set-piece) → inline `timed` + default `feedback`. Proves inline
  authoring, the EXEC path running timed, and duds → legible.

## Testing

- **Unit:** `timed` → synthesized operator config matches the hand-wired shape; `isNodeBusy`
  unification (a node with any active operator *or* process blocks new actions + shows ABORT);
  feedback resolution is field-level layered (inline → central → default).
- **Integration:** dispatch a `timed` set-piece action → does *not* resolve instantly → ticks →
  `onComplete` fires the original effects exactly once; ABORT and PLAYER_NAVIGATED both cancel it and
  reset progress; `ACTION_FEEDBACK` carries the resolved overlay/drone/cue names (default when
  unmapped).
- **No-regression:** existing core verbs unchanged (same durations, same bespoke overlays via central
  entries); SWEEP + the process framework still work (busy/abort still cancels a sweep).
- **Balance:** `make census` after `corrupt` goes timed (changes IDS-subversion timing), same-seed vs
  main.

## Non-goals

- Phase 2 breadth / remaining actions (stays under #187).
- Operator↔process runtime convergence + core-verb migration onto `timed` (#288).
- Bespoke per-action visuals/audio (future palette arc).
- Any change to SWEEP, heat, or the alert sensors' numbers.

## Verification gates

`make check` green; `make census` no regression (same-seed vs main); browser smoke (the three
converted actions show the generic overlay + drone + completion cue, are abortable, and honor
one-at-a-time against both operator and process busy); preview-harness demo for the generic overlay.
