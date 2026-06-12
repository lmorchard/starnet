// @ts-check
// Shared pre-order traversal for skeleton slot trees. skeleton.js's collectors
// (collectAll / collectLeaves / collectExpandable) and slot-filler.js's
// collectSlots were near-identical recursive walks; they're now all defined in
// terms of walkSlots (#171).

/** @typedef {import('./skeleton.js').SkeletonSlot} SkeletonSlot */

/**
 * Pre-order depth-first walk over a slot tree, collecting every slot for which
 * `predicate` returns true (defaults to all slots).
 * @param {SkeletonSlot} root
 * @param {(slot: SkeletonSlot) => boolean} [predicate]
 * @returns {SkeletonSlot[]}
 */
export function walkSlots(root, predicate = () => true) {
  /** @type {SkeletonSlot[]} */
  const result = [];
  /** @param {SkeletonSlot} slot */
  function visit(slot) {
    if (predicate(slot)) result.push(slot);
    for (const child of slot.children) visit(child);
  }
  visit(root);
  return result;
}
