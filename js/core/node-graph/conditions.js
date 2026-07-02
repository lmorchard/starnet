// @ts-check
/** @typedef {import('./types.js').Condition} Condition */

/**
 * Evaluate a condition against the current state.
 *
 * @param {Condition} condition
 * @param {{ getNodeAttr: (nodeId: string, attr: string) => any, getQuality: (name: string) => number, isNodeBusy: (nodeId: string) => boolean }} accessors
 * @returns {boolean}
 */
export function evaluateCondition(condition, { getNodeAttr, getQuality, isNodeBusy }) {
  switch (condition.type) {
    case "node-attr":
      return getNodeAttr(condition.nodeId ?? "", condition.attr) === condition.eq;

    case "quality-gte":
      return getQuality(condition.name) >= condition.value;

    case "quality-eq":
      return getQuality(condition.name) === condition.value;

    case "all-of":
      return condition.conditions.every((c) =>
        evaluateCondition(c, { getNodeAttr, getQuality, isNodeBusy })
      );

    case "any-of":
      return condition.conditions.some((c) =>
        evaluateCondition(c, { getNodeAttr, getQuality, isNodeBusy })
      );

    case "not":
      return !evaluateCondition(condition.condition, { getNodeAttr, getQuality, isNodeBusy });

    // Structural check (#187 Phase 2): passes when the node has NO active
    // timed-action operator — covers both the hand-wired core verbs (probe,
    // xploit, …) AND a synthesized `timed` action (ActionDef.timed), which
    // mints a dynamically-named activeAttr that a static node-attr condition
    // can't name in advance. Unifies with the #282 process framework's busy
    // check (activeProcessOnNode), which is enforced separately at the
    // getAvailableActions layer (node-actions.js) since a condition here has
    // no access to game state, only this node's graph-runtime data.
    case "no-active-timed-action":
      return !isNodeBusy(condition.nodeId ?? "");

    case "quality-from-attr": {
      // Read quality name from a node attribute, then check the quality value.
      // Enables dynamic quality gating — the quality name can change at runtime.
      const qualityName = getNodeAttr(condition.nodeId ?? "", condition.attr);
      if (!qualityName) return false;
      const value = getQuality(qualityName);
      if (condition.gte !== undefined) return value >= condition.gte;
      if (condition.eq !== undefined) return value === condition.eq;
      return false;
    }

    default:
      throw new Error(`Unknown condition type: "${/** @type {any} */ (condition).type}"`);
  }
}

/**
 * Pre-fill a missing `nodeId` on a condition tree so self-targeting conditions
 * resolve against the owning node. Recurses through all-of/any-of/not and fills
 * the node-bearing condition types (node-attr, quality-from-attr, no-active-timed-action).
 *
 * @param {Condition} condition
 * @param {string} nodeId
 * @returns {Condition}
 */
export function fillConditionNodeId(condition, nodeId) {
  if (
    (condition.type === "node-attr" ||
      condition.type === "quality-from-attr" ||
      condition.type === "no-active-timed-action") &&
    !condition.nodeId
  ) {
    return { ...condition, nodeId };
  }
  if (condition.type === "all-of" || condition.type === "any-of") {
    return { ...condition, conditions: condition.conditions.map((c) => fillConditionNodeId(c, nodeId)) };
  }
  if (condition.type === "not") {
    return { ...condition, condition: fillConditionNodeId(condition.condition, nodeId) };
  }
  return condition;
}
