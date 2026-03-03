// @ts-check
/** @typedef {import('./types.js').Condition} Condition */

/**
 * Evaluate a condition against the current state.
 *
 * @param {Condition} condition
 * @param {{ getNodeAttr: (nodeId: string, attr: string) => any, getQuality: (name: string) => number }} accessors
 * @returns {boolean}
 */
export function evaluateCondition(condition, { getNodeAttr, getQuality }) {
  switch (condition.type) {
    case "node-attr":
      return getNodeAttr(condition.nodeId ?? "", condition.attr) === condition.eq;

    case "quality-gte":
      return getQuality(condition.name) >= condition.value;

    case "quality-eq":
      return getQuality(condition.name) === condition.value;

    case "all-of":
      return condition.conditions.every((c) =>
        evaluateCondition(c, { getNodeAttr, getQuality })
      );

    case "any-of":
      return condition.conditions.some((c) =>
        evaluateCondition(c, { getNodeAttr, getQuality })
      );

    default:
      throw new Error(`Unknown condition type: "${/** @type {any} */ (condition).type}"`);
  }
}
