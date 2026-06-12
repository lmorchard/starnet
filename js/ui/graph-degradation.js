// @ts-check
// Graph-panel degradation effects.
//  - Health: a transparent WebGL canvas injected into #graph-container, drawing a
//    kaleidoscopic "liquid light show" plasma over the graph, plus a CSS haze filter
//    on #cy. Decoupled: never reads Cytoscape pixels. No-op without WebGL.
//  - Deck: chaos in the REAL graph via Cytoscape's own model, as a lightweight PARTICLE
//    system. Each tick (~30Hz) a severity-scaled budget emits glitch "particles" — node
//    shakes, blink / id-scramble / glyph-swap / undiscover, real-edge drop-out, phantom
//    nodes & connections, grid-backdrop spasms — each with a lifetime, an optional per-tick
//    update, and a self-cleanup. Operates on cy's render positions/styles only; the game
//    model (state/nodeGraph) is untouched, so save/load is unaffected. Cheap for our node
//    counts (no per-pixel filter). Particle UPDATES run every frame (~60Hz) so the micro-shake
//    blurs; spawning is gated to ~30Hz so the rate is frame-rate-independent. Restored on heal/stop.

import { degradationParams, buildGraphFilterString } from "./graph-degradation-params.js";
import { getCy } from "./graph.js";
import { ALL_GLYPH_TYPES, nodeFaceDataUri } from "./node-glyphs.js";
import { ParticlePool } from "./particle-pool.js";

let gl = null, canvas = null, program = null, raf = 0;
let uniforms = null;
let cyEl = null;
let containerEl = null;        // #graph-container, for grid-backdrop glitches
let gridGlitchActive = false;  // guard so overlapping grid glitches don't clear early
// Deck-perturbation state. cy render positions aren't saved state, so this is purely
// visual; base positions are restored on heal.
let basePos = null;        // Map<nodeId, {x,y}> | null — resting positions while degraded
let deckTickLast = 0;      // throttle for the position/style writes
// A glitch "particle" is a transient corruption with a lifetime: `update` (optional) runs each
// tick while alive (shakes re-jitter); `restore` undoes it exactly, on expiry or heal. Style/
// structural glitches are apply-on-spawn + restore (no update). The shared ParticlePool owns the
// age/cull lifecycle (see js/ui/particle-pool.js).
/** @typedef {import("./particle-pool.js").Particle} Particle */
const pool = new ParticlePool(); // live glitch particles — every type shares one pool
let phantomSeq = 0;        // unique-id counter for hallucinated phantom nodes
let flowTime = 0;          // heartbeat-warped flow clock fed to the plasma shader (u_t)
let flowLast = 0;          // previous loop timestamp, for dt
// Latest params (set by updateFromState; read by the rAF loop).
let cur = {
  health: { severity: 0, overlayOpacity: 0 },
  deck: { severity: 0 },
};
// Kept in sync with buildGraphFilterString's base return so the change-gate
// correctly skips the first DOM write while healthy.
let curFilter = "url(#starnet-bloom)";

