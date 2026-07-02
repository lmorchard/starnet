// <starnet-heat-scope> — animated heat history strip ("Ember Scope").
//
// A standing vector-CRT scope, like <starnet-waveform>: a sweep head redraws left-to-right on
// repeat, leaving a phosphor trail that fades over one sweep. Unlike the vitals it draws a FLAME
// rather than a single trace — a jagged crown contour rides the current heat height (`frac`), with
// discrete contour lines stacked below it at a fixed gap, added/removed only at the bottom. Color
// runs red (crown) → yellow (base); lower lines fade out. All flame geometry is the pure, tested
// heat-flame.js module; this component owns only canvas/RAF/dpr plumbing and the sweep buffer.
//
// The buffer stores a frozen per-column seed `r` (its only entropy) so a painted column holds
// still and just fades — the shimmer comes from fresh jitter the beam lays down as it sweeps past.
// All animation state (_buf/_head/_lastTs) is ephemeral render state — NOT game state.

import { html, nothing } from "lit";
import { StarnetElement } from "./starnet-element.js";
import { bandY, bandExists, bandColor, bandAlpha } from "../heat-flame.js";

const STEP = 2;   // px between trail samples
const NB = 12;    // glow age-bands per frame
const CEIL = 12;  // hard cap on contour lines

class StarnetHeatScope extends StarnetElement {
  static properties = {
    frac:  { type: Number },   // 0..1 heat fraction (heat / HEAT_GAUGE_MAX)
    label: { type: String },
    w:     { type: Number },
    h:     { type: Number },
    speed: { type: Number },   // px/sec sweep
    trail: { type: Number },   // trail length as a multiple of one sweep
    bloom: { type: Number },   // glow blur radius
    bandGap:  { type: Number }, // px between contour lines
    maxBands: { type: Number }, // contour-line cap (<= CEIL)
    jag:   { type: Number },    // jitter amount 0..1
    fade:  { type: Number },    // lower-band transparency falloff 0..1
    autosize: { type: Boolean }, // track host width (full-width strips); ignores `w`
  };

  constructor() {
    super();
    this.frac = 0;
    this.label = "HEAT";
    this.w = 204;
    this.h = 44;
    this.speed = 100; // matches the vital waveforms so the sweep heads stay in phase
    this.trail = 0.9;
    this.bloom = 6;
    this.bandGap = 4;
    this.maxBands = 12;
    this.jag = 0.5;
    this.fade = 0.6;
    this.autosize = false;

    // Ephemeral render state — not reactive, not serialised.
    this._buf = [];
    this._head = 0;
    this._lastTs = null;
    this._rafId = null;
    this._ctx = null;
    this._W = this.w;
    this._H = this.h;
    this._ro = null;
  }

  render() {
    return html`
      ${this.label
        ? html`<div class="vital-head"><span class="vital-label">${this.label}</span></div>`
        : nothing}
      <span class="hud-waveform"><canvas></canvas></span>
    `;
  }

  firstUpdated() {
    if (this.autosize && typeof ResizeObserver !== "undefined") {
      this._ro = new ResizeObserver(() => { this._setupCanvas(); });
      this._ro.observe(this);
    }
    this._setupCanvas();
    this._startLoop();
  }

  updated(changed) {
    if (changed.has("w") || changed.has("h")) this._setupCanvas();
  }

  connectedCallback() {
    super.connectedCallback();
    this._startLoop(); // no-op until firstUpdated has the canvas; re-arms on reattach
  }

  disconnectedCallback() {
    this._stopLoop();
    if (this._ro) { this._ro.disconnect(); this._ro = null; }
    super.disconnectedCallback();
  }

  // ── internals ──────────────────────────────────────────────────────────────

  _setupCanvas() {
    const canvas = this.querySelector("canvas");
    if (!canvas) return;
    const W = this.autosize ? Math.round(this.clientWidth || this.w) : this.w;
    const H = this.h;
    if (W < 1 || H < 1) return; // not laid out yet — ResizeObserver will re-fire
    if (this._ctx && this._W === W && this._H === H) return; // unchanged (keep the trail)
    this._W = W;
    this._H = H;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS px; crisp on hi-dpi
    this._ctx = ctx;
    this._buf = [];
    this._head = 0;
    this._lastTs = null;
    ctx.clearRect(0, 0, W, H);
  }

