// @ts-check
/**
 * Pure canvas-draw module for the coherence auto-burn combat instrument.
 *
 * Draws a radial instrument centered on a target node canvas context.
 * NO imports from graph.js / cytoscape / state / DOM — takes plain data only.
 *
 * Outer→inner layout:
 *   heat bezel → staging ring (hoard) → shield rings (coherence) → core
 */

// ── constants ──────────────────────────────────────────────────────────────

/** Segments per shield ring. 12-sided faceted segments. */
export const SEG = 12;

/** Shield ring counts by grade label. */
export const RING_COUNT = { S: 3, A: 3, B: 2, C: 2, D: 2, E: 1, F: 1 };

/** Shield ring radii by ring count. Outer→inner. */
const RADII_BY_COUNT = { 1: [67], 2: [67, 47], 3: [67, 51, 32] };

/** Core hexagon radius. */
const CORE_R = 14;

/** Staging ring radius (single compact ring). */
const STAGING_R = 88;

/** Staging slot angular spacing (px at ring radius). */
const STAGING_SPACING = 17;

/** Heat bezel tick count. */
const HEAT_TICKS = 56;

/** Heat bezel outer radius offset above staging. */
const HEAT_R_OFFSET = 20; // noiseRadius = stagingR + 20 = 108

// ── pure geometry ──────────────────────────────────────────────────────────

/**
 * Return the array of shield ring radii for a given ring count.
 * @param {number} ringCount - 1, 2, or 3
 * @returns {number[]}
 */
export function ringRadii(ringCount) {
  return RADII_BY_COUNT[ringCount] ?? RADII_BY_COUNT[1];
}

/**
 * Total number of alive shield segments for a coherence fraction.
 * Erodes outer→inner, so aliveCount drives how many segments remain globally.
 * @param {number} coherence01 - 0..1 (clamped)
 * @param {number} ringCount - total rings
 * @returns {number}
 */
export function aliveSegCount(coherence01, ringCount) {
  const c = Math.max(0, Math.min(1, coherence01));
  return Math.ceil(c * ringCount * SEG);
}

/**
 * The radius at which in-flight projectiles stop (the outermost INTACT ring).
 * Marches inward as rings fall. Returns CORE_R when all rings are dead.
 * @param {number} aliveCount - from aliveSegCount()
 * @param {number} ringCount
 * @param {number} [coreR]
 * @returns {number}
 */
export function outerIntactRadius(aliveCount, ringCount, coreR = CORE_R) {
  const radii = RADII_BY_COUNT[ringCount] ?? RADII_BY_COUNT[1];
  if (aliveCount <= 0) return coreR;
  for (let j = 0; j < ringCount; j++) {
    if ((ringCount - 1 - j) * SEG < aliveCount) return radii[j];
  }
  return coreR;
}

// ── FX model ───────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Shot
 * @property {number} x - start x (canvas px)
 * @property {number} y - start y
 * @property {number} tx - target x
 * @property {number} ty - target y
 * @property {string} id - round identifier (for hex label)
 * @property {number} type - glyph type 0..4
 * @property {string} rarity - "common"|"uncommon"|"rare"
 * @property {boolean} disclosed - disclosed/burned round (red tint)
 * @property {number} t - progress 0..1+
 * @property {number} ang - travel angle (radians)
 * @property {boolean} [done]
 */

/**
 * @typedef {Object} Shard
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {number} life - 0..1
 * @property {string} c - color
 */

/**
 * @typedef {Object} InstrumentFx
 * @property {Shot[]} shots
 * @property {Shard[]} shards
 * @property {number} shake - screen shake amount (px)
 * @property {number} flash - cyan flash intensity 0..1
 */

/**
 * Create a fresh FX state container.
 * @returns {InstrumentFx}
 */
export function createInstrumentFx() {
  return { shots: [], shards: [], shake: 0, flash: 0 };
}

