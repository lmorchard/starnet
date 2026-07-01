// @ts-check
/**
 * Flow-manipulation programs (Flow Subversion Session 1). Pure game logic that acts on
 * state.flows + player state. Programs are a fixed always-available kit (no loadout economy
 * yet — that's Session 3); they surface as node-contextual actions via program-actions.js.
 *
 * Each program play adds noise to the shared trace clock (recordProgramNoise). Quiet,
 * minimal solutions are the skill.
 */

/** @typedef {import('./types.js').GameState} GameState */

import { setFlowRevealed, flowId } from "./state/flow.js";
import { addCapturedCredential } from "./state/player.js";
import { setNodeAccessLevel, setNodeAlertState, setNodeVisible, setNodeProbed } from "./state/node.js";
import { revealNeighbors } from "./state.js";
import { recordProgramNoise } from "./alert.js";
import { PROGRAM_NOISE_COST } from "./balance.js";
import { emitEvent, E } from "./events.js";

export { flowId };

/**
 * Flows incident to a node (either endpoint). The player reads/acts on a flow through a node
 * it can reach at either end.
 * @param {GameState} state @param {string} nodeId
 */
export const incidentFlows = (state, nodeId) =>
  state.flows.filter((f) => f.from === nodeId || f.to === nodeId);

/**
 * Incident flows the player can currently SEE — the other endpoint must be revealed (not hidden),
 * matching the flow-layer's fog-of-war rule (a flow renders only once both endpoints are present).
 * SNIFF availability, the flow picker, and the console listing all use this so the menu never
 * leaks hidden topology.
 * @param {GameState} state @param {string} nodeId
 */
export const visibleIncidentFlows = (state, nodeId) =>
  incidentFlows(state, nodeId).filter((f) => {
    const other = state.nodes[f.from === nodeId ? f.to : f.from];
    return other && other.visibility !== "hidden";
  });

/**
 * SNIFF a flow: reveal its render (decrypts an encrypted flow) and, if it carries a credential
 * token, capture it into the player's kit. Adds sniff noise. No-op on an unknown id.
 * @param {GameState} state @param {string} nodeId @param {string} id flow id (see flowId)
 */
export function sniffFlow(state, nodeId, id) {
  const f = state.flows.find((fl) => flowId(fl) === id);
  if (!f) return;
  setFlowRevealed(id);
  emitEvent(E.FLOW_SNIFFED, { nodeId, flowId: id, type: f.type });
  if (f.type === "credential" && f.key) {
    addCapturedCredential(f.key);
    emitEvent(E.CREDENTIAL_CAPTURED, { nodeId, key: f.key });
  }
  recordProgramNoise(PROGRAM_NOISE_COST.sniff);
}

/**
 * REPLAY a captured credential into a finesse node that trusts it → owned. No-op unless the
 * node is finesse-locked, trusts a key the player holds, and isn't already owned. Replicates
 * the access-gain side-effects of a successful exploit (applyCombatResult) so a firewall's
 * gated neighbors reveal. Adds replay noise.
 * @param {GameState} state @param {string} nodeId
 */
export function replayCredential(state, nodeId) {
  const node = state.nodes[nodeId];
  const key = node?.trustsCredential;
  if (!key || !state.player.capturedCredentials.includes(key)) return;
  if (node.accessLevel === "owned") return;
  const prev = node.accessLevel;
  setNodeAccessLevel(nodeId, "owned");
  setNodeAlertState(nodeId, "green");
  setNodeVisible(nodeId, "accessible");
  setNodeProbed(nodeId);
  revealNeighbors(nodeId); // owned reveals what the firewall/gate concealed
  emitEvent(E.CREDENTIAL_REPLAYED, { nodeId, key });
  emitEvent(E.NODE_ACCESSED, { nodeId, label: node.label, prev, next: "owned" });
  recordProgramNoise(PROGRAM_NOISE_COST.replay);
}