  _startLoop() {
    if (this._rafId != null || !this._ctx) return; // guard against double-start
    const tick = (ts) => {
      this._frame(ts);
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  _stopLoop() {
    if (this._rafId != null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._lastTs = null;
  }

  _frame(ts) {
    const ctx = this._ctx;
    if (!ctx) return;
    const now = ts / 1000;
    const dt = this._lastTs != null ? Math.min(now - this._lastTs, 0.05) : 0;
    this._lastTs = now;

    const W = this._W, H = this._H;
    const frac = Math.max(0, Math.min(1, Number(this.frac) || 0));
    const geom = { base: H - 3, span: H - 3 - 4, gap: this.bandGap, jag: this.jag };
    const MAXB = Math.min(CEIL, this.maxBands | 0);
    const fade = this.fade;

    // Advance the sweep head, sampling the CURRENT level into the buffer with a frozen jitter
    // seed per column (older columns keep their level/shape — a frac change ripples in behind).
    const sweepT = W / Math.max(1, this.speed);
    const trailDur = sweepT * Math.max(0.05, this.trail);
    const target = this._head + this.speed * dt;
    while (this._head < target) {
      const segStart = this._head;
      const next = Math.min(this._head + STEP, target);
      const x = next % W;
      const gap = Math.floor(next / W) !== Math.floor(segStart / W); // crossed the edge
      this._buf.push({ x, level: frac, r: Math.random(), t: now, gap });
      this._head = next;
    }
    const cutoff = now - trailDur;
    while (this._buf.length && this._buf[0].t < cutoff) this._buf.shift();

    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const bandOf = (p) => Math.floor(((now - p.t) / trailDur) * NB);

    // Draw bottom → top so the bright crown lands on top. Each contour line is batched by age
    // band (one glowing stroke per band), skipping wrap gaps and columns with no room for it.
    for (let j = MAXB - 1; j >= 0; j--) {
      const col = bandColor(j, MAXB);
      const isCrown = j === 0;
      ctx.lineWidth = isCrown ? 1.4 : 1.1;
      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = isCrown ? this.bloom : Math.max(0, this.bloom - 2);
      const dim = bandAlpha(j, MAXB, fade);
      // The crown (j=0) always draws — at heat 0 it rests as a faint flat baseline rather than
      // vanishing, like the vitals' idle flatline. Lower bands appear only when there's room.
      const alwaysDraw = j === 0;
      let curBand = -1, open = false;
      const flush = () => {
        if (open) { ctx.globalAlpha = dim * (1 - (curBand + 0.5) / NB); ctx.stroke(); open = false; }
      };
      for (let i = 1; i < this._buf.length; i++) {
        const a = this._buf[i - 1], b = this._buf[i];
        const band = bandOf(b);
        if (b.gap || band >= NB ||
            (!alwaysDraw && (!bandExists(a.level, j, geom) || !bandExists(b.level, j, geom)))) {
          flush(); curBand = -1; continue;
        }
        if (band !== curBand) {
          flush();
          ctx.beginPath();
          ctx.moveTo(a.x, bandY(a.level, a.r, j, geom));
          curBand = band; open = true;
        }
        ctx.lineTo(b.x, bandY(b.level, b.r, j, geom));
      }
      flush();
    }
    ctx.globalAlpha = 1;

    // Leading head dot rides the crown (always present, even at heat 0).
    if (this._buf.length) {
      const p = this._buf[this._buf.length - 1];
      const y = bandY(p.level, p.r, 0, geom);
      const col = bandColor(0, MAXB);
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = this.bloom + 3;
      ctx.beginPath(); ctx.arc(p.x, y, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff6e8";
      ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(p.x, y, 0.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;
  }
}

customElements.define("starnet-heat-scope", StarnetHeatScope);