/**
 * Spawn an in-flight projectile (a round fired from a staging slot inward).
 * @param {InstrumentFx} fx
 * @param {{ fromX: number, fromY: number, toX: number, toY: number, id: string, type: number, rarity: string, disclosed: boolean }} params
 */
export function spawnShot(fx, { fromX, fromY, toX, toY, id, type, rarity, disclosed }) {
  fx.shots.push({
    x: fromX, y: fromY, tx: toX, ty: toY,
    id, type, rarity, disclosed,
    t: 0,
    ang: Math.atan2(toY - fromY, toX - fromX),
    done: false,
  });
}

/**
 * Spawn red shards at a dying segment location.
 * @param {InstrumentFx} fx
 * @param {number} x
 * @param {number} y
 */
export function spawnSegShards(fx, x, y) {
  for (let i = 0; i < 5; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 1.5 + Math.random() * 4;
    fx.shards.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, c: "#ff5a5a" });
  }
}

/**
 * Spawn 60 cyan shards at the core (on crack).
 * @param {InstrumentFx} fx
 * @param {number} cx
 * @param {number} cy
 */
export function spawnCrackShards(fx, cx, cy) {
  for (let i = 0; i < 60; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 2 + Math.random() * 7;
    fx.shards.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, c: "#21e6ff" });
  }
}

/**
 * Add shake, clamped to reasonable maximum.
 * @param {InstrumentFx} fx
 * @param {number} amount
 */
export function bumpShake(fx, amount) {
  fx.shake = Math.min(14, fx.shake + Math.max(0, amount));
}

// ── internal draw helpers ──────────────────────────────────────────────────

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx
 * @param {number} cy
 * @param {number} r
 * @param {number} n - sides
 */
function polygon(ctx, cx, cy, r, n) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + i * 2 * Math.PI / n;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

/**
 * Draw one of the 5 abstract stroked glyph shapes (types 0..4).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} type
 * @param {number} x
 * @param {number} y
 * @param {number} s - size hint
 */
function drawGlyph(ctx, type, x, y, s) {
  const h = s * 0.42;
  ctx.beginPath();
  if (type === 0) {
    for (let i = -1; i <= 1; i++) {
      ctx.moveTo(x - h, y + i * h * 0.8);
      ctx.lineTo(x + h, y + i * h * 0.8);
    }
  } else if (type === 1) {
    ctx.moveTo(x - h * 0.2, y - h); ctx.lineTo(x - h, y); ctx.lineTo(x - h * 0.2, y + h);
    ctx.moveTo(x + h * 0.2, y - h); ctx.lineTo(x + h, y); ctx.lineTo(x + h * 0.2, y + h);
  } else if (type === 2) {
    ctx.moveTo(x - h, y - h); ctx.lineTo(x, y); ctx.lineTo(x - h, y + h);
    ctx.moveTo(x + h * 0.1, y + h); ctx.lineTo(x + h, y + h);
  } else if (type === 3) {
    ctx.rect(x - h, y - h * 0.8, h * 2, h * 1.4);
    ctx.moveTo(x - h * 0.4, y + h * 0.95); ctx.lineTo(x + h * 0.4, y + h * 0.95);
  } else {
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI / 3;
      ctx.moveTo(x - h * Math.cos(a), y - h * Math.sin(a));
      ctx.lineTo(x + h * Math.cos(a), y + h * Math.sin(a));
    }
  }
  ctx.stroke();
}

/** @param {string} rarity */
function rarityColor(rarity) {
  return rarity === "rare" ? "#ff00aa" : rarity === "uncommon" ? "#21e6ff" : "#2f6a4a";
}

// ── shield ring state helpers (used during draw) ───────────────────────────

/**
 * @typedef {Object} ShieldRingDrawState
 * @property {number} rot - current rotation angle
 * @property {number} dir - +1 or -1
 * @property {number} speed - radians per frame
 * @property {number[]} order - shuffled seg death order (length SEG)
 * @property {boolean[]} dead - per-segment dead flags (length SEG)
 */

