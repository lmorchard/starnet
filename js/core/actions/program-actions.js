// @ts-check
/**
 * Flow-program actions (Session 1). Programs are a fixed always-available kit surfaced as
 * node-contextual actions — NOT node traits (the kit is player-owned, not node-intrinsic) and
 * NOT EXEC scripts (SNIFF hosts its own flow picker, which EXEC can't nest). getProgramActions
 * is injected into getAvailableActions; availability that the node-graph's `requires` can't
 * express (incident flows, player-held credentials) is filtered here — mirroring the KICK filter.
 */

/** @typedef {import('../types.js').ActionDef} ActionDef */
/** @typedef {import('../types.js').NodeState} NodeState */
/** @typedef {import('../types.js').GameState} GameState */

import { A } from "../action-ids.js";
import { visibleIncidentFlows, flowId } from "../programs.js";
import { startSweep } from "../sweep.js";
import { activeProcessOnNode } from "../processes.js";
import { isNodeBusy } from "../busy.js";
import { SWEEP_MAX_DEPTH, SNIFF_DURATION, REPLAY_DURATION } from "../balance.js";
import { timedActiveAttr, getTimedActionAttrNames } from "../node-graph/timed-actions.js";

/**
 * Flow choices for the SNIFF picker — plain DATA (core stays UI-free). The picker component
 * (starnet-action-choices) renders the glyph from flow-glyphs geometry.
 * @param {NodeState} node @param {GameState} state
 */
export function getFlowChoices(node, state) {
  return visibleIncidentFlows(state, node.id).map((f) => ({
    id: flowId(f),
    payloadKey: "flowId",
    render: "flow-packet",
    data: {
      type: f.type,
      encrypted: !!f.encrypted && !f.revealed,
      revealed: !!f.revealed,
      dir: f.from === node.id ? "out" : "in",
    },
  }));
}

export const getFlowEmptyReason = () => "No flows on this node.";

/**
 * Arm a program action as a timed action by attaching (once) and arming a
 * `timed-action` operator on the target node. The operator's onComplete calls
 * `ctx.<resolverMethod>("$nodeId")` when the timer completes — see game-ctx.js.
 * Per-play parameters go in `extraAttrs` as serializable node attributes, NOT in
 * onComplete (which must stay static so the operator can be reused across plays).
 * @param {GameState} state @param {string} nodeId @param {string} actionId
 * @param {number} duration ticks @param {string} resolverMethod ctx method name
 * @param {Record<string, any>} [extraAttrs]
 */
export function armTimedProgram(state, nodeId, actionId, duration, resolverMethod, extraAttrs = {}) {
  const graph = state.nodeGraph;
  if (!graph) return;
  const activeAttr = timedActiveAttr(actionId);
  const { progressAttr, durationAttr } = getTimedActionAttrNames(actionId);

  if (!graph.hasBehavior(nodeId, "timed-action", actionId)) {
    graph.attachBehavior(nodeId, {
      name: "timed-action",
      action: actionId,
      activeAttr,
      emitStartOnArm: true, // flat duration → operator emits "start" on first tick (overlay mount)
      onComplete: [{ effect: "ctx-call", method: resolverMethod, args: ["$nodeId"] }],
      _abortable: true,
    });
  }

  for (const [k, v] of Object.entries(extraAttrs)) graph.setNodeAttr(nodeId, k, v);
  graph.setNodeAttr(nodeId, progressAttr, 0);
  graph.setNodeAttr(nodeId, durationAttr, duration);
  graph.setNodeAttr(nodeId, activeAttr, true); // set active LAST — operator sees progress/duration already seeded
}

/** @type {ActionDef} */
export const SNIFF_ACTION = {
  id: A.SNIFF,
  label: "SNIFF",
  available: () => true,
  desc: () => "Read a data flow on this node; capture a credential if it carries one.",
  followup: { title: (node) => `SNIFF ${node.id}`, choices: getFlowChoices, empty: getFlowEmptyReason },
  execute: (node, state, _ctx, payload) =>
    armTimedProgram(state, node.id, A.SNIFF, SNIFF_DURATION, "resolveSniff", { _sniff_flow_id: payload?.flowId }),
};

/** Depth options for the SWEEP picker (plain DATA; rendered as "action" choices). */
export function getSweepChoices() {
  return [
    { id: "1", payloadKey: "depth", render: "action", data: { label: "depth 1", desc: "immediate neighbors" } },
    { id: "2", payloadKey: "depth", render: "action", data: { label: "depth 2" } },
    { id: "3", payloadKey: "depth", render: "action", data: { label: "depth 3" } },
    { id: "max", payloadKey: "depth", render: "action", data: { label: "max", desc: "until it runs dry" } },
  ];
}

/** @type {ActionDef} */
export const SWEEP_ACTION = {
  id: A.SWEEP,
  label: "SWEEP",
  available: () => true,
  desc: () => "Broadcast probe — ripples outward through open nodes, building heat as it goes.",
  followup: { title: (node) => `SWEEP ${node.id}`, choices: getSweepChoices, empty: () => "" },
  execute: (node, _state, _ctx, payload) =>
    startSweep(node.id, payload?.depth === "max" ? SWEEP_MAX_DEPTH : Number(payload?.depth)),
};

/** @type {ActionDef} */
export const REPLAY_ACTION = {
  id: A.REPLAY,
  label: "REPLAY",
  available: () => true,
  desc: () => "Replay a captured credential to gain trusted access.",
  execute: (node, state, _ctx) =>
    armTimedProgram(state, node.id, A.REPLAY, REPLAY_DURATION, "resolveReplay"),
};

/**
 * Programs available on this node given the player's kit + flow/credential context.
 * @param {NodeState | null} node @param {GameState} state @returns {ActionDef[]}
 */
export function getProgramActions(node, state) {
  /** @type {ActionDef[]} */
  const out = [];
  if (!node || node.visibility !== "accessible") return out;

  // SWEEP: broadcast probe from any accessible node (probes the origin itself first). Not offered
  // while a process is already running on this node (one sweep at a time).
  if (!activeProcessOnNode(state, node.id)) out.push(SWEEP_ACTION);

  // SNIFF/REPLAY are now timed actions (#187 Phase 2) — a node already running one (including
  // an in-flight sniff/replay) can't start another.
  const busy = isNodeBusy(node, state);

  // SNIFF: requires the node be PROBED — a measure of careful preparation (you scan/fingerprint
  // the node before reading its traffic), but a single recon act, NOT the locked→open→owned
  // XPLOIT climb (that climb is the grind the flow loop exists to avoid). Plus a VISIBLE incident
  // flow to read (fog-of-war: don't offer SNIFF for a flow to an unrevealed node).
  if (node.probed && !busy && visibleIncidentFlows(state, node.id).length > 0) out.push(SNIFF_ACTION);

  // REPLAY: a finesse-locked node that trusts a credential the player has captured,
  // not already owned. (Player-held-credential check can't be a node-graph `requires`.)
  const key = node.trustsCredential;
  if (node.finesseLocked && !busy && key && node.accessLevel !== "owned"
      && state.player.capturedCredentials.includes(key)) {
    out.push(REPLAY_ACTION);
  }
  return out;
}
