// @ts-check
/**
 * Action templates — the declarative ActionDef objects for the game's verbs
 * (probe, xploit, dump, fetch, mine, reboot, corrupt, …) plus the shared
 * timed-action wiring (NOT_BUSY) and the lie-low operator/attrs bundle.
 *
 * These are the *action half* of each mechanic; the matching timed-action
 * *operators* live on the traits in `traits.js`, which is the sole consumer of
 * this module (it pairs each operator with its template). Node-type factories
 * select traits and never touch templates directly — see `node-factories.js`.
 */

/** @typedef {import('./types.js').ActionDef} ActionDef */
/** @typedef {import('./types.js').Condition} Condition */
/** @typedef {import('./types.js').OperatorConfig} OperatorConfig */

import { A } from "../action-ids.js";
// getExploitChoices / getExploitEmptyReason removed: XPLOIT followup (card picker)
// was removed in Phase 3 (E1). Those functions remain in exploits.js for use by
// profile/hub/store code (Phase 5 cleanup will sweep them).
import { ABORTABLE_FLAGS, getTimedActionAttrNames } from "./timed-actions.js";

// ── Shared action templates ──────────────────────────────────

// activeAttr flags for the player-initiated, abortable timed actions, sourced
// from the TIMED_ACTIONS registry (timed-actions.js): NOT_BUSY (below) requires
// all of them false. ABORT no longer reads this list directly — it uses the
// structural `active-abortable-timed-action` condition instead (#187 Phase 2
// review fix) — but NOT_BUSY still needs the enumerated flags (a busy node is
// busy whether or not the thing making it busy is abortable). Add new timed
// actions to the registry, not here.
const TIMED_ACTION_FLAGS = ABORTABLE_FLAGS;

// A node may run at most ONE timed action at a time. Every startable action
// requires the node be idle: no timed action in flight, and not rebooting.
// `rebooting` is involuntary (forced offline after a failure) so it isn't in
// TIMED_ACTION_FLAGS — ABORT can't cancel it — but it still blocks starting
// anything new. Spread `...NOT_BUSY` into each startable action's requires.
//
// A flag means "busy" only when explicitly true, so we test `not (eq true)`
// rather than `eq false`: some flags (e.g. reading/looting) aren't defined on
// non-lootable node types, and undefined must read as idle, not busy.
/** @type {import('./types.js').Condition[]} */
const NOT_BUSY = [
  ...[...TIMED_ACTION_FLAGS, "rebooting"].map(
    (attr) => /** @type {Condition} */ ({ type: "not", condition: { type: "node-attr", attr, eq: true } })
  ),
  // Structural check (#187 Phase 2), additive alongside the enumerated flags above:
  // catches a busy *synthesized* timed action (declarative ActionDef.timed), whose
  // activeAttr is minted per-action-id and so can't be named in TIMED_ACTION_FLAGS.
  { type: "no-active-timed-action" },
];

/** @type {ActionDef} */
const PROBE_ACTION = {
  id: A.PROBE,
  label: "PROBE",
  desc: "Reveal vulnerabilities. Raises local alert.",
  requires: [
    { type: "node-attr", attr: "accessLevel", eq: "locked" },
    { type: "node-attr", attr: "probed", eq: false },
    ...NOT_BUSY,
  ],
  effects: [
    { effect: "set-attr", attr: "probing", value: true },
    { effect: "set-attr", attr: getTimedActionAttrNames("probe").progressAttr, value: 0 },
  ],
};

// Abort: unified cancel for any timed action. The execution is generic
// (queries timed-action operators at runtime); the requires list is the single
// structural `active-abortable-timed-action` check (#187 Phase 2 review fix) —
// it covers both the enumerated core verbs (probe, xploit, …) and a synthesized
// timed action (dynamically-named activeAttr) alike, while EXCLUDING an action
// marked non-abortable (reboot — involuntary, ABORT must not offer to cancel it).
// This replaced a broader `not(no-active-timed-action)` check that didn't
// distinguish abortable from non-abortable, which let ABORT wrongly show during
// a reboot. The #282 process-framework busy case (SWEEP, …) is handled
// separately, one layer up in node-actions.js — it swaps in its own ABORT
// before this template is ever consulted, so it isn't duplicated here.
/** @type {ActionDef} */
const ABORT_ACTION = {
  id: A.ABORT,
  label: "ABORT",
  desc: "Cancel the current timed action.",
  requires: [{ type: "active-abortable-timed-action" }],
  effects: [
    { effect: "ctx-call", method: "abortTimedAction", args: ["$nodeId"] },
  ],
};

/**
 * Exploit action template — launches the coherence auto-burn process.
 *
 * Phase 3 (E1 combat rework): XPLOIT is now arg-less. No card picker (followup)
 * is offered; auto-burn draws from player.hoard directly. The node-actions.js
 * special-case calls startAutoBurn(node.id) instead of the old startExploit.
 *
 * The NOT_BUSY guard and the active-process guard (node-actions.js) together
 * ensure only one operation runs at a time. Auto-burn's busy-state comes from
 * activeProcessOnNode, not from a timed-action flag — the NOT_BUSY conditions
 * below guard entry; the process-level ABORT in node-actions.js handles cancel.
 * @type {ActionDef}
 */
