// @ts-check
// Pure game-level state mutations. No event emission, no orchestration.

import { mutate, getState } from "./index.js";

// Menu is view chrome, not gameplay: the HUD hamburger is usable at the overworld hub.
// When a run is active the flag lives in serialized run state (state.ui, round-tripped).
// At the initial hub — before any run has been started this session — there is no
// active run, so mutate() would throw (#236); the toggle falls back to this module-level
// view state instead. The goal is simply that the toggle never throws regardless of run context.
const _uiFallback = { menuOpen: false };

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

