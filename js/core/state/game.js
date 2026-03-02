// @ts-check
// Pure game-level state mutations. No event emission, no orchestration.

import { mutate } from "./index.js";

/** Sets state.selectedNodeId (pass null to deselect). */
export function setSelectedNode(nodeId) {
  mutate((s) => {
    s.selectedNodeId = nodeId;
  });
}

/** Sets state.phase ('playing' | 'ended'). */
export function setPhase(phase) {
  mutate((s) => {
    s.phase = phase;
  });
}

/** Sets state.runOutcome ('success' | 'caught' | null). */
export function setRunOutcome(outcome) {
  mutate((s) => {
    s.runOutcome = outcome;
  });
}

/** Sets state.isCheating = true. */
export function setCheating() {
  mutate((s) => {
    s.isCheating = true;
  });
}
