// @ts-check
/** @typedef {import('./types.js').Effect} Effect */
/** @typedef {import('./types.js').MessageDescriptor} MessageDescriptor */
/** @typedef {import('./types.js').CtxInterface} CtxInterface */

/**
 * @typedef {Object} EffectMutators
 * @property {(nodeId: string, attr: string, value: any) => void} setNodeAttr
 * @property {string | null} targetNodeId  - node id for self-targeting set-attr / toggle-attr effects
 * @property {(nodeId: string, attr: string) => any} getNodeAttr
 * @property {(name: string) => number} getQuality
 * @property {(name: string, value: number) => void} setQuality
 * @property {(name: string, delta: number) => void} deltaQuality
 * @property {(nodeId: string, message: MessageDescriptor) => void} sendMessage
 * @property {(nodeId: string, message: MessageDescriptor) => void} emitFrom  - bypasses source node's own operators
 * @property {CtxInterface} ctx
 */

/**
 * Apply a single effect using the provided mutators.
 *
 * @param {Effect} effect
 * @param {EffectMutators} mutators
 */
export function applyEffect(effect, mutators) {
  const { setNodeAttr, targetNodeId, getNodeAttr, setQuality, deltaQuality, emitFrom, ctx } = mutators;

  switch (effect.effect) {
    case "set-attr":
      if (!targetNodeId) throw new Error("set-attr effect requires targetNodeId in mutators");
      setNodeAttr(targetNodeId, effect.attr, effect.value);
      break;

    case "toggle-attr": {
      if (!targetNodeId) throw new Error("toggle-attr effect requires targetNodeId in mutators");
      const current = getNodeAttr(targetNodeId, effect.attr);
      setNodeAttr(targetNodeId, effect.attr, !current);
      break;
    }

    case "set-node-attr":
      setNodeAttr(effect.nodeId, effect.attr, effect.value);
      break;

    case "emit-message":
      if (!targetNodeId) throw new Error("emit-message effect requires targetNodeId in mutators");
      emitFrom(targetNodeId, effect.message);
      break;

    case "quality-set":
      setQuality(effect.name, effect.value);
      break;

    case "quality-delta":
      deltaQuality(effect.name, effect.delta);
      break;

    case "ctx-call":
      ctx[effect.method](...(effect.args ?? []));
      break;

    case "log":
      ctx.log(effect.message);
      break;

    case "reveal-node":
      ctx.revealNode(effect.nodeId);
      break;

    case "enable-node":
      ctx.enableNode(effect.nodeId);
      break;

    default:
      throw new Error(`Unknown effect type: "${/** @type {any} */ (effect).effect}"`);
  }
}
