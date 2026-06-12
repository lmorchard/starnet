// @ts-check
// Pure SVG/canvas waveform geometry — no DOM, no Math.random.
// Visualises player health (neural/meat) and deck integrity as vital-sign traces.
//
//   ecgPoints   — health: a clinical PQRST(+U) heartbeat complex; beats speed up and
//                 grow erratic as health falls.
//   pulsePoints — deck integrity: a clean double square pulse that develops ringing,
//                 dropouts and amplitude/width glitches as integrity falls.
//
// The shapes are STATIC and anchored to [0,width] — they do not scroll. The animated
// "drawn left-to-right on a vector CRT" sweep + phosphor trail lives in the
// <starnet-waveform> component, which samples these points with sampleY(). Keeping the
// geometry static and pure makes it deterministic and unit-testable.
//
// All variation uses hash01() (deterministic from a numeric seed) — never Math.random —
// so a given (frac, width, height) always yields identical output.

/**
 * @typedef {{ x: number, y: number }} Point
 */

// ── private helpers ──────────────────────────────────────────────────────────

/** Linear interpolation. @param {number} a @param {number} b @param {number} t @returns {number} */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Clamp to [0,1]; non-finite → 0. @param {number} v @returns {number} */
function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

// ── public API ───────────────────────────────────────────────────────────────

/**
 * Deterministic hash: maps any number to a value in [0, 1). sin-based scatter — fast,
 * no dependencies, no Math.random.
 * @param {number} n
 * @returns {number}
 */
