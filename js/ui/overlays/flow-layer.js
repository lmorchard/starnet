// @ts-check
// Edge-anchored flow layer: draws typed packets travelling along the edge between each flow's
// endpoints. Rendered on a single <canvas> (not DOM/SVG per packet) — clearing and redrawing
// ~N small stroked glyphs per frame is sub-millisecond and avoids the per-frame DOM repaint /
// compositing cost that animating many SVG nodes over the graph canvas incurs.
//
// Cytoscape is read ONLY in _recompute() (on rebuild + pan/zoom), never per-frame: the rAF
// loop works entirely from cached screen geometry, so it can't force a canvas redraw of the
// graph. `cy` is passed into refresh() rather than imported, keeping the pure seams
// (renderableFlows / flowsSignature) importable in node tests without stubbing the DOM.

import { drawFlowGlyph } from "../flow-glyphs.js";

/** @typedef {import('../../core/types.js').Flow} Flow */

// Packet volume + speed as functions of a flow's `rate` (0..1). Feel-tuned.
const MAX_PACKETS = 3;
/** @param {number} rate */
function packetCount(rate) {
  return Math.max(1, Math.min(MAX_PACKETS, Math.round((Number(rate) || 0) * MAX_PACKETS)));
}
/** Fraction of the edge traversed per ms. @param {number} rate */
function packetSpeed(rate) {
  return (0.18 + 0.42 * (Number(rate) || 0)) / 1000;
}

// Spacing for flows that share one edge (mixed-type): parallel perpendicular lanes + staggered
// phase so different types don't stack. Plus per-packet jitter to break lockstep. Feel-tuned.
const LANE_GAP = 3;
const PHASE_STAGGER = 0.4;
const PHASE_JITTER = 0.12;
// Extra clearance (glyph-space px, scaled by zoom) between a packet's endpoints and node rims.
// Kept small: the fade (below) makes packets invisible at the endpoints, so they can spawn /
// despawn right up against the rim without popping — they only read solid once well clear.
const RIM_PAD = 2;
// Glyph stroke width in glyph-space (scaled with zoom at draw time).
const STROKE = 0.7;
// Fraction of a packet's traversal spent fading in (leaving the source) and fading out
// (arriving at the destination), so packets don't pop in/out at the t=0↔1 wrap. Feel-tuned.
const FADE = 0.15;

/**
 * Opacity ramp for a packet at position `t` (0 = source rim, 1 = destination rim): 0 at both
 * ends, rising linearly to 1 over the first/last FADE of the traversal. Pure. @param {number} t
 */
export function fadeAlpha(t) {
  return Math.max(0, Math.min(1, Math.min(t, 1 - t) / FADE));
}

/**
 * Flows whose BOTH endpoints are currently present (revealed) in the graph. Pure.
 * Generic so the caller's richer flow type (with type/rate/encrypted) is preserved.
 * @template {{from:string,to:string}} T
 * @param {T[]} flows
 * @param {string[]} presentNodeIds
 * @returns {T[]}
 */
export function renderableFlows(flows, presentNodeIds) {
  const present = new Set(presentNodeIds);
  return (flows || []).filter((f) => present.has(f.from) && present.has(f.to));
}

/**
 * Stable string key for a set of flows. The layer rebuilds only when this changes, so frequent
 * STATE_CHANGED events that don't alter the flow set (e.g. a timed action ticking) don't reset
 * the packets. Pure.
 * @param {Array<{from:string,to:string,type:string,rate:number,encrypted?:boolean,revealed?:boolean}>} flows
 * @returns {string}
 */
export function flowsSignature(flows) {
  return (flows || [])
    // `revealed` is in the key so SNIFFing an encrypted flow (which flips revealed) changes the
    // signature and rebuilds the layer — the packet re-renders as its true type instead of "?".
    .map((f) => `${f.from}>${f.to}:${f.type}:${f.rate}:${f.encrypted ? 1 : 0}:${f.revealed ? 1 : 0}`)
    .join("|");
}