const EXPLOIT_ACTION = {
  id: A.XPLOIT,
  label: "XPLOIT",
  desc: "Launch a coherence burn on this node.",
  requires: [
    { type: "node-attr", attr: "visibility", eq: "accessible" },
    ...NOT_BUSY,
    // Owned nodes are already at max access — don't offer XPLOIT.
    { type: "not", condition: { type: "node-attr", attr: "accessLevel", eq: "owned" } },
    // Finesse-locked nodes require a captured credential replayed in (REPLAY).
    { type: "not", condition: { type: "node-attr", attr: "finesseLocked", eq: true } },
  ],
  // No followup: auto-burn is a single dispatch — no card selection needed.
  effects: [
    // The node-actions.js special-case intercepts XPLOIT before graph.executeAction
    // and calls startAutoBurn(node.id) directly. This effects array is vestigial
    // (never executed for XPLOIT) but kept as documentation of intent.
  ],
};

// cancel-xploit removed — absorbed into unified ABORT_ACTION

/** @type {ActionDef} */
const DUMP_ACTION = {
  id: A.DUMP,
  label: "DUMP",
  desc: "Scan node contents for loot or connections.",
  requires: [
    // Available once recon exposes the node — probed is enough (whether or not
    // owned). Access collapsed to two tiers, so "reveal loot on recon" hangs off
    // probed, not an intermediate access step.
    { type: "node-attr", attr: "probed", eq: true },
    { type: "node-attr", attr: "read", eq: false },
    ...NOT_BUSY,
  ],
  effects: [
    { effect: "set-attr", attr: "reading", value: true },
    // Derived from the registry so it always matches the dump operator's progress attr.
    { effect: "set-attr", attr: getTimedActionAttrNames("dump").progressAttr, value: 0 },
  ],
};

// cancel-dump removed — absorbed into unified ABORT_ACTION

/** @type {ActionDef} */
const FETCH_ACTION = {
  id: A.FETCH,
  label: "FETCH",
  desc: "Extract macguffins for cash.",
  requires: [
    { type: "node-attr", attr: "accessLevel", eq: "owned" },
    { type: "node-attr", attr: "read", eq: true },
    { type: "node-attr", attr: "looted", eq: false },
    ...NOT_BUSY,
  ],
  effects: [
    { effect: "set-attr", attr: "looting", value: true },
    // Derived from the registry so it always matches the fetch operator's progress attr.
    { effect: "set-attr", attr: getTimedActionAttrNames("fetch").progressAttr, value: 0 },
  ],
};

// cancel-fetch removed — absorbed into unified ABORT_ACTION

/** @type {ActionDef} */
const MINE_ACTION = {
  id: A.MINE,
  label: "MINE",
  desc: "Data-mine for exploits.",
  requires: [
    { type: "node-attr", attr: "accessLevel", eq: "owned" },
    { type: "node-attr", attr: "mineExhausted", eq: false },
    ...NOT_BUSY,
  ],
  effects: [
    { effect: "set-attr", attr: "mining", value: true },
    { effect: "set-attr", attr: getTimedActionAttrNames("mine").progressAttr, value: 0 },
  ],
};

/** @type {ActionDef} */
const KICK_ACTION = {
  id: A.KICK,
  label: "KICK",
  desc: "Boot ICE attention to a random adjacent node.",
  requires: [
    { type: "node-attr", attr: "accessLevel", eq: "owned" },
    ...NOT_BUSY,
  ],
  // Timed (#187 Phase 2): a short beat so a reactive/panic kick still feels immediate but
  // reads as an action, not a free instant. duration is a feel-draft (~0.5s) — tuned in Part 3.
  timed: { duration: 5 },
  effects: [
    { effect: "ctx-call", method: "ejectIce", args: ["$nodeId"] },
  ],
};

/** @type {ActionDef} */
const REBOOT_ACTION = {
  id: A.REBOOT,
  label: "REBOOT",
  desc: "Force ICE home and take node offline 1-3s.",
  requires: [
    { type: "node-attr", attr: "accessLevel", eq: "owned" },
    ...NOT_BUSY,
  ],
  effects: [
    // startReboot handles ICE eviction + deselect + setting rebooting + duration
    { effect: "ctx-call", method: "startReboot", args: ["$nodeId"] },
  ],
};

/** @type {ActionDef} */
const RECONFIGURE_ACTION = {
  id: A.CORRUPT,
  label: "CORRUPT",
  desc: "Disable event forwarding to security monitor.",
  requires: [
    { type: "node-attr", attr: "accessLevel", eq: "owned" },
    { type: "node-attr", attr: "forwardingEnabled", eq: true },
    ...NOT_BUSY,
  ],
  // Timed (#187 Phase 5): subverting an IDS takes time, grade-scaled — a higher-grade
  // IDS resists longer. Feel-draft numbers. Synthesis (timed-synthesis.js) rewrites these
  // `effects` into the timed-action operator's `onComplete`, so forwardingEnabled only
  // flips (and reconfigureNode only fires) once the subversion completes, not at dispatch.
  timed: { durationTable: { S: 30, A: 25, B: 20, C: 15, D: 12, F: 8 } },
  effects: [
    { effect: "set-attr", attr: "forwardingEnabled", value: false },
    { effect: "ctx-call", method: "reconfigureNode", args: ["$nodeId"] },
  ],
};

