// @ts-check
// Single source of truth for the timed-action set (#170).
//
// A timed action is an async node operation driven by the "timed-action" operator
// (operators.js): it sets an `activeAttr` true, ticks a `_ta_<action>_progress`
// attribute toward `_ta_<action>_duration`, then fires its onComplete. The action
// id, the (irregular) activeAttr flag, and whether ABORT can cancel it were
// previously enumerated independently across traits.js, action-templates.js, and
// game-ctx.js — adding one meant touching all three by hand. They derive from this
// registry now: action-templates builds ABORT/NOT_BUSY from ABORTABLE_FLAGS, game-ctx and
// runtime build attribute names via getTimedActionAttrNames, and a test
// (timed-actions.test.js) asserts the traits.js operator configs still match.

/**
 * @typedef {Object} TimedActionDef
 * @property {string} action        timed-action id (drives the _ta_<action>_* attr names)
 * @property {string} activeAttr    boolean "in progress" attribute (mapped explicitly — irregular)
 * @property {boolean} abortable    whether ABORT can cancel it (reboot is involuntary, so no)
 * @property {string[]} [clearOnCancel] extra node attributes to null out when the action is cancelled
 *   (nav-cancel / jack-out). Beyond the standard activeAttr/progress/duration reset — e.g. xploit's
 *   `activeExploitId`. Centralized here so the nav-cancel handler stays a generic loop (#225).
 */

/** @type {TimedActionDef[]} */
export const TIMED_ACTIONS = [
  { action: "probe",   activeAttr: "probing",    abortable: true },
  { action: "xploit",  activeAttr: "exploiting", abortable: true, clearOnCancel: ["activeExploitId"] },
  { action: "dump",    activeAttr: "reading",    abortable: true },
  { action: "fetch",   activeAttr: "looting",    abortable: true },
  { action: "mine",    activeAttr: "mining",     abortable: true },
  { action: "lie-low", activeAttr: "lyingLow",   abortable: true },
  { action: "reboot",  activeAttr: "rebooting",  abortable: false },
];

/**
 * The ABORTABLE timed actions — the set the nav-cancel / jack-out handler resets. reboot is
 * excluded (involuntary). The nav-cancel handler (game-ctx.js) iterates this instead of
 * hand-enumerating each action.
 * @type {TimedActionDef[]}
 */
export const ABORTABLE_TIMED_ACTIONS = TIMED_ACTIONS.filter((t) => t.abortable);

/**
 * activeAttr flags for the ABORTABLE timed actions. ABORT shows when any is true;
 * NOT_BUSY (action-templates.js) requires all of them — plus `rebooting` — false.
 * @type {string[]}
 */
export const ABORTABLE_FLAGS = ABORTABLE_TIMED_ACTIONS.map((t) => t.activeAttr);

/**
 * The standard attribute names for a timed action, derived from its id. Operators
 * may override progress/duration via config; this returns the conventional
 * defaults plus the registered activeAttr (undefined for an unknown action).
 * @param {string} action
 * @returns {{ activeAttr: string|undefined, progressAttr: string, durationAttr: string }}
 */
export function getTimedActionAttrNames(action) {
  const def = TIMED_ACTIONS.find((t) => t.action === action);
  return {
    activeAttr: def?.activeAttr,
    progressAttr: `_ta_${action}_progress`,
    durationAttr: `_ta_${action}_duration`,
  };
}