const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
const FRAG = `
precision highp float;
uniform vec2 u_res; uniform float u_t; uniform float u_hop; uniform float u_pulse; uniform float u_sev;
float hash3(vec3 p){return fract(sin(dot(p,vec3(41.3,289.1,113.7)))*43758.5453);}
// 3D value noise — lets us animate by moving through a z-slice (growth in place, not flow).
float vnoise3(vec3 p){
  vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  float a=mix(mix(hash3(i+vec3(0,0,0)),hash3(i+vec3(1,0,0)),f.x),
              mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y);
  float b=mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),
              mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y);
  return mix(a,b,f.z);
}
// fBm over 3D noise. The *2.03 per octave scales z too, so fine detail boils faster than the
// coarse structure — a turbulent, creeping growth rather than a uniform drift.
float fbm3(vec3 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*vnoise3(p);p=p*2.03+vec3(1.7,9.1,2.3);a*=.5;}return s;}
// Cosine palette (Inigo Quilez): rich full-spectrum colour that cycles with its phase arg.
vec3 pal(float x){ return 0.5 + 0.5*cos(6.28318*(x + vec3(0.0,0.33,0.67))); }
void main(){
  if(u_hop<=0.0){ gl_FragColor=vec4(0.0); return; }
  // health — TIMELAPSE MOLD GROWTH (not smoky swirls). Straight fBm sampled from a moving slice
  // of 3D noise, so the pattern morphs and GROWS IN PLACE. Bright "colonies" spread outward from
  // slow drifting spore-centres; the advancing growth front glows; colours mingle in patches.
  float asp=u_res.x/u_res.y;
  vec2 auv=vec2(gl_FragCoord.x/u_res.y, gl_FragCoord.y/u_res.y); // aspect-correct (y-normalized)
  float t=u_t;                                  // heartbeat-warped clock (advanced in JS)
  // Heartbeat squeeze: the whole field contracts slightly on each thump (u_pulse spikes per beat).
  vec2 ctr=vec2(asp*0.5,0.5);
  auv = ctr + (auv-ctr)*(1.0 - 0.02*u_pulse);
  // Spore-centres: slow-drifting points that locally lower the growth threshold, so colonies
  // bloom outward from them like mold spreading from a spore.
  float boost=0.0;
  for(int i=0;i<3;i++){
    float fi=float(i)+1.0;
    vec2 c=vec2(asp*(0.5+0.32*sin(t*0.05*fi + fi*1.7)),
                    (0.5+0.32*cos(t*0.045*fi + fi*3.3)));
    float d=length(auv-c);
    boost += 0.10/(d*d + 0.06);
  }
  boost=clamp(boost,0.0,0.32) + 0.025*u_pulse;  // colonies swell gently outward on each heartbeat
  // Fractal density evolving through z over time => in-place growth, no directional flow.
  float n=fbm3(vec3(auv*3.4, t*0.22));
  // Coverage scales with health damage: mild damage -> high threshold (sparse colonies on mostly
  // black); severe -> low threshold (dense colour, little black left). Spore boost still blooms.
  float lo=mix(0.78, 0.40, u_sev) - boost;
  float hi=lo + 0.22;
  float growth=smoothstep(lo, hi, n);                       // colony body (fuzzy advancing front)
  float front=growth*(1.0-smoothstep(hi, hi+0.14, n));      // bright rim at the spreading edge
  // Colour from a slower, lower-freq noise => broad PATCHES of differing hue that mingle across
  // the colonies, plus a faint global evolution. Many colours coexist; no global hue sweep.
  float hue=0.55*fbm3(vec3(auv*1.4+11.0, t*0.10)) + 0.35*n + 0.02*t;
  vec3 col=pal(hue);
  float luma=dot(col, vec3(0.299,0.587,0.114));
  col=clamp(mix(vec3(luma), col, 1.30), 0.0, 1.0);          // richer saturation (push away from gray)
  col *= mix(0.06, 0.60, growth);                           // deep-black substrate -> lit colony (dimmed)
  col *= 1.0 + 0.35*front;                                   // advancing front glows softly (no scintillating rim)
  col = mix(col, vec3(0.9,0.85,0.72), smoothstep(hi+0.06, hi+0.20, n)*0.2); // dense cores warm-blow, faint
  col *= 1.0 + 0.10*u_pulse;                                // subtle luminance swell on each heartbeat
  // Substrate stays faint; colonies + fronts carry the opacity. Gated by u_hop (health).
  float a=u_hop*clamp((0.18 + 0.85*growth + 0.55*front)*(1.0 + 0.10*u_pulse), 0.0, 1.0);
  gl_FragColor=vec4(col, clamp(a,0.0,0.95));
}`;

/**
 * @param {number} type
 * @param {string} src
 * @returns {WebGLShader}
 */
