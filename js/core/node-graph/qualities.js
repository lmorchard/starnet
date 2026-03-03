// @ts-check

/**
 * Named integer counter store used by operators, triggers, and actions.
 */
export class QualityStore {
  /** @param {Record<string, number>} [initial] */
  constructor(initial = {}) {
    /** @type {Record<string, number>} */
    this._values = { ...initial };
  }

  /**
   * Return current value; defaults to 0 for unknown names.
   * @param {string} name
   * @returns {number}
   */
  get(name) {
    return this._values[name] ?? 0;
  }

  /**
   * Set quality to value.
   * @param {string} name
   * @param {number} value
   */
  set(name, value) {
    this._values[name] = value;
  }

  /**
   * Increment or decrement quality by amount.
   * @param {string} name
   * @param {number} amount
   */
  delta(name, amount) {
    this._values[name] = (this._values[name] ?? 0) + amount;
  }

  /**
   * Return a plain object copy of all qualities.
   * @returns {Record<string, number>}
   */
  snapshot() {
    return { ...this._values };
  }

  /**
   * Replace internal state from a plain object.
   * @param {Record<string, number>} data
   */
  restore(data) {
    this._values = { ...data };
  }
}
