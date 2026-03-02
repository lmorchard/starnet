// @ts-check
// Pure ICE state mutations. No event emission, no orchestration.

import { mutate } from "./index.js";

/** Sets ice.attentionNodeId. */
export function setIceAttention(nodeId) {
  mutate((s) => {
    if (s.ice) s.ice.attentionNodeId = nodeId;
  });
}

/** Sets ice.detectedAtNode (pass null to clear). */
export function setIceDetectedAt(nodeId) {
  mutate((s) => {
    if (s.ice) s.ice.detectedAtNode = nodeId;
  });
}

/** Sets ice.dwellTimerId. */
export function setIceDwellTimer(timerId) {
  mutate((s) => {
    if (s.ice) s.ice.dwellTimerId = timerId;
  });
}

/** Increments ice.detectionCount. */
export function incrementIceDetectionCount() {
  mutate((s) => {
    if (s.ice) s.ice.detectionCount++;
  });
}

/** Sets ice.active. */
export function setIceActive(active) {
  mutate((s) => {
    if (s.ice) s.ice.active = active;
  });
}

/** Sets state.lastDisturbedNodeId (pass null to clear). */
export function setLastDisturbedNode(nodeId) {
  mutate((s) => {
    s.lastDisturbedNodeId = nodeId;
  });
}