// ── draw instrument ────────────────────────────────────────────────────────

/**
 * @typedef {Object} StagingSlot
 * @property {string} c - color
 * @property {number} type - glyph type 0..4
 * @property {boolean} dark - dimmed (no round in slot)
 * @property {number} g - green flash counter (frames)
 * @property {number} r - red flash counter (frames)
 */

/**
 * @typedef {Object} InstrumentState
 * @property {number} cx - center x in canvas px
 * @property {number} cy - center y in canvas px
 * @property {number} coherence01 - node.coherence / coherenceMax (0..1)
 * @property {number} ringCount - RING_COUNT[grade]
 * @property {number} hoardFrac - usable/total rounds (0..1)
 * @property {number} heat01 - heat / heatCeiling (0..1)
 * @property {string} gradeLabel - "C" etc. (core label)
 * @property {boolean} cracked - true → core cyan bloom
 * @property {InstrumentFx} fx
 * @property {number} [scale] - overall draw scale (default 1)
 * @property {number} [opacity] - overall opacity (default 1)
 * @property {number} [ringSpeed] - rotation speed multiplier (default 1)
 * @property {boolean} [coreLabel] - draw grade letter in core (default true)
 * @property {ShieldRingDrawState[]} shieldRings - per-ring mutable rotation state
 * @property {{ r: number, rot: number, dir: number, speed: number, slots: StagingSlot[] }} stagingRing - mutable staging ring state
 */

/**
 * Draw one frame of the coherence auto-burn instrument.
 *
 * The caller owns all mutable state (shieldRings, stagingRing, fx) and advances
 * it between frames. This function is pure with respect to its arguments — it
 * writes only to ctx.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {InstrumentState} state
 */