export class FlowLayer {
  /** @param {HTMLElement} container the overlay layer element */
  constructor(container) {
    this.container = container;
    const canvas = document.createElement("canvas");
    canvas.className = "flow-layer";
    Object.assign(canvas.style, {
      position: "absolute",
      left: "0",
      top: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
    });
    container.appendChild(canvas);
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    // Cap the backing-store resolution: this canvas repaints every frame, so its whole texture
    // is re-uploaded to the GPU each frame — cost scales with pixel area. At full retina (2×) a
    // graph-panel-sized canvas is millions of pixels/frame; 1× is plenty for small glow-softened
    // glyphs and cuts the per-frame upload ~4×.
    this.dpr = Math.min((typeof window !== "undefined" && window.devicePixelRatio) || 1, 1);
    this.w = 0;
    this.h = 0;
    /** @type {any} */
    this.cy = null;
    // Grouped by flow: endpoint node refs cached here (resolved once per rebuild) and per-edge
    // screen geometry cached by _recompute (on rebuild + pan/zoom), shared by all its packets.
    /** @type {Array<{a:any,b:any,type:string,encrypted:boolean,laneOffset:number,packets:Array<{t:number,speed:number}>,visible?:boolean,sx?:number,sy?:number,segX?:number,segY?:number,offX?:number,offY?:number,zoom?:number}>} */
    this.flows = [];
    this.raf = null;
    this.last = 0;
    this._sig = "";
    this._resize();
  }

  /** Match the canvas backing-store to the container size × devicePixelRatio. */
  _resize() {
    const w = this.container.clientWidth || 0;
    const h = this.container.clientHeight || 0;
    this.w = w;
    this.h = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
  }

  /**
   * Rebuild the packet set from the current flows + graph, skipping when the renderable set is
   * unchanged (so STATE_CHANGED storms during a timed action don't reset packet phases).
   * @param {Array<{from:string,to:string,type:string,rate:number,encrypted?:boolean,revealed?:boolean}>} flows
   * @param {any} cy
   */
  refresh(flows, cy) {
    this.cy = cy;
    const present = cy ? cy.nodes().map((/** @type {any} */ n) => n.id()) : [];
    const renderable = renderableFlows(flows, present);
    const sig = flowsSignature(renderable);
    if (sig === this._sig) return;
    this._sig = sig;
    this._build(renderable);
  }

  /** @param {Array<{from:string,to:string,type:string,rate:number,encrypted?:boolean,revealed?:boolean}>} flows */
  _build(flows) {
    this.flows = [];
    const cy = this.cy;
    // Lane assignment among flows sharing an (unordered) edge.
    const edgeKey = (/** @type {{from:string,to:string}} */ f) =>
      f.from < f.to ? `${f.from}|${f.to}` : `${f.to}|${f.from}`;
    const laneCount = new Map();
    for (const f of flows) laneCount.set(edgeKey(f), (laneCount.get(edgeKey(f)) || 0) + 1);
    const laneSeen = new Map();
    for (const f of flows) {
      const key = edgeKey(f);
      const groupSize = laneCount.get(key);
      const laneIndex = laneSeen.get(key) || 0;
      laneSeen.set(key, laneIndex + 1);
      const laneOffset = (laneIndex - (groupSize - 1) / 2) * LANE_GAP;
      const count = packetCount(f.rate);
      const speed = packetSpeed(f.rate);
      const packets = [];
      for (let i = 0; i < count; i++) {
        const jitter = (Math.random() - 0.5) * PHASE_JITTER;
        const t = ((i / count + laneIndex * PHASE_STAGGER + jitter) % 1 + 1) % 1;
        packets.push({ t, speed });
      }
      this.flows.push({
        a: cy ? cy.getElementById(f.from) : null,
        b: cy ? cy.getElementById(f.to) : null,
        type: f.type,
        // Concealed only while encrypted AND not yet SNIFFed. Once revealed, draw the true glyph.
        encrypted: !!f.encrypted && !f.revealed,
        laneOffset,
        packets,
      });
    }
    this._resize();
    this._recompute(); // prime cached geometry before the first frame
    this._ensureLoop();
  }

