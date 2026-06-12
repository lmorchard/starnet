// @ts-check
// Pure frame-timing math for the dev FPS meter (js/ui/fps-meter.js) — no DOM, no rAF,
// so it's unit-testable. Feed it inter-frame deltas; it rolls them up into an FPS
// reading + worst-frame over a window, and maps a delta history to a sparkline.

export class FrameStats {
  /** @param {number} [windowMs] how long to accumulate before publishing a reading */
  constructor(windowMs = 500) {
    this._windowMs = windowMs;
    this._acc = 0;
    this._frames = 0;
    this._worst = 0;
    /** Frames per second over the last completed window. */
    this.fps = 0;
    /** Longest single frame (ms) in the last completed window. */
    this.worstMs = 0;
  }

  /**
   * Record one inter-frame delta. Non-finite / non-positive deltas are ignored.
   * @param {number} dtMs ms since the previous frame
   * @returns {boolean} true when the window rolled over and fps/worstMs were updated
   */
  record(dtMs) {
    if (Number.isFinite(dtMs) && dtMs > 0) {
      this._frames++;
      this._acc += dtMs;
      if (dtMs > this._worst) this._worst = dtMs;
    }
    if (this._acc >= this._windowMs && this._frames > 0) {
      this.fps = Math.round((this._frames * 1000) / this._acc);
      this.worstMs = Math.round(this._worst * 10) / 10;
      this._frames = 0;
      this._acc = 0;
      this._worst = 0;
      return true;
    }
    return false;
  }
}

/**
 * Map a frame-time history to sparkline vertices (oldest at x=0, newest at x=width).
 * A slower frame spikes taller (toward y=0), so hitches read as upward spikes; deltas
 * are clamped to [0, maxMs].
 * @param {number[]} dts frame deltas in ms
 * @param {number} width
 * @param {number} height
 * @param {number} [maxMs] full-scale frame time (top of the chart)
 * @returns {Array<{x:number,y:number}>}
 */
export function frameSparkline(dts, width, height, maxMs = 50) {
  const n = dts.length;
  if (n === 0) return [];
  return dts.map((dt, i) => {
    const x = n === 1 ? width : (i / (n - 1)) * width;
    const c = Math.max(0, Math.min(maxMs, Number.isFinite(dt) ? dt : 0));
    const y = height - (c / maxMs) * height;
    return { x: +x.toFixed(2), y: +y.toFixed(2) };
  });
}
