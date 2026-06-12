// @ts-check
// Health-plasma: a transparent WebGL canvas injected over #graph-container drawing a
// kaleidoscopic "liquid light show" plasma whose density/heartbeat scale with health
// damage. Decoupled from Cytoscape — it never reads graph pixels and is a no-op without
// WebGL. Owns its own GL handles and heartbeat-warped flow clock; the degradation wiring
// drives it once per frame via drawHealthPlasma(now, health). Split out of
// graph-degradation.js per issue #166.

let gl = null, canvas = null, program = null;
let uniforms = null;
let flowTime = 0;          // heartbeat-warped flow clock fed to the plasma shader (u_t)
let flowLast = 0;          // previous loop timestamp, for dt

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

/**
 * Inject the canvas + compile the program. Idempotent; safe no-op without DOM/WebGL.
 * Logs a warning and runs degraded (deck chaos still works) if WebGL is unavailable.
 * @param {HTMLElement} container the #graph-container to mount the canvas in
 */
export function initHealthPlasma(container) {
  if (canvas) return; // already initialized
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
}

/**
 * Advance the heartbeat-warped flow clock and render one plasma frame. The clock advances
 * every call (continuous even as the plasma fades in, and even without WebGL); rendering
 * only happens when WebGL is available and the overlay is visible.
 * @param {number} now rAF timestamp (ms)
 * @param {{ severity: number, overlayOpacity: number }} health
 */
export function drawHealthPlasma(now, health) {
  const dt = flowLast ? Math.min(0.05, (now - flowLast) / 1000) : 0;
  flowLast = now;
  flowTime += dt * heartbeatSpeed(now, health.severity);
  if (!gl || !canvas) return;
  const g = /** @type {WebGLRenderingContext} */ (gl);
  const c = /** @type {HTMLCanvasElement} */ (canvas);
  resize();
  g.clearColor(0, 0, 0, 0);
  g.clear(g.COLOR_BUFFER_BIT);
  if (health.overlayOpacity > 0) {
    g.useProgram(program);
    const u = /** @type {NonNullable<typeof uniforms>} */ (uniforms);
    g.uniform2f(u.res, c.width, c.height);
    g.uniform1f(u.t, flowTime);
    g.uniform1f(u.hop, health.overlayOpacity);
    g.uniform1f(u.pulse, heartbeatPulse(now, health.severity));
    g.uniform1f(u.sev, health.severity);
    g.drawArrays(g.TRIANGLES, 0, 3);
  }
}

/**
 * Remove the injected canvas and clear the cached GL handles + flow clock so a subsequent
 * initHealthPlasma() re-initializes cleanly.
 */
export function stopHealthPlasma() {
  if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
  gl = null; canvas = null; program = null; uniforms = null;
  flowTime = 0; flowLast = 0;
}