  /**
   * Recompute each flow's cached SCREEN geometry from Cytoscape. The ONLY place that reads cy
   * (renderedPosition/renderedWidth/zoom) — run on rebuild and on pan/zoom, never per-frame.
   */
  _recompute() {
    const cy = this.cy;
    const zoom = cy ? cy.zoom() : 1;
    const pad = RIM_PAD * zoom;
    for (const fl of this.flows) {
      const a = fl.a;
      const b = fl.b;
      if (!cy || !a || !b || !a.length || !b.length || a.removed() || b.removed()) {
        fl.visible = false;
        continue;
      }
      const pa = a.renderedPosition();
      const pb = b.renderedPosition();
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      // Travel rim-to-rim (+RIM_PAD); fall back to centers if the rims would cross.
      const rA = a.renderedWidth() / 2 + pad;
      const rB = b.renderedWidth() / 2 + pad;
      const inset = len - rA - rB > 1;
      const sx = inset ? pa.x + ux * rA : pa.x;
      const sy = inset ? pa.y + uy * rA : pa.y;
      const ex = inset ? pb.x - ux * rB : pb.x;
      const ey = inset ? pb.y - uy * rB : pb.y;
      fl.visible = true;
      fl.sx = sx;
      fl.sy = sy;
      fl.segX = ex - sx;
      fl.segY = ey - sy;
      fl.offX = -uy * fl.laneOffset * zoom;
      fl.offY = ux * fl.laneOffset * zoom;
      fl.zoom = zoom;
    }
  }

  _packetCount() {
    let n = 0;
    for (const fl of this.flows) n += fl.packets.length;
    return n;
  }

  _ensureLoop() {
    const has = this._packetCount() > 0;
    if (has && this.raf === null) {
      this.last = 0;
      this.raf = requestAnimationFrame((t) => this._frame(t));
    } else if (!has && this.raf !== null) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  }

  /**
   * Per-frame: clear the canvas and redraw each packet at its advanced position, using cached
   * geometry only. No Cytoscape reads, no DOM mutation.
   * @param {number} now
   */
  _frame(now) {
    const dt = this.last ? now - this.last : 16;
    this.last = now;
    const ctx = this.ctx;
    if (ctx) {
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.w, this.h);
      ctx.lineWidth = STROKE;
      ctx.lineJoin = "round";
      for (const fl of this.flows) {
        if (!fl.visible) continue;
        const sx = fl.sx ?? 0;
        const sy = fl.sy ?? 0;
        const segX = fl.segX ?? 0;
        const segY = fl.segY ?? 0;
        const offX = fl.offX ?? 0;
        const offY = fl.offY ?? 0;
        const zoom = fl.zoom ?? 1;
        for (const p of fl.packets) {
          p.t = (p.t + p.speed * dt) % 1;
          const x = sx + segX * p.t + offX;
          const y = sy + segY * p.t + offY;
          ctx.save();
          ctx.globalAlpha = fadeAlpha(p.t); // fade in leaving the source, out arriving
          ctx.translate(x, y);
          ctx.scale(zoom, zoom);
          drawFlowGlyph(ctx, fl.type, { encrypted: fl.encrypted });
          ctx.restore();
        }
      }
    }
    this.raf = requestAnimationFrame((t) => this._frame(t));
  }

  /** Re-cache geometry + canvas size on pan/zoom (wired to onViewport). No per-frame cy reads. */
  reposition() {
    this._resize();
    this._recompute();
  }

  clear() {
    if (this.raf !== null) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
    if (this.ctx) {
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.ctx.clearRect(0, 0, this.w, this.h);
    }
    this.flows = [];
    this._sig = ""; // force a rebuild on the next refresh (e.g. fresh run)
  }
}
