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
import { getExploitChoices, getExploitEmptyReason } from "../exploits.js";
import { ABORTABLE_FLAGS, getTimedActionAttrNames } from "./timed-actions.js";

// ── Shared action templates ──────────────────────────────────

// activeAttr flags for the player-initiated, abortable timed actions, sourced
// from the TIMED_ACTIONS registry (timed-actions.js): ABORT shows when any is
// true, and NOT_BUSY (below) requires all of them false. Add new timed actions
// to the registry, not here.
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
const NOT_BUSY = [...TIMED_ACTION_FLAGS, "rebooting"].map(
  (attr) => ({ type: "not", condition: { type: "node-attr", attr, eq: true } })
);

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
// (queries timed-action operators at runtime); the requires list shows it
// whenever any abortable timed action is in flight (see TIMED_ACTION_FLAGS).
/** @type {ActionDef} */
const ABORT_ACTION = {
  id: A.ABORT,
  label: "ABORT",
  desc: "Cancel the current timed action.",
  requires: [
    {
      type: "any-of",
      conditions: TIMED_ACTION_FLAGS.map((attr) => ({ type: "node-attr", attr, eq: true })),
    },
  ],
  effects: [
    { effect: "ctx-call", method: "abortTimedAction", args: ["$nodeId"] },
  ],
};

/**
 * Exploit action template. NOTE: the exploitId (card selection) is passed via
 * event payload, not through the action system. The dispatcher handles exploit
 * specially — it extracts exploitId and calls ctx.startExploit(nodeId, exploitId)
 * directly. The graph.executeAction path is bypassed for exploit.
 *
 * Multi-step action: choosing XPLOIT opens a node-anchored card picker (the UI reads
 * this followup). Picking a card re-dispatches starnet:action with { exploitId }, which
 * the dispatcher routes to ctx.startExploit. The hand + console supply exploitId directly
 * and skip the picker entirely.
 * @type {ActionDef}
 */
const EXPLOIT_ACTION = {
  id: A.XPLOIT,
  label: "XPLOIT",
  desc: "Attack with an exploit card.",
  requires: [
    { type: "node-attr", attr: "visibility", eq: "accessible" },
    ...NOT_BUSY,
    // Owned nodes are already at max access — don't offer XPLOIT at all (the
    // hand stays a full-agency override for a deliberate re-exploit).
    { type: "not", condition: { type: "node-attr", attr: "accessLevel", eq: "owned" } },
  ],
  followup: {
    title: (node) => `XPLOIT ${node.id}`,
    choices: getExploitChoices,
    empty: getExploitEmptyReason,
  },
  effects: [
    { effect: "ctx-call", method: "startExploit", args: ["$nodeId"] },
  ],
};

// cancel-xploit removed — absorbed into unified ABORT_ACTION

/** @type {ActionDef} */
const DUMP_ACTION = {
  id: A.DUMP,
  label: "DUMP",
  desc: "Scan node contents for loot or connections.",
  requires: [
    {
      type: "any-of", conditions: [
        { type: "node-attr", attr: "accessLevel", eq: "open" },
        { type: "node-attr", attr: "accessLevel", eq: "owned" },
      ],
    },
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
  ],
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
    {
      type: "any-of", conditions: [
        { type: "node-attr", attr: "accessLevel", eq: "open" },
        { type: "node-attr", attr: "accessLevel", eq: "owned" },
      ],
    },
    { type: "node-attr", attr: "forwardingEnabled", eq: true },
  ],
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
  requires: [{
    type: "any-of", conditions: [
      { type: "node-attr", attr: "accessLevel", eq: "open" },
      { type: "node-attr", attr: "accessLevel", eq: "owned" },
    ],
  }],
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
