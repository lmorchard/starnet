// @ts-check
/**
 * Tests for js/ui/combat-instrument.js — pure geometry + FX model.
 * No canvas or DOM required for most assertions.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SEG,
  RING_COUNT,
  ringRadii,
  aliveSegCount,
  outerIntactRadius,
  createInstrumentFx,
  spawnShot,
  spawnSegShards,
  spawnCrackShards,
  bumpShake,
  drawInstrument,
  drawVulnGlyph,
  createStagingRing,
  createShieldRings,
} from "../js/ui/combat-instrument.js";

// ── RING_COUNT ─────────────────────────────────────────────────────────────

test("RING_COUNT maps grades to correct ring counts", () => {
  assert.equal(RING_COUNT.S, 3);
  assert.equal(RING_COUNT.A, 3);
  assert.equal(RING_COUNT.B, 2);
  assert.equal(RING_COUNT.C, 2);
  assert.equal(RING_COUNT.D, 2);
  assert.equal(RING_COUNT.E, 1);
  assert.equal(RING_COUNT.F, 1);
});

test("SEG is 12 (12 faceted segments per ring)", () => {
  assert.equal(SEG, 12);
});

// ── ringRadii ──────────────────────────────────────────────────────────────

test("ringRadii(1) returns [67]", () => {
  assert.deepEqual(ringRadii(1), [67]);
});

test("ringRadii(2) returns [67, 47]", () => {
  assert.deepEqual(ringRadii(2), [67, 47]);
});

test("ringRadii(3) returns [67, 51, 32]", () => {
  assert.deepEqual(ringRadii(3), [67, 51, 32]);
});

test("ringRadii outer radius is always 67 (for any count)", () => {
  for (const c of [1, 2, 3]) {
    assert.equal(ringRadii(c)[0], 67, `outermost for count=${c}`);
  }
});

// ── aliveSegCount ──────────────────────────────────────────────────────────

test("aliveSegCount(1, 3) === 36 (full coherence, 3 rings × 12 segs)", () => {
  assert.equal(aliveSegCount(1, 3), 36);
});

test("aliveSegCount(0, 3) === 0 (no coherence)", () => {
  assert.equal(aliveSegCount(0, 3), 0);
});

test("aliveSegCount(0.5, 2) === 12 (half coherence, 2 rings × 12)", () => {
  assert.equal(aliveSegCount(0.5, 2), 12);
});

test("aliveSegCount(1, 1) === 12", () => {
  assert.equal(aliveSegCount(1, 1), 12);
});

test("aliveSegCount(0, 1) === 0", () => {
  assert.equal(aliveSegCount(0, 1), 0);
});

test("aliveSegCount clamps coherence01 below 0", () => {
  assert.equal(aliveSegCount(-5, 3), 0);
});

test("aliveSegCount clamps coherence01 above 1", () => {
  assert.equal(aliveSegCount(2, 3), 36);
});

test("aliveSegCount(0.5, 3) === ceil(0.5 × 36) = 18", () => {
  assert.equal(aliveSegCount(0.5, 3), 18);
});

// ── outerIntactRadius ──────────────────────────────────────────────────────

test("outerIntactRadius: full rings → outermost radius (67)", () => {
  assert.equal(outerIntactRadius(36, 3), 67);
  assert.equal(outerIntactRadius(24, 2), 67);
  assert.equal(outerIntactRadius(12, 1), 67);
});

test("outerIntactRadius: 0 alive → core radius", () => {
  assert.equal(outerIntactRadius(0, 3), 14);
  assert.equal(outerIntactRadius(0, 1), 14);
});

test("outerIntactRadius: custom coreR is respected", () => {
  assert.equal(outerIntactRadius(0, 3, 20), 20);
});

test("outerIntactRadius marches inward for 3-ring: outer dead → second ring", () => {
  // 3 rings: outer=j0 dead when aliveCount <= (3-1-0)*12=24, inner segs
  // aliveCount 24 means outermost ring's segs (index 24..35) are all dead
  // Next intact ring is j=1 → radius 51
  assert.equal(outerIntactRadius(24, 3), 51);
});

test("outerIntactRadius marches to innermost for 3-ring when only innermost alive", () => {
  // innermost ring = j=2, base=(3-1-2)*12=0, segs 0..11
  // aliveCount=12 → only innermost ring intact → radius 32
  assert.equal(outerIntactRadius(12, 3), 32);
});

test("outerIntactRadius for 2-ring: outer dead → inner (47)", () => {
  // outer dead when aliveCount <= (2-1-0)*12=12
  // aliveCount=12 → outermost dead, inner intact → radius 47
  assert.equal(outerIntactRadius(12, 2), 47);
});

// ── createInstrumentFx ─────────────────────────────────────────────────────

test("createInstrumentFx returns empty fx state", () => {
  const fx = createInstrumentFx();
  assert.deepEqual(fx.shots, []);
  assert.deepEqual(fx.shards, []);
  assert.equal(fx.shake, 0);
  assert.equal(fx.flash, 0);
});

// ── spawnShot ──────────────────────────────────────────────────────────────

test("spawnShot appends a shot to fx.shots", () => {
  const fx = createInstrumentFx();
  assert.equal(fx.shots.length, 0);
  spawnShot(fx, { fromX: 100, fromY: 200, toX: 50, toY: 150, id: "deadbeef", type: "deserialization", rarity: "uncommon", disclosed: false });
  assert.equal(fx.shots.length, 1);
  const s = fx.shots[0];
  assert.equal(s.x, 100);
  assert.equal(s.y, 200);
  assert.equal(s.tx, 50);
  assert.equal(s.ty, 150);
  assert.equal(s.id, "deadbeef");
  assert.equal(s.type, "deserialization");
  assert.equal(s.rarity, "uncommon");
  assert.equal(s.disclosed, false);
  assert.equal(s.t, 0);
  assert.equal(typeof s.ang, "number");
});

test("spawnShot sets ang = atan2(dy, dx)", () => {
  const fx = createInstrumentFx();
  spawnShot(fx, { fromX: 0, fromY: 0, toX: 10, toY: 0, id: "x", type: "unpatched-ssh", rarity: "common", disclosed: false });
  assert.equal(fx.shots[0].ang, 0); // purely rightward
});

test("spawnShot can be called multiple times", () => {
  const fx = createInstrumentFx();
  spawnShot(fx, { fromX: 0, fromY: 0, toX: 1, toY: 1, id: "a", type: "unpatched-ssh", rarity: "common", disclosed: false });
  spawnShot(fx, { fromX: 0, fromY: 0, toX: 2, toY: 2, id: "b", type: "zero-day-rce", rarity: "rare", disclosed: true });
  assert.equal(fx.shots.length, 2);
});

// ── spawnSegShards ─────────────────────────────────────────────────────────

test("spawnSegShards spawns 5 red shards", () => {
  const fx = createInstrumentFx();
  spawnSegShards(fx, 100, 100);
  assert.equal(fx.shards.length, 5);
  for (const sh of fx.shards) {
    assert.equal(sh.c, "#ff5a5a");
    assert.equal(sh.life, 1);
  }
});

// ── spawnCrackShards ───────────────────────────────────────────────────────

test("spawnCrackShards spawns 60 cyan shards at the center", () => {
  const fx = createInstrumentFx();
  spawnCrackShards(fx, 270, 260);
  assert.equal(fx.shards.length, 60);
  for (const sh of fx.shards) {
    assert.equal(sh.c, "#21e6ff");
    assert.equal(sh.x, 270);
    assert.equal(sh.y, 260);
    assert.equal(sh.life, 1);
  }
});

// ── bumpShake ──────────────────────────────────────────────────────────────

test("bumpShake adds to fx.shake", () => {
  const fx = createInstrumentFx();
  bumpShake(fx, 3);
  assert.equal(fx.shake, 3);
});

test("bumpShake clamps to 14", () => {
  const fx = createInstrumentFx();
  bumpShake(fx, 100);
  assert.equal(fx.shake, 14);
});

test("bumpShake does not go negative with 0", () => {
  const fx = createInstrumentFx();
  bumpShake(fx, 0);
  assert.equal(fx.shake, 0);
});

test("bumpShake accumulates across calls, capped at 14", () => {
  const fx = createInstrumentFx();
  bumpShake(fx, 5);
  bumpShake(fx, 5);
  assert.equal(fx.shake, 10);
  bumpShake(fx, 10);
  assert.equal(fx.shake, 14);
});

// ── drawInstrument smoke tests ────────────────────────────────────────────
// A stub fake 2D context — records calls, never throws.

function makeFakeCtx() {
  const calls = [];
  const handler = {
    get(target, prop) {
      if (prop === "calls") return calls;
      if (prop in target) return target[prop];
      // Return a no-op function for any method
      return (...args) => {
        calls.push({ method: prop, args });
      };
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  };
  const base = {
    calls,
    save() { calls.push({ method: "save" }); },
    restore() { calls.push({ method: "restore" }); },
    beginPath() { calls.push({ method: "beginPath" }); },
    closePath() { calls.push({ method: "closePath" }); },
    moveTo(x, y) { calls.push({ method: "moveTo", args: [x, y] }); },
    lineTo(x, y) { calls.push({ method: "lineTo", args: [x, y] }); },
    stroke() { calls.push({ method: "stroke" }); },
    fill() { calls.push({ method: "fill" }); },
    fillRect(x, y, w, h) { calls.push({ method: "fillRect", args: [x, y, w, h] }); },
    rect(x, y, w, h) { calls.push({ method: "rect", args: [x, y, w, h] }); },
    fillText(t, x, y) { calls.push({ method: "fillText", args: [t, x, y] }); },
    translate(x, y) { calls.push({ method: "translate", args: [x, y] }); },
    rotate(a) { calls.push({ method: "rotate", args: [a] }); },
    scale(x, y) { calls.push({ method: "scale", args: [x, y] }); },
    strokeStyle: "#fff",
    fillStyle: "#fff",
    lineWidth: 1,
    shadowBlur: 0,
    shadowColor: "#fff",
    font: "10px monospace",
    textAlign: "left",
    textBaseline: "alphabetic",
    globalAlpha: 1,
  };
  return new Proxy(base, handler);
}

function makeInstrumentState(overrides = {}) {
  const ringCount = overrides.ringCount ?? 2;
  const fx = createInstrumentFx();
  const shieldRings = createShieldRings(ringCount);
  const stagingRing = createStagingRing([{ rarity: "common", types: ["unpatched-ssh"] }]);
  return {
    cx: 270, cy: 260,
    coherence01: 1,
    ringCount,
    hoardFrac: 0.8,
    heat01: 0.3,
    gradeLabel: "C",
    cracked: false,
    fx,
    scale: 1,
    opacity: 1,
    ringSpeed: 1.0,
    coreLabel: true,
    shieldRings,
    stagingRing,
    ...overrides,
  };
}

test("drawInstrument smoke: coherence01=0 does not throw", () => {
  const ctx = makeFakeCtx();
  const state = makeInstrumentState({ coherence01: 0, ringCount: 2 });
  assert.doesNotThrow(() => drawInstrument(ctx, state));
});

test("drawInstrument smoke: coherence01=0.5 does not throw", () => {
  const ctx = makeFakeCtx();
  const state = makeInstrumentState({ coherence01: 0.5, ringCount: 2 });
  assert.doesNotThrow(() => drawInstrument(ctx, state));
});

test("drawInstrument smoke: coherence01=1 does not throw", () => {
  const ctx = makeFakeCtx();
  const state = makeInstrumentState({ coherence01: 1, ringCount: 2 });
  assert.doesNotThrow(() => drawInstrument(ctx, state));
});

test("drawInstrument smoke: ringCount=1 (grades E, F) does not throw", () => {
  const ctx = makeFakeCtx();
  const state = makeInstrumentState({ ringCount: 1 });
  assert.doesNotThrow(() => drawInstrument(ctx, state));
});

test("drawInstrument smoke: ringCount=2 (grades B, C, D) does not throw", () => {
  const ctx = makeFakeCtx();
  const state = makeInstrumentState({ ringCount: 2 });
  assert.doesNotThrow(() => drawInstrument(ctx, state));
});

test("drawInstrument smoke: ringCount=3 (grades S, A) does not throw", () => {
  const ctx = makeFakeCtx();
  const state = makeInstrumentState({ ringCount: 3 });
  assert.doesNotThrow(() => drawInstrument(ctx, state));
});

test("drawInstrument smoke: cracked=true does not throw", () => {
  const ctx = makeFakeCtx();
  const state = makeInstrumentState({ cracked: true, ringCount: 2 });
  assert.doesNotThrow(() => drawInstrument(ctx, state));
});

test("drawInstrument smoke: with active shots + shards does not throw", () => {
  const ctx = makeFakeCtx();
  const state = makeInstrumentState({ ringCount: 2 });
  spawnShot(state.fx, { fromX: 300, fromY: 250, toX: 270, toY: 260, id: "cafebabe", type: "kernel-exploit", rarity: "rare", disclosed: false });
  spawnSegShards(state.fx, 270, 200);
  assert.doesNotThrow(() => drawInstrument(ctx, state));
});

test("drawInstrument smoke: with crack shards + flash does not throw", () => {
  const ctx = makeFakeCtx();
  const state = makeInstrumentState({ ringCount: 3, cracked: true });
  spawnCrackShards(state.fx, 270, 260);
  state.fx.flash = 0.8;
  assert.doesNotThrow(() => drawInstrument(ctx, state));
});

test("drawInstrument smoke: heat01=0 (empty bezel) does not throw", () => {
  const ctx = makeFakeCtx();
  const state = makeInstrumentState({ heat01: 0 });
  assert.doesNotThrow(() => drawInstrument(ctx, state));
});

test("drawInstrument smoke: heat01=1 (full red bezel) does not throw", () => {
  const ctx = makeFakeCtx();
  const state = makeInstrumentState({ heat01: 1 });
  assert.doesNotThrow(() => drawInstrument(ctx, state));
});

test("drawInstrument smoke: hoardFrac=0 (empty staging) does not throw", () => {
  const ctx = makeFakeCtx();
  const state = makeInstrumentState({ hoardFrac: 0 });
  assert.doesNotThrow(() => drawInstrument(ctx, state));
});

test("drawInstrument calls ctx.save/restore (wraps the draw in a transform)", () => {
  const ctx = makeFakeCtx();
  const state = makeInstrumentState();
  drawInstrument(ctx, state);
  const saves = ctx.calls.filter(c => c.method === "save");
  const restores = ctx.calls.filter(c => c.method === "restore");
  assert.ok(saves.length >= 1, "at least one ctx.save");
  assert.ok(restores.length >= 1, "at least one ctx.restore");
  assert.equal(saves.length, restores.length, "balanced save/restore");
});

test("drawInstrument calls stroke for heat bezel ticks", () => {
  const ctx = makeFakeCtx();
  const state = makeInstrumentState({ heat01: 0.5 });
  drawInstrument(ctx, state);
  const strokes = ctx.calls.filter(c => c.method === "stroke");
  // 56 bezel ticks + shield ring segments + core = well over 56 strokes total
  assert.ok(strokes.length >= 56, `expected ≥56 strokes, got ${strokes.length}`);
});

// ── drawVulnGlyph ──────────────────────────────────────────────────────────

test("drawVulnGlyph: known vuln id renders without throwing", () => {
  const ctx = makeFakeCtx();
  assert.doesNotThrow(() => drawVulnGlyph(ctx, "unpatched-ssh", 32, 32, 22));
});

test("drawVulnGlyph: unknown (fallback) id renders without throwing", () => {
  const ctx = makeFakeCtx();
  assert.doesNotThrow(() => drawVulnGlyph(ctx, "nonexistent-vuln-id", 32, 32, 22));
});

test("drawVulnGlyph: all known vuln ids render without throwing", () => {
  const ctx = makeFakeCtx();
  const ids = [
    "unpatched-ssh", "weak-auth", "stale-firmware", "open-telnet", "buffer-overflow", "snmp-public",
    "path-traversal", "deserialization", "side-channel", "race-condition", "kernel-exploit",
    "zero-day-rce", "supply-chain", "hardware-backdoor", "cryptographic-weakness",
  ];
  for (const id of ids) {
    assert.doesNotThrow(() => drawVulnGlyph(ctx, id, 32, 32, 22), `should not throw for ${id}`);
  }
});

test("drawVulnGlyph: issues at least one stroke call for a known id", () => {
  const ctx = makeFakeCtx();
  drawVulnGlyph(ctx, "unpatched-ssh", 32, 32, 22);
  const strokes = ctx.calls.filter(c => c.method === "stroke" || c.method === "strokeRect");
  assert.ok(strokes.length >= 1, "expected at least one stroke call");
});

test("drawVulnGlyph: cached and uncached renders produce identical stroke counts", () => {
  // The first call parses + caches; the second call hits the cache.
  // Identical stroke counts confirm the cache doesn't lose or duplicate primitives.
  const id = "kernel-exploit";
  const ctx1 = makeFakeCtx();
  const ctx2 = makeFakeCtx();
  drawVulnGlyph(ctx1, id, 32, 32, 22); // may or may not be cached already
  drawVulnGlyph(ctx2, id, 32, 32, 22); // guaranteed cache hit (same id)
  const strokes1 = ctx1.calls.filter(c => c.method === "stroke" || c.method === "strokeRect").length;
  const strokes2 = ctx2.calls.filter(c => c.method === "stroke" || c.method === "strokeRect").length;
  assert.equal(strokes1, strokes2, "cached and uncached renders produce same stroke count");
});

// ── createStagingRing / createShieldRings ──────────────────────────────────

test("createStagingRing returns a ring with slots", () => {
  const ring = createStagingRing([{ rarity: "common", types: ["unpatched-ssh"] }]);
  assert.ok(Array.isArray(ring.slots));
  assert.ok(ring.slots.length >= 12);
  assert.equal(ring.dir, 1);
  assert.equal(typeof ring.rot, "number");
});

test("createStagingRing: slots have string vuln-id types", () => {
  const ring = createStagingRing([{ rarity: "uncommon", types: ["kernel-exploit"] }]);
  for (const slot of ring.slots) {
    assert.equal(typeof slot.type, "string", "slot.type must be a vuln-id string");
  }
});

test("createShieldRings returns correct count", () => {
  for (const n of [1, 2, 3]) {
    const rings = createShieldRings(n);
    assert.equal(rings.length, n);
  }
});

test("createShieldRings: each ring has order (length SEG) and dead (length SEG)", () => {
  const rings = createShieldRings(3);
  for (const ring of rings) {
    assert.equal(ring.order.length, SEG);
    assert.equal(ring.dead.length, SEG);
    assert.ok(ring.dead.every(d => d === false));
  }
});

test("createShieldRings: direction alternates per ring", () => {
  const rings = createShieldRings(3);
  // dir alternates: i%2 ? 1 : -1 → ring0=-1, ring1=1, ring2=-1
  assert.equal(rings[0].dir, -1);
  assert.equal(rings[1].dir, 1);
  assert.equal(rings[2].dir, -1);
});