function compile(type, src) {
  const g = /** @type {WebGLRenderingContext} */ (gl);
  const s = g.createShader(type);
  if (!s) throw new Error("createShader failed");
  g.shaderSource(s, src); g.compileShader(s);
  if (!g.getShaderParameter(s, g.COMPILE_STATUS)) {
    console.warn("graph-degradation shader:", g.getShaderInfoLog(s));
  }
  return s;
}

// ── Glitch particle factories ───────────────────────────────────────────────
// Each returns (or, for style glitches, applies-then-returns) the restore() half of a
// Particle; the spawner wraps it with a lifetime. Everything is discrete particles emitted
// on one rate curve: per tick (~30Hz) the budget = SPAWN_K * severity spawns floor + a
// fractional extra, so the convex deck severity yields "did I see that?" at >90% deck, ~1
// every few seconds at ~75%, and near-continuous chaos (overlapping particles) below ~25%.
const SPAWN_K = 4.5;       // expected events PER TICK = SPAWN_K * severity. >1 well before empty,
                           // so multiple events fire per tick → an overwhelming, unusable floor
const SHAKE_MIN_MS = 150;  // single-node shake duration range; many overlapping independent
const SHAKE_MAX_MS = 400;  // shakes at low deck merge into a continuous, desynced tremor

function randChars(n) {
  const c = "ABCDEF0123456789#$%&@!";
  let s = "";
  for (let i = 0; i < n; i++) s += c[(Math.random() * c.length) | 0];
  return s;
}
/** Blink a node nearly out. */
function glitchBlink(node) {
  node.style("opacity", 0.04);
  return () => node.removeStyle("opacity");
}
/** Scramble a node's displayed id/label (inline label overrides the data(id) mapping). */
function glitchScramble(node) {
  node.style("label", randChars(Math.max(4, node.id().length)));
  return () => node.removeStyle("label");
}
/** Flash a different node glyph by swapping the inline background-image face. */
function glitchGlyph(node) {
  const orig = node.style("background-image");
  const t = ALL_GLYPH_TYPES[(Math.random() * ALL_GLYPH_TYPES.length) | 0];
  node.style("background-image", nodeFaceDataUri(t, "owned"));
  return () => node.style("background-image", orig);
}
/**
 * Hallucinate a phantom "undiscovered" node — a dim "???" node with 1–2 random edges to
 * real nodes — then remove it. Deliberately inert: `events: "no"` + non-selectable/grabbable
 * so it can never be clicked or targeted (it isn't in game state). Removing the node removes
 * its edges too. Uses a `phantom-glitch` class so it's never mistaken for a real node.
 */
