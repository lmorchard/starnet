// Lab A — standalone butterchurn aesthetic proof. Throwaway reference lab.
// butterchurn + presets from esm.sh (ESM build, matches the documented `import` API).
// The whole question: does the psychedelia, composited over the vector graph, read as
// intentional brain-damage (meat bleeding through) — or as garbage bolted on?
import butterchurn from "https://esm.sh/butterchurn@2.6.7";
import butterchurnPresets from "https://esm.sh/butterchurn-presets@2.4.7";

const $ = (id) => document.getElementById(id);
const canvas = $("bc");
const status = $("status");

// ---------------------------------------------------------------------------
// Audio graph. butterchurn needs an AudioContext + an input node (its analyser).
// butterchurn requires WebGL2 (unlike the game's WebGL1 health-plasma).
// ---------------------------------------------------------------------------
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const analyser = audioCtx.createAnalyser();

// Placeholder track -> analyser (visualized) AND -> destination (heard).
const trackEl = $("track");
const srcNode = audioCtx.createMediaElementSource(trackEl);
srcNode.connect(analyser);
srcNode.connect(audioCtx.destination);

// Synthetic-impulse bus -> analyser ONLY (not heard). The SHOCK button fires a
// bass impulse into this so a "hit" punches the visuals without a click in playback.
// This mirrors the mechanism Lab B uses against real damage events.
const shockBus = audioCtx.createGain();
shockBus.connect(analyser);

// ---------------------------------------------------------------------------
// Visualizer + presets.
// ---------------------------------------------------------------------------
const viz = butterchurn.createVisualizer(audioCtx, canvas, {
  width: canvas.clientWidth,
  height: canvas.clientHeight,
});
viz.connectAudio(analyser);

const presets = butterchurnPresets.getPresets();
const names = Object.keys(presets);
const presetSel = $("preset");
for (const n of names) {
  const opt = document.createElement("option");
  opt.value = n;
  opt.textContent = n;
  presetSel.appendChild(opt);
}
function loadPresetByName(name, blend = 2.0) {
  viz.loadPreset(presets[name], blend);
}
// Prefer an organic/liquid preset if the pack has one; else the first.
const initial = names.find((n) => /flexi|geiss|martin|aderrasi|organic/i.test(n)) || names[0];
presetSel.value = initial;
loadPresetByName(initial, 0.0);
presetSel.addEventListener("change", () => loadPresetByName(presetSel.value));

function sizeCanvas() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w; canvas.height = h;
  viz.setRendererSize(w, h);
}
window.addEventListener("resize", sizeCanvas);
sizeCanvas();

function renderLoop() {
  viz.render();
  requestAnimationFrame(renderLoop);
}
requestAnimationFrame(renderLoop);

// ---------------------------------------------------------------------------
// Compositing: mix-blend-mode + opacity. screen/lighten/color-dodge drop black,
// so only bright psychedelia shows over the vector UI; overlay/normal are heavier.
// ---------------------------------------------------------------------------
const blendSel = $("blend");
const opacityRange = $("opacity");
const severityRange = $("severity");
const opacityVal = $("opacityVal");
const severityVal = $("severityVal");

let baseOpacity = 0;   // ambient bed floor set by the slider
let severity = 0;      // accumulated-damage bed (0..1) -> added opacity

blendSel.addEventListener("change", () => { canvas.style.mixBlendMode = blendSel.value; });
opacityRange.addEventListener("input", () => {
  baseOpacity = +opacityRange.value;
  opacityVal.textContent = baseOpacity.toFixed(2);
});
severityRange.addEventListener("input", () => {
  severity = +severityRange.value;
  severityVal.textContent = severity.toFixed(2);
});
canvas.style.mixBlendMode = blendSel.value;

// ---------------------------------------------------------------------------
// Shock flare: a transient opacity spike + a synthetic bass impulse into the
// analyser (so butterchurn itself warps). Decays over ~SHOCK_MS. These constants
// get tuned by feel with Les at the checkpoint.
// ---------------------------------------------------------------------------
const SHOCK_MS = 900;
const FLARE_GAIN = 0.6;
const SEVERITY_WEIGHT = 0.7;
let shockStart = -Infinity;

function shockEnv(now) {
  const t = (now - shockStart) / SHOCK_MS;
  if (t < 0 || t > 1) return 0;
  return Math.pow(1 - t, 2); // fast attack, quadratic decay
}

function currentOpacity() {
  const flare = FLARE_GAIN * shockEnv(performance.now());
  return Math.min(1, baseOpacity + SEVERITY_WEIGHT * severity + flare);
}

// Opacity is time-varying (shock decays), so drive it every frame.
(function opacityLoop() {
  canvas.style.opacity = String(currentOpacity());
  requestAnimationFrame(opacityLoop);
})();

function fireShockImpulse() {
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.25);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(1.0, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
  osc.connect(g); g.connect(shockBus);
  osc.start(now); osc.stop(now + 0.42);
}

$("shock").addEventListener("click", () => {
  shockStart = performance.now();
  fireShockImpulse();
});

// ---------------------------------------------------------------------------
// Audio needs a user gesture to start.
// ---------------------------------------------------------------------------
$("audio").addEventListener("click", async () => {
  await audioCtx.resume();
  await trackEl.play();
  status.textContent = `audio playing · ${names.length} presets · WebGL2=${!!canvas.getContext}`;
});

// Exposed for devtools poking / Lab B reuse.
export { audioCtx, analyser, shockBus, viz, loadPresetByName };
