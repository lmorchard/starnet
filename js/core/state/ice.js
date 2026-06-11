// @ts-check
// Pure ICE state mutations. No event emission, no orchestration.

import { mutate } from "./index.js";

/**
 * Resolve an ICE instance from the collection.
 * If iceId is provided, return that specific instance.
 * Otherwise return the first active instance.
 * @param {import('../types.js').GameState} s
 * @param {string|undefined} iceId
 * @returns {import('../types.js').IceInstance|null}
 */
function resolveIce(s, iceId) {
  if (iceId) return s.ice?.instances?.[iceId] ?? null;
  const inst = s.ice?.instances ?? {};
  for (const id of Object.keys(inst)) if (inst[id]?.active) return inst[id];
  return null;
}

/** Sets ice.attentionNodeId. */
export function setIceAttention(nodeId, iceId) {
  mutate((s) => {
    const ice = resolveIce(s, iceId);
    if (ice) ice.attentionNodeId = nodeId;
  });
}

/** Sets ice.detectedAtNode (pass null to clear). */
export function setIceDetectedAt(nodeId, iceId) {
  mutate((s) => {
    const ice = resolveIce(s, iceId);
    if (ice) ice.detectedAtNode = nodeId;
  });
}

/** Sets ice.dwellTimerId. */
export function setIceDwellTimer(timerId, iceId) {
  mutate((s) => {
    const ice = resolveIce(s, iceId);
    if (ice) ice.dwellTimerId = timerId;
  });
}

/** Sets ice.moveTimerId. */
export function setIceMoveTimer(timerId, iceId) {
  mutate((s) => {
    const ice = resolveIce(s, iceId);
    if (ice) ice.moveTimerId = timerId;
  });
}

/** Increments ice.detectionCount. */
export function incrementIceDetectionCount(iceId) {
  mutate((s) => {
    const ice = resolveIce(s, iceId);
    if (ice) ice.detectionCount++;
  });
}

/** Sets ice.active. */
export function setIceActive(active, iceId) {
  mutate((s) => {
    const ice = resolveIce(s, iceId);
    if (ice) ice.active = active;
  });
}

/** Sets state.lastDisturbedNodeId (pass null to clear). */
export function setLastDisturbedNode(nodeId) {
  mutate((s) => {
    s.lastDisturbedNodeId = nodeId;
  });
}

/**
 * Return all active ICE instances from the passed-in state.
 * Pure derivation — does not read module-global state.
 * @param {import('../types.js').GameState} state
 * @returns {import('../types.js').IceInstance[]}
 */
export function activeIceInstances(state) {
  return Object.values(state.ice?.instances ?? {}).filter((i) => i.active);
}

/**
 * True if at least one ICE instance is active in the passed-in state.
 * @param {import('../types.js').GameState} state
 * @returns {boolean}
 */
export function hasActiveIce(state) {
  return activeIceInstances(state).length > 0;
}
