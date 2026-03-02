// @ts-check
// Set piece engine function — applies a set piece definition to a network.
// Set piece definitions (data) live in biome bundles (e.g. js/biomes/corporate/set-pieces.js).

import { shiftGrade } from "../grades.js";

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
 *   eligible?: (ctx: object) => boolean,
 *   probability?: number,
 * }} SetPiece
 */

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

  // External attachments — find a main-graph node of the given type, add an edge.
  // Only consume rng when there are multiple candidates (matches pick() invariant
  // in network-gen.js — single-candidate picks must not advance the rng sequence).
  for (const { attachTo, localId } of piece.externalAttachments) {
    const candidates = network.nodes.filter((n) => /** @type {any} */(n).type === attachTo);
    if (candidates.length === 0) continue;
    const host = /** @type {any} */ (candidates.length === 1
      ? candidates[0]
      : candidates[Math.floor(rng() * candidates.length)]);
    network.edges.push({ source: host.id, target: idMap[localId] });
  }
}
