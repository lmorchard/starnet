// @ts-check
// Frame-rate-independent exponential smoothing (a low-pass filter). Used by
// NodeOverlay to ease a displayed progress toward a tick-fed target progress so
// overlay geometry renders smoothly at display rate even when progress only
// updates at the ~10fps game tick. tau is the time-constant in ms: larger = more
// smoothing (and more lag), smaller = snappier.

/**
 * Move `current` toward `target` by an amount that depends on elapsed time, so
 * the approach rate is independent of frame rate (two 8ms steps ≈ one 16ms step).
 * @param {number} current
 * @param {number} target
 * @param {number} dtMs   elapsed time since the last step, in ms
 * @param {number} tauMs  smoothing time-constant in ms (> 0)
 * @returns {number}
 */
export function easeToward(current, target, dtMs, tauMs) {
  if (!Number.isFinite(dtMs) || dtMs <= 0) return current; // no time elapsed → no step
  if (!Number.isFinite(tauMs) || tauMs <= 0) return target; // smoothing disabled → snap
  const k = 1 - Math.exp(-dtMs / tauMs);
  return current + (target - current) * k;
}