function glitchPhantom(cy) {
  const real = cy.nodes().filter((n) => !n.hasClass("phantom-glitch"));
  if (real.length < 2) return () => {};
  const id = `phantom-glitch-${phantomSeq++}`;
  const anchor = real[(Math.random() * real.length) | 0].position();
  cy.add({
    group: "nodes",
    data: { id, label: "???" },
    position: { x: anchor.x + (Math.random() * 2 - 1) * 180, y: anchor.y + (Math.random() * 2 - 1) * 140 },
    classes: "phantom-glitch",
    selectable: false,
    grabbable: false,
  });
  const pn = cy.getElementById(id);
  pn.style({
    events: "no", label: "???", "background-image": "none", "background-color": "#0a0a12",
    "border-color": "#3a4a5a", "border-width": 1, color: "#6a8a7a", opacity: 0.7,
    shape: "ellipse", width: 26, height: 26, "font-size": 9,
  });
  const k = 1 + (Math.random() < 0.5 ? 1 : 0);
  for (let i = 0; i < k; i++) {
    const target = real[(Math.random() * real.length) | 0].id();
    const eid = `${id}-e${i}`;
    cy.add({ group: "edges", data: { id: eid, source: id, target }, classes: "phantom-glitch" });
    cy.getElementById(eid).style({ events: "no", "line-color": "#3a4a5a", "line-style": "dashed", opacity: 0.55, width: 1 });
  }
  return () => { const el = cy.getElementById(id); if (el && el.length) cy.remove(el); };
}
/** Hallucinate a phantom connection between two real nodes (inert), then remove it. */
function glitchPhantomEdge(cy) {
  const real = cy.nodes().filter((n) => !n.hasClass("phantom-glitch"));
  if (real.length < 2) return () => {};
  const a = real[(Math.random() * real.length) | 0];
  const b = real[(Math.random() * real.length) | 0];
  if (a.id() === b.id()) return () => {};
  const eid = `phantom-glitch-edge-${phantomSeq++}`;
  cy.add({ group: "edges", data: { id: eid, source: a.id(), target: b.id() }, classes: "phantom-glitch" });
  cy.getElementById(eid).style({ events: "no", "line-color": "#3a4a5a", "line-style": "dashed", opacity: 0.6, width: 1 });
  return () => { const e = cy.getElementById(eid); if (e && e.length) cy.remove(e); };
}
/** Briefly flip a discovered node back to an "undiscovered" look — "???" label, no glyph. */
function glitchUndiscover(node) {
  const origImg = node.style("background-image");
  node.style({ label: "???", "background-image": "none" });
  return () => { node.style("background-image", origImg); node.removeStyle("label"); };
}
/** Drop a REAL connection out for a beat — the edge vanishes, then comes back. */
function glitchHideEdge(cy) {
  const realEdges = cy.edges().filter((e) => !e.hasClass("phantom-glitch") && +e.style("opacity") > 0.05);
  if (!realEdges.length) return () => {};
  const e = realEdges[(Math.random() * realEdges.length) | 0];
  e.style("opacity", 0);
  return () => e.removeStyle("opacity");
}
/**
 * Glitch the grid backdrop on #graph-container: a brighter/recolored flash, a drop-out, or a
 * spacing jump. Global, so guarded against overlap; restores to the stylesheet grid.
 */
function glitchGrid(container) {
  if (!container) return () => {};
  gridGlitchActive = true;
  const r = Math.random();
  if (r < 0.4) {
    const col = Math.random() < 0.5 ? "rgba(255,0,255,0.12)" : "rgba(0,255,255,0.16)";
    container.style.backgroundImage = `linear-gradient(${col} 1px, transparent 1px), linear-gradient(90deg, ${col} 1px, transparent 1px)`;
  } else if (r < 0.7) {
    container.style.backgroundImage = "none"; // grid drops out
  } else {
    const s = (18 + Math.random() * 70) | 0;
    container.style.backgroundSize = `${s}px ${s}px`; // spacing jumps
  }
  return () => { container.style.backgroundImage = ""; container.style.backgroundSize = ""; gridGlitchActive = false; };
}
/**
 * Shake particle: jitters ONE node along ONE axis ('h' or 'v') by a tiny 1–2px each tick
 * (update), and settles it back on expiry/heal (restore). The axis lock + micro-magnitude
 * read as a fine signal tremor (not a cheesy 2D wobble); independent windows of mixed axes
 * desync into a sequence. @param {any} cy @param {string} id @param {number} until
 * @param {"h"|"v"} axis @returns {Particle}
 */
function shakeParticle(cy, id, until, axis) {
  return {
    until,
    update() {
      const b = basePos && basePos.get(id);
      const n = cy.getElementById(id);
      if (!b || !n.length) return;
      const d = (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random()); // 1–2px, either direction
      if (axis === "h") n.position({ x: b.x + d, y: b.y });
      else n.position({ x: b.x, y: b.y + d });
    },
    restore() {
      const b = basePos && basePos.get(id);
      const n = cy.getElementById(id);
      if (b && n.length) n.position({ x: b.x, y: b.y });
    },
  };
}

