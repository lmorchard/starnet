// @ts-check
// Set piece definitions — named, parameterized prefab subgraphs for the LAN generator.
// Set pieces are the escape hatch for topologies too complex to express as topology rules.
// Each piece participates in macro-level topology as a unit ("super-node") and may
// intentionally violate standard topology rules to represent interesting configurations.

import { shiftGrade } from "./grades.js";

/**
 * A single node in a set piece definition.
 * @typedef {{ localId: string, type: string, gradeOffset: number, depth: number }} PieceNodeDef
 */

/**
 * An edge internal to a set piece (references localIds, not real network ids).
 * @typedef {{ source: string, target: string }} PieceEdgeDef
 */

/**
 * How a set piece node attaches to the main graph.
 * attachTo: the type of main-graph node to connect from (picks one at random if multiple)
 * localId: which piece node receives the connection
 * @typedef {{ attachTo: string, localId: string }} ExternalAttachment
 */

/**
 * A set piece definition.
 * @typedef {{
 *   id: string,
 *   nodes: PieceNodeDef[],
 *   edges: PieceEdgeDef[],
 *   externalAttachments: ExternalAttachment[],
 * }} SetPiece
 */

/** @type {Record<string, SetPiece>} */
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
  },
};

/**
 * Apply a set piece to a network (mutates network.nodes and network.edges in place).
 *
 * The caller provides makeId and nextLabel so the piece integrates seamlessly into
 * the generator's existing ID sequence and label pools — no module-level state here.
 *
 * @param {SetPiece} piece
 * @param {{ nodes: Array<object>, edges: Array<{source:string,target:string}> }} network
 * @param {() => number} rng
 * @param {string} baseGrade   - grade to use as reference for gradeOffset
 * @param {(type: string) => string} nextLabel  - draws from generator's label pools
 * @param {(type: string) => string} makeId     - draws from generator's node ID sequence
 * @returns void
 */
export function applySetPiece(piece, network, rng, baseGrade, nextLabel, makeId) {
  // Map localId → real network id
  /** @type {Record<string, string>} */
  const idMap = {};

  for (const { localId, type, gradeOffset, depth } of piece.nodes) {
    const id = makeId(type);
    idMap[localId] = id;
    const grade = shiftGrade(baseGrade, gradeOffset);
    network.nodes.push({ id, type, label: nextLabel(type), grade, _depth: depth });
  }

  // Internal edges
  for (const { source, target } of piece.edges) {
    network.edges.push({ source: idMap[source], target: idMap[target] });
  }

  // External attachments — find a main-graph node of the given type, add an edge
  for (const { attachTo, localId } of piece.externalAttachments) {
    const candidates = network.nodes.filter((n) => /** @type {any} */(n).type === attachTo);
    if (candidates.length === 0) continue;
    const host = /** @type {any} */ (candidates[Math.floor(rng() * candidates.length)]);
    network.edges.push({ source: host.id, target: idMap[localId] });
  }
}