export function hash01(n) {
  const s = Math.sin(n) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Health ECG — a flat baseline punctuated by clinical heartbeat complexes:
 * P (small hump) → flat PR → Q/R/S (sharp QRS spike) → flat ST → T (wider hump) →
 * U (small trailing hump) → flat diastole to the next beat.
 *
 * Beat count rises with damage (4 healthy → 7 near-dead) and beat spacing/amplitude
 * gain jitter as health falls.
 *
 * @param {{ frac: number, width: number, height: number }} opts
 *   frac — health 0..1 (0 = flat line)
 * @returns {Array<Point>} vertices in ascending x within [0,width]×[0,height]
 */
export function ecgPoints({ frac, width, height }) {
  const f = clamp01(frac);
  const W = width, H = height, mid = H / 2;
  if (f <= 0) return [{ x: 0, y: mid }, { x: W, y: mid }];

  // Period is height-relative, so each beat keeps the same aspect at any strip width;
  // a wider strip shows MORE beats rather than stretching a fixed few. Damage shortens
  // the period (faster heart rate). Tuned to match the lab proportions.
  const period = H * lerp(1.15, 2.0, f);
  const beats = Math.max(1, Math.floor(W / period));
  const cw = Math.min(period * 0.72, period - 2); // complex width; rest is flat diastole
  const top = H * 0.04, bot = H * 0.96;            // headroom so glow doesn't clip
  const cl = (y) => Math.max(top, Math.min(bot, y));
  const spike0 = H * 0.56;                          // R height
  const P = H * 0.13, Q = H * 0.08, S = H * 0.2, T = H * 0.22, U = H * 0.07;
  const erratic = 1 - f;

  /** @type {Array<Point>} */
  const pts = [{ x: 0, y: mid }];
  for (let k = 0; k < beats; k++) {
    const spike = spike0 * lerp(1, lerp(0.8, 1.2, hash01(k * 13.7 + 2.3)), erratic);
    const jit = lerp(0, period * 0.12, erratic) * (hash01(k * 7.3 + 1.1) - 0.5) * 2;
    const bx = k * period + period * 0.1 + jit;
    const X = (fr) => bx + cw * fr;
    pts.push({ x: X(0.00), y: mid });
    pts.push({ x: X(0.06), y: mid });
    pts.push({ x: X(0.10), y: mid - P * 0.7 });     // P wave
    pts.push({ x: X(0.13), y: mid - P });
    pts.push({ x: X(0.16), y: mid - P * 0.7 });
    pts.push({ x: X(0.20), y: mid });
    pts.push({ x: X(0.28), y: mid });               // PR segment
    pts.push({ x: X(0.31), y: cl(mid + Q) });       // Q
    pts.push({ x: X(0.34), y: cl(mid - spike) });   // R
    pts.push({ x: X(0.37), y: cl(mid + S) });       // S
    pts.push({ x: X(0.41), y: mid });               // J point
    pts.push({ x: X(0.52), y: mid });               // ST segment
    pts.push({ x: X(0.58), y: mid - T * 0.5 });     // T wave
    pts.push({ x: X(0.66), y: mid - T });
    pts.push({ x: X(0.74), y: mid - T * 0.5 });
    pts.push({ x: X(0.80), y: mid });
    pts.push({ x: X(0.86), y: mid - U * 0.7 });     // U wave
    pts.push({ x: X(0.89), y: mid - U });
    pts.push({ x: X(0.92), y: mid - U * 0.7 });
    pts.push({ x: X(0.96), y: mid });
  }
  pts.push({ x: W, y: mid });
  return pts;
}

/**
 * Deck-integrity pulse — a symmetric CPU-clock signal (no resting baseline): equal-duty
 * alternating up-pulses (`hi = mid-amp`) and down-pulses (`lo = mid+amp`), ~4 hi+lo cycles
 * across the width. Every transition rings — a departing overshoot (further in the
 * departing pulse's direction) and an arriving overshoot (past the arriving level), each
 * held briefly so it reads as a small square micro-pulse, then a damped settle. Up-pulses
 * overshoot up, down-pulses down (a positive trailing spike leads into the next negative
 * leading spike). Overshoot is visible even healthy (clock-edge ringing); damage grows the
 * overshoot + adds damped wobbles and roughens both plateaus. Amplitude/timing stay ~constant
 * — degradation reads as ringing/instability, not flattening.
 *
 * @param {{ frac: number, width: number, height: number }} opts
 *   frac — integrity 0..1 (0 = flat line)
 * @returns {Array<Point>} vertices in ascending x within [0,width]×[0,height]
 */
export function pulsePoints({ frac, width, height }) {
  const f = clamp01(frac);
  const W = width, H = height, mid = H / 2;
  if (f <= 0) return [{ x: 0, y: mid }, { x: W, y: mid }];

  const dmg = 1 - f;
  const amp = H * lerp(0.3, 0.38, f);          // ~constant amplitude across health
  const mTop = H * 0.04, mBot = H * 0.96;
  const cl = (y) => Math.max(mTop, Math.min(mBot, y));
  const hi = cl(mid - amp);                     // up-pulse level
  const lo = cl(mid + amp);                     // down-pulse level

  const ramp = Math.pow(dmg, 0.4);
  const over = H * lerp(0.06, 0.34, ramp);      // edge overshoot, visible healthy → grows with damage
  const nw = Math.round(lerp(0, 4, ramp));      // extra damped ring wobbles from damage
  const CYCLES = 4;                             // hi+lo cycles across the width (~W/8 plateaus)
  const half = W / (CYCLES * 2);                // one plateau (up OR down) — equal duty
  const eW = half * lerp(0.375, 0.6, ramp);     // ringing-edge region width

  // Symmetric clock edge: leaving fromY, overshoot further in fromY's direction (departing
  // trailing spike), swing to toY and overshoot past it (arriving leading spike) — each held
  // briefly so it reads as a small square micro-pulse — then a damped ring settling to toY.
  const edge = (pts, x, fromY, toY) => {
    const dFrom = Math.sign(fromY - toY), dTo = Math.sign(toY - fromY);
    const oFrom = cl(fromY + dFrom * over), oTo = cl(toY + dTo * over);
    const X = (fr) => x + eW * fr;
    pts.push({ x, y: fromY });
    pts.push({ x: X(0.1), y: oFrom });          // departing overshoot...
    pts.push({ x: X(0.28), y: oFrom });         // ...held → little square micro-pulse
    pts.push({ x: X(0.44), y: oTo });           // arriving overshoot...
    pts.push({ x: X(0.62), y: oTo });           // ...held → little square micro-pulse
    for (let w = 1; w <= nw; w++) {
      pts.push({ x: X(0.62 + (0.3 * w) / (nw + 1)), y: cl(toY + dTo * over * Math.pow(-0.5, w)) });
    }
    pts.push({ x: X(1.0), y: toY });            // settle
  };

  const NH = CYCLES * 2;
  let prev = lo;                                // arrive from a low pulse at the left edge
  /** @type {Array<Point>} */
  const pts = [{ x: 0, y: lo }];
  for (let k = 0; k < NH; k++) {
    const level = (k % 2 === 0) ? hi : lo;
    const px0 = k * half, px1 = (k + 1) * half;
    edge(pts, px0, prev, level);                // ringing transition into this plateau
    const p0 = px0 + eW;                         // ragged plateau (chaos grows with damage)
    for (let j = 1; j <= 4; j++) {
      const noise = ramp * over * 0.55 * (hash01(k * 9.1 + j * 3.3) - 0.5) * 2;
      pts.push({ x: p0 + ((px1 - p0) * j) / 4, y: cl(level + noise) });
    }
    prev = level;
  }
  pts.push({ x: W, y: prev });
  return pts;
}

/**
 * Sample the y of a monotonic-in-x polyline at a given x (linear interpolation along
 * the segment spanning x). Used by the sweep renderer to draw the trace head.
 * @param {Array<Point>} pts  vertices in ascending x
 * @param {number} x
 * @returns {number}
 */
export function sampleY(pts, x) {
  if (pts.length === 0) return 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (x <= b.x) {
      if (b.x === a.x) return b.y;
      return lerp(a.y, b.y, (x - a.x) / (b.x - a.x));
    }
  }
  return pts[pts.length - 1].y;
}

/**
 * Serialize a vertex list to an SVG path `d` string using only M/L commands.
 * Numbers rounded to 2 decimal places. (Kept for tests / any SVG consumer.)
 * @param {Array<Point>} points
 * @returns {string}
 */
export function pointsToPath(points) {
  if (points.length === 0) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
}