/**
 * Deck = dying-graph chaos via Cytoscape's model, as DISCRETE events on one convex rate
 * curve (no continuous background motion). Each tick spawns events from a severity-scaled
 * budget (`SPAWN_K * sev` expected per tick — so zero or one while mild, several per tick once
 * `SPAWN_K * sev > 1` near empty). Each event is a shake burst (vibrates a few nodes briefly;
 * edges/labels follow) or a transient glitch (blink / glyph-swap / id-scramble / undiscover /
 * phantom node / phantom edge). Event rate and shake-victim count rise with severity, so bursts
 * overlap into continuous chaos near empty.
 * All restored cleanly on heal. cy positions aren't saved state, so this never corrupts the
 * game.
 * @param {number} now rAF timestamp (ms)
 */
function applyDeckPerturbation(now) {
  const cy = getCy();
  if (!cy) return;
  const sev = cur.deck.severity;
  if (sev <= 0) {
    if (basePos || pool.size) restoreDeck(cy);
    return;
  }
  // Particle UPDATES run every rAF frame (so the 1–2px shake re-jitters at full ~60Hz and
  // blurs rather than stepping); spawning + base capture are gated to ~30Hz so the tuned
  // event rate is frame-rate-independent.
  const tick = now - deckTickLast >= 33;
  if (tick) deckTickLast = now;
  if (pool.size === 0 && !tick) return; // nothing to do this frame

  cy.batch(() => {
    if (!basePos) basePos = new Map();

    // Update the live pool EVERY frame; reap expired particles (each restores itself). The
    // graph is STILL wherever no particle is acting — shakes settle their node on expiry, so
    // there's no residue. Independent shake windows desync into a sequence, not one burst.
    pool.tick(now);

    if (!tick) return; // base capture + spawning only at the throttled cadence

    // Real nodes only — phantoms are transient decoration, never shaken/captured.
    const real = cy.nodes().filter((n) => !n.hasClass("phantom-glitch"));
    // Lazy base capture (covers nodes revealed mid-degradation).
    real.forEach((n) => {
      const id = n.id();
      if (!basePos.has(id)) basePos.set(id, { x: n.position("x"), y: n.position("y") });
    });

    // Emit new particles at the convex severity-scaled rate. Durations vary by type with a
    // shuffle so they overlap organically: shakes are quick tremors; blink is a flicker;
    // glyph / id-scramble / undiscover linger so you read them; phantoms persist longest.
    if (real.length) {
      const pick = () => real[(Math.random() * real.length) | 0];
      const dur = () => now + SHAKE_MIN_MS + Math.random() * (SHAKE_MAX_MS - SHAKE_MIN_MS);
      const hold = (min, max) => now + (min + Math.random() * (max - min)) * (0.6 + Math.random() * 1.1);
      const spawnOne = () => {
        const roll = Math.random();
        if (roll < 0.46) {
          const axis = () => (Math.random() < 0.5 ? "h" : "v"); // mix of horizontal + vertical tremors
          pool.add(shakeParticle(cy, pick().id(), dur(), axis()));
          if (Math.random() < sev) pool.add(shakeParticle(cy, pick().id(), dur(), axis())); // a 2nd, staggered, at high severity
        } else if (roll < 0.57) {
          pool.add({ until: hold(80, 380), restore: glitchBlink(pick()) });        // flicker
        } else if (roll < 0.68) {
          pool.add({ until: hold(400, 1600), restore: glitchScramble(pick()) });   // lingering scramble
        } else if (roll < 0.78) {
          pool.add({ until: hold(400, 1600), restore: glitchGlyph(pick()) });      // wrong glyph holds
        } else if (roll < 0.86) {
          pool.add({ until: hold(400, 1600), restore: glitchUndiscover(pick()) }); // stays "???"
        } else if (roll < 0.92) {
          pool.add({ until: hold(400, 1800), restore: glitchHideEdge(cy) });        // a real link drops out
        } else if (roll < 0.97) {
          if (real.length >= 2) {
            const restore = Math.random() < 0.5 ? glitchPhantom(cy) : glitchPhantomEdge(cy);
            pool.add({ until: hold(700, 2500), restore });                          // phantoms persist
          }
        } else if (!gridGlitchActive) {
          pool.add({ until: hold(150, 700), restore: glitchGrid(containerEl) });    // grid backdrop spasms
        }
      };
      // Budget = expected events this tick. Spawn floor(budget) particles + a fractional
      // chance for one more, so the rate climbs past one-per-tick into chaos near empty.
      let budget = SPAWN_K * sev;
      while (budget > 0) {
        if (budget < 1 && Math.random() >= budget) break;
        spawnOne();
        budget -= 1;
      }
    }
  });
}

