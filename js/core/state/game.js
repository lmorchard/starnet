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

/** Toggle the HUD hamburger panel. @returns {boolean} new menuOpen */
export function toggleMenuOpen() {
  let v;
  mutate((s) => {
    s.ui.menuOpen = !s.ui.menuOpen;
    v = s.ui.menuOpen;
  });
  return /** @type {boolean} */ (v);
}

/** Toggle the exploit-hand collapse. @returns {boolean} new handCollapsed */
export function toggleHandCollapsed() {
  let v;
  mutate((s) => {
    s.ui.handCollapsed = !s.ui.handCollapsed;
    v = s.ui.handCollapsed;
  });
  return /** @type {boolean} */ (v);
}