export function drawInstrument(ctx, state) {
  const {
    cx, cy,
    coherence01, ringCount, hoardFrac, heat01,
    gradeLabel, cracked,
    fx,
    scale = 1,
    opacity = 1,
    ringSpeed = 1.0,
    coreLabel = true,
    shieldRings,
    stagingRing,
  } = state;

  const noiseRadius = STAGING_R + HEAT_R_OFFSET; // 108

  // apply screen shake
  const sx = (Math.random() * 2 - 1) * fx.shake;
  const sy = (Math.random() * 2 - 1) * fx.shake;
  fx.shake *= 0.85;
  if (fx.shake < 0.3) fx.shake = 0;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(cx + sx, cy + sy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);

  const step = Math.PI * 2 / SEG;
  const radii = ringRadii(ringCount);
  const aliveCount = aliveSegCount(coherence01, ringCount);

  // ── heat bezel ────────────────────────────────────────────────────────────
  const noiseFrac = Math.max(0, Math.min(1, heat01));
  const litN = Math.round(noiseFrac * HEAT_TICKS);
  const nc = noiseFrac < 0.5 ? "#9ff7c4" : noiseFrac < 0.8 ? "#ffb020" : "#ff2a2a";
  for (let i = 0; i < HEAT_TICKS; i++) {
    const a = -Math.PI / 2 + i / HEAT_TICKS * Math.PI * 2;
    const lit = i < litN;
    ctx.strokeStyle = lit ? nc : "#20302a";
    ctx.shadowColor = nc;
    ctx.shadowBlur = lit ? 8 : 0;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + noiseRadius * Math.cos(a), cy + noiseRadius * Math.sin(a));
    ctx.lineTo(cx + (noiseRadius + 7) * Math.cos(a), cy + (noiseRadius + 7) * Math.sin(a));
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#4a6a5a";
  ctx.font = "10px monospace";
  ctx.textAlign = "center";
  ctx.fillText("HEAT", cx, cy - noiseRadius - 13);

  // ── staging ring (hoard) ─────────────────────────────────────────────────
  // advance rotation
  stagingRing.rot += stagingRing.dir * stagingRing.speed * ringSpeed;

  // reconcile slot occupancy to hoardFrac
  _reconcileStaging(stagingRing.slots, hoardFrac);

  for (let j = 0; j < stagingRing.slots.length; j++) {
    const cell = stagingRing.slots[j];
    const a = -Math.PI / 2 + j / stagingRing.slots.length * Math.PI * 2 + stagingRing.rot;
    const x = cx + STAGING_R * Math.cos(a);
    const y = cy + STAGING_R * Math.sin(a);
    let color = cell.dark ? "#0c110d" : cell.c;
    let glow = 0;
    let lw = 1.5;
    if (cell.g > 0) { color = "#7dffb0"; glow = 8; lw = 2; cell.g--; }
    if (cell.r > 0) { color = "#ff5a5a"; glow = 8; lw = 2; cell.r--; }
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
    ctx.lineWidth = lw;
    drawGlyph(ctx, cell.type, x, y, 10);
  }
  ctx.shadowBlur = 0;

  // staging label
  const usableSlots = stagingRing.slots.filter(s => !s.dark).length;
  const totalSlots = stagingRing.slots.length;
  ctx.fillStyle = "#4a6a5a";
  ctx.textAlign = "center";
  ctx.font = "10px monospace";
  ctx.fillText(`HOARD ${usableSlots}/${totalSlots}`, cx, cy + noiseRadius + 16);

  // ── shield rings (coherence) ───────────────────────────────────────────────
  ctx.strokeStyle = "#ff2a2a";
  ctx.shadowColor = "#ff2a2a";
  ctx.shadowBlur = 8;
  ctx.lineWidth = 2.5;

  for (let j = 0; j < ringCount; j++) {
    const ring = shieldRings[j];
    const r = radii[j];
    const base = (ringCount - 1 - j) * SEG;
    ring.rot += ring.dir * ring.speed * ringSpeed;

    for (let k = 0; k < SEG; k++) {
      const dead = base + ring.order[k] >= aliveCount;
      if (dead) {
        if (!ring.dead[k]) {
          ring.dead[k] = true;
          const a = (k + 0.5) * step + ring.rot;
          spawnSegShards(fx, cx + r * Math.cos(a), cy + r * Math.sin(a));
        }
        continue;
      }
      ring.dead[k] = false;
      const a0 = ring.rot + k * step;
      const a1 = ring.rot + (k + 0.9) * step;
      ctx.beginPath();
      ctx.moveTo(cx + r * Math.cos(a0), cy + r * Math.sin(a0));
      ctx.lineTo(cx + r * Math.cos(a1), cy + r * Math.sin(a1));
      ctx.stroke();
    }
  }
  ctx.shadowBlur = 0;

  // ── core ──────────────────────────────────────────────────────────────────
  const isCracked = cracked || aliveCount <= 0;
  ctx.strokeStyle = isCracked ? "#21e6ff" : "#ff5a5a";
  ctx.shadowColor = ctx.strokeStyle;
  ctx.shadowBlur = fx.flash > 0 ? 30 : 10;
  ctx.lineWidth = 2;
  polygon(ctx, cx, cy, CORE_R, 6);
  ctx.stroke();
  ctx.shadowBlur = 0;

  if (coreLabel) {
    ctx.fillStyle = isCracked ? "#7fefff" : "#ff8a8a";
    ctx.textAlign = "center";
    ctx.font = "13px monospace";
    ctx.fillText(gradeLabel, cx, cy + 5);
  }

  // ── projectiles ───────────────────────────────────────────────────────────
  for (const s of fx.shots) {
    s.t += 0.16;
    const p = Math.min(1, s.t);
    const x = s.x + (s.tx - s.x) * p;
    const y = s.y + (s.ty - s.y) * p;
    const col = s.disclosed ? "#ff2a2a" : rarityColor(s.rarity);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(s.ang);
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 1.5;
    drawGlyph(ctx, s.type, -9, 0, 10);
    ctx.font = "9px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(s.id.slice(0, 4), 0, 0);
    ctx.restore();
    ctx.shadowBlur = 0;
    ctx.textBaseline = "alphabetic";
    if (s.t >= 1 && !s.done) {
      s.done = true;
    }
  }
  fx.shots = fx.shots.filter(s => s.t < 1.4);

  // ── shards ────────────────────────────────────────────────────────────────
  for (const sh of fx.shards) {
    sh.x += sh.vx;
    sh.y += sh.vy;
    sh.vy += 0.15;
    sh.life -= 0.02;
    ctx.strokeStyle = sh.c || "#21e6ff";
    ctx.globalAlpha = Math.max(0, sh.life) * opacity;
    ctx.beginPath();
    ctx.moveTo(sh.x, sh.y);
    ctx.lineTo(sh.x - sh.vx * 2, sh.y - sh.vy * 2);
    ctx.stroke();
    ctx.globalAlpha = opacity;
  }
  fx.shards = fx.shards.filter(sh => sh.life > 0);

  // ── cyan flash overlay ────────────────────────────────────────────────────
  if (fx.flash > 0) {
    ctx.fillStyle = `rgba(33,230,255,${fx.flash * 0.25})`;
    // fill a rect that's big enough to cover the entire scaled instrument
    ctx.fillRect(cx - 200, cy - 200, 400, 400);
    fx.flash *= 0.9;
    if (fx.flash < 0.02) fx.flash = 0;
  }

  ctx.restore();
}