/**
 * Heal: undo every live particle via its own restore() (precise — shakes reset their node's
 * position, style glitches clear their inline style, phantoms remove themselves; never
 * blanket-clears styles legit code may set inline). Then clear all deck state.
 */
function restoreDeck(cy) {
  cy.batch(() => pool.clear());
  basePos = null;
  // Defensive: ensure the global grid backdrop is back to its stylesheet state.
  if (containerEl) { containerEl.style.backgroundImage = ""; containerEl.style.backgroundSize = ""; }
  gridGlitchActive = false;
}

function resize() {
  if (!canvas || !gl) return;
  const g = /** @type {WebGLRenderingContext} */ (gl);
  const c = /** @type {HTMLCanvasElement} */ (canvas);
  // Cap DPR at 1 for this overlay: it's a soft full-screen plasma where extra pixels
  // aren't perceptible, and on HiDPI / software renderers the per-pixel shader cost is
  // what tanks the framerate.
  const dpr = 1;
  const w = c.clientWidth * dpr, h = c.clientHeight * dpr;
  if (c.width !== w || c.height !== h) {
    c.width = w; c.height = h;
    g.viewport(0, 0, w, h);
  }
}

/**
 * Heartbeat time-warp for the plasma flow: the fluid surges on each lub-dub and eases between,
 * a pulse that grows stronger AND faster as health drops. Returns a speed multiplier (≈1 when
 * healthy). @param {number} now ms @param {number} sev 0..1 health severity
 */
function heartbeatEnv(now, sev) {
  if (sev <= 0) return 0;
  const bpm = 45 + 70 * sev;                  // faster pulse as health falls (panic)
  const x = ((now / 1000) * (bpm / 60)) % 1;  // 0..1 within a beat
  const lub = Math.exp(-((x - 0.10) ** 2) / 0.004);
  const dub = 0.55 * Math.exp(-((x - 0.27) ** 2) / 0.006);
  return lub + dub;                           // ~0 between beats, spikes at the two thumps
}
/** Flow-speed multiplier: surges on each thump, eases below 1 between (the catch-breath). */
function heartbeatSpeed(now, sev) {
  if (sev <= 0) return 1;
  return 1 + 1.6 * sev * (heartbeatEnv(now, sev) - 0.18);
}
/** Visual throb fed to the shader as u_pulse: positive spike per thump, grows with severity. */
function heartbeatPulse(now, sev) {
  if (sev <= 0) return 0;
  // Capped low so even at flatline it reads as a swell, not a strobe. Grows with severity but
  // saturates early (sqrt) so the extreme end isn't a flash.
  return Math.min(0.45, 0.75 * Math.sqrt(sev) * heartbeatEnv(now, sev));
}

/** @param {number} now */
function loop(now) {
  // Advance the heartbeat-warped flow clock every frame (continuous even as the plasma fades
  // in, and independent of whether we draw this frame).
  const dt = flowLast ? Math.min(0.05, (now - flowLast) / 1000) : 0;
  flowLast = now;
  flowTime += dt * heartbeatSpeed(now, cur.health.severity);
  // Health plasma (WebGL) — only when WebGL is available and health is degraded.
  if (gl && canvas) {
    const g = /** @type {WebGLRenderingContext} */ (gl);
    const c = /** @type {HTMLCanvasElement} */ (canvas);
    resize();
    g.clearColor(0, 0, 0, 0);
    g.clear(g.COLOR_BUFFER_BIT);
    if (cur.health.overlayOpacity > 0) {
      g.useProgram(program);
      const u = /** @type {NonNullable<typeof uniforms>} */ (uniforms);
      g.uniform2f(u.res, c.width, c.height);
      g.uniform1f(u.t, flowTime);
      g.uniform1f(u.hop, cur.health.overlayOpacity);
      g.uniform1f(u.pulse, heartbeatPulse(now, cur.health.severity));
      g.uniform1f(u.sev, cur.health.severity);
      g.drawArrays(g.TRIANGLES, 0, 3);
    }
  }
  // Deck chaos perturbs the real graph via Cytoscape (independent of WebGL).
  applyDeckPerturbation(now);
  raf = requestAnimationFrame(loop);
}

