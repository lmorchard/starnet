// @ts-check
// OverlayManager — pools/reuses node-overlay elements and drives them keyed by (overlayName, nodeId),
// so multiple nodes animate the same overlay at once (e.g. a SWEEP fan-out shows every probing node).
// General: any overlay name registered in `nameTags` is rendered here; this session registers only
// "probe-sweep". A random 0–150ms start jitter destaggers a batch of simultaneous starts (view-layer only).

/** @typedef {{ sync(nodeId: string, progress: number): void, clear(): void, reposition(): void }} OverlayLike */

export const JITTER_MAX_MS = 150;

export class OverlayManager {
  /**
   * @param {Map<string,string>} nameTags  overlay name → overlay tag name
   * @param {{ createOverlay?: (tag:string)=>OverlayLike, random?: ()=>number,
   *           setTimer?: (fn:()=>void, ms:number)=>any, clearTimer?: (h:any)=>void }} [deps]
   */
  constructor(nameTags, deps = {}) {
    this._tags = nameTags;
    this._create = deps.createOverlay ?? ((tag) => /** @type {any} */ (document.createElement(tag)));
    this._random = deps.random ?? Math.random;
    this._setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this._clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h));
    /** @type {Map<string, OverlayLike[]>} tag → free element pool */
    this._pools = new Map();
    /** @type {Map<string, Map<string, any>>} overlayName → nodeId → entry */
    this._active = new Map();
    /** @type {any} */ this._layer = null;
  }

  /** @param {any} layer DOM container pooled elements attach to */
  mount(layer) { this._layer = layer; }

  /** @param {string} overlayName */
  handles(overlayName) { return this._tags.has(overlayName); }

  /** @param {string} overlayName */
  activeCount(overlayName) { return this._active.get(overlayName)?.size ?? 0; }

  /**
   * Start animating overlayName for nodeId. Acquires from the tag's pool,
   * schedules jittered first sync (deferred reveal, buffers progress until then).
   * @param {string} overlayName
   * @param {string} nodeId
   */
  start(overlayName, nodeId) {
    if (!nodeId || !this._tags.has(overlayName)) return;
    let byNode = this._active.get(overlayName);
    if (!byNode) { byNode = new Map(); this._active.set(overlayName, byNode); }
    if (byNode.has(nodeId)) return; // already animating this node
    const tag = /** @type {string} */ (this._tags.get(overlayName));
    const el = this._acquire(tag);
    const entry = { el, tag, nodeId, revealed: false, pending: 0, timer: null };
    // View-layer jitter: delay the first render by a random 0–JITTER_MAX_MS so a batch of
    // simultaneous starts (a sweep fan-out) doesn't flash in lockstep.
    entry.timer = this._setTimer(() => {
      entry.revealed = true; entry.timer = null;
      entry.el.sync(entry.nodeId, entry.pending);
    }, this._random() * JITTER_MAX_MS);
    byNode.set(nodeId, entry);
  }

  /**
   * Update progress for overlayName at nodeId.
   * @param {string} overlayName
   * @param {string} nodeId
   * @param {number} progress
   */
  progress(overlayName, nodeId, progress) {
    const entry = this._active.get(overlayName)?.get(nodeId);
    if (!entry) return;
    if (entry.revealed) entry.el.sync(nodeId, progress ?? 0);
    else entry.pending = progress ?? 0; // buffered until reveal
  }

  /**
   * End (complete or cancel) the overlay for overlayName at nodeId.
   * @param {string} overlayName
   * @param {string} nodeId
   */
  end(overlayName, nodeId) {
    const byNode = this._active.get(overlayName);
    const entry = byNode?.get(nodeId);
    if (!entry) return;
    if (entry.timer != null) this._clearTimer(entry.timer);
    this._release(entry.tag, entry.el);
    byNode.delete(nodeId);
  }

  repositionAll() {
    for (const byNode of this._active.values())
      for (const entry of byNode.values())
        if (entry.revealed) entry.el.reposition();
  }

  clearAll() {
    for (const byNode of this._active.values())
      for (const entry of byNode.values()) {
        if (entry.timer != null) this._clearTimer(entry.timer);
        this._release(entry.tag, entry.el);
      }
    this._active.clear();
  }

  /** @param {string} tag @returns {OverlayLike} */
  _acquire(tag) {
    const free = this._pools.get(tag);
    if (free && free.length) return /** @type {OverlayLike} */ (free.pop());
    const el = this._create(tag);
    if (this._layer) this._layer.appendChild(el);
    return el;
  }

  /** @param {string} tag @param {OverlayLike} el */
  _release(tag, el) {
    el.clear();
    let free = this._pools.get(tag);
    if (!free) { free = []; this._pools.set(tag, free); }
    free.push(el);
  }
}
