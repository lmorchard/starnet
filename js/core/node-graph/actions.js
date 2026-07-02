// @ts-check
/** @typedef {import('./types.js').ActionDef} ActionDef */
import { evaluateCondition, fillConditionNodeId } from "./conditions.js";
import { applyEffect } from "./effects.js";

/**
 * @typedef {Object} ActionAccessors
 * @property {(nodeId: string, attr: string) => any} getNodeAttr
 * @property {(name: string) => number} getQuality
 * @property {(nodeId: string) => boolean} isNodeBusy
 */

/**
 * @typedef {Object} ActionMutators
 * @property {(nodeId: string, attr: string, value: any) => void} setNodeAttr
 * @property {string | null} targetNodeId
 * @property {(nodeId: string, attr: string) => any} getNodeAttr
 * @property {(name: string) => number} getQuality
 * @property {(name: string, value: number) => void} setQuality
 * @property {(name: string, delta: number) => void} deltaQuality
 * @property {(nodeId: string, message: import('./types.js').MessageDescriptor) => void} sendMessage
 * @property {(nodeId: string, message: import('./types.js').MessageDescriptor) => void} emitFrom
 * @property {import('./types.js').CtxInterface} ctx
 */

/**
 * Check whether all requires conditions pass for the given node.
 * @param {ActionDef} action
 * @param {string} nodeId
 * @param {ActionAccessors} accessors
 * @returns {boolean}
 */
function requiresPass(action, nodeId, accessors) {
  return (action.requires ?? []).every((condition) =>
    evaluateCondition(fillConditionNodeId(condition, nodeId), accessors)
  );
}

/**
 * Return only actions whose requires all pass.
 * @param {ActionDef[]} actionDefs
 * @param {string} nodeId
 * @param {ActionAccessors} accessors
 * @returns {ActionDef[]}
 */
export function getAvailableActions(actionDefs, nodeId, accessors) {
  return actionDefs.filter((a) => requiresPass(a, nodeId, accessors));
}

/**
 * Execute an action by id. Throws if not found or requires fail.
 * @param {ActionDef[]} actionDefs
 * @param {string} actionId
 * @param {string} nodeId
 * @param {ActionMutators} mutators
 * @param {ActionAccessors} accessors
 */
export function executeAction(actionDefs, actionId, nodeId, mutators, accessors) {
  const action = actionDefs.find((a) => a.id === actionId);
  if (!action) throw new Error(`Action not found: "${actionId}"`);
  if (!requiresPass(action, nodeId, accessors)) {
    throw new Error(`Action "${actionId}" requires not satisfied`);
  }
  const boundMutators = { ...mutators, targetNodeId: nodeId };
  for (const effect of action.effects) {
    applyEffect(effect, boundMutators);
  }
}
