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
 * Deck-integrity pulse — a clean, defined double square pulse (main + smaller follow),
 * clustered early in each cell with flat space before the next. As integrity falls the
 * regulation breaks down: edges develop deepening, lengthening overshoot/ring (jagged),
 * plateaus shrink and go ragged, and pulses occasionally drop out or get their height/
 * width glitched. Amplitude stays roughly constant (degradation reads as chaos, not
 * flattening); timing stays metronomic.
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
  // Height-relative cell width → constant aspect; wider strips show more pulses
  // (lab-matched proportions) rather than stretching a fixed count.
  const period = H * 2.0;
  const CELLS = Math.max(1, Math.floor(W / period));
  const mTop = H * 0.04, mBot = H * 0.96;
  const cl = (y) => Math.max(mTop, Math.min(mBot, y));
  const halfAmp = H * lerp(0.3, 0.38, f);   // ~constant amplitude across health
  const base = cl(mid + halfAmp);
  const top = cl(mid - halfAmp);
  const follow = cl(mid - halfAmp * 0.55);   // smaller second pulse

  // Ring escalates on a curve: shows EARLY and takes over near 0. Jaggedness is
  // vertical (depth + wobble count); horizontal width stays modest so timing holds.
  const ramp = Math.pow(dmg, 0.4);
  const over = H * lerp(0.015, 0.34, ramp);
  const ringW = period * lerp(0.018, 0.05, ramp);
  const nw = Math.round(lerp(1, 7, ramp));

  /** Damped overshoot edge from fromY to toY at x, settling over ringW with nw wobbles. */
  const ring = (pts, x, fromY, toY) => {
    const dir = toY < fromY ? -1 : 1;
    const step = ringW / (nw + 2);
    pts.push({ x, y: fromY });
    pts.push({ x: x + step * 0.6, y: cl(toY + dir * over) });
    for (let w = 1; w <= nw; w++) {
      pts.push({ x: x + step * (w + 0.6), y: cl(toY + dir * over * Math.pow(-0.62, w)) });
    }
    pts.push({ x: x + ringW, y: toY });
  };

  const peaks = [
    { level: top, gap: 0.08, w: 0.2 },     // main — wide square, shifted off the left edge
    { level: follow, gap: 0.38, w: 0.09 }, // smaller follow
  ];

  /** @type {Array<Point>} */
  const pts = [{ x: 0, y: base }];
  for (let c = 0; c < CELLS; c++) {
    const cx = c * period;
    pts.push({ x: cx, y: base });
    let cur = cx; // monotonic guard only — fixed gaps mean timing doesn't stretch
    peaks.forEach((pk, pi) => {
      const gk = c * 17.7 + pi * 4.3;
      let level = pk.level, skip = false, wMul = 1;
      if (hash01(gk * 1.7 + 2.1) < ramp * 0.6) {
        const s = hash01(gk * 0.9 + 5.5);
        if (s < 0.22) skip = true;                              // dropped pulse
        else level = base - (base - pk.level) * lerp(0.3, 1.5, s); // scrambled height
      }
      if (hash01(gk * 2.3 + 8.8) < ramp * 0.5) {               // glitched width
        wMul = lerp(0.4, 1.8, hash01(gk * 1.1 + 3.3));
      }
      const xr = Math.max(cx + period * pk.gap, cur + ringW * 0.6);
      if (skip || Math.abs(level - base) < 1) {
        pts.push({ x: xr, y: base }); cur = xr;                // flat — pulse skipped
      } else {
        pts.push({ x: xr, y: base });
        ring(pts, xr, base, level);                            // rise + overshoot
        const plW = period * pk.w * (1 - 0.55 * ramp) * wMul;  // plateau shrinks with damage
        const x0 = xr + ringW, xf = x0 + plW, segs = 4;
        for (let j = 1; j <= segs; j++) {
          const noise = ramp * over * 0.6 * (hash01(gk * 5.3 + j * 2.7) - 0.5) * 2;
          pts.push({ x: x0 + (plW * j) / segs, y: cl(level + noise) }); // ragged plateau
        }
        ring(pts, xf, level, base);                            // fall + undershoot
        cur = xf + ringW;
      }
    });
    pts.push({ x: cx + period, y: base });
  }
  pts.push({ x: W, y: base }); // flat tail to the right edge (count rarely divides W evenly)
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