/** Inject the canvas + compile the program. Idempotent; safe no-op without DOM/WebGL. */
export function initGraphDegradation() {
  if (canvas) return; // already initialized
  const container = document.getElementById("graph-container");
  if (!container) return;
  containerEl = container; // for grid-backdrop glitches
  canvas = document.createElement("canvas");
  canvas.id = "graph-degradation-layer";
  Object.assign(canvas.style, {
    position: "absolute", inset: "0", width: "100%", height: "100%",
    pointerEvents: "none", zIndex: "5",
  });
  container.appendChild(canvas);
  gl = canvas.getContext("webgl", { premultipliedAlpha: false, alpha: true });
  if (gl) {
    const g = gl;
    g.enable(g.BLEND);
    g.blendFunc(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA);
    program = g.createProgram();
    if (program) {
      g.attachShader(program, compile(g.VERTEX_SHADER, VERT));
      g.attachShader(program, compile(g.FRAGMENT_SHADER, FRAG));
      g.linkProgram(program); g.useProgram(program);
      const buf = g.createBuffer();
      g.bindBuffer(g.ARRAY_BUFFER, buf);
      g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
      const loc = g.getAttribLocation(program, "p");
      g.enableVertexAttribArray(loc);
      g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
      uniforms = {
        res: g.getUniformLocation(program, "u_res"),
        t: g.getUniformLocation(program, "u_t"),
        hop: g.getUniformLocation(program, "u_hop"),
        pulse: g.getUniformLocation(program, "u_pulse"),
        sev: g.getUniformLocation(program, "u_sev"),
      };
    }
  } else {
    console.warn("graph-degradation: WebGL unavailable; health plasma disabled (deck chaos still runs)");
  }
  // Always run the loop: deck perturbation works through Cytoscape even without WebGL.
  raf = requestAnimationFrame(loop);
}

/** Pull the live pools from game state and apply params (plasma uniforms + #cy haze filter). */
export function updateFromState(state) {
  const p = degradationParams(state);
  cur = p;
  const filter = buildGraphFilterString(p.health);
  if (filter !== curFilter) {
    curFilter = filter;
    const cy = cyEl || (cyEl = document.getElementById("cy"));
    if (cy) cy.style.filter = filter;
  }
}

/**
 * Stop the rAF loop and reset module state (e.g. teardown). Removes the injected
 * canvas, restores any deck perturbation, and clears the cached GL handles so a
 * subsequent initGraphDegradation() re-initializes cleanly.
 */
export function stopGraphDegradation() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  const cy = getCy();
  if (cy && (basePos || pool.size)) restoreDeck(cy);
  if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
  gl = null; canvas = null; program = null; uniforms = null;
  // Reset the health CSS filter to the base bloom so the graph doesn't stay blurred/hue-shifted
  // after teardown, and clear the cached params/filter/DOM handle + flow clock so a subsequent
  // initGraphDegradation() starts from a clean (healthy) baseline.
  const cyDom = cyEl || document.getElementById("cy");
  if (cyDom) cyDom.style.filter = "url(#starnet-bloom)";
  curFilter = "url(#starnet-bloom)";
  cyEl = null;
  flowTime = 0; flowLast = 0;
  cur = { health: { severity: 0, overlayOpacity: 0 }, deck: { severity: 0 } };
}
