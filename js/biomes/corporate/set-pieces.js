// @ts-check
// Set piece definitions for the corporate biome.
// Each piece includes eligible() and probability for generic engine selection.

import { GRADE_INDEX } from "../../grades.js";

/** @type {Record<string, import('../../set-pieces.js').SetPiece & { eligible?: Function, probability?: number }>} */
export const SET_PIECES = {
  /**
   * careless-user — a workstation inadvertently bridged to a fileserver that is
   * otherwise behind a firewall. Creates a soft alternate path to a protected node.
   *
   * Narrative: the sysadmin connected the departmental workstation to the file store
   * for convenience, not realising the firewall was supposed to gate that access.
   *
   * Topology rule violation: fileserver is accessible both through the firewall
   * (hard path) and through the workstation (soft path that bypasses the gate).
   */
  "careless-user": {
    id: "careless-user",
    nodes: [
      { localId: "ws", type: "workstation", gradeOffset: -1, depth: 2 }, // soft entry
      { localId: "fs", type: "fileserver",  gradeOffset:  0, depth: 2 }, // base grade
      { localId: "fw", type: "firewall",    gradeOffset: +1, depth: 1 }, // hardened gate
    ],
    edges: [
      { source: "ws", target: "fs" }, // the exposure — bypasses firewall
      { source: "fw", target: "fs" }, // firewall still present (hard path)
    ],
    externalAttachments: [
      { attachTo: "router",  localId: "ws" }, // router → workstation (soft entry point)
      { attachTo: "gateway", localId: "fw" }, // gateway → firewall (hard entry point)
    ],
    eligible: ({ mc, state }) =>
      GRADE_INDEX[mc] >= GRADE_INDEX["C"] && (state.gate?.length ?? 0) > 0,
    probability: 0.6,
  },
};
