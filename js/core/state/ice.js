// @ts-check
// Pure ICE state mutations. No event emission, no orchestration.

import { mutate, getState } from "./index.js";

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
 * Pure variant of getPrimaryIce: derives the first active instance from the
 * passed-in state argument, not the module-global state. Use when callers
 * already hold a state parameter (perception, action availability, etc.) so
 * the function stays a pure derivation.
 *
 * @param {import('../types.js').GameState} state
 * @returns {import('../types.js').IceInstance|null}
 */
export function getPrimaryIceFromState(state) {
  const inst = state.ice?.instances ?? {};
  for (const id of Object.keys(inst)) {
    if (inst[id]?.active) return inst[id];
  }
  return null;
}

/**
 * Return the first active instance, or null if none.
 * Compatibility shim — callers iterate `state.ice.instances` directly in
 * later sessions. Phase 4 of session 1 migrates existing callers to use
 * this shim before broader iteration changes.
 *
 * @returns {import('../types.js').IceInstance|null}
 */
export function getPrimaryIce() {
  return getPrimaryIceFromState(getState());
}
