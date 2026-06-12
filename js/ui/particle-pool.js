// @ts-check
// A tiny, domain-agnostic particle-lifecycle manager. Extracted from the proven
// {until, update, restore} pattern in graph-degradation.js: spawn short-lived
// animated things, age them each frame, clean them up on expiry.
//
// The pool knows nothing about HOW a particle draws — each particle owns its own
// update/restore, so SVG overlay effects mutate DOM elements while graph-degradation
// mutates Cytoscape, through the same pool. The pool also owns no timer: the caller
// ticks it from whatever loop it already runs (an overlay time loop, a graph rAF),
// which keeps this pure and testable and lets each consumer keep its own cadence.

/**
 * @typedef {Object} Particle
 * @property {number} until            timestamp (ms, same clock as tick's `now`) when it expires
 * @property {(now: number) => void} [update]  per-frame work while alive; omit for static particles
 * @property {() => void} [restore]    cleanup on expiry or clear (remove element, reset style/position)
 */

export class ParticlePool {
  constructor() {
    /** @type {Particle[]} */
    this._particles = [];
  }

  /** Number of live particles. */
  get size() {
    return this._particles.length;
  }

  /**
   * Add a particle to the pool.
   * @param {Particle} p
   * @returns {Particle} the same particle, for convenience
   */
  add(p) {
    this._particles.push(p);
    return p;
  }

  /**
   * Age the pool by one frame: restore + drop expired particles, update the rest.
   * @param {number} now timestamp (ms) in the same clock as each particle's `until`
   */
  tick(now) {
    if (this._particles.length === 0) return;
    /** @type {Particle[]} */
    const live = [];
    for (const p of this._particles) {
      if (now >= p.until) {
        p.restore?.();
      } else {
        p.update?.(now);
        live.push(p);
      }
    }
    this._particles = live;
  }

  /** Restore and drop every particle (e.g. on heal / clear). */
  clear() {
    for (const p of this._particles) p.restore?.();
    this._particles = [];
  }
}
