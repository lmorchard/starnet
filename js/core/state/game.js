// @ts-check
// Pure game-level state mutations. No event emission, no orchestration.

import { mutate, getState } from "./index.js";

// Menu/hand are view chrome, not gameplay: the HUD hamburger + hand collapse are usable in the
// overworld hub, where there is NO active run (so mutate() would throw — #236). When a run is
// active the flags live in serialized run state (state.ui, round-tripped); with no run they fall
// back to this module-level view state. The two scopes are independent by design — a run starts
// with fresh state.ui, and the hub keeps its own toggle state between runs.
const _uiFallback = { menuOpen: false, handCollapsed: false };

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

/** Toggle the HUD hamburger panel. Works in-run (state.ui) and at the hub (fallback). @returns {boolean} new menuOpen */
export function toggleMenuOpen() {
  if (!getState()) return (_uiFallback.menuOpen = !_uiFallback.menuOpen);
  let v;
  mutate((s) => {
    s.ui.menuOpen = !s.ui.menuOpen;
    v = s.ui.menuOpen;
  });
  return /** @type {boolean} */ (v);
}

/** Toggle the exploit-hand collapse. Works in-run (state.ui) and at the hub (fallback). @returns {boolean} new handCollapsed */
export function toggleHandCollapsed() {
  if (!getState()) return (_uiFallback.handCollapsed = !_uiFallback.handCollapsed);
  let v;
  mutate((s) => {
    s.ui.handCollapsed = !s.ui.handCollapsed;
    v = s.ui.handCollapsed;
  });
  return /** @type {boolean} */ (v);
}
