// @ts-check
/** @typedef {import('./types.js').TriggerDef} TriggerDef */
/** @typedef {import('./types.js').Condition} Condition */
/** @typedef {import('./types.js').Effect} Effect */
import { evaluateCondition } from "./conditions.js";
import { applyEffect } from "./effects.js";

/**
 * @typedef {Object} StateAccessors
 * @property {(nodeId: string, attr: string) => any} getNodeAttr
 * @property {(name: string) => number} getQuality
 */

/**
 * @typedef {Object} TriggerMutators
 * @property {(nodeId: string, attr: string, value: any) => void} setNodeAttr
 * @property {string | null} targetNodeId
 * @property {(nodeId: string, attr: string) => any} getNodeAttr
 * @property {(name: string) => number} getQuality
 * @property {(name: string, value: number) => void} setQuality
 * @property {(name: string, delta: number) => void} deltaQuality
 * @property {(nodeId: string, message: import('./types.js').MessageDescriptor) => void} sendMessage
 * @property {import('./types.js').CtxInterface} ctx
 */

/**
 * Manages trigger definitions and tracks which have fired.
 * Triggers fire once when their condition transitions false → true.
 */
export class TriggerStore {
  /** @param {TriggerDef[]} triggerDefs */
  constructor(triggerDefs) {
    /** @type {TriggerDef[]} */
    this._defs = triggerDefs.map((d) => ({ ...d }));
    /** @type {Set<string>} */
    this._fired = new Set(triggerDefs.filter((d) => d.fired).map((d) => d.id));
  }

  /**
   * Check all unfired triggers; apply effects for newly true conditions.
   * @param {StateAccessors} stateAccessors
   * @param {TriggerMutators} mutators
   */
  evaluate(stateAccessors, mutators) {
    for (const def of this._defs) {
      if (this._fired.has(def.id)) continue;
      if (evaluateCondition(def.when, stateAccessors)) {
        this._fired.add(def.id);
        for (const effect of def.then) {
          applyEffect(effect, mutators);
        }
      }
    }
  }

  /** Clear fired set (for testing). */
  reset() {
    this._fired.clear();
  }

  /** @returns {Set<string>} */
  getFired() {
    return new Set(this._fired);
  }

  /**
   * Return trigger defs with fired status baked in (for snapshot).
   * @returns {TriggerDef[]}
   */
  snapshot() {
    return this._defs.map((d) => ({ ...d, fired: this._fired.has(d.id) }));
  }

  /**
   * Reconstitute from snapshot data.
   * @param {TriggerDef[]} data
   */
  restore(data) {
    this._defs = data.map((d) => ({ ...d }));
    this._fired = new Set(data.filter((d) => d.fired).map((d) => d.id));
  }
}
