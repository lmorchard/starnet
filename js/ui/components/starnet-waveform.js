// <starnet-waveform> — animated vital-sign waveform component.
//
// Draws one waveform (ECG or square-pulse) onto a <canvas> like a vector-CRT scope:
// the static shape (from waveform.js) is redrawn left-to-right by a sweep head, leaving
// a phosphor trail that fades to nothing over one sweep. The trace is sampled into a
// time-stamped history buffer and redrawn from scratch each frame (clear + age→alpha),
// so the fade is exact (no burn-in) and a frac change ripples in behind the head rather
// than snapping the whole graph. Glow is paid per age-band (~12), not per segment.
//
// All animation state (_buf/_head/_lastTs) is ephemeral render state — NOT reactive,
// NOT part of game state.

import { html, nothing } from "lit";
import { StarnetElement } from "./starnet-element.js";
import { ecgPoints, pulsePoints, sampleY } from "../waveform.js";

const STEP = 2;  // px between trail samples
const NB = 12;   // glow age-bands per frame

class StarnetWaveform extends StarnetElement {
  static properties = {
    kind:  { type: String },
    frac:  { type: Number },
    color: { type: String },
    w:     { type: Number },
    h:     { type: Number },
    label: { type: String },
    speed: { type: Number },  // px/sec sweep
    trail: { type: Number },  // trail length as a multiple of one sweep
    bloom: { type: Number },  // glow blur radius
    autosize: { type: Boolean }, // track host width (full-width strips); ignores `w`
    meter: { type: Boolean }, // render a label + depleting pip header above the trace
  };

  constructor() {
    super();
    this.kind  = "ecg";
    this.frac  = 1;
    this.color = "var(--green)";
    this.w     = 120;
    this.h     = 28;
    this.label = "";
    this.speed = 100;
    this.trail = 0.8;
    this.bloom = 14;
    this.autosize = false;
    this.meter = false;

    // Ephemeral render state — not reactive, not serialised.
    this._buf = [];
    this._head = 0;
    this._lastTs = null;
    this._rafId = null;
    this._ctx = null;
    this._resolvedColor = "#39ff7a";
    this._W = this.w;     // effective draw size (autosize tracks host width)
    this._H = this.h;
    this._ro = null;      // ResizeObserver when autosize
  }

  render() {
    const frac = Math.max(0, Math.min(1, Number(this.frac) || 0));
    return html`
      ${this.meter ? this._meterHeader(frac) : nothing}
      <span class="hud-waveform" title="${this.label}: ${Math.round(frac * 100)}%">
        <canvas></canvas>
      </span>
    `;
  }

  /** Label + depleting 5-pip meter (ramps green→yellow→red), mirroring the card pips. */
  _meterHeader(frac) {
    const PIPS = 5;
    const filled = frac <= 0 ? 0 : Math.max(1, Math.round(frac * PIPS));
    const pips = "█".repeat(filled) + "░".repeat(PIPS - filled);
    const tier = frac > 0.6 ? "ok" : frac > 0.3 ? "warn" : "crit";
    return html`
      <div class="vital-head">
        <span class="vital-label">${this.label}</span>
        <span class="vital-pips ${tier}">${pips}</span>
      </div>
    `;
  }

  firstUpdated() {
    this._resolveColor();
    if (this.autosize && typeof ResizeObserver !== "undefined") {
      this._ro = new ResizeObserver(() => { this._setupCanvas(); });
      this._ro.observe(this);
    }
    this._setupCanvas();
    this._startLoop();
  }

  updated(changed) {
    if (changed.has("w") || changed.has("h")) this._setupCanvas();
    if (changed.has("color")) this._resolveColor();
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

  /** Resolve a `var(--x)` color string to its computed value (canvas can't use vars). */
  _resolveColor() {
    const c = (this.color || "").trim();
    const m = /^var\((--[\w-]+)\)$/.exec(c);
    this._resolvedColor = m
      ? (getComputedStyle(this).getPropertyValue(m[1]).trim() || "#39ff7a")
      : (c || "#39ff7a");
  }

  _setupCanvas() {
    const canvas = this.querySelector("canvas");
    if (!canvas) return;
    const W = this.autosize ? Math.round(this.clientWidth || this.w) : this.w;
    const H = this.h;
    if (W < 1 || H < 1) return; // not laid out yet — ResizeObserver will re-fire
    if (this._ctx && this._W === W && this._H === H) return; // unchanged (avoid clearing the trail)
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
    const color = this._resolvedColor;
    const pts = frac <= 0
      ? [{ x: 0, y: H / 2 }, { x: W, y: H / 2 }]
      : (this.kind === "pulse" ? pulsePoints({ frac, width: W, height: H })
                               : ecgPoints({ frac, width: W, height: H }));

    // Sample the swept slice with the CURRENT shape (history keeps older shapes).
    const sweepT = W / Math.max(1, this.speed);
    const trailDur = sweepT * Math.max(0.05, this.trail);
    const target = this._head + this.speed * dt;
    while (this._head < target) {
      const segStart = this._head;
      const next = Math.min(this._head + STEP, target);
      const x = next % W;
      const gap = Math.floor(next / W) !== Math.floor(segStart / W); // crossed the edge
      this._buf.push({ x, y: sampleY(pts, x), t: now, gap });
      this._head = next;
    }
    const cutoff = now - trailDur;
    while (this._buf.length && this._buf[0].t < cutoff) this._buf.shift();

    // Redraw from scratch: clear, then stroke each age-band as one glowing path.
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 1.3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = this.bloom;
    const bandOf = (p) => Math.floor(((now - p.t) / trailDur) * NB);
    let curBand = -1, open = false;
    const flush = () => { if (open) { ctx.globalAlpha = 1 - (curBand + 0.5) / NB; ctx.stroke(); open = false; } };
    for (let i = 1; i < this._buf.length; i++) {
      const a = this._buf[i - 1], b = this._buf[i];
      const band = bandOf(b);
      if (b.gap || band >= NB) { flush(); curBand = -1; continue; }
      if (band !== curBand) { flush(); ctx.beginPath(); ctx.moveTo(a.x, a.y); curBand = band; open = true; }
      ctx.lineTo(b.x, b.y);
    }
    flush();
    ctx.globalAlpha = 1;

    // Leading dot rides the newest point.
    if (this._buf.length) {
      const p = this._buf[this._buf.length - 1];
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = this.bloom + 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#eaffff";
      ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(p.x, p.y, 0.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;
  }
}

customElements.define("starnet-waveform", StarnetWaveform);
