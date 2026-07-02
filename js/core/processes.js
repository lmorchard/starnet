// @ts-check
/**
 * Progressive-process framework — the general seam for player operations that advance over ticks
 * and/or affect nodes beyond their origin (SWEEP now; parallel-XPLOIT etc. later). Instead of each
 * such action hand-rolling a global timer + bespoke abort, they register a handler here and ride the
 * single `stepProcesses()` hook the central tick() already calls. In-flight state lives in
 * `state.processes` (serializable). Abort/busy is uniform: a node with an active process is busy.
 */

/** @typedef {import('./types.js').Process} Process */
/** @typedef {import('./types.js').GameState} GameState */

import { getState } from "./state.js";
import { removeProcess } from "./state/process.js";
import { emitEvent, E } from "./events.js";

/**
 * @typedef {{ step: (proc: Process, state: GameState) => boolean, onAbort?: (proc: Process, state: GameState) => void }} ProcessHandler
 * `step` advances one tick; return `true` when the process is finished. `onAbort` runs on ANY end
 * (complete or aborted) as idempotent cleanup.
 */

/** type → handler. Module-level (populated at import), so it survives clearHandlers() (event-bus only). */
const HANDLERS = new Map();

/** Register a process type's behavior. @param {string} type @param {ProcessHandler} def */
export function registerProcess(type, def) {
  HANDLERS.set(type, def);
}

/** Advance every active process one tick; self-remove finished ones. Called once per virtual tick. */
export function stepProcesses() {
  const s = getState();
  if (!s || s.phase !== "playing") return;
  for (const proc of [...s.processes]) {   // snapshot — step may mutate the list
    const def = HANDLERS.get(proc.type);
    if (!def) { endProcess(proc.id, "no-handler"); continue; } // orphan (unregistered type) — don't soft-lock its node
    if (def.step(proc, getState()) === true) endProcess(proc.id, "complete");
  }
}

/** True if the node has any active process (drives busy/ABORT). @param {GameState} state @param {string} nodeId */
export function activeProcessOnNode(state, nodeId) {
  return state.processes.some((p) => p.nodeId === nodeId);
}

/** Abort (end) every process on a node — uniform cancel path (ABORT action, nav-away). */
export function abortNodeProcesses(nodeId, reason = "aborted") {
  for (const proc of getState().processes.filter((p) => p.nodeId === nodeId)) endProcess(proc.id, reason);
}

/** End a process: run its onAbort cleanup, remove it, announce it. @param {number} id @param {string} reason */
function endProcess(id, reason) {
  const proc = getState().processes.find((p) => p.id === id);
  if (!proc) return;
  HANDLERS.get(proc.type)?.onAbort?.(proc, getState());
  removeProcess(id);
  emitEvent(E.PROCESS_ENDED, { id, type: proc.type, nodeId: proc.nodeId, reason });
}
