// @ts-check
// Pure process-list mutations (state.processes). No orchestration/events — that's js/core/processes.js.

/** @typedef {import('../types.js').Process} Process */

import { mutate, getState } from "./index.js";

/** Next unused process id (monotonic within the run). @returns {number} */
export function nextProcessId() {
  return 1 + getState().processes.reduce((m, p) => Math.max(m, p.id), 0);
}

/** Append a process record. @param {Process} proc */
export function addProcess(proc) {
  mutate((s) => { s.processes.push(proc); });
}

/** Shallow-merge a patch into the process with this id. @param {number} id @param {object} patch */
export function updateProcess(id, patch) {
  mutate((s) => {
    const p = s.processes.find((pr) => pr.id === id);
    if (p) Object.assign(p, patch);
  });
}

/** Remove the process with this id. @param {number} id */
export function removeProcess(id) {
  mutate((s) => {
    const i = s.processes.findIndex((pr) => pr.id === id);
    if (i !== -1) s.processes.splice(i, 1);
  });
}
