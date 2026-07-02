# Timed Actions Phase 1 — Implementation Plan

> **For agentic workers:** implement task-by-task; TDD (failing test → minimal code → green → commit).
> Phase 4a is a **human-in-the-loop feel loop with Les** — NOT autonomous. Everything else is
> autonomous-friendly.

**Goal:** Make timing declarable per-action (`ActionDef.timed`) so core verbs *and* inline set-piece
actions share one path, unify busy/abort, add an action→feedback mapping with a generic default so no
timed action is a silent dud, and prove it on `corrupt` + `extract-key` + `crack-vault`.

**Architecture:** `timed` on an ActionDef synthesizes — at node construction — the *same*
`timed-action` operator the runtime already ticks (activeAttr generated, `onComplete` = the action's
effects, effects rewritten to the arm pattern). Busy/abort unifies into `isNodeBusy = active timed
operator OR activeProcessOnNode` (additively — the #282 process contract is untouched). A feedback
profile `{overlay,drone,completionCue}` resolves inline → central → default, riding the existing
`ACTION_FEEDBACK` payload; the generic default overlay/drone is prototyped with Les then ported.

**Tech stack:** Vanilla ES modules, JSDoc `@ts-check`, node:test, Lit HUD + SVG overlays, Strudel
audio, esbuild.

## Global constraints (copied from spec)

- **Additive only on shared surfaces.** Do NOT alter the `processes.js` contract (`state.processes`,
  `activeProcessOnNode`, `abortNodeProcesses`, `PROCESS_*`). Do NOT rename/relocate `timed-actions.js`
  / `ABORTABLE_FLAGS` / `TIMED_ACTION_FLAGS`. Any surface rename → ping the #286 session; the dissolve
  is deferred to #288.
- **One runtime engine.** `timed` generates the existing operator config shape — no second execution path.
- **No behavior change** for the existing core verbs, SWEEP, heat, or the alert sensors' numbers.
- Seed every `initGame()` in tests. `make check` green per phase; `make census` (same-seed vs main)
  after `corrupt` goes timed.

---

## Phase 1 — Declarable `timed` → operator synthesis (engine)

Make an inline/trait action carrying `timed` become a real timed action at construction. No feedback yet.

**Files:**
- Modify `js/core/node-graph/types.js` — add the `timed` typedef to `ActionDef`.
- Create `js/core/node-graph/timed-synthesis.js` — `synthesizeTimedActions(node)`: for each action with
  `timed`, push a synthesized `timed-action` operator and rewrite the action's `effects` to the arm pattern.
- Modify `js/core/node-graph/runtime.js` (~line 62-68, after `resolveTraits`) — call
  `synthesizeTimedActions(node)` on every constructed node.
- Modify `js/core/node-graph/timed-actions.js` — export `timedActiveAttr(actionId)` helper
  (`_ta_active_<id>`) used by synthesis + the busy query. (Additive; does not touch `ABORTABLE_FLAGS`.)
- Test: `tests/timed-synthesis.test.js`.

**Interfaces produced:**
- `ActionDef.timed?: { duration?: number, durationTable?: Record<Grade,number>, abortable?: boolean }`
- `synthesizeTimedActions(node): void` (mutates the constructed node in place)
- `timedActiveAttr(actionId): string`

**Key changes:**
```js
// timed-synthesis.js
import { getTimedActionAttrNames, timedActiveAttr } from "./timed-actions.js";

/** Turn each action.timed into a real timed-action operator + arm-pattern effects. Idempotent. */
export function synthesizeTimedActions(node) {
  for (const action of node.actions ?? []) {
    if (!action.timed || action._timedSynthesized) continue;
    const activeAttr = timedActiveAttr(action.id);              // "_ta_active_<id>"
    const { progressAttr } = getTimedActionAttrNames(action.id);
    node.operators = node.operators ?? [];
    node.operators.push({
      name: "timed-action",
      action: action.id,
      activeAttr,
      ...(action.timed.durationTable ? { durationTable: action.timed.durationTable } : {}),
      ...(action.timed.duration != null ? { durationAttr: getTimedActionAttrNames(action.id).durationAttr } : {}),
      onComplete: action.effects,                               // original effects fire on completion
      _abortable: action.timed.abortable !== false,             // default true
    });
    // If a flat `duration` was given (no table), seed it as the initial duration attr.
    action.effects = [
      { effect: "set-attr", attr: activeAttr, value: true },
      { effect: "set-attr", attr: progressAttr, value: 0 },
      ...(action.timed.duration != null
        ? [{ effect: "set-attr", attr: getTimedActionAttrNames(action.id).durationAttr, value: action.timed.duration }]
        : []),
    ];
    action._timedSynthesized = true;
  }
}
```
```js
// timed-actions.js (append)
/** Generated "in progress" flag for a declared timed action (distinct from the core verbs' irregular flags). */
export function timedActiveAttr(actionId) { return `_ta_active_${actionId}`; }
```

**Steps (TDD):**
1. Write `tests/timed-synthesis.test.js`: build a node from a def with one inline action
   `{ id:"test-act", timed:{ duration:5 }, effects:[{effect:"set-attr", attr:"done", value:true}] }`.
   Assert after construction: the node has a `timed-action` operator with `action:"test-act"`,
   `activeAttr:"_ta_active_test-act"`, `onComplete` deep-equals the original effects; and the action's
   own `effects` are the arm pattern (sets active flag + progress 0 + duration 5).
2. Run → FAIL (module missing).
3. Implement `timedActiveAttr` + `synthesizeTimedActions`; wire the call in `runtime.js` after `resolveTraits`.
4. Run → PASS.
5. Add an integration case (in the same file or `tests/integration.test.js`): dispatch the action via
   `graph.executeAction` → assert `done` is NOT set immediately (only the arm flag is), then
   `tick(6)` → assert `done === true` and the active flag cleared, and exactly one `ACTION_FEEDBACK`
   `complete` fired for `test-act`. Run → PASS.
6. `make check`. Commit: `feat: declarable ActionDef.timed synthesizes a timed-action operator (#187)`.

---

## Phase 2 — Unified `isNodeBusy` (additive)

One notion of "busy" spanning the operator and process runtimes; ABORT + nav-cancel cancel both.

**Files:**
- Modify `js/core/node-graph/runtime.js` — `isNodeBusy(nodeId)` method: `getActiveTimedAction(nodeId) != null`.
- Create/append `js/core/node-graph/conditions.js` — a `no-active-timed-action` condition type
  (passes when the node has no active timed operator). Used by `NOT_BUSY`.
- Modify `js/core/node-graph/action-templates.js` — `NOT_BUSY` gains the `no-active-timed-action`
  condition (kept alongside the existing `ABORTABLE_FLAGS` spread — additive, covers synthesized flags);
  `ABORT` shows when a timed operator OR a process is active.
- Modify `js/core/node-graph/game-ctx.js` — the nav-cancel handler + `abortTimedAction` generalize to
  cancel *any* active timed operator on the node (via `getActiveTimedAction`) and still call
  `abortNodeProcesses` (already present, #282). Keep the existing enumerated reset path working.
- Test: `tests/timed-busy.test.js`.

**Interfaces produced:**
- `graph.isNodeBusy(nodeId): boolean` — true if any timed-action operator is active on the node.
- condition `{ type: "no-active-timed-action" }`.

**Key changes:**
```js
// runtime.js
isNodeBusy(nodeId) { return this.getActiveTimedAction(nodeId) != null; }
```
```js
// action's requires (action-templates.js NOT_BUSY) — additive: enumerated flags + the general query
const NOT_BUSY = [
  ...ABORTABLE_FLAGS.map((attr) => ({ type: "not", condition: { type: "node-attr", attr, eq: true } })),
  { type: "node-attr", attr: "rebooting", eq: false },
  { type: "no-active-timed-action" },   // covers synthesized set-piece timed actions too
];
```
Note the process side of busy already lives in `getAvailableActions` (`activeProcessOnNode`, #282) and
stays as-is; ABORT/nav-cancel already call `abortNodeProcesses`. This phase only *adds* the timed-operator
generality; it renames nothing.

**Steps (TDD):**
1. Write `tests/timed-busy.test.js`: a node with a synthesized timed action in progress → a second
   startable action's `requires` fails (node busy); ABORT is available; firing ABORT clears the active
   flag + progress. Also: a node with an active *process* (stub one into `state.processes`) → busy too.
2. Run → FAIL.
3. Implement `isNodeBusy` + the `no-active-timed-action` condition + wire into `NOT_BUSY`/`ABORT`;
   generalize nav-cancel/`abortTimedAction` to the `getActiveTimedAction` scan.
4. Run → PASS.
5. Regression: existing `tests/nav-cancel.test.js` + integration still green (core verbs unaffected).
6. `make check`. Commit: `feat: unify busy/abort across timed operators + processes (isNodeBusy) (#187)`.

---

## Phase 3 — Feedback mapping + resolution (plumbing; default may render nothing until Phase 4)

**Files:**
- Create `js/ui/feedback-profiles.js` — `ACTION_FEEDBACK_PROFILES` (central: core-verb entries),
  `DEFAULT_PROFILE = { overlay: "generic-process", drone: "generic", completionCue: "process.done" }`,
  and `resolveFeedback(actionId, inline)` doing field-level `inline ?? central ?? default`.
- Modify `js/core/node-graph/operators.js` — the `timed-action` operator's `start` `ACTION_FEEDBACK`
  payload includes the action's inline `feedback` (available on the operator config; thread it through
  synthesis). (Additive payload field; existing consumers ignore unknown fields.)
- Modify `js/core/node-graph/timed-synthesis.js` — copy `action.feedback` onto the synthesized operator
  config so the operator can emit it.
- Modify `js/ui/overlays/registry.js` — overlays keyed by **name**; add `descriptorForName(name)`.
  Add central entries mapping the core verbs' actions → their existing overlay names (so lookups still
  resolve). Keep `overlayDescriptorForAction` working via `resolveFeedback(action).overlay`.
- Modify `js/ui/overlays/dispatch.js` — resolve `action → resolveFeedback → profile.overlay → element`;
  no element (unmapped/not-yet-built) → early return (safe, like `reboot`).
- Modify the Strudel drone player (`js/audio/strudel/index.js`) — resolve `profile.drone` (fallback to
  the generic drone id) instead of `resolveDrone(action)`; resolve `profile.completionCue` on complete.
- Test: `tests/feedback-profiles.test.js` (pure resolution) + assert the operator's `start` payload
  carries `feedback`.

**Interfaces produced:**
- `resolveFeedback(actionId, inline?): { overlay?, drone?, completionCue? }`
- `ActionDef.feedback?: { overlay?: string, drone?: string, completionCue?: string }` (typedef in types.js)

**Key changes:**
```js
// feedback-profiles.js
export const DEFAULT_PROFILE = { overlay: "generic-process", drone: "generic", completionCue: "process.done" };
export const ACTION_FEEDBACK_PROFILES = {
  probe: { overlay: "probe-sweep" }, xploit: { overlay: "exploit-brackets" },
  dump: { overlay: "read-sectors" }, fetch: { overlay: "loot-rings" },
  mine: { overlay: "mine-scan" }, "lie-low": { overlay: "lie-low-clock" },
  // (drone/cue omitted → inherit default; core drones already keyed by action id — see note)
};
export function resolveFeedback(actionId, inline = {}) {
  const c = ACTION_FEEDBACK_PROFILES[actionId] ?? {};
  const pick = (k) => inline[k] ?? c[k] ?? DEFAULT_PROFILE[k];
  return { overlay: pick("overlay"), drone: pick("drone"), completionCue: pick("completionCue") };
}
```

**Steps (TDD):**
1. Write `tests/feedback-profiles.test.js`: field-level layering — inline wins; central fills; default
   fills the rest; a core verb (`probe`) resolves to `"probe-sweep"`; an unmapped verb resolves overlay
   to `"generic-process"`.
2. Run → FAIL. Implement `feedback-profiles.js`. Run → PASS.
3. Thread `feedback` through synthesis → operator config → `ACTION_FEEDBACK` start payload; add a test
   asserting the payload carries the inline `feedback`. Repoint `dispatch.js` + registry to name-keyed
   resolution; repoint the Strudel drone/cue to `profile.drone`/`profile.completionCue`.
4. Regression: core-verb overlays still dispatch (probe shows probe-sweep). `make check`.
5. Commit: `feat: action→feedback profile mapping with layered default resolution (#187)`.

> Between Phase 3 and 4, an unmapped action resolves overlay `"generic-process"` which isn't registered
> yet → `dispatch.js` early-returns (no overlay), exactly like `reboot` today. Safe interim state.

---

## Phase 4 — Generic default overlay + drone (FEEL — prototype-first)

### 4a. Interactive feel loop (human-in-the-loop with Les — NOT autonomous)
- Build a throwaway slider-driven Canvas lab in `tmp/` (per the interactive-lab pattern): a node glyph
  + a `progress` slider (0→1) driving the candidate generic overlay (stroked, angular, clockwise,
  phosphene glow). Iterate geometry/feel live with Les until locked. Simultaneously audition the
  generic drone + completion cue (via `preview/sfx.html` or a lab hook).
- **Output:** locked geometry constants + drone/cue spec. Do NOT proceed to 4b until Les signs off.

### 4b. Port (autonomous, TDD)
**Files:**
- Create `js/ui/overlays/generic-process.js` — the overlay custom element (`sync/clear/reposition`),
  geometry from a pure module `js/ui/generic-process-glyph.js` (testable, consumed by overlay + preview).
- Modify `js/ui/overlays/index.js` — import + register; add the `"generic-process"` descriptor (driver
  `action-feedback`, keyed for the default).
- Modify `js/ui/overlays/registry.js` — register the `"generic-process"` name.
- Modify `preview.html` / `js/ui/preview.js` — a demo node + progress control for the generic overlay
  (per the "new visual effects go in the preview harness" rule).
- Modify Strudel audio (`js/audio/strudel/data/drones.js` + `data/cues.js`) — add the `generic` drone
  spec + `process.done` completion cue, so `DEFAULT_PROFILE` resolves to real audio.
- Test: `tests/generic-process-glyph.test.js` (pure geometry: N segments lit at progress p; CW order).

**Steps:**
1. Write `tests/generic-process-glyph.test.js` for the pure geometry (locked constants from 4a). FAIL.
2. Implement `generic-process-glyph.js`. PASS.
3. Build the overlay element consuming the glyph; register + descriptor + preview demo; add drone/cue.
4. `make check`. Commit: `feat: generic default process overlay + drone/cue (#187)`.

---

## Phase 5 — Proof slice (convert three actions)

**Files:**
- Modify `js/core/node-graph/action-templates.js` — `RECONFIGURE_ACTION` (`corrupt`): add
  `timed: { durationTable: { S:30,A:25,B:20,C:15,D:12,F:8 } }` (feel-draft), and **move** the
  `set-attr forwardingEnabled=false` from `effects` into what becomes `onComplete` (i.e. leave it in
  `effects`; synthesis moves effects → onComplete). Confirm `...NOT_BUSY` is in its `requires` (add it).
- Modify `data/biomes/corporate-pieces/scattered.js` — `crack-vault` + `extract-key` (find their defs):
  add `timed: { duration: 20 }` (feel-draft). No `feedback` → inherit the generic default.
- Test: `tests/timed-proof-slice.test.js` + `tests/integration.test.js` additions.

**Steps (TDD):**
1. `corrupt`: test that dispatching it does NOT flip `forwardingEnabled` immediately; after `tick`(to
   completion) `forwardingEnabled === false` and `ACTION_RESOLVED`/`reconfigureNode` fired once; ABORT
   mid-action leaves `forwardingEnabled` unchanged (true). FAIL → add `timed` + NOT_BUSY → PASS.
2. `crack-vault`: test that reward is NOT granted instantly; after completion `giveReward` + `cracked`
   fire once; nav-away mid-action cancels (no reward). FAIL → add `timed` → PASS.
3. `extract-key`: analogous timed + cancel test.
4. Assert each converted action's `start` `ACTION_FEEDBACK` resolves overlay `"generic-process"` (set-piece)
   / its central entry (corrupt has none → generic) — i.e. they're legible, not duds.
5. `make check`.
6. `make census SEEDS=50` (default grades) vs `main` — `corrupt` now timed changes IDS-subversion
   timing; confirm successRate/traceFiredRate not materially regressed. Record numbers in `notes.md`.
7. Commit: `feat: convert corrupt + crack-vault + extract-key to timed actions (#187)`.

---

## Phase 6 — Verify, docs, PR

- Browser smoke (headless Chromium): the three converted actions show the generic overlay + drone +
  completion cue, are abortable (ABORT + navigate-away), and honor one-at-a-time against both a timed
  action and an active process (start a SWEEP, confirm the node is busy). Zero new console errors.
- Update `MANUAL.md` (actions that are now timed; note the generic "process running" feedback), and the
  session `notes.md` (decisions, census numbers, the #286/#288 coordination).
- `make check` green, `make bundle-vendor` clean, `make census` recorded.
- Squash-ready branch; open PR to `main` closing the Phase-1 portion of #187 (note Phase 2 breadth +
  #288 convergence remain). Request Copilot review.

---

## Self-review notes

- **Spec coverage:** declarable `timed` (P1), unified busy/abort (P2), feedback mapping + default (P3),
  generic overlay/drone prototype→port (P4), proof slice corrupt+extract-key+crack-vault (P5),
  testing + census + docs (P5/P6). All spec sections mapped.
- **Additivity:** P2/P3 explicitly keep `ABORTABLE_FLAGS` + the `processes.js` contract intact (#286).
- **Feel gate:** P4a is the only non-autonomous task — flagged for a live loop with Les.
- **Verify P5.4 assumption during execution:** confirm `extract-key`/`crack-vault` exact file+shape in
  `data/biomes/corporate-pieces/scattered.js` before editing (labels/ids confirmed present).