/** @type {ActionDef} */
const CANCEL_TRACE_ACTION = {
  id: A.CANCEL_TRACE,
  label: "CANCEL TRACE",
  desc: "Abort trace countdown.",
  // Instant (#187 default-flip opt-out): the panic button. Racing the trace countdown
  // while the game keeps the player waiting on this action to complete would be pure
  // frustration, not in-world timed work.
  instant: true,
  requires: [
    { type: "node-attr", attr: "accessLevel", eq: "owned" },
  ],
  effects: [
    { effect: "ctx-call", method: "cancelTrace", args: [] },
  ],
};

/** @type {ActionDef} */
const ACCESS_DARKNET_ACTION = {
  id: A.ACCESS_DARKNET,
  label: "ACCESS DARKNET",
  desc: "Access the darknet broker to purchase exploit cards.",
  // Instant (#187 default-flip opt-out): a UI transition (opens the store modal), not
  // in-world timed work.
  instant: true,
  requires: [],
  effects: [
    { effect: "ctx-call", method: "openDarknetsStore", args: [] },
  ],
};

/** @type {ActionDef} */
const DISCONNECT_ACTION = {
  id: A.DISCONNECT,
  label: "DISCONNECT",
  desc: "Sever the uplink — jack out and end the run.",
  // Instant (#187 default-flip opt-out): jacking out ends the run immediately — an exit
  // action, not in-world timed work.
  instant: true,
  requires: [],
  effects: [
    { effect: "ctx-call", method: "jackOut", args: [] },
  ],
};

/** @type {ActionDef} */
const SCRUB_LOGS_ACTION = {
  id: A.SCRUB_LOGS,
  label: "SCRUB LOGS",
  desc: "Wipe this monitor's accumulated alert logs, easing the global alert one level.",
  requires: [{ type: "node-attr", attr: "accessLevel", eq: "owned" }],
  effects: [
    { effect: "ctx-call", method: "scrubLogs", args: ["$nodeId"] },
  ],
};

/** @type {ActionDef} */
const LIE_LOW_ACTION = {
  id: A.LIE_LOW,
  label: "LIE LOW",
  desc: "Go quiet and let the security grid's logs age out. Limited — a human admin eventually notices.",
  requires: [
    { type: "node-attr", attr: "lieLowExhausted", eq: false },
    ...NOT_BUSY, // one-timed-action-per-node (#189); includes lyingLow so it can't re-trigger itself
  ],
  effects: [
    { effect: "set-attr", attr: "lyingLow", value: true },
    { effect: "set-attr", attr: getTimedActionAttrNames("lie-low").progressAttr, value: 0 },
  ],
};

// Lie-low wiring shared by every WAN node — the `darknet` trait (and, through it,
// the createWAN factory). Attributes track the per-run uses; the timed-action
// operator is the "time cost" wait that fires ctx.lieLow on completion.
// (Tunable: LIE_LOW_USES, LIE_LOW_TICKS.)
const LIE_LOW_USES = 2;
const LIE_LOW_TICKS = 50; // ~5s wait; flat across grades (the wait isn't grade-scaled)
export const LIE_LOW_ATTRS = {
  lyingLow: false,
  lieLowUsesRemaining: LIE_LOW_USES,
  lieLowExhausted: false,
};
/** @type {OperatorConfig} */
export const LIE_LOW_OPERATOR = {
  name: "timed-action",
  action: "lie-low", // matches A.LIE_LOW so ACTION_FEEDBACK.action correlates across start/cancel
  activeAttr: "lyingLow",
  durationTable: { S: LIE_LOW_TICKS, A: LIE_LOW_TICKS, B: LIE_LOW_TICKS, C: LIE_LOW_TICKS, D: LIE_LOW_TICKS, F: LIE_LOW_TICKS },
  onComplete: [{ effect: "ctx-call", method: "lieLow", args: ["$nodeId"] }],
};

// ── Template registry ─────────────────────────────────────────

export const ACTION_TEMPLATES = {
  PROBE: PROBE_ACTION,
  ABORT: ABORT_ACTION,
  EXPLOIT: EXPLOIT_ACTION,
  DUMP: DUMP_ACTION,
  FETCH: FETCH_ACTION,
  MINE: MINE_ACTION,
  KICK: KICK_ACTION,
  REBOOT: REBOOT_ACTION,
  RECONFIGURE: RECONFIGURE_ACTION,
  CANCEL_TRACE: CANCEL_TRACE_ACTION,
  ACCESS_DARKNET: ACCESS_DARKNET_ACTION,
  SCRUB_LOGS: SCRUB_LOGS_ACTION,
  LIE_LOW: LIE_LOW_ACTION,
  DISCONNECT: DISCONNECT_ACTION,
};