// ── staging ring construction helper ──────────────────────────────────────

/**
 * Build the initial staging ring state from a hoard snapshot.
 * @param {{ rarity: string, types: number[] }[]} hoard - array of round objects
 * @returns {{ r: number, rot: number, dir: number, speed: number, slots: StagingSlot[] }}
 */
export function createStagingRing(hoard) {
  const r = STAGING_R;
  const n = Math.max(12, Math.floor(2 * Math.PI * r / STAGING_SPACING));
  const slots = Array.from({ length: n }, () => {
    const e = hoard[Math.floor(Math.random() * hoard.length)] || { rarity: "common", types: [0] };
    return { c: rarityColor(e.rarity), type: e.types[0], dark: false, g: 0, r: 0 };
  });
  return { r, rot: Math.random() * Math.PI * 2, dir: 1, speed: 0.0032, slots };
}

/**
 * Build the initial shield ring states for a given ring count.
 * @param {number} ringCount
 * @returns {ShieldRingDrawState[]}
 */
export function createShieldRings(ringCount) {
  const rings = [];
  for (let i = 0; i < ringCount; i++) {
    const order = _shuffle(SEG);
    rings.push({
      rot: Math.random() * Math.PI * 2,
      dir: i % 2 ? 1 : -1,
      speed: 0.004 + i * 0.002,
      order,
      dead: new Array(SEG).fill(false),
    });
  }
  return rings;
}

// ── private helpers ────────────────────────────────────────────────────────

/** @param {number} n */
function _shuffle(n) {
  const a = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Reconcile staging slot occupancy toward the target hoard fraction.
 * @param {StagingSlot[]} slots
 * @param {number} hoardFrac - 0..1
 */
function _reconcileStaging(slots, hoardFrac) {
  const litTarget = Math.round(Math.max(0, Math.min(1, hoardFrac)) * slots.length);
  let lit = slots.filter(s => !s.dark).length;
  if (lit > litTarget) {
    const pool = slots.filter(s => !s.dark);
    for (let n = lit - litTarget; n > 0 && pool.length; n--) {
      pool.splice(Math.floor(Math.random() * pool.length), 1)[0].dark = true;
    }
  } else if (lit < litTarget) {
    const pool = slots.filter(s => s.dark);
    for (let n = litTarget - lit; n > 0 && pool.length; n--) {
      pool.splice(Math.floor(Math.random() * pool.length), 1)[0].dark = false;
    }
  }
}
