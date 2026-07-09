// @ts-check
/**
 * Phase 1 (#187): declarable `timed` block → operator synthesis.
 *
 * Today, an action that needs to run over time hand-authors both a `timed-action`
 * operator (operators.js) *and* rewrites its own `effects` to the "arm" pattern — see
 * the `encrypted` trait's `dump` action override in traits.js. `synthesizeTimedActions`
 * generalizes that: an ActionDef may declare `timed: { duration?, durationTable?,
 * abortable? }` instead, and this function — called once per constructed node from
 * NodeGraph's constructor (runtime.js) — does the rewrite for it:
 *
 *   1. Synthesizes a `timed-action` operator wired to the action's *original* `effects`
 *      as `onComplete`.
 *   2. Replaces the action's own `effects` with the arm pattern: set the active flag,
 *      zero progress, and — only for a flat `duration` — seed the duration attribute
 *      directly (mirroring how xploit/reboot seed duration via ctx rather than a grade
 *      table, so the timed-action operator's grade-table branch is bypassed). A
 *      `durationTable` is left for the operator itself to resolve on the first armed
 *      tick, same as the hand-authored probe/dump/fetch/mine operators.
 *
 * One runtime engine: this produces the exact operator config shape operators.js
 * already knows how to run. No second execution path.
 *
 * ActionDef objects can be shared by reference across every node that composes a given
 * trait (traits.js resolves `actionMap.set(action.id, action)` from the trait's own
 * action list — the same object, not a copy). Mutating that shared object in place
 * would let the first node to synthesize it silently "steal" the timed-action operator
 * from every other node using the same trait. So each synthesized action becomes a new
 * object (map, don't mutate) and each node's `operators` array is rebuilt via spread
 * (never `.push()`ed in place) — safe even if the same NodeDef object is reused across
 * more than one NodeGraph construction. The `_timedSynthesized` guard on the *new*
 * object then only has to protect against re-running synthesis on an
 * already-synthesized node (idempotency), not against cross-node sharing.
 *
 * Timed-by-default flip (#187 default-flip): declaring `timed:{}` on every set-piece/
 * script action doesn't scale — it's easy to forget (exactly what happened to the
 * `puzzles.js` multiKeyVault `extract-key`, which never got a `timed` block and so
 * never animated, unlike its `scattered.js` sibling). So a script action (per
 * `isScriptAction()`, i.e. not a core deck verb) is synthesized into a timed action
 * EVEN WITHOUT an explicit `timed` block, using `DEFAULT_SCRIPT_ACTION_DURATION` — unless
 * it opts out via `instant: true`, or the node already carries a hand-wired
 * `timed-action` operator for that action id (e.g. the `darknet` trait's `lie-low`,
 * wired directly via `LIE_LOW_OPERATOR` rather than through `ActionDef.timed`). A
 * default-timed action is just "explicit `timed`" with a default duration — it reuses
 * the exact same synthesis path below.
 */

/** @typedef {import('./runtime.js').NodeState} NodeState */
/** @typedef {import('./types.js').NodeDef} NodeDef */
/** @typedef {import('./types.js').TimedActionSpec} TimedActionSpec */

import { getTimedActionAttrNames, timedActiveAttr } from "./timed-actions.js";
import { isScriptAction } from "../actions/scripts.js";

// Flat duration (ticks) applied to a script action synthesized as timed-by-default (no
// explicit `timed` block). ~2s at the standard 100ms tick — a feel-draft placeholder,
// same value the Phase-5 hand-conversions (extract-key/crack-vault) used explicitly.
export const DEFAULT_SCRIPT_ACTION_DURATION = 20;

/**
 * @param {NodeState | NodeDef} node - the node object under construction; mutated in place
 *   (`node.operators` / `node.actions` are reassigned to new arrays).
 */
export function synthesizeTimedActions(node) {
  if (!node.actions || node.actions.length === 0) return;

  let operators = node.operators ?? [];

  // Action ids that already have a hand-wired `timed-action` operator (e.g. `lie-low` via
  // the `darknet` trait's LIE_LOW_OPERATOR) — the default-timed path must not double-wire
  // these. Snapshotted once, before this pass adds any operators of its own.
  const alreadyTimed = new Set(
    operators.filter((o) => o.name === "timed-action").map((o) => o.action)
  );

  const actions = node.actions.map((action) => {
    if (action._timedSynthesized) return action;

    /** @type {TimedActionSpec | undefined} */
    let timedSpec = action.timed;
    if (!timedSpec) {
      // Timed-by-default: a script action with no explicit `timed` block still gets
      // synthesized, unless it opts out (`instant`) or is already timed some other way.
      if (!isScriptAction(action.id) || action.instant || alreadyTimed.has(action.id)) return action;
      timedSpec = { duration: DEFAULT_SCRIPT_ACTION_DURATION };
    }

    // Registry-listed actions (probe/dump/fetch/mine/lie-low/reboot) carry an
    // irregular activeAttr (`probing`, `reading`, …) that is read widely across the
    // codebase; honor it so a migrated core verb keeps its load-bearing flag name.
    // Everything else (corrupt/kick/sniff/replay/set-piece scripts) mints
    // `_ta_active_<id>` as before — fully backward-compatible (#288 A0).
    const { activeAttr: registryActiveAttr, progressAttr, durationAttr } = getTimedActionAttrNames(action.id);
    const activeAttr = registryActiveAttr ?? timedActiveAttr(action.id);

    operators = [
      ...operators,
      {
        name: "timed-action",
        action: action.id,
        activeAttr,
        ...(timedSpec.durationTable ? { durationTable: timedSpec.durationTable } : {}),
        // Flat-duration actions seed `duration` directly via the arm effects below, which
        // bypasses the operator's grade-table first-tick branch (progress===0 && duration===0)
        // — that branch is the ONLY place the operator emits a "start" ACTION_FEEDBACK, so
        // without this flag a flat-duration action never starts its overlay animation
        // (manual-smoke bug, #187 review fix). Not set for durationTable actions — that branch
        // already emits "start" and must not double-fire.
        ...(timedSpec.duration != null && !timedSpec.durationTable ? { emitStartOnArm: true } : {}),
        // Inline feedback-profile override (#187 Phase 3), carried through to the "start"
        // ACTION_FEEDBACK payload by the timed-action operator (operators.js). Additive —
        // absent unless the ActionDef declares `feedback`.
        ...(action.feedback ? { feedback: action.feedback } : {}),
        onComplete: action.effects,
        // Wired through for the ABORT/nav-cancel structural checks (review fix,
        // #187 Phase 2): defaults to abortable unless the ActionDef explicitly
        // opts out via `timed.abortable: false`.
        _abortable: timedSpec.abortable !== false,
      },
    ];

    /** @type {import('./types.js').Effect[]} */
    const armEffects = [
      { effect: "set-attr", attr: activeAttr, value: true },
      { effect: "set-attr", attr: progressAttr, value: 0 },
    ];
    if (timedSpec.duration != null) {
      armEffects.push({ effect: "set-attr", attr: durationAttr, value: timedSpec.duration });
    }

    return { ...action, _timedSynthesized: true, effects: armEffects };
  });

  node.operators = operators;
  node.actions = actions;
}
