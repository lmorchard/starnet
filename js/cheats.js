// ── CHEAT COMMANDS — development/playtesting only ────────
// These commands are intentionally separate from game logic so they can be
// gated, disabled, or penalized as a unit in future builds.
// Any use of a cheat command sets state.isCheating = true for the run.

import { addLogEntry } from "./state.js";

export function handleCheatCommand(_args) {
  // Implemented in Phase 6
  addLogEntry("Cheat commands not yet implemented.", "error");
}
