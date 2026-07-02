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
 */

/** @typedef {import('./runtime.js').NodeState} NodeState */
/** @typedef {import('./types.js').NodeDef} NodeDef */

import { getTimedActionAttrNames, timedActiveAttr } from "./timed-actions.js";

/**
 * @param {NodeState | NodeDef} node - the node object under construction; mutated in place
 *   (`node.operators` / `node.actions` are reassigned to new arrays).
 */
export function synthesizeTimedActions(node) {
  if (!node.actions || node.actions.length === 0) return;

  let operators = node.operators ?? [];

  const actions = node.actions.map((action) => {
    if (!action.timed || action._timedSynthesized) return action;

    const activeAttr = timedActiveAttr(action.id);
    const { progressAttr, durationAttr } = getTimedActionAttrNames(action.id);

    operators = [
      ...operators,
      {
        name: "timed-action",
        action: action.id,
        activeAttr,
        ...(action.timed.durationTable ? { durationTable: action.timed.durationTable } : {}),
        // Inline feedback-profile override (#187 Phase 3), carried through to the "start"
        // ACTION_FEEDBACK payload by the timed-action operator (operators.js). Additive —
        // absent unless the ActionDef declares `feedback`.
        ...(action.feedback ? { feedback: action.feedback } : {}),
        onComplete: action.effects,
        // Wired through for the ABORT/nav-cancel structural checks (review fix,
        // #187 Phase 2): defaults to abortable unless the ActionDef explicitly
        // opts out via `timed.abortable: false`.
        _abortable: action.timed.abortable !== false,
      },
    ];

    /** @type {import('./types.js').Effect[]} */
    const armEffects = [
      { effect: "set-attr", attr: activeAttr, value: true },
      { effect: "set-attr", attr: progressAttr, value: 0 },
    ];
    if (action.timed.duration != null) {
      armEffects.push({ effect: "set-attr", attr: durationAttr, value: action.timed.duration });
    }

    return { ...action, _timedSynthesized: true, effects: armEffects };
  });

  node.operators = operators;
  node.actions = actions;
}
